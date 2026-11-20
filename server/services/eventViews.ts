import type { CampusEvent, Database, EventView, Student, StudentSummary } from '../../shared/types';

/** Interest counts always come from stored swipes, never from organizer claims. */
export function interestedStudentIds(db: Readonly<Database>, eventId: string): string[] {
  return db.swipes.filter((s) => s.eventId === eventId && s.decision === 'interested').map((s) => s.studentId);
}

/** Students who are interested AND opted in to finding people to go with. */
export function goingTogetherIds(db: Readonly<Database>, eventId: string): string[] {
  const interested = new Set(interestedStudentIds(db, eventId));
  return db.connections
    .filter((c) => c.eventId === eventId && interested.has(c.studentId))
    .map((c) => c.studentId)
    .filter((id) => db.students.find((s) => s.id === id)?.socialVisible);
}

function canSeeAddress(db: Readonly<Database>, event: CampusEvent, viewerId: string): boolean {
  if (event.visibility === 'public') return true;
  if (event.organizer.studentId === viewerId) return true;
  return db.joinRequests.some((r) => r.eventId === event.id && r.studentId === viewerId && r.status === 'approved');
}

/** Projects an event for one viewer, withholding what they are not allowed to see. */
export function toEventView(db: Readonly<Database>, event: CampusEvent, viewerId: string): EventView {
  const { address, reports, ...rest } = event;
  const showAddress = canSeeAddress(db, event, viewerId);
  const swipe = db.swipes.find((s) => s.eventId === event.id && s.studentId === viewerId);
  const join = db.joinRequests.find((r) => r.eventId === event.id && r.studentId === viewerId);
  return {
    ...rest,
    address: showAddress ? address : null,
    locationNote: showAddress ? null : 'Exact location is shared once the host approves you.',
    interestedCount: interestedStudentIds(db, event.id).length,
    goingTogetherCount: goingTogetherIds(db, event.id).length,
    reportCount: reports.length,
    viewer: {
      decision: swipe?.decision ?? null,
      optedIn: db.connections.some((c) => c.eventId === event.id && c.studentId === viewerId),
      isHost: event.organizer.studentId === viewerId,
      joinStatus: join?.status ?? null,
    },
  };
}

export function toStudentSummary(student: Student): StudentSummary {
  const { id, name, major, year, avatarColor, onboarded } = student;
  return { id, name, major, year, avatarColor, onboarded };
}

export function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}
