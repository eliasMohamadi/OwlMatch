import type { NextFunction, Request, Response } from 'express';
import type { Database, Student } from '../../shared/types';
import { HttpError } from '../http';
import { readSession, type Session } from './session';

/**
 * Every request acts as exactly one student, decided here and never by ids in
 * the request body or query:
 *  - a signed-in student always acts as themselves;
 *  - a signed-in admin picks a demo student per request with this header
 *    (the web client sends the tab's `?as=` choice). Admins can never act as
 *    real (Microsoft) students.
 */
export const ACT_AS_HEADER = 'x-owlmatch-as';

export function requireSession(req: Request): Session {
  const session = readSession(req);
  if (!session) throw new HttpError(401, 'Please sign in');
  return session;
}

/** Express middleware: rejects requests without a valid session. */
export function requireSignedIn(req: Request, _res: Response, next: NextFunction): void {
  try {
    requireSession(req);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req: Request): void {
  if (requireSession(req).role !== 'admin') throw new HttpError(403, 'Admins only');
}

export const isDemoStudent = (student: Student) => student.account.type === 'demo';

export function resolveActor(req: Request, db: Readonly<Database>): Student {
  const session = requireSession(req);
  if (session.role === 'student') {
    const student = db.students.find((s) => s.id === session.studentId);
    if (!student) throw new HttpError(401, 'Your account was not found. Please sign in again.');
    return student;
  }
  const actingAs = req.header(ACT_AS_HEADER);
  if (!actingAs) throw new HttpError(400, 'Choose a demo student to act as');
  const student = db.students.find((s) => s.id === actingAs);
  if (!student) throw new HttpError(404, 'Student not found');
  if (!isDemoStudent(student)) throw new HttpError(403, 'Admins can only act as demo students');
  return student;
}
