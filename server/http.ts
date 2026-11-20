import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import type { Database, Student } from '../shared/types';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Wraps async handlers so thrown errors reach the error middleware. */
export const route =
  (handler: (req: Request, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res))
      .then((body) => {
        if (!res.headersSent) res.json(body);
      })
      .catch(next);
  };

export function parseBody<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, 'Invalid request', parsed.error.flatten());
  return parsed.data;
}

export function requireStudent(db: Readonly<Database>, id: unknown): Student {
  const student = db.students.find((s) => s.id === id);
  if (!student) throw new HttpError(404, 'Student not found');
  return student;
}

export function requireEvent(db: Readonly<Database>, id: unknown) {
  const event = db.events.find((e) => e.id === id && e.status === 'active');
  if (!event) throw new HttpError(404, 'Event not found');
  return event;
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, details: error.details });
    return;
  }
  console.error('[server] unexpected error', error);
  res.status(500).json({ error: 'Something went wrong on our side.' });
}
