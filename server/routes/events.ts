import { Router } from 'express';
import { z } from 'zod';
import { INTERESTS } from '../../shared/interests';
import { swipeDecisionSchema } from '../../shared/schemas';
import type { PeopleResponse } from '../../shared/types';
import { requireSignedIn, resolveActor } from '../auth/actor';
import { parseBody, requireEvent, requireStudent, route } from '../http';
import {
  approveJoinRequest,
  createStudentEvent,
  deleteEvent,
  recordSwipe,
  removeSwipe,
  reportEvent,
  setConnection,
} from '../services/eventActions';
import { goingTogetherIds, interestedStudentIds, toEventView } from '../services/eventViews';
import { deleteCoverImage } from '../services/uploads';
import { mutate, read } from '../store/db';

/**
 * Event endpoints. The acting student always comes from the signed-in session
 * (see auth/actor.ts); ids in the body or query are never trusted.
 */
export const eventsRouter = Router();
eventsRouter.use(requireSignedIn);

const me = (req: Parameters<typeof resolveActor>[0]) => resolveActor(req, read()).id;

eventsRouter.get(
  '/:id',
  route((req) => {
    const db = read();
    return toEventView(db, requireEvent(db, req.params.id), resolveActor(req, db).id);
  }),
);

eventsRouter.post(
  '/',
  route((req, res) => {
    const organizerId = me(req);
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const event = mutate((db) => createStudentEvent(db, { ...body, organizerId }, new Date()));
    res.status(201);
    return toEventView(read(), event, organizerId);
  }),
);

/** Host-only hard delete: the event, its related records and its uploaded cover image. */
eventsRouter.delete(
  '/:id',
  route((req) => {
    const hostId = me(req);
    const deleted = mutate((db) => deleteEvent(db, req.params.id, hostId));
    deleteCoverImage(read(), deleted.coverImageUrl);
    return { ok: true };
  }),
);

const swipeBody = z.object({ decision: swipeDecisionSchema });

eventsRouter.post(
  '/:id/swipe',
  route((req) => {
    const studentId = me(req);
    const { decision } = parseBody(swipeBody, req.body);
    mutate((db) => recordSwipe(db, req.params.id, studentId, decision, new Date()));
    return toEventView(read(), requireEvent(read(), req.params.id), studentId);
  }),
);

eventsRouter.delete(
  '/:id/swipe',
  route((req) => {
    const studentId = me(req);
    mutate((db) => removeSwipe(db, req.params.id, studentId));
    return toEventView(read(), requireEvent(read(), req.params.id), studentId);
  }),
);

const connectBody = z.object({ optIn: z.boolean() });

eventsRouter.post(
  '/:id/connect',
  route((req) => {
    const studentId = me(req);
    const { optIn } = parseBody(connectBody, req.body);
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
    const viewer = resolveActor(req, db);
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
    const hostId = me(req);
    requireStudent(read(), req.params.studentId);
    mutate((db) => approveJoinRequest(db, req.params.id, req.params.studentId, hostId));
    return { ok: true };
  }),
);

const reportBody = z.object({ reason: z.string().trim().min(3).max(300) });

eventsRouter.post(
  '/:id/report',
  route((req) => {
    const studentId = me(req);
    const { reason } = parseBody(reportBody, req.body);
    mutate((db) => reportEvent(db, req.params.id, studentId, reason, new Date()));
    return { ok: true };
  }),
);
