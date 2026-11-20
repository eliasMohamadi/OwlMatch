import { Router } from 'express';
import { z } from 'zod';
import { INTERESTS } from '../../shared/interests';
import { swipeDecisionSchema } from '../../shared/schemas';
import type { PeopleResponse } from '../../shared/types';
import { parseBody, requireEvent, requireStudent, route } from '../http';
import {
  approveJoinRequest,
  createStudentEvent,
  recordSwipe,
  removeEvent,
  removeSwipe,
  reportEvent,
  setConnection,
} from '../services/eventActions';
import { goingTogetherIds, interestedStudentIds, toEventView } from '../services/eventViews';
import { mutate, read } from '../store/db';

export const eventsRouter = Router();

const viewerOf = (query: unknown) => parseBody(z.object({ viewer: z.string() }), query).viewer;

eventsRouter.get(
  '/:id',
  route((req) => {
    const db = read();
    return toEventView(db, requireEvent(db, req.params.id), viewerOf(req.query));
  }),
);

eventsRouter.post(
  '/',
  route((req, res) => {
    const event = mutate((db) => createStudentEvent(db, req.body, new Date()));
    res.status(201);
    return toEventView(read(), event, event.organizer.studentId ?? '');
  }),
);

const hostSchema = z.object({ hostId: z.string() });

eventsRouter.delete(
  '/:id',
  route((req) => {
    const { hostId } = parseBody(hostSchema, req.body);
    mutate((db) => removeEvent(db, req.params.id, hostId));
    return { ok: true };
  }),
);

const swipeBody = z.object({ studentId: z.string(), decision: swipeDecisionSchema });

eventsRouter.post(
  '/:id/swipe',
  route((req) => {
    const { studentId, decision } = parseBody(swipeBody, req.body);
    mutate((db) => recordSwipe(db, req.params.id, studentId, decision, new Date()));
    return toEventView(read(), requireEvent(read(), req.params.id), studentId);
  }),
);

const studentBody = z.object({ studentId: z.string() });

eventsRouter.delete(
  '/:id/swipe',
  route((req) => {
    const { studentId } = parseBody(studentBody, req.body);
    mutate((db) => removeSwipe(db, req.params.id, studentId));
    return toEventView(read(), requireEvent(read(), req.params.id), studentId);
  }),
);

const connectBody = z.object({ studentId: z.string(), optIn: z.boolean() });

eventsRouter.post(
  '/:id/connect',
  route((req) => {
    const { studentId, optIn } = parseBody(connectBody, req.body);
    mutate((db) => setConnection(db, req.params.id, studentId, optIn, new Date()));
    return toEventView(read(), requireEvent(read(), req.params.id), studentId);
  }),
);

/**
 * Mutual visibility: names are only shown to a viewer who has opted in
 * themselves, and only for students who opted in (and did not turn off social).
 */
eventsRouter.get(
  '/:id/people',
  route((req): PeopleResponse => {
    const db = read();
    const event = requireEvent(db, req.params.id);
    const viewer = requireStudent(db, viewerOf(req.query));
    const optedIn = goingTogetherIds(db, event.id);
    const viewerOptedIn = optedIn.includes(viewer.id);
    const hostId = event.organizer.studentId;
    const visibleIds = viewerOptedIn ? [...(hostId && hostId !== viewer.id ? [hostId] : []), ...optedIn.filter((id) => id !== viewer.id && id !== hostId)] : [];
    const people = visibleIds.flatMap((id) => {
      const s = db.students.find((x) => x.id === id);
      if (!s) return [];
      return [{
        id: s.id,
        name: s.name.split(' ')[0] ?? s.name,
        major: s.major,
        year: s.year,
        avatarColor: s.avatarColor,
        sharedInterests: s.interests.filter((i) => viewer.interests.includes(i)).map((i) => INTERESTS[i].shortLabel),
        isHost: id === hostId,
      }];
    });
    return { interestedCount: interestedStudentIds(db, event.id).length, goingTogetherCount: optedIn.length, people, viewerOptedIn };
  }),
);

eventsRouter.post(
  '/:id/requests/:studentId/approve',
  route((req) => {
    const { hostId } = parseBody(hostSchema, req.body);
    mutate((db) => approveJoinRequest(db, req.params.id, req.params.studentId, hostId));
    return { ok: true };
  }),
);

const reportBody = z.object({ studentId: z.string(), reason: z.string().trim().min(3).max(300) });

eventsRouter.post(
  '/:id/report',
  route((req) => {
    const { studentId, reason } = parseBody(reportBody, req.body);
    mutate((db) => reportEvent(db, req.params.id, studentId, reason, new Date()));
    return { ok: true };
  }),
);
