import { INTEREST_LIST, isInterestId, type InterestId } from '../../shared/interests';
import { includesAny, interestsMentioned, tokenize } from '../../shared/text';
import type { AiProfile, ConciergeIntent, OnboardingInput } from '../../shared/types';

/**
 * Rule-based stand-ins for the Gemini steps. They keep OwlMatch useful with
 * no API key, and they are labeled "heuristic" wherever their output shows.
 */

const SMALL_GROUP_PHRASES = ['small group', 'smaller group', 'small-group', 'few people', 'introvert', 'not big crowds', 'low-key', 'casual'];
const LARGE_GROUP_PHRASES = ['big group', 'large group', 'big events', 'crowd', 'party'];
const RELAXED_PHRASES = ['chill', 'relaxed', 'casual', 'calm', 'low-key', 'laid back', 'laid-back'];
const HIGH_ENERGY_PHRASES = ['competitive', 'high energy', 'high-energy', 'intense', 'hype'];
const FRIEND_PHRASES = ['meet new people', 'make friends', 'meet people', 'new friends', 'meet other', 'people who'];
const NEW_PHRASES = ['try something new', 'new hobby', 'beginner', 'never tried', 'start'];

const MAX_KEYWORDS = 10;

export function heuristicProfile(input: OnboardingInput, now: Date): AiProfile {
  const text = input.about;
  const mentioned = interestsMentioned(text).filter((id) => !input.interests.includes(id));
  const knownKeywords = new Set(INTEREST_LIST.flatMap((i) => i.keywords));
  const keywords = [...new Set(tokenize(text).filter((t) => knownKeywords.has(t)))].slice(0, MAX_KEYWORDS);

  const preferredGroupSize = includesAny(text, SMALL_GROUP_PHRASES)
    ? 'small'
    : includesAny(text, LARGE_GROUP_PHRASES)
      ? 'large'
      : input.social.groupSize;
  const preferredEnergy = includesAny(text, RELAXED_PHRASES)
    ? 'relaxed'
    : includesAny(text, HIGH_ENERGY_PHRASES)
      ? 'high'
      : input.social.energy;

  const goals: string[] = [];
  if (input.social.makeFriends || includesAny(text, FRIEND_PHRASES)) goals.push('Meet new people');
  if (input.social.tryNew || includesAny(text, NEW_PHRASES)) goals.push('Try something new');

  const labels = [...input.interests, ...mentioned].map((id) => INTEREST_LIST.find((i) => i.id === id)?.shortLabel.toLowerCase());
  const summary = `Into ${labels.slice(0, 4).join(', ') || 'exploring campus'}${
    preferredGroupSize === 'small' ? ', prefers smaller groups' : ''
  }${goals.length ? `; wants to ${goals.map((g) => g.toLowerCase()).join(' and ')}` : ''}.`;

  return {
    summary,
    inferredInterests: mentioned,
    keywords,
    preferredGroupSize,
    preferredEnergy,
    goals,
    source: 'heuristic',
    generatedAt: now.toISOString(),
  };
}

const CAMPUS_WORDS: [string, ConciergeIntent['campus']][] = [
  ['marietta', 'marietta'],
  ['kennesaw campus', 'kennesaw'],
  ['main campus', 'kennesaw'],
];

export function heuristicIntent(message: string): ConciergeIntent {
  const lower = message.toLowerCase();
  const campus = CAMPUS_WORDS.find(([word]) => lower.includes(word))?.[1] ?? null;
  const timeWindow: ConciergeIntent['timeWindow'] = lower.includes('weekend')
    ? 'weekend'
    : lower.includes('tonight')
      ? 'tonight'
      : lower.includes('today')
        ? 'today'
        : lower.includes('this week')
          ? 'week'
          : 'any';
  const afterMatch = lower.match(/after (\d{1,2})\s*(am|pm)?/);
  let afterHour: number | null = null;
  if (afterMatch) {
    const hour = Number(afterMatch[1]);
    // "after 5" on a campus means 5 PM unless the student says "am".
    afterHour = afterMatch[2] === 'am' ? hour : hour < 12 ? hour + 12 : hour;
  }
  const categories = interestsMentioned(message).filter(isInterestId);
  const wantsSocial = includesAny(lower, FRIEND_PHRASES) || lower.includes('fun');
  if (wantsSocial && !categories.includes('social')) categories.push('social' as InterestId);
  return {
    campus,
    categories,
    keywords: tokenize(message).slice(0, MAX_KEYWORDS),
    timeWindow,
    afterHour,
    beginnerFriendly: includesAny(lower, NEW_PHRASES),
    wantsSocial,
    unsupported: null,
  };
}
