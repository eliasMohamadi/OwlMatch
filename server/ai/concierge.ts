import { conciergeIntentSchema, conciergeReplySchema } from '../../shared/schemas';
import { campusParts, inTimeWindow } from '../../shared/time';
import { filterEligible, learnFromSwipes, rankEvents, toRuleRecommendation } from '../../shared/ranking';
import type { CampusEvent, ConciergeIntent, ConciergeResponse, Database, Student } from '../../shared/types';
import { INTERESTS } from '../../shared/interests';
import { formatList } from '../../shared/text';
import { toEventView } from '../services/eventViews';
import { generateJson } from './gemini';
import { heuristicIntent } from './heuristics';
import { compactStudent, conciergeReplyPrompt, intentPrompt } from './prompts';

const MAX_RESULTS = 3;

/** Applies the parsed intent as hard filters. Returns which filters had to be relaxed. */
function applyIntent(events: CampusEvent[], intent: ConciergeIntent, now: Date): { matches: CampusEvent[]; relaxed: string[] } {
  const byTime = (e: CampusEvent) =>
    e.kind === 'ongoing' ||
    (inTimeWindow(new Date(e.start), intent.timeWindow, now) &&
      (intent.afterHour === null || campusParts(new Date(e.start)).hour >= intent.afterHour));
  const byCampus = (e: CampusEvent) => !intent.campus || intent.campus === 'both' || e.campus === intent.campus;
  const byBeginner = (e: CampusEvent) => !intent.beginnerFriendly || e.beginnerFriendly;

  const attempts: { label: string | null; test: (e: CampusEvent) => boolean }[] = [
    { label: null, test: (e) => byTime(e) && byCampus(e) && byBeginner(e) },
    { label: 'time', test: (e) => byCampus(e) && byBeginner(e) },
    { label: 'campus', test: (e) => byTime(e) && byBeginner(e) },
  ];
  for (const attempt of attempts) {
    const matches = events.filter(attempt.test);
    if (matches.length > 0) return { matches, relaxed: attempt.label ? [attempt.label] : [] };
  }
  return { matches: [], relaxed: [] };
}

/** Folds the request into the student's profile so ranking reflects what they asked for right now. */
function studentForRequest(student: Student, intent: ConciergeIntent, message: string): Student {
  return {
    ...student,
    campus: intent.campus ?? 'both',
    interests: intent.categories.length > 0 ? intent.categories : student.interests,
    about: `${message} ${intent.keywords.join(' ')}`,
    social: { ...student.social, makeFriends: student.social.makeFriends || intent.wantsSocial, tryNew: intent.beginnerFriendly || student.social.tryNew },
    aiProfile: student.aiProfile && { ...student.aiProfile, inferredInterests: student.interests },
  };
}

export async function askConcierge(db: Readonly<Database>, student: Student, message: string, now: Date): Promise<ConciergeResponse> {
  const parsedIntent = await generateJson(intentPrompt(message), conciergeIntentSchema, { temperature: 0 });
  const intent = parsedIntent.ok ? parsedIntent.data : heuristicIntent(message);

  const visible = filterEligible(db.events, { student, now, filters: { campus: 'both' }, includeSwiped: true, swipedEventIds: new Set() });
  const { matches, relaxed } = applyIntent(visible, intent, now);
  const requestStudent = studentForRequest(student, intent, message);
  const signals = learnFromSwipes(db.swipes.filter((s) => s.studentId === student.id), db.events);
  const ranked = rankEvents(requestStudent, matches, signals).slice(0, MAX_RESULTS);

  const reply = await generateJson(
    conciergeReplyPrompt(message, compactStudent(student, [], []), ranked.map((r) => r.event), relaxed, intent.unsupported),
    conciergeReplySchema,
  );

  const allowed = new Set(ranked.map((r) => r.event.id));
  const aiReasons = new Map(reply.ok ? reply.data.picks.filter((p) => allowed.has(p.eventId)).map((p) => [p.eventId, p.reason]) : []);
  const items = ranked.map((scored) => {
    const rule = toRuleRecommendation(requestStudent, scored, signals);
    const aiReason = aiReasons.get(scored.event.id);
    return {
      event: toEventView(db, scored.event, student.id),
      recommendation: aiReason ? { ...rule, reason: aiReason, scoreSource: 'ai' as const } : rule,
    };
  });

  const mode = parsedIntent.ok && reply.ok ? 'ai' : 'fallback';
  return { mode, reply: reply.ok ? reply.data.reply : fallbackReply(intent, items.length, relaxed), intent, relaxed, items };
}

function fallbackReply(intent: ConciergeIntent, count: number, relaxed: string[]): string {
  if (count === 0) return "I couldn't find anything that fits yet. Try a different campus or time, or check back as students post new events.";
  const topics = formatList(intent.categories.map((id) => INTERESTS[id].shortLabel.toLowerCase()));
  const where = intent.campus && intent.campus !== 'both' ? ` on the ${intent.campus[0].toUpperCase()}${intent.campus.slice(1)} campus` : '';
  const relaxNote = relaxed.length ? ` Nothing matched exactly, so I loosened the ${relaxed.join(' and ')} filter.` : '';
  return `Here ${count === 1 ? 'is 1 pick' : `are ${count} picks`}${topics ? ` for ${topics}` : ''}${where}.${relaxNote}`;
}
