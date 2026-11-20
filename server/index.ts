import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config, isAiConfigured } from './config';
import { HttpError, errorHandler } from './http';
import { eventsRouter } from './routes/events';
import { studentsRouter } from './routes/students';
import { UPLOAD_DIR, systemRouter } from './routes/system';

/** Image uploads arrive as base64 JSON, so allow a bit more than the 3 MB image cap. */
const JSON_BODY_LIMIT = '5mb';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use('/uploads', express.static(UPLOAD_DIR(), { maxAge: '7d' }));
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

createApp().listen(config.port, () => {
  console.log(`OwlMatch API on http://localhost:${config.port}`);
  console.log(isAiConfigured() ? `Gemini enabled (${config.gemini.model})` : 'Gemini not configured: using rule-based fallback');
});
