import { randomUUID } from 'node:crypto';
import { validateNewEvent, type FieldErrors } from '../../shared/eventValidation';
import type { CampusEvent, Database, SwipeDecision } from '../../shared/types';
import { HttpError, requireEvent, requireStudent } from '../http';
import { firstName } from './eventViews';

/**
 * Event mutations as plain functions over a Database object. Routes wrap them
 * in `mutate()` for persistence; tests call them directly on a seed database.
 */

export class EventValidationError extends HttpError {
  constructor(readonly fieldErrors: FieldErrors) {
    super(422, 'Please fix the highlighted fields', fieldErrors);
  }
}

export function createStudentEvent(db: Database, input: unknown, now: Date): CampusEvent {
  const result = validateNewEvent(input, now);
  if (!result.ok) throw new EventValidationError(result.errors);
  const { value, start, end } = result;
  const organizer = requireStudent(db, value.organizerId);
  const orgName = value.organizationName.trim();

  const event: CampusEvent = {
    id: `evt-${randomUUID().slice(0, 8)}`,
    title: value.title,
    description: value.description,
    categories: value.categories,
    tags: [],
    kind: 'event',
    campus: value.campus,
    venue: value.venue,
    address: value.address || value.venue,
    start: start.toISOString(),
    end: end.toISOString(),
    groupSize: value.groupSize,
    energy: value.energy,
    beginnerFriendly: value.beginnerFriendly,
    capacity: value.capacity,
    visibility: value.visibility,
    organizer: {
      // An org name is displayed as a claim, never as verified affiliation.
      name: orgName ? `${firstName(organizer.name)} · ${orgName}` : organizer.name,
      kind: 'student',
      studentId: organizer.id,
      verification: 'demo-simulated',
    },
    source: { type: 'student', label: 'Posted by a student on OwlMatch', url: null, verifiedAt: null },
    rsvpUrl: null,
    coverImageUrl: value.coverImageUrl,
    createdAt: now.toISOString(),
    status: 'active',
    reports: [],
  };
  db.events.push(event);
  return event;
}

/** Upserts a swipe. Interest in an approval-only event also files a join request. */
export function recordSwipe(db: Database, eventId: string, studentId: string, decision: SwipeDecision, now: Date): void {
  const event = requireEvent(db, eventId);
  requireStudent(db, studentId);
  if (event.organizer.studentId === studentId) throw new HttpError(400, 'Hosts cannot swipe on their own event');

  db.swipes = db.swipes.filter((s) => !(s.eventId === eventId && s.studentId === studentId));
  db.swipes.push({ eventId, studentId, decision, at: now.toISOString() });

  if (decision === 'passed') {
    db.connections = db.connections.filter((c) => !(c.eventId === eventId && c.studentId === studentId));
    db.joinRequests = db.joinRequests.filter((r) => !(r.eventId === eventId && r.studentId === studentId));
  } else if (event.visibility === 'approval' && !db.joinRequests.some((r) => r.eventId === eventId && r.studentId === studentId)) {
    db.joinRequests.push({ eventId, studentId, status: 'pending', at: now.toISOString() });
  }
}

export function removeSwipe(db: Database, eventId: string, studentId: string): void {
  db.swipes = db.swipes.filter((s) => !(s.eventId === eventId && s.studentId === studentId));
  db.connections = db.connections.filter((c) => !(c.eventId === eventId && c.studentId === studentId));
  db.joinRequests = db.joinRequests.filter((r) => !(r.eventId === eventId && r.studentId === studentId));
}

/** "Find people to go with" opt-in. Requires being interested first. */
export function setConnection(db: Database, eventId: string, studentId: string, optIn: boolean, now: Date): void {
  requireEvent(db, eventId);
  const interested = db.swipes.some((s) => s.eventId === eventId && s.studentId === studentId && s.decision === 'interested');
  db.connections = db.connections.filter((c) => !(c.eventId === eventId && c.studentId === studentId));
  if (!optIn) return;
  if (!interested) throw new HttpError(400, 'Mark yourself interested before finding people to go with');
  db.connections.push({ eventId, studentId, at: now.toISOString() });
}

export function approveJoinRequest(db: Database, eventId: string, studentId: string, hostId: string): void {
  const event = requireEvent(db, eventId);
  if (event.organizer.studentId !== hostId) throw new HttpError(403, 'Only the host can approve requests');
  const request = db.joinRequests.find((r) => r.eventId === eventId && r.studentId === studentId);
  if (!request) throw new HttpError(404, 'Request not found');
  request.status = 'approved';
}

export function removeEvent(db: Database, eventId: string, hostId: string): void {
  const event = requireEvent(db, eventId);
  if (event.organizer.studentId !== hostId) throw new HttpError(403, 'Only the host can remove this event');
  event.status = 'removed';
}

/** Reports are stored for moderators; three distinct reports auto-hide an event pending review. */
export const AUTO_HIDE_REPORT_THRESHOLD = 3;

export function reportEvent(db: Database, eventId: string, studentId: string, reason: string, now: Date): void {
  const event = requireEvent(db, eventId);
  if (event.reports.some((r) => r.studentId === studentId)) return;
  event.reports.push({ studentId, reason, at: now.toISOString() });
  if (event.reports.length >= AUTO_HIDE_REPORT_THRESHOLD) event.status = 'removed';
}
