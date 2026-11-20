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
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? DEFAULT_GEMINI_TIMEOUT_MS),
  },
} as const;

export const isAiConfigured = (): boolean => config.gemini.apiKey.length > 0;
