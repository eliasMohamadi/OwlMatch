import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Minimal .env loader so the server needs no extra dependency. Real env vars win. */
function loadDotEnv(file: string): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] === undefined) process.env[key] = raw.replace(/^["']|["']$/g, '');
  }
}

const ROOT = path.resolve(import.meta.dirname, '..');
loadDotEnv(path.join(ROOT, '.env'));

const DEFAULT_PORT = 8787;
/** Measured live: ~9 s per ranking call with low thinking; 25 s leaves headroom on slow Wi-Fi. */
const DEFAULT_GEMINI_TIMEOUT_MS = 25000;

export const config = {
  root: ROOT,
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  isProduction: process.env.NODE_ENV === 'production',
  dataDir: process.env.OWLMATCH_DATA_DIR ?? path.join(ROOT, 'server', 'data'),
  /** Off by default: real data only. The e2e and screenshot fixtures set OWLMATCH_SAMPLE_EVENTS=1. */
  sampleEvents: process.env.OWLMATCH_SAMPLE_EVENTS === '1',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? DEFAULT_GEMINI_TIMEOUT_MS),
  },
  auth: {
    /** Public origin the browser uses (the Vite dev server in development). Microsoft redirects back here. */
    appBaseUrl: (process.env.APP_BASE_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
    /** Signs session cookies. Required in production; development falls back to a per-process random secret. */
    sessionSecret: process.env.SESSION_SECRET ?? '',
    /** Enables the admin sign-in that can act as demo students. Empty disables it. */
    adminPassword: process.env.ADMIN_PASSWORD ?? '',
    /** Only these email domains can sign in with Microsoft (exact match, lowercase). */
    allowedEmailDomains: (process.env.ALLOWED_EMAIL_DOMAINS ?? 'students.kennesaw.edu,kennesaw.edu')
      .split(',')
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean),
    entra: {
      /** The university's Entra tenant id (a GUID). Pinning it stops other tenants from claiming a KSU email. */
      tenantId: (process.env.ENTRA_TENANT_ID ?? '').trim().toLowerCase(),
      clientId: (process.env.ENTRA_CLIENT_ID ?? '').trim(),
      clientSecret: process.env.ENTRA_CLIENT_SECRET ?? '',
    },
  },
  /** The data reset is admin-only; in production it also needs this explicit opt-in. */
  allowReset: process.env.OWLMATCH_ALLOW_RESET === '1',
} as const;

export const isAiConfigured = (): boolean => config.gemini.apiKey.length > 0;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Microsoft sign-in needs an app registration and a specific tenant GUID (not "common" or "organizations"). */
export const isMicrosoftConfigured = (): boolean => {
  const { tenantId, clientId, clientSecret } = config.auth.entra;
  return GUID.test(tenantId) && clientId.length > 0 && clientSecret.length > 0;
};

export const isAdminConfigured = (): boolean => config.auth.adminPassword.length > 0;
