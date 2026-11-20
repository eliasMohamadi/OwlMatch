import { beforeEach, describe, expect, it } from 'vitest';
import { createSeedDatabase } from '../server/store/seed';
import {
  approveJoinRequest,
  AUTO_HIDE_REPORT_THRESHOLD,
  createStudentEvent,
  EventValidationError,
  recordSwipe,
  reportEvent,
  setConnection,
} from '../server/services/eventActions';
import { goingTogetherIds, toEventView } from '../server/services/eventViews';
import type { Database, NewEventInput } from '../shared/types';

const NOW = new Date('2026-11-20T15:00:00Z');
let db: Database;

const input = (overrides: Partial<NewEventInput> = {}): NewEventInput => ({
  organizerId: 'stu-jordan', title: 'Casual Game Night', description: 'Smash, Mario Kart and student-made indie games.',
  categories: ['gaming', 'social'], campus: 'marietta', venue: 'Student Center Game Room', address: 'Room 210',
  date: '2026-11-21', startTime: '19:00', endTime: '22:00', capacity: 16, visibility: 'public',
  groupSize: 'small', energy: 'relaxed', beginnerFriendly: true, organizationName: 'Game Dev Society', coverImageUrl: null,
  ...overrides,
});

beforeEach(() => {
  db = createSeedDatabase(NOW);
});

describe('student-created events', () => {
  it('stores the event as student-hosted with simulated (not real) verification', () => {
    const event = createStudentEvent(db, input(), NOW);
    expect(db.events).toContain(event);
    expect(event.organizer).toMatchObject({ kind: 'student', studentId: 'stu-jordan', verification: 'demo-simulated' });
    expect(event.organizer.name).toBe('Jordan · Game Dev Society');
    expect(event.source.type).toBe('student');
  });

  it('rejects invalid input with field errors', () => {
    expect(() => createStudentEvent(db, input({ title: '' }), NOW)).toThrow(EventValidationError);
  });
});

describe('swipes and interest counts', () => {
  it('persists interest and derives the count from stored swipes', () => {
    const event = createStudentEvent(db, input(), NOW);
    expect(toEventView(db, event, 'stu-maya').interestedCount).toBe(0);
    recordSwipe(db, event.id, 'stu-maya', 'interested', NOW);
    recordSwipe(db, event.id, 'stu-sam', 'interested', NOW);
    const view = toEventView(db, event, 'stu-maya');
    expect(view.interestedCount).toBe(2);
    expect(view.viewer.decision).toBe('interested');
  });

  it('changing your mind replaces the swipe instead of double counting', () => {
    const event = createStudentEvent(db, input(), NOW);
    recordSwipe(db, event.id, 'stu-maya', 'interested', NOW);
    recordSwipe(db, event.id, 'stu-maya', 'passed', NOW);
    expect(db.swipes.filter((s) => s.eventId === event.id)).toHaveLength(1);
    expect(toEventView(db, event, 'stu-maya').interestedCount).toBe(0);
  });

  it('does not let hosts swipe on their own event', () => {
    const event = createStudentEvent(db, input(), NOW);
    expect(() => recordSwipe(db, event.id, 'stu-jordan', 'interested', NOW)).toThrow();
  });
});

describe('social opt-in', () => {
  it('requires interest first and respects the global privacy switch', () => {
    const event = createStudentEvent(db, input(), NOW);
    expect(() => setConnection(db, event.id, 'stu-maya', true, NOW)).toThrow();
    recordSwipe(db, event.id, 'stu-maya', 'interested', NOW);
    setConnection(db, event.id, 'stu-maya', true, NOW);
    expect(goingTogetherIds(db, event.id)).toEqual(['stu-maya']);
    db.students.find((s) => s.id === 'stu-maya')!.socialVisible = false;
    expect(goingTogetherIds(db, event.id)).toEqual([]);
  });

  it('passing on an event removes the opt-in', () => {
    const event = createStudentEvent(db, input(), NOW);
    recordSwipe(db, event.id, 'stu-maya', 'interested', NOW);
    setConnection(db, event.id, 'stu-maya', true, NOW);
    recordSwipe(db, event.id, 'stu-maya', 'passed', NOW);
    expect(goingTogetherIds(db, event.id)).toEqual([]);
  });
});

describe('approval-required events', () => {
  it('hides the exact address until the host approves', () => {
    const event = createStudentEvent(db, input({ visibility: 'approval' }), NOW);
    recordSwipe(db, event.id, 'stu-maya', 'interested', NOW);
    expect(toEventView(db, event, 'stu-maya').address).toBeNull();
    expect(toEventView(db, event, 'stu-jordan').address).toBe('Room 210');
    expect(() => approveJoinRequest(db, event.id, 'stu-maya', 'stu-sam')).toThrow();
    approveJoinRequest(db, event.id, 'stu-maya', 'stu-jordan');
    expect(toEventView(db, event, 'stu-maya').address).toBe('Room 210');
  });
});

describe('moderation', () => {
  it('auto-hides an event after enough distinct reports', () => {
    const event = createStudentEvent(db, input(), NOW);
    const reporters = ['stu-maya', 'stu-sam', 'stu-alex', 'stu-priya'].slice(0, AUTO_HIDE_REPORT_THRESHOLD);
    reportEvent(db, event.id, reporters[0], 'spam', NOW);
    reportEvent(db, event.id, reporters[0], 'spam again', NOW);
    expect(event.reports).toHaveLength(1);
    for (const r of reporters.slice(1)) reportEvent(db, event.id, r, 'spam', NOW);
    expect(event.status).toBe('removed');
  });
});
