import { describe, expect, it } from 'vitest';
import { googleCalendarUrl, toCalendarTimestamp } from '../shared/calendar';
import { validateNewEvent } from '../shared/eventValidation';
import { campusTimeToUtc, inTimeWindow } from '../shared/time';
import { heuristicIntent, heuristicProfile } from '../server/ai/heuristics';
import type { NewEventInput } from '../shared/types';

const NOW = new Date('2026-11-20T15:00:00Z'); // Fri Nov 20, 10:00 AM EST

describe('campus time zone', () => {
  it('converts Eastern wall-clock time to UTC, across DST', () => {
    expect(campusTimeToUtc('2026-11-21', '19:00').toISOString()).toBe('2026-11-22T00:00:00.000Z'); // EST, UTC-5
    expect(campusTimeToUtc('2026-07-04', '19:00').toISOString()).toBe('2026-07-04T23:00:00.000Z'); // EDT, UTC-4
  });

  it('knows what "this weekend" means relative to now', () => {
    expect(inTimeWindow(campusTimeToUtc('2026-11-21', '14:00'), 'weekend', NOW)).toBe(true);
    expect(inTimeWindow(campusTimeToUtc('2026-11-24', '14:00'), 'weekend', NOW)).toBe(false);
    expect(inTimeWindow(campusTimeToUtc('2026-11-20', '20:00'), 'tonight', NOW)).toBe(true);
  });
});

describe('Google Calendar link', () => {
  const url = new URL(
    googleCalendarUrl({
      title: 'Game Night',
      start: '2026-11-22T00:00:00.000Z',
      end: '2026-11-22T03:00:00.000Z',
      description: 'Bring controllers',
      location: 'Student Center, Marietta Campus',
    }),
  );

  it('prefills title, UTC dates, details, location and campus time zone', () => {
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Game Night');
    expect(url.searchParams.get('dates')).toBe('20261122T000000Z/20261122T030000Z');
    expect(url.searchParams.get('details')).toBe('Bring controllers');
    expect(url.searchParams.get('location')).toBe('Student Center, Marietta Campus');
    expect(url.searchParams.get('ctz')).toBe('America/New_York');
  });

  it('formats timestamps without separators or milliseconds', () => {
    expect(toCalendarTimestamp('2026-01-02T03:04:05.678Z')).toBe('20260102T030405Z');
  });
});

describe('validateNewEvent', () => {
  const valid: NewEventInput = {
    organizerId: 'stu-jordan', title: 'Game Night', description: 'Casual Smash and Mario Kart, all welcome.',
    categories: ['gaming'], campus: 'marietta', venue: 'Student Center', address: '', date: '2026-11-21',
    startTime: '19:00', endTime: '22:00', capacity: 16, visibility: 'public', groupSize: 'small',
    energy: 'relaxed', beginnerFriendly: true, organizationName: '', coverImageUrl: null,
  };

  it('accepts a complete event and returns UTC times', () => {
    const result = validateNewEvent(valid, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.start.toISOString()).toBe('2026-11-22T00:00:00.000Z');
  });

  it('rejects past dates, reversed times and missing fields', () => {
    const past = validateNewEvent({ ...valid, date: '2026-11-19' }, NOW);
    const reversed = validateNewEvent({ ...valid, startTime: '22:00', endTime: '19:00' }, NOW);
    const empty = validateNewEvent({ ...valid, title: '', categories: [] }, NOW);
    expect(past.ok || past.errors.startTime).toBeTruthy();
    expect(!reversed.ok && reversed.errors.endTime).toBeTruthy();
    expect(!empty.ok && empty.errors.title && empty.errors.categories).toBeTruthy();
  });

  it('keeps personal contact details out of public text', () => {
    const result = validateNewEvent({ ...valid, description: 'Text me at 404-555-1234 to get the room number' }, NOW);
    expect(!result.ok && result.errors.description).toBeTruthy();
  });
});

describe('heuristic fallbacks (used when Gemini is unavailable)', () => {
  it('extracts preferences from the student’s own words', () => {
    const profile = heuristicProfile(
      {
        campus: 'both', interests: ['tech'], availability: [],
        social: { makeFriends: false, groupSize: 'any', tryNew: false, energy: 'any' },
        about: "I'm a CS student who likes basketball and gaming. I want to meet new people, but I prefer smaller groups.",
      },
      NOW,
    );
    expect(profile.source).toBe('heuristic');
    expect(profile.inferredInterests).toEqual(expect.arrayContaining(['sports', 'gaming']));
    expect(profile.inferredInterests).not.toContain('tech');
    expect(profile.preferredGroupSize).toBe('small');
    expect(profile.goals).toContain('Meet new people');
  });

  it('parses a concierge request into filters', () => {
    const intent = heuristicIntent('Find something fun on the Marietta campus this weekend after 5 for gaming');
    expect(intent.campus).toBe('marietta');
    expect(intent.timeWindow).toBe('weekend');
    expect(intent.afterHour).toBe(17);
    expect(intent.categories).toContain('gaming');
  });
});
