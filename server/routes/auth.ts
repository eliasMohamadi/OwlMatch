import { createHash, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AuthState } from '../../shared/types';
import { config, isAdminConfigured, isMicrosoftConfigured } from '../config';
import { authorizeUrl, exchangeCode, isAllowedEmail, newTransaction, verifyIdToken, type OidcTransaction } from '../auth/entra';
import {
  OIDC_COOKIE,
  OIDC_TRANSACTION_MS,
  SESSION_COOKIE,
  clearCookie,
  readCookie,
  readSession,
  seal,
  setCookie,
  startAdminSession,
  startStudentSession,
  unseal,
} from '../auth/session';
import { HttpError, parseBody, route } from '../http';
import { upsertMicrosoftStudent } from '../services/accounts';
import { mutate, read } from '../store/db';

export const authRouter = Router();

const OIDC_COOKIE_PATH = '/api/auth/microsoft';

authRouter.get(
  '/me',
  route((req, res): AuthState => {
    const session = readSession(req);
    if (!session) return { signedIn: false };
    if (session.role === 'admin') return { signedIn: true, role: 'admin' };
    const student = read().students.find((s) => s.id === session.studentId);
    if (!student || student.account.type !== 'microsoft') {
      clearCookie(res, SESSION_COOKIE);
      return { signedIn: false };
    }
    return { signedIn: true, role: 'student', studentId: student.id, email: student.account.email };
  }),
);

/** Sends the browser back to the app with a short error code the sign-in page explains. */
const backToApp = (res: Response, error?: string) =>
  res.redirect(303, `${config.auth.appBaseUrl}/${error ? `?auth_error=${encodeURIComponent(error)}` : ''}`);

authRouter.get('/microsoft/start', (_req, res) => {
  if (!isMicrosoftConfigured()) return backToApp(res, 'not-configured');
  const tx = newTransaction(Date.now(), OIDC_TRANSACTION_MS);
  setCookie(res, OIDC_COOKIE, seal(tx), OIDC_TRANSACTION_MS, OIDC_COOKIE_PATH);
  res.redirect(303, authorizeUrl(tx));
});

authRouter.get('/microsoft/callback', async (req: Request, res: Response) => {
  const tx = unseal<OidcTransaction>(readCookie(req, OIDC_COOKIE));
  clearCookie(res, OIDC_COOKIE, OIDC_COOKIE_PATH);
  const { code, state, error } = req.query;

  if (typeof error === 'string') return backToApp(res, error === 'access_denied' ? 'cancelled' : 'failed');
  if (!isMicrosoftConfigured()) return backToApp(res, 'not-configured');
  if (!tx || typeof state !== 'string' || state !== tx.state || typeof code !== 'string') return backToApp(res, 'expired');

  try {
    const identity = await verifyIdToken(await exchangeCode(code, tx.verifier), { nonce: tx.nonce });
    if (!isAllowedEmail(identity.email)) return backToApp(res, 'domain');
    const student = mutate((db) => upsertMicrosoftStudent(db, identity, new Date()));
    startStudentSession(res, student.id);
    return backToApp(res);
  } catch (err) {
    console.warn('[auth] Microsoft sign-in failed:', err instanceof Error ? err.message : err);
    return backToApp(res, 'failed');
  }
});

/** Brute-force guard for the admin password: a few failures per client, then a cool-down. */
const ADMIN_MAX_FAILURES = 5;
const ADMIN_LOCKOUT_MS = 15 * 60 * 1000;
const adminFailures = new Map<string, { count: number; first: number }>();

function checkAdminRateLimit(key: string, now: number): void {
  const entry = adminFailures.get(key);
  if (entry && now - entry.first > ADMIN_LOCKOUT_MS) adminFailures.delete(key);
  else if (entry && entry.count >= ADMIN_MAX_FAILURES) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
}

function recordAdminFailure(key: string, now: number): void {
  const entry = adminFailures.get(key);
  adminFailures.set(key, entry ? { ...entry, count: entry.count + 1 } : { count: 1, first: now });
}

const digest = (value: string) => createHash('sha256').update(value).digest();
const passwordMatches = (given: string) => timingSafeEqual(digest(given), digest(config.auth.adminPassword));

authRouter.post(
  '/admin',
  route((req, res) => {
    if (!isAdminConfigured()) throw new HttpError(404, 'Admin sign-in is not enabled on this server');
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    checkAdminRateLimit(key, now);
    const { password } = parseBody(z.object({ password: z.string().max(200) }), req.body);
    if (!passwordMatches(password)) {
      recordAdminFailure(key, now);
      throw new HttpError(401, 'Wrong admin password');
    }
    adminFailures.delete(key);
    startAdminSession(res);
    return { signedIn: true, role: 'admin' } satisfies AuthState;
  }),
);

authRouter.post(
  '/signout',
  route((_req, res) => {
    clearCookie(res, SESSION_COOKIE);
    return { ok: true };
  }),
);
