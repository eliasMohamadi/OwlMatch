import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeedDatabase } from '../server/store/seed';
import type { Student } from '../shared/types';

/** Gemini is mocked so we can prove what happens with good, hostile and missing output. */
const generateJson = vi.fn();
vi.mock('../server/ai/gemini', () => ({ generateJson: (...args: unknown[]) => generateJson(...args) }));

const { recommend, clampScore } = await import('../server/ai/recommend');
const { askConcierge } = await import('../server/ai/concierge');

const NOW = new Date('2026-11-20T15:00:00Z');
const db = createSeedDatabase(NOW);
let counter = 0;

function freshStudent(): Student {
  counter += 1; // unique profile per test so the server-side cache never leaks between tests
  return {
    ...db.students.find((s) => s.id === 'stu-alex')!,
    id: `stu-test-${counter}`,
    about: `test ${counter}`,
  };
}

beforeEach(() => generateJson.mockReset());

describe('recommend()', () => {
  it('uses Gemini scores and reasons for shortlisted events only', async () => {
    generateJson.mockResolvedValue({
      ok: true,
      data: {
        rankings: [
          { eventId: 'evt-robotics-build', score: 140, reason: 'You build robots; this is a robot build night.', matchedInterests: ['Engineering'] },
          { eventId: 'evt-made-up', score: 99, reason: 'Invented event', matchedInterests: [] },
          { eventId: 'evt-pickup-hoops', score: -20, reason: 'You play pickup.', matchedInterests: ['Sports'] },
        ],
      },
    });
    const result = await recommend(db, freshStudent(), {}, { now: NOW });
    expect(result.mode).toBe('ai');
    const ids = result.items.map((i) => i.event.id);
    expect(ids).not.toContain('evt-made-up'); // grounding: unknown ids are dropped
    expect(result.items[0].event.id).toBe('evt-robotics-build');
    expect(result.items[0].recommendation).toMatchObject({ score: 100, scoreSource: 'ai' }); // clamped
    const hoops = result.items.find((i) => i.event.id === 'evt-pickup-hoops')!;
    expect(hoops.recommendation.score).toBe(0);
    // Events Gemini did not rank keep their rule-based score, labeled as such.
    expect(result.items.some((i) => i.recommendation.scoreSource === 'rules')).toBe(true);
  });

  it('falls back to deterministic ranking when Gemini fails, and says so', async () => {
    generateJson.mockResolvedValue({ ok: false, reason: 'Gemini timed out' });
    const result = await recommend(db, freshStudent(), {}, { now: NOW });
    expect(result.mode).toBe('fallback');
    expect(result.notice).toBe('Gemini timed out');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((i) => i.recommendation.scoreSource === 'rules')).toBe(true);
    const scores = result.items.map((i) => i.recommendation.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('falls back when Gemini returns only unknown ids', async () => {
    generateJson.mockResolvedValue({ ok: true, data: { rankings: [{ eventId: 'nope', score: 50, reason: 'x', matchedInterests: [] }] } });
    expect((await recommend(db, freshStudent(), {}, { now: NOW })).mode).toBe('fallback');
  });

  it('caches Gemini results for identical inputs', async () => {
    generateJson.mockResolvedValue({ ok: true, data: { rankings: [{ eventId: 'evt-robotics-build', score: 80, reason: 'r', matchedInterests: [] }] } });
    const student = freshStudent();
    await recommend(db, student, {}, { now: NOW });
    await recommend(db, student, {}, { now: NOW });
    expect(generateJson).toHaveBeenCalledTimes(1);
  });
});

describe('clampScore', () => {
  it('keeps scores within 0–100 and rounds', () => {
    expect([clampScore(-5), clampScore(42.6), clampScore(300)]).toEqual([0, 43, 100]);
  });
});

describe('askConcierge()', () => {
  it('returns only real events matching the parsed intent, even when AI is down', async () => {
    generateJson.mockResolvedValue({ ok: false, reason: 'not configured' });
    const response = await askConcierge(db, freshStudent(), 'Something fun on Marietta campus to meet people who like gaming', NOW);
    expect(response.mode).toBe('fallback');
    expect(response.items.length).toBeGreaterThan(0);
    expect(response.items.every((i) => i.event.campus === 'marietta')).toBe(true);
    expect(response.items.every((i) => db.events.some((e) => e.id === i.event.id))).toBe(true);
  });

  it('ignores Gemini picks that are not in the filtered list', async () => {
    generateJson
      .mockResolvedValueOnce({ ok: true, data: { campus: 'kennesaw', categories: ['wellness'], keywords: ['yoga'], timeWindow: 'any', afterHour: null, beginnerFriendly: false, wantsSocial: false, unsupported: null } })
      .mockResolvedValueOnce({ ok: true, data: { reply: 'Try yoga!', picks: [{ eventId: 'evt-yoga-green', reason: 'Calm start.' }, { eventId: 'evt-fake', reason: 'Fake' }] } });
    const response = await askConcierge(db, freshStudent(), 'yoga on kennesaw campus', NOW);
    expect(response.mode).toBe('ai');
    expect(response.reply).toBe('Try yoga!');
    expect(response.items.map((i) => i.event.id)).not.toContain('evt-fake');
    expect(response.items.find((i) => i.event.id === 'evt-yoga-green')?.recommendation.reason).toBe('Calm start.');
  });
});
