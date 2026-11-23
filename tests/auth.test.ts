import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { ACT_AS_HEADER, resolveActor } from '../server/auth/actor';
import { IdTokenError, isAllowedEmail, verifyIdToken } from '../server/auth/entra';
import { SESSION_COOKIE, seal, unseal } from '../server/auth/session';
import { upsertMicrosoftStudent } from '../server/services/accounts';
import { createSeedDatabase } from '../server/store/seed';

const TENANT = '11111111-2222-3333-4444-555555555555';
const OTHER_TENANT = '99999999-8888-7777-6666-555555555555';
const CLIENT = 'client-abc';
const NOW = Date.parse('2026-11-20T15:00:00Z');
const NOW_S = Math.floor(NOW / 1000);

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: attackerKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

function token(claims: Record<string, unknown>, { key = privateKey, header = { alg: 'RS256', kid: 'k1' } }: { key?: KeyObject; header?: object } = {}) {
  const data = `${b64(header)}.${b64(claims)}`;
  const signature = createSign('RSA-SHA256').update(data).sign(key).toString('base64url');
  return `${data}.${signature}`;
}

const validClaims = {
  iss: `https://login.microsoftonline.com/${TENANT}/v2.0`,
  aud: CLIENT,
  tid: TENANT,
  oid: 'oid-1',
  exp: NOW_S + 3600,
  nbf: NOW_S - 10,
  nonce: 'n-1',
  name: 'Jamie Doe',
  preferred_username: 'JDoe@students.kennesaw.edu',
};

const verifyOpts = { nonce: 'n-1', tenantId: TENANT, clientId: CLIENT, now: NOW, getKey: async (kid: string) => (kid === 'k1' ? publicKey : null) };

describe('ID token verification', () => {
  it('accepts a valid token and returns the lowercased university email', async () => {
    await expect(verifyIdToken(token(validClaims), verifyOpts)).resolves.toEqual({
      tenantId: TENANT,
      objectId: 'oid-1',
      email: 'jdoe@students.kennesaw.edu',
      name: 'Jamie Doe',
    });
  });

  it.each([
    ['another tenant claiming a KSU email', { iss: `https://login.microsoftonline.com/${OTHER_TENANT}/v2.0`, tid: OTHER_TENANT }],
    ['a matching issuer but different tid', { tid: OTHER_TENANT }],
    ['a token for another app', { aud: 'someone-else' }],
    ['an expired token', { exp: NOW_S - 3600 }],
    ['a replayed nonce', { nonce: 'other' }],
    ['a token without an object id', { oid: undefined }],
  ])('rejects %s', async (_label, overrides) => {
    await expect(verifyIdToken(token({ ...validClaims, ...overrides }), verifyOpts)).rejects.toBeInstanceOf(IdTokenError);
  });

  it('rejects a token signed by someone else', async () => {
    await expect(verifyIdToken(token(validClaims, { key: attackerKey }), verifyOpts)).rejects.toThrow('bad signature');
  });

  it('rejects unsigned and unknown-key tokens', async () => {
    const unsigned = `${b64({ alg: 'none' })}.${b64(validClaims)}.`;
    await expect(verifyIdToken(unsigned, verifyOpts)).rejects.toThrow('unexpected signing algorithm');
    await expect(verifyIdToken(token(validClaims, { header: { alg: 'RS256', kid: 'k2' } }), verifyOpts)).rejects.toThrow('unknown signing key');
  });
});

describe('email domain allow-list', () => {
  const domains = ['students.kennesaw.edu', 'kennesaw.edu'];
  it.each([
    ['jdoe@students.kennesaw.edu', true],
    ['prof@kennesaw.edu', true],
    ['JDOE@STUDENTS.KENNESAW.EDU', true],
    ['someone@gmail.com', false],
    ['x@kennesaw.edu.evil.com', false],
    ['x@evilkennesaw.edu', false],
    ['x@sub.students.kennesaw.edu', false],
    ['not-an-email', false],
  ])('%s → %s', (email, allowed) => {
    expect(isAllowedEmail(email, domains)).toBe(allowed);
  });
});

describe('session cookies', () => {
  it('round-trips and rejects tampering and expiry', () => {
    const value = seal({ role: 'student', studentId: 'stu-1', exp: NOW + 1000 });
    expect(unseal(value, NOW)).toMatchObject({ studentId: 'stu-1' });
    expect(unseal(value, NOW + 2000)).toBeNull();
    const [data, sig] = value.split('.');
    const forged = Buffer.from(JSON.stringify({ role: 'admin', exp: NOW + 1000 })).toString('base64url');
    expect(unseal(`${forged}.${sig}`, NOW)).toBeNull();
    expect(unseal(`${data}.${sig}x`, NOW)).toBeNull();
    expect(unseal(undefined, NOW)).toBeNull();
  });
});

describe('Microsoft accounts', () => {
  const identity = { tenantId: TENANT, objectId: 'oid-1', email: 'jdoe@students.kennesaw.edu', name: 'Jamie Doe' };

  it('creates a new, not-yet-onboarded student once, then reuses it by object id', () => {
    const db = createSeedDatabase(new Date(NOW));
    const first = upsertMicrosoftStudent(db, identity, new Date(NOW));
    expect(first).toMatchObject({ onboarded: false, name: 'Jamie Doe', account: { type: 'microsoft', email: identity.email } });
    const again = upsertMicrosoftStudent(db, { ...identity, email: 'renamed@students.kennesaw.edu', name: 'Jamie D.' }, new Date(NOW + 1));
    expect(again.id).toBe(first.id);
    expect(again.name).toBe('Jamie D.');
    expect(db.students.filter((s) => s.account.type === 'microsoft')).toHaveLength(1);
  });
});

describe('acting student', () => {
  const db = createSeedDatabase(new Date(NOW));
  const real = upsertMicrosoftStudent(db, { tenantId: TENANT, objectId: 'oid-9', email: 'a@students.kennesaw.edu', name: 'A' }, new Date(NOW));

  const req = (session: object | null, actAs?: string) =>
    ({
      headers: { cookie: session ? `${SESSION_COOKIE}=${encodeURIComponent(seal(session))}` : '' },
      header: (name: string) => (name.toLowerCase() === ACT_AS_HEADER ? actAs : undefined),
    }) as unknown as Request;

  const future = Date.now() + 60_000;

  it('requires a session', () => {
    expect(() => resolveActor(req(null), db)).toThrow(expect.objectContaining({ status: 401 }));
  });

  it('makes a student act as themselves, ignoring any act-as header', () => {
    expect(resolveActor(req({ role: 'student', studentId: real.id, exp: future }, 'stu-jordan'), db).id).toBe(real.id);
  });

  it('lets an admin act as a demo student but never as a real student', () => {
    const admin = { role: 'admin', exp: future };
    expect(resolveActor(req(admin, 'stu-maya'), db).id).toBe('stu-maya');
    expect(() => resolveActor(req(admin, real.id), db)).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => resolveActor(req(admin), db)).toThrow(expect.objectContaining({ status: 400 }));
  });
});
