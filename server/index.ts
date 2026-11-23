import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config, isAdminConfigured, isAiConfigured, isMicrosoftConfigured } from './config';
import { assertSessionConfig } from './auth/session';
import { HttpError, errorHandler } from './http';
import { authRouter } from './routes/auth';
import { eventsRouter } from './routes/events';
import { studentsRouter } from './routes/students';
import { systemRouter } from './routes/system';
import { UPLOAD_DIR, pruneOrphanUploads } from './services/uploads';
import { read } from './store/db';

/** Image uploads arrive as base64 JSON, so allow a bit more than the 3 MB image cap. */
const JSON_BODY_LIMIT = '5mb';
const UPLOAD_SWEEP_MS = 60 * 60 * 1000;

export function createApp() {
  const app = express();
  // Behind a reverse proxy in production, this makes req.ip the client address for the admin rate limit.
  if (config.isProduction) app.set('trust proxy', 1);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use('/uploads', express.static(UPLOAD_DIR(), { maxAge: '7d' }));
  app.use('/api/auth', authRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api', systemRouter);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  const dist = path.join(config.root, 'dist');
  if (config.isProduction && existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}

assertSessionConfig();
if (config.isProduction && isAdminConfigured() && config.auth.adminPassword.length < 12) {
  throw new Error('ADMIN_PASSWORD must be at least 12 characters in production');
}

const sweepUploads = () => {
  const removed = pruneOrphanUploads(read());
  if (removed > 0) console.log(`[uploads] removed ${removed} unused image(s)`);
};
sweepUploads();
setInterval(sweepUploads, UPLOAD_SWEEP_MS).unref();

createApp().listen(config.port, () => {
  console.log(`OwlMatch API on http://localhost:${config.port}`);
  console.log(isAiConfigured() ? `Gemini enabled (${config.gemini.model})` : 'Gemini not configured: using rule-based fallback');
  console.log(
    isMicrosoftConfigured()
      ? `Microsoft sign-in enabled for ${config.auth.allowedEmailDomains.join(', ')} (redirect: ${config.auth.appBaseUrl}/api/auth/microsoft/callback)`
      : 'Microsoft sign-in not configured (set ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET)',
  );
  console.log(isAdminConfigured() ? 'Admin sign-in enabled' : 'Admin sign-in disabled (set ADMIN_PASSWORD)');
});
