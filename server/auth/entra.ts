import { createHash, createPublicKey, randomBytes, verify, type JsonWebKey, type KeyObject } from 'node:crypto';
import { config } from '../config';

/**
 * Microsoft Entra ID (school account) sign-in with the OpenID Connect
 * authorization-code flow and PKCE. Microsoft runs the password and the
 * Microsoft Authenticator approval under the university's MFA policy; OwlMatch
 * never sees either. We verify the returned ID token ourselves:
 *  - RS256 signature against Microsoft's published keys for the tenant,
 *  - issuer and `tid` equal to the pinned university tenant (a user from any
 *    other tenant could otherwise claim a KSU email address),
 *  - audience, expiry and the nonce we generated for this sign-in.
 */

const LOGIN = 'https://login.microsoftonline.com';
const CLOCK_SKEW_S = 300;
const KEY_CACHE_MS = 24 * 60 * 60 * 1000;

export const redirectUri = () => `${config.auth.appBaseUrl}/api/auth/microsoft/callback`;
const tenant = () => config.auth.entra.tenantId;

export interface OidcTransaction {
  state: string;
  nonce: string;
  verifier: string;
  exp: number;
}

const random = () => randomBytes(32).toString('base64url');

export function newTransaction(now = Date.now(), ttlMs: number): OidcTransaction {
  return { state: random(), nonce: random(), verifier: random(), exp: now + ttlMs };
}

export function authorizeUrl(tx: OidcTransaction): string {
  const params = new URLSearchParams({
    client_id: config.auth.entra.clientId,
    response_type: 'code',
    response_mode: 'query',
    redirect_uri: redirectUri(),
    scope: 'openid profile email',
    state: tx.state,
    nonce: tx.nonce,
    code_challenge: createHash('sha256').update(tx.verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${LOGIN}/${tenant()}/oauth2/v2.0/authorize?${params}`;
}

/** Exchanges the authorization code for tokens (server to server, authenticated with the client secret). */
export async function exchangeCode(code: string, verifier: string): Promise<string> {
  const response = await fetch(`${LOGIN}/${tenant()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.auth.entra.clientId,
      client_secret: config.auth.entra.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
      scope: 'openid profile email',
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string };
  if (!response.ok || !body.id_token) throw new Error(`token exchange failed: ${body.error ?? response.status}`);
  return body.id_token;
}

type KeyLookup = (kid: string) => Promise<KeyObject | null>;

let keyCache: { at: number; keys: Map<string, KeyObject> } | null = null;

async function fetchKeys(): Promise<Map<string, KeyObject>> {
  const response = await fetch(`${LOGIN}/${tenant()}/discovery/v2.0/keys`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`could not load Microsoft signing keys (${response.status})`);
  const { keys = [] } = (await response.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
  const map = new Map<string, KeyObject>();
  for (const jwk of keys) {
    if (jwk.kty === 'RSA' && jwk.kid) map.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
  }
  return map;
}

/** Microsoft rotates keys, so an unknown key id triggers one refresh before failing. */
const microsoftKey: KeyLookup = async (kid) => {
  if (!keyCache || Date.now() - keyCache.at > KEY_CACHE_MS || !keyCache.keys.has(kid)) {
    keyCache = { at: Date.now(), keys: await fetchKeys() };
  }
  return keyCache.keys.get(kid) ?? null;
};

export interface MicrosoftIdentity {
  tenantId: string;
  objectId: string;
  email: string;
  name: string;
}

export class IdTokenError extends Error {}

interface IdTokenClaims {
  iss?: string;
  aud?: string;
  tid?: string;
  oid?: string;
  exp?: number;
  nbf?: number;
  nonce?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
}

export interface VerifyOptions {
  nonce: string;
  tenantId?: string;
  clientId?: string;
  now?: number;
  getKey?: KeyLookup;
}

export async function verifyIdToken(token: string, options: VerifyOptions): Promise<MicrosoftIdentity> {
  const { nonce, tenantId = tenant(), clientId = config.auth.entra.clientId, now = Date.now(), getKey = microsoftKey } = options;
  const parts = token.split('.');
  if (parts.length !== 3) throw new IdTokenError('malformed token');
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; kid?: string };
  let claims: IdTokenClaims;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw new IdTokenError('malformed token');
  }
  if (header.alg !== 'RS256' || !header.kid) throw new IdTokenError('unexpected signing algorithm');

  const key = await getKey(header.kid);
  if (!key) throw new IdTokenError('unknown signing key');
  const valid = verify('RSA-SHA256', Buffer.from(`${headerB64}.${payloadB64}`), key, Buffer.from(signatureB64, 'base64url'));
  if (!valid) throw new IdTokenError('bad signature');

  const nowS = Math.floor(now / 1000);
  if (claims.iss !== `${LOGIN}/${tenantId}/v2.0`) throw new IdTokenError('wrong issuer');
  if (claims.tid?.toLowerCase() !== tenantId) throw new IdTokenError('wrong tenant');
  if (claims.aud !== clientId) throw new IdTokenError('wrong audience');
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < nowS) throw new IdTokenError('token expired');
  if (typeof claims.nbf === 'number' && claims.nbf - CLOCK_SKEW_S > nowS) throw new IdTokenError('token not yet valid');
  if (claims.nonce !== nonce) throw new IdTokenError('nonce mismatch');
  if (!claims.oid) throw new IdTokenError('missing object id');

  // Within the pinned tenant, preferred_username is the institution-managed sign-in name (e.g. jdoe@students.kennesaw.edu).
  const email = (claims.preferred_username ?? claims.email ?? '').trim().toLowerCase();
  if (!email.includes('@')) throw new IdTokenError('missing email');
  return { tenantId, objectId: claims.oid, email, name: claims.name?.trim() || email.split('@')[0] };
}

/** Exact domain match only: "x@students.kennesaw.edu" passes, "x@kennesaw.edu.evil.com" does not. */
export function isAllowedEmail(email: string, domains: readonly string[] = config.auth.allowedEmailDomains): boolean {
  const at = email.lastIndexOf('@');
  if (at <= 0) return false;
  return domains.includes(email.slice(at + 1).toLowerCase());
}
