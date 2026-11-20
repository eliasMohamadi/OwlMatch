import { Router } from 'express';
import { z } from 'zod';
import { discoverFiltersSchema, interestIdSchema, onboardingInputSchema } from '../../shared/schemas';
import type { MatchesResponse } from '../../shared/types';
import { askConcierge } from '../ai/concierge';
import { understandStudent } from '../ai/profile';
import { compareRankings, recommend } from '../ai/recommend';
import { toEventView, toStudentSummary } from '../services/eventViews';
import { parseBody, requireStudent, route } from '../http';
import { mutate, read } from '../store/db';

export const studentsRouter = Router();

studentsRouter.get('/', route(() => read().students.map(toStudentSummary)));

studentsRouter.get('/:id', route((req) => requireStudent(read(), req.params.id)));

/** Saves onboarding answers and runs Step A of the AI pipeline (understand the student). */
studentsRouter.put(
  '/:id/onboarding',
  route(async (req) => {
    requireStudent(read(), req.params.id);
    const input = parseBody(onboardingInputSchema, req.body);
    const aiProfile = await understandStudent(input, new Date());
    return mutate((db) => {
      const student = requireStudent(db, req.params.id);
      Object.assign(student, input, { aiProfile, onboarded: true });
      return student;
    });
  }),
);

const settingsSchema = z.object({ socialVisible: z.boolean() });

studentsRouter.patch(
  '/:id/settings',
  route((req) => {
    const settings = parseBody(settingsSchema, req.body);
    return mutate((db) => {
      const student = requireStudent(db, req.params.id);
      student.socialVisible = settings.socialVisible;
      return student;
    });
  }),
);

const csv = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value.split(',') : undefined);

studentsRouter.get(
  '/:id/recommendations',
  route(async (req) => {
    const db = read();
    const student = requireStudent(db, req.params.id);
    const filters = parseBody(discoverFiltersSchema.extend({ categories: z.array(interestIdSchema).optional() }), {
      campus: req.query.campus || undefined,
      categories: csv(req.query.categories),
      when: req.query.when || undefined,
      kind: req.query.kind || undefined,
      query: req.query.q || undefined,
    });
    return recommend(db, student, filters, { now: new Date() });
  }),
);

studentsRouter.get('/:id/comparison', route(async (req) => compareRankings(read(), requireStudent(read(), req.params.id), new Date())));

const conciergeSchema = z.object({ message: z.string().trim().min(2).max(300) });

studentsRouter.post(
  '/:id/concierge',
  route(async (req) => {
    const db = read();
    const student = requireStudent(db, req.params.id);
    const { message } = parseBody(conciergeSchema, req.body);
    return askConcierge(db, student, message, new Date());
  }),
);

studentsRouter.get(
  '/:id/matches',
  route((req): MatchesResponse => {
    const db = read();
    const student = requireStudent(db, req.params.id);
    const now = Date.now();
    const view = (e: (typeof db.events)[number]) => toEventView(db, e, student.id);
    const active = db.events.filter((e) => e.status === 'active');
    const isPast = (e: (typeof db.events)[number]) => new Date(e.end).getTime() < now;
    const interestedIds = new Set(db.swipes.filter((s) => s.studentId === student.id && s.decision === 'interested').map((s) => s.eventId));
    const byStart = (a: { start: string }, b: { start: string }) => a.start.localeCompare(b.start);
    const hosting = active.filter((e) => e.organizer.studentId === student.id);
    return {
      interested: active.filter((e) => interestedIds.has(e.id) && !isPast(e)).sort(byStart).map(view),
      hosting: hosting.sort(byStart).map(view),
      past: active.filter((e) => interestedIds.has(e.id) && isPast(e)).map(view),
      pendingRequests: db.joinRequests
        .filter((r) => r.status === 'pending' && hosting.some((e) => e.id === r.eventId))
        .flatMap((r) => {
          const requester = db.students.find((s) => s.id === r.studentId);
          const event = hosting.find((e) => e.id === r.eventId);
          return requester && event ? [{ event: view(event), student: toStudentSummary(requester) }] : [];
        }),
    };
  }),
);
