import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import type { HealthResponse } from '../../shared/types';
import { config, isAiConfigured } from '../config';
import { currentModel } from '../ai/gemini';
import { HttpError, parseBody, route } from '../http';
import { resetToSeed } from '../store/db';

export const systemRouter = Router();

systemRouter.get(
  '/health',
  route((): HealthResponse => ({ ok: true, ai: { configured: isAiConfigured(), model: currentModel() }, storage: 'json-file' })),
);

/** Restores the demo dataset so the judged demo is reproducible. */
systemRouter.post(
  '/demo/reset',
  route(() => {
    resetToSeed();
    return { ok: true };
  }),
);

export const UPLOAD_DIR = () => path.join(config.dataDir, 'uploads');
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const uploadSchema = z.object({ dataUrl: z.string().max(Math.ceil(MAX_UPLOAD_BYTES * 1.4)) });

/** Cover image upload. Validates type and size from the decoded bytes, stores locally. */
systemRouter.post(
  '/uploads',
  route((req) => {
    const { dataUrl } = parseBody(uploadSchema, req.body);
    const match = dataUrl.match(/^data:([\w/+-]+);base64,(.+)$/);
    if (!match) throw new HttpError(400, 'Expected a base64 image');
    const [, mime, base64] = match;
    const extension = ALLOWED_TYPES[mime];
    if (!extension) throw new HttpError(415, 'Use a JPEG, PNG or WebP image');
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length > MAX_UPLOAD_BYTES) throw new HttpError(413, 'Image must be under 3 MB');
    mkdirSync(UPLOAD_DIR(), { recursive: true });
    const fileName = `${randomUUID()}.${extension}`;
    writeFileSync(path.join(UPLOAD_DIR(), fileName), bytes);
    return { url: `/uploads/${fileName}` };
  }),
);
