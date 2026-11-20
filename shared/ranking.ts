import { INTERESTS, type InterestId } from './interests';
import { tokenize } from './text';
import { dayPartOf, inTimeWindow, isWeekend } from './time';
import type { CampusEvent, DiscoverFilters, Recommendation, ScoreBreakdown, Student, Swipe } from './types';

/**
 * Deterministic matcher. It is the shortlist stage of the AI pipeline and the
 * complete fallback when Gemini is unavailable, so it must be good on its own.
 * Every number it produces comes from the weighted signals below.
 */
export const SCORE_WEIGHTS: ScoreBreakdown = {
  interest: 40,
  keyword: 20,
  availability: 15,
  social: 15,
  feedback: 10,
};

/** An explicitly chosen interest outranks one the AI inferred from free text. */
const FIRST_MATCH_CREDIT = 0.75;
const INFERRED_INTEREST_CREDIT = 0.55;
/** Each additional overlapping category; events matching several of a student's interests rank higher. */
const EXTRA_CATEGORY_BONUS = 0.25;
/** Keyword hits needed for a full keyword score. */
const KEYWORD_SATURATION = 3;
const NEUTRAL = 0.5;

export interface FeedbackSignals {
  likedEventIds: Set<string>;
  passedEventIds: Set<string>;
  /** −1 (always passed) … 1 (always liked), learned from swipe history. */
  categoryAffinity: Partial<Record<InterestId, number>>;
}

export function learnFromSwipes(swipes: readonly Swipe[], events: readonly CampusEvent[]): FeedbackSignals {
  const byId = new Map(events.map((event) => [event.id, event]));
  const tally = new Map<InterestId, { liked: number; passed: number }>();
  const likedEventIds = new Set<string>();
  const passedEventIds = new Set<string>();

  for (const swipe of swipes) {
    const event = byId.get(swipe.eventId);
    (swipe.decision === 'interested' ? likedEventIds : passedEventIds).add(swipe.eventId);
    if (!event) continue;
    for (const category of event.categories) {
      const entry = tally.get(category) ?? { liked: 0, passed: 0 };
      if (swipe.decision === 'interested') entry.liked += 1;
      else entry.passed += 1;
      tally.set(category, entry);
    }
  }

  const categoryAffinity: FeedbackSignals['categoryAffinity'] = {};
  for (const [category, { liked, passed }] of tally) {
    // +1 smoothing keeps a single swipe from swinging the score to an extreme.
    categoryAffinity[category] = (liked - passed) / (liked + passed + 1);
  }
  return { likedEventIds, passedEventIds, categoryAffinity };
}

/** Words that describe what the student is into: interests, AI keywords and their own text. */
export function profileTerms(student: Student): Set<string> {
  const terms = new Set<string>();
  const interestIds = new Set<InterestId>([...student.interests, ...(student.aiProfile?.inferredInterests ?? [])]);
  for (const id of interestIds) INTERESTS[id].keywords.forEach((k) => tokenize(k).forEach((t) => terms.add(t)));
  for (const keyword of student.aiProfile?.keywords ?? []) tokenize(keyword).forEach((t) => terms.add(t));
  tokenize(student.about).forEach((t) => terms.add(t));
  return terms;
}

export function eventTerms(event: CampusEvent): Set<string> {
  return new Set(tokenize(`${event.title} ${event.description} ${event.tags.join(' ')}`));
}

function interestScore(student: Student, event: CampusEvent): { score: number; matched: InterestId[] } {
  const explicit = event.categories.filter((c) => student.interests.includes(c));
  const inferred = event.categories.filter(
    (c) => !explicit.includes(c) && student.aiProfile?.inferredInterests.includes(c),
  );
  if (explicit.length === 0 && inferred.length === 0) return { score: 0, matched: [] };
  const base = explicit.length > 0 ? FIRST_MATCH_CREDIT : INFERRED_INTEREST_CREDIT;
  const extras = explicit.length + inferred.length - 1;
  return { score: Math.min(1, base + extras * EXTRA_CATEGORY_BONUS), matched: [...explicit, ...inferred] };
}

function keywordScore(terms: Set<string>, event: CampusEvent): { score: number; hits: string[] } {
  const hits = [...eventTerms(event)].filter((t) => terms.has(t));
  return { score: Math.min(1, hits.length / KEYWORD_SATURATION), hits };
}

function availabilityScore(student: Student, event: CampusEvent): number {
  if (event.kind === 'ongoing' || student.availability.length === 0) return 1;
  const start = new Date(event.start);
  const days = student.availability.filter((a) => a === 'weekdays' || a === 'weekends');
  const parts = student.availability.filter((a) => a === 'mornings' || a === 'afternoons' || a === 'evenings');
  const dayOk = days.length === 0 || days.includes(isWeekend(start) ? 'weekends' : 'weekdays');
  const partOk = parts.length === 0 || parts.includes(`${dayPartOf(start)}s` as (typeof parts)[number]);
  return (Number(dayOk) + Number(partOk)) / 2;
}

function socialScore(student: Student, event: CampusEvent): number {
  const signals: number[] = [];
  const groupPref = student.aiProfile?.preferredGroupSize ?? student.social.groupSize;
  if (groupPref === 'small') signals.push(event.groupSize === 'large' ? 0 : event.groupSize === 'small' ? 1 : 0.7);
  if (groupPref === 'large') signals.push(event.groupSize === 'small' ? 0.3 : 1);
  const energyPref = student.aiProfile?.preferredEnergy ?? student.social.energy;
  if (energyPref !== 'any') signals.push(event.energy === energyPref ? 1 : 0);
  if (student.social.makeFriends) signals.push(event.categories.includes('social') || event.groupSize !== 'large' ? 1 : 0.5);
  if (student.social.tryNew) signals.push(event.beginnerFriendly ? 1 : 0.4);
  if (signals.length === 0) return NEUTRAL;
  return signals.reduce((sum, s) => sum + s, 0) / signals.length;
}

function feedbackScore(signals: FeedbackSignals, event: CampusEvent): number {
  const affinities = event.categories
    .map((c) => signals.categoryAffinity[c])
    .filter((a): a is number => a !== undefined);
  if (affinities.length === 0) return NEUTRAL;
  const mean = affinities.reduce((sum, a) => sum + a, 0) / affinities.length;
  return (mean + 1) / 2;
}

export interface ScoredEvent {
  event: CampusEvent;
  score: number;
  breakdown: ScoreBreakdown;
  matchedInterests: InterestId[];
  keywordHits: string[];
}

export function scoreEvent(student: Student, event: CampusEvent, signals: FeedbackSignals, terms = profileTerms(student)): ScoredEvent {
  const interest = interestScore(student, event);
  const keyword = keywordScore(terms, event);
  const breakdown: ScoreBreakdown = {
    interest: interest.score,
    keyword: keyword.score,
    availability: availabilityScore(student, event),
    social: socialScore(student, event),
    feedback: feedbackScore(signals, event),
  };
  const total = (Object.keys(SCORE_WEIGHTS) as (keyof ScoreBreakdown)[]).reduce(
    (sum, key) => sum + SCORE_WEIGHTS[key] * breakdown[key],
    0,
  );
  return { event, score: Math.round(total), breakdown, matchedInterests: interest.matched, keywordHits: keyword.hits };
}

export function rankEvents(student: Student, events: readonly CampusEvent[], signals: FeedbackSignals): ScoredEvent[] {
  const terms = profileTerms(student);
  return events
    .map((event) => scoreEvent(student, event, signals, terms))
    .sort((a, b) => b.score - a.score || a.event.start.localeCompare(b.event.start));
}

/** Baseline used in the "Why AI?" comparison: category overlap only, nothing else. */
export function rankByCategoryOnly(student: Student, events: readonly CampusEvent[]): ScoredEvent[] {
  return events
    .map((event) => {
      const matched = event.categories.filter((c) => student.interests.includes(c));
      const score = Math.round((matched.length / event.categories.length) * 100);
      const breakdown: ScoreBreakdown = { interest: score / 100, keyword: 0, availability: 0, social: 0, feedback: 0 };
      return { event, score, breakdown, matchedInterests: matched, keywordHits: [] };
    })
    .filter((s) => s.matchedInterests.length > 0)
    .sort((a, b) => b.score - a.score || a.event.start.localeCompare(b.event.start));
}

/* ------------------------------ Hard filters ------------------------------ */

export interface EligibilityContext {
  student: Student;
  now: Date;
  swipedEventIds: Set<string>;
  filters: DiscoverFilters;
  /** Include events the student already swiped on (concierge, comparisons). */
  includeSwiped?: boolean;
}

/**
 * Hard constraints enforced in code, never delegated to the model:
 * visibility, moderation status, timing, campus and explicit filters.
 */
export function filterEligible(events: readonly CampusEvent[], ctx: EligibilityContext): CampusEvent[] {
  const { student, now, filters } = ctx;
  const campus = filters.campus ?? student.campus;
  const query = filters.query?.trim().toLowerCase();
  return events.filter((event) => {
    if (event.status !== 'active') return false;
    if (event.visibility === 'invite') return false;
    if (event.organizer.studentId === student.id) return false;
    if (new Date(event.end).getTime() <= now.getTime()) return false;
    if (!ctx.includeSwiped && ctx.swipedEventIds.has(event.id)) return false;
    if (campus !== 'both' && event.campus !== campus) return false;
    if (filters.categories?.length && !event.categories.some((c) => filters.categories?.includes(c))) return false;
    if (filters.kind && filters.kind !== 'all' && event.kind !== filters.kind) return false;
    if (filters.when && filters.when !== 'any' && event.kind === 'event' && !inTimeWindow(new Date(event.start), filters.when, now)) return false;
    if (query && !`${event.title} ${event.description} ${event.tags.join(' ')} ${event.venue}`.toLowerCase().includes(query)) return false;
    return true;
  });
}

/* --------------------------- Rule-based reasons --------------------------- */

const GROUP_PHRASE = { small: 'a small group', large: 'a big crowd' } as const;

/**
 * Builds a specific, factual explanation from the signals that actually fired,
 * so fallback recommendations still say *why* instead of generic praise.
 */
export function explainScore(student: Student, scored: ScoredEvent, signals: FeedbackSignals): string {
  const { event, breakdown, matchedInterests, keywordHits } = scored;
  const parts: string[] = [];
  if (matchedInterests.length > 0) {
    const labels = matchedInterests.map((id) => INTERESTS[id].shortLabel.toLowerCase());
    const fromAi = matchedInterests.some((id) => !student.interests.includes(id));
    parts.push(fromAi ? `Fits what you described (${labels.join(', ')})` : `Matches your interest in ${labels.join(' and ')}`);
  } else if (keywordHits.length > 0) {
    parts.push(`Mentions things you care about: ${keywordHits.slice(0, 3).join(', ')}`);
  } else {
    parts.push('Something outside your usual picks');
  }
  const groupPref = student.aiProfile?.preferredGroupSize ?? student.social.groupSize;
  if (groupPref === 'small' && event.groupSize === 'small') parts.push(`it's ${GROUP_PHRASE.small}, like you prefer`);
  if (groupPref === 'large' && event.groupSize === 'large') parts.push(`it draws ${GROUP_PHRASE.large}, the way you like it`);
  if (student.social.tryNew && event.beginnerFriendly) parts.push('beginners are welcome');
  if (breakdown.availability === 1 && event.kind === 'event' && student.availability.length > 0) parts.push('the time fits your availability');
  const likedCategory = event.categories.find((c) => (signals.categoryAffinity[c] ?? 0) > 0);
  if (likedCategory) parts.push(`you've liked other ${INTERESTS[likedCategory].shortLabel.toLowerCase()} events`);
  const [first, ...rest] = parts;
  return rest.length === 0 ? `${first}.` : `${first} — ${rest.slice(0, 2).join(', and ')}.`;
}

export function toRuleRecommendation(student: Student, scored: ScoredEvent, signals: FeedbackSignals): Recommendation {
  return {
    eventId: scored.event.id,
    score: scored.score,
    scoreSource: 'rules',
    reason: explainScore(student, scored, signals),
    matchedInterests: scored.matchedInterests.map((id) => INTERESTS[id].shortLabel),
    socialNote: null,
    breakdown: scored.breakdown,
  };
}
