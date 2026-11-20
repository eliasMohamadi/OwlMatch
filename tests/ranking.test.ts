import { describe, expect, it } from 'vitest';
import { explainScore, filterEligible, learnFromSwipes, rankByCategoryOnly, rankEvents, SCORE_WEIGHTS } from '../shared/ranking';
import { createSeedDatabase } from '../server/store/seed';
import type { Student } from '../shared/types';

const NOW = new Date('2026-11-20T15:00:00Z'); // Friday 10:00 AM campus time
const db = createSeedDatabase(NOW);

function student(overrides: Partial<Student> = {}): Student {
  return {
    id: 'stu-test', name: 'Test Student', major: 'CS', year: 'Junior', avatarColor: '#fff',
    onboarded: true, socialVisible: true, aiProfile: null, campus: 'both',
    interests: ['gaming', 'tech'], about: '', availability: [],
    social: { makeFriends: false, groupSize: 'any', tryNew: false, energy: 'any' },
    ...overrides,
  };
}

const eligibleFor = (s: Student) => filterEligible(db.events, { student: s, now: NOW, filters: {}, swipedEventIds: new Set() });

describe('score weights', () => {
  it('sum to 100 so scores read as percentages', () => {
    expect(Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('filterEligible (hard constraints)', () => {
  it('respects the campus preference', () => {
    const events = eligibleFor(student({ campus: 'marietta' }));
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.campus === 'marietta')).toBe(true);
  });

  it('never shows removed, invite-only, ended, or own events', () => {
    const s = student();
    const [removed, invite, ended, own] = structuredClone(db.events.slice(0, 4));
    removed.status = 'removed';
    invite.visibility = 'invite';
    ended.end = new Date(NOW.getTime() - 1000).toISOString();
    own.organizer = { ...own.organizer, studentId: s.id };
    const result = filterEligible([removed, invite, ended, own], { student: s, now: NOW, filters: {}, swipedEventIds: new Set() });
    expect(result).toEqual([]);
  });

  it('hides already-swiped events unless asked to include them', () => {
    const s = student();
    const swiped = new Set([db.events[0].id]);
    expect(filterEligible(db.events, { student: s, now: NOW, filters: {}, swipedEventIds: swiped }).map((e) => e.id)).not.toContain(db.events[0].id);
    expect(filterEligible(db.events, { student: s, now: NOW, filters: {}, swipedEventIds: swiped, includeSwiped: true }).map((e) => e.id)).toContain(db.events[0].id);
  });

  it('applies category, kind and search filters', () => {
    const s = student();
    const ctx = { student: s, now: NOW, swipedEventIds: new Set<string>() };
    expect(filterEligible(db.events, { ...ctx, filters: { categories: ['wellness'] } }).every((e) => e.categories.includes('wellness'))).toBe(true);
    expect(filterEligible(db.events, { ...ctx, filters: { kind: 'ongoing' } }).every((e) => e.kind === 'ongoing')).toBe(true);
    expect(filterEligible(db.events, { ...ctx, filters: { query: 'yoga' } }).map((e) => e.id)).toEqual(['evt-yoga-green']);
  });
});

describe('rankEvents', () => {
  it('puts interest matches above unrelated events', () => {
    const ranked = rankEvents(student({ interests: ['wellness'] }), eligibleFor(student()), learnFromSwipes([], db.events));
    expect(ranked[0].event.categories).toContain('wellness');
    expect(ranked.every((r) => r.score >= 0 && r.score <= 100)).toBe(true);
  });

  it('uses free-text keywords beyond categories (semantic layer)', () => {
    const base = student({ interests: ['sports'] });
    const withWords = { ...base, about: 'I love godot and making my own platformer games' };
    const signals = learnFromSwipes([], db.events);
    const score = (s: Student) => rankEvents(s, eligibleFor(s), signals).find((r) => r.event.id === 'evt-gamedev-101')!.score;
    expect(score(withWords)).toBeGreaterThan(score(base));
  });

  it('prefers small, relaxed events for students who said so', () => {
    const signals = learnFromSwipes([], db.events);
    const quiet = student({ interests: ['gaming', 'social'], social: { makeFriends: true, groupSize: 'small', tryNew: false, energy: 'relaxed' } });
    const ranked = rankEvents(quiet, eligibleFor(quiet), signals);
    const position = (id: string) => ranked.findIndex((r) => r.event.id === id);
    expect(position('evt-board-game-cafe')).toBeLessThan(position('evt-smash-tournament'));
  });
});

describe('learning from swipes', () => {
  it('raises categories the student liked and lowers ones they passed', () => {
    const s = student({ interests: ['sports', 'arts'] });
    const swipes = [
      { studentId: s.id, eventId: 'evt-pickup-hoops', decision: 'passed' as const, at: NOW.toISOString() },
      { studentId: s.id, eventId: 'evt-anime-sketch', decision: 'interested' as const, at: NOW.toISOString() },
    ];
    const signals = learnFromSwipes(swipes, db.events);
    expect(signals.categoryAffinity.arts).toBeGreaterThan(0);
    expect(signals.categoryAffinity.sports).toBeLessThan(0);

    const before = rankEvents(s, eligibleFor(s), learnFromSwipes([], db.events)).find((r) => r.event.id === 'evt-pottery-paint')!;
    const after = rankEvents(s, eligibleFor(s), signals).find((r) => r.event.id === 'evt-pottery-paint')!;
    expect(after.breakdown.feedback).toBeGreaterThan(before.breakdown.feedback);
  });
});

describe('category-only baseline', () => {
  it('only returns events sharing a category and ignores everything else', () => {
    const s = student({ interests: ['gaming'], about: 'small groups please' });
    const ranked = rankByCategoryOnly(s, eligibleFor(s));
    expect(ranked.every((r) => r.event.categories.includes('gaming'))).toBe(true);
    expect(ranked.every((r) => r.breakdown.social === 0)).toBe(true);
  });
});

describe('explainScore', () => {
  it('cites concrete reasons instead of generic praise', () => {
    const s = student({ interests: ['gaming'], social: { makeFriends: false, groupSize: 'small', tryNew: true, energy: 'any' } });
    const signals = learnFromSwipes([], db.events);
    const scored = rankEvents(s, eligibleFor(s), signals).find((r) => r.event.id === 'evt-board-game-cafe')!;
    const reason = explainScore(s, scored, signals);
    expect(reason).toMatch(/gaming/);
    expect(reason).toMatch(/small group/);
    expect(reason).toMatch(/beginners/);
  });
});
