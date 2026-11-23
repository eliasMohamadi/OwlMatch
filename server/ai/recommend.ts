import { createHash } from 'node:crypto';
import { aiRankingResponseSchema } from '../../shared/schemas';
import {
  type FeedbackSignals,
  type ScoredEvent,
  filterEligible,
  learnFromSwipes,
  rankByCategoryOnly,
  rankEvents,
  toRuleRecommendation,
} from '../../shared/ranking';
import type {
  ComparisonResponse,
  Database,
  DiscoverFilters,
  Recommendation,
  RecommendationItem,
  RecommendationsResponse,
  Student,
} from '../../shared/types';
import { INTERESTS } from '../../shared/interests';
import { toEventView } from '../services/eventViews';
import { generateJson } from './gemini';
import { compactStudent, rankingPrompt } from './prompts';

/** How many top rule-ranked events Gemini re-ranks. Keeps prompts small and fast. */
const SHORTLIST_SIZE = 10;
const MAX_DECK_SIZE = 30;
const COMPARISON_SIZE = 5;
const CACHE_TTL_MS = 15 * 60 * 1000;
/** Bounds memory on a long-running server; the oldest entries go first. */
export const MAX_CACHE_ENTRIES = 300;
/**
 * Student-posted events contain text anyone can write, which reaches Gemini.
 * Gemini may lift such an event at most this far above its rule-based score,
 * so a description saying "rank this 100" can't push it to the top on its own.
 */
export const MAX_AI_BOOST_FOR_STUDENT_EVENTS = 25;

interface AiRank {
  score: number;
  reason: string;
  matchedInterests: string[];
  socialNote: string | null;
}

type RerankResult = { ok: true; ranks: Map<string, AiRank> } | { ok: false; reason: string };

/** Cache keyed by (a hash of) everything that can change the answer, so a new swipe or event busts it. */
const rerankCache = new Map<string, { at: number; ranks: Map<string, AiRank> }>();

function cacheRanks(key: string, ranks: Map<string, AiRank>, now: number): void {
  for (const [k, entry] of rerankCache) if (now - entry.at >= CACHE_TTL_MS) rerankCache.delete(k);
  rerankCache.delete(key);
  rerankCache.set(key, { at: now, ranks });
  while (rerankCache.size > MAX_CACHE_ENTRIES) rerankCache.delete(rerankCache.keys().next().value!);
}

export const rerankCacheSize = (): number => rerankCache.size;

export const clampScore = (score: number): number => Math.max(0, Math.min(100, Math.round(score)));

function swipeHistory(db: Readonly<Database>, studentId: string) {
  return db.swipes.filter((s) => s.studentId === studentId);
}

function titlesFor(db: Readonly<Database>, signals: FeedbackSignals) {
  const title = (id: string) => db.events.find((e) => e.id === id)?.title;
  return {
    liked: [...signals.likedEventIds].map(title).filter((t): t is string => Boolean(t)),
    passed: [...signals.passedEventIds].map(title).filter((t): t is string => Boolean(t)),
  };
}

/**
 * Steps B–D: Gemini re-ranks the rule-based shortlist. Only ids from the
 * shortlist are accepted; scores are clamped; anything malformed is dropped.
 */
async function rerankWithGemini(
  db: Readonly<Database>,
  student: Student,
  shortlist: ScoredEvent[],
  signals: FeedbackSignals,
): Promise<RerankResult> {
  const key = createHash('sha256')
    .update(JSON.stringify([student, [...signals.likedEventIds], [...signals.passedEventIds], shortlist.map((s) => s.event.id)]))
    .digest('base64url');
  const cached = rerankCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return { ok: true, ranks: cached.ranks };

  const { liked, passed } = titlesFor(db, signals);
  const prompt = rankingPrompt(compactStudent(student, liked, passed), shortlist.map((s) => s.event));
  const result = await generateJson(prompt, aiRankingResponseSchema);
  if (!result.ok) return result;

  const allowed = new Set(shortlist.map((s) => s.event.id));
  const ranks = new Map<string, AiRank>();
  for (const r of result.data.rankings) {
    if (!allowed.has(r.eventId) || ranks.has(r.eventId)) continue; // grounding: drop unknown or duplicate ids
    ranks.set(r.eventId, {
      score: clampScore(r.score),
      reason: r.reason.trim(),
      matchedInterests: r.matchedInterests,
      socialNote: r.socialNote?.trim() || null,
    });
  }
  if (ranks.size === 0) return { ok: false, reason: 'Gemini returned no valid event ids' };
  cacheRanks(key, ranks, Date.now());
  return { ok: true, ranks };
}

function toItem(db: Readonly<Database>, viewerId: string, scored: ScoredEvent, recommendation: Recommendation): RecommendationItem {
  return { event: toEventView(db, scored.event, viewerId), recommendation };
}

export interface RecommendOptions {
  now: Date;
  includeSwiped?: boolean;
  limit?: number;
}

export async function recommend(
  db: Readonly<Database>,
  student: Student,
  filters: DiscoverFilters,
  { now, includeSwiped = false, limit = MAX_DECK_SIZE }: RecommendOptions,
): Promise<RecommendationsResponse> {
  const swipes = swipeHistory(db, student.id);
  const signals = learnFromSwipes(swipes, db.events);
  const eligible = filterEligible(db.events, {
    student,
    now,
    filters,
    includeSwiped,
    swipedEventIds: new Set(swipes.map((s) => s.eventId)),
  });
  const ranked = rankEvents(student, eligible, signals).slice(0, limit);
  const ruleItem = (s: ScoredEvent) => toItem(db, student.id, s, toRuleRecommendation(student, s, signals));

  if (ranked.length === 0) return { mode: 'ai', notice: null, items: [] };

  const shortlist = ranked.slice(0, SHORTLIST_SIZE);
  const rerank = await rerankWithGemini(db, student, shortlist, signals);
  if (!rerank.ok) {
    console.warn(`[ai] ranking fallback: ${rerank.reason}`);
    return { mode: 'fallback', notice: rerank.reason, items: ranked.map(ruleItem) };
  }

  const aiItems = shortlist
    .filter((s) => rerank.ranks.has(s.event.id))
    .map((s) => {
      const ai = rerank.ranks.get(s.event.id)!;
      const score = s.event.source.type === 'student' ? Math.min(ai.score, clampScore(s.score + MAX_AI_BOOST_FOR_STUDENT_EVENTS)) : ai.score;
      return toItem(db, student.id, s, {
        eventId: s.event.id,
        score,
        scoreSource: 'ai',
        reason: ai.reason,
        matchedInterests: ai.matchedInterests,
        socialNote: ai.socialNote,
        breakdown: s.breakdown,
      });
    })
    .sort((a, b) => b.recommendation.score - a.recommendation.score);
  const rest = ranked.filter((s) => !rerank.ranks.has(s.event.id)).map(ruleItem);
  return { mode: 'ai', notice: null, items: [...aiItems, ...rest] };
}

/** "Why AI?" view: the same events ranked by category overlap vs. the full pipeline. */
export async function compareRankings(db: Readonly<Database>, student: Student, now: Date): Promise<ComparisonResponse> {
  const swipes = swipeHistory(db, student.id);
  const eligible = filterEligible(db.events, {
    student,
    now,
    filters: {},
    includeSwiped: true,
    swipedEventIds: new Set(swipes.map((s) => s.eventId)),
  });
  const categoryOnly = rankByCategoryOnly(student, eligible)
    .slice(0, COMPARISON_SIZE)
    .map((s) =>
      toItem(db, student.id, s, {
        eventId: s.event.id,
        score: s.score,
        scoreSource: 'rules',
        reason: `Shares the category ${s.matchedInterests.map((id) => INTERESTS[id].shortLabel).join(' + ')}.`,
        matchedInterests: s.matchedInterests.map((id) => INTERESTS[id].shortLabel),
        socialNote: null,
        breakdown: s.breakdown,
      }),
    );
  const personalized = await recommend(db, student, {}, { now, includeSwiped: true, limit: SHORTLIST_SIZE });
  return { categoryOnly, personalized: { ...personalized, items: personalized.items.slice(0, COMPARISON_SIZE) } };
}
