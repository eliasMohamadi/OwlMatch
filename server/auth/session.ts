import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { config } from '../config';

/**
 * Signed, HttpOnly cookies. The payload is readable base64url JSON plus an
 * HMAC-SHA256 signature, so the server needs no session table and a tampered
 * or expired cookie is simply treated as signed out.
 */

export const SESSION_COOKIE = 'owlmatch_session';
export const OIDC_COOKIE = 'owlmatch_oidc';

const STUDENT_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
export const OIDC_TRANSACTION_MS = 10 * 60 * 1000;

export type Session = { role: 'student'; studentId: string; exp: number } | { role: 'admin'; exp: number };

/** Only a development server may run without SESSION_SECRET; its sessions end when it restarts. */
let devSecret: string | null = null;
function secret(): string {
  if (config.auth.sessionSecret) return config.auth.sessionSecret;
  if (config.isProduction) throw new Error('SESSION_SECRET must be set in production');
  devSecret ??= randomBytes(32).toString('hex');
  return devSecret;
}

export function assertSessionConfig(): void {
  if (config.isProduction && config.auth.sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be set to at least 32 characters in production');
  }
  if (!config.auth.sessionSecret) console.warn('[auth] SESSION_SECRET not set: using a temporary secret (sign-ins end on restart)');
}

const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url');

export function seal(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

/** Returns the payload if the signature is valid and `exp` is in the future, otherwise null. */
export function unseal<T extends { exp: number }>(value: string | undefined, now = Date.now()): T | null {
  if (!value) return null;
  const [data, signature, extra] = value.split('.');
  if (!data || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as T;
    return typeof payload.exp === 'number' && payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

const secureCookies = () => config.isProduction || config.auth.appBaseUrl.startsWith('https://');

export function setCookie(res: Response, name: string, value: string, maxAgeMs: number, path = '/'): void {
  res.cookie(name, value, { httpOnly: true, sameSite: 'lax', secure: secureCookies(), maxAge: maxAgeMs, path });
}

export function clearCookie(res: Response, name: string, path = '/'): void {
  res.clearCookie(name, { httpOnly: true, sameSite: 'lax', secure: secureCookies(), path });
}

export function readSession(req: Request): Session | null {
  const session = unseal<Session>(readCookie(req, SESSION_COOKIE));
  if (!session) return null;
  if (session.role === 'admin' || (session.role === 'student' && typeof session.studentId === 'string')) return session;
  return null;
}

export function startStudentSession(res: Response, studentId: string, now = Date.now()): void {
  setCookie(res, SESSION_COOKIE, seal({ role: 'student', studentId, exp: now + STUDENT_SESSION_MS }), STUDENT_SESSION_MS);
}

export function startAdminSession(res: Response, now = Date.now()): void {
  setCookie(res, SESSION_COOKIE, seal({ role: 'admin', exp: now + ADMIN_SESSION_MS }), ADMIN_SESSION_MS);
}
