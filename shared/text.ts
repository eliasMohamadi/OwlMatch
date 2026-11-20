import { INTEREST_LIST, type InterestId } from './interests';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'i', "i'm", 'im', 'in', 'into', 'is', 'it',
  'like', 'love', 'me', 'my', 'of', 'on', 'or', 'so', 'some', 'that', 'the', 'this', 'to', 'want', 'with', 'you',
  'your', 'we', 'our', 'who', 'all', 'any', 'can', 'just', 'really', 'also', 'more', 'not', 'do', 'get', 'enjoy',
  'student', 'students', 'prefer', 'something', 'find', 'about', 'am', 'will', 'bring', 'come', 'up',
]);

/** Lowercase word tokens with stop words removed and simple plural folding. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ''))
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map((word) => (word.length > 4 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word));
}

/** Interests whose keyword lists appear in free text, e.g. "I play Valorant" → gaming. */
export function interestsMentioned(text: string): InterestId[] {
  const lowered = ` ${text.toLowerCase()} `;
  const tokens = new Set(tokenize(text));
  return INTEREST_LIST.filter((interest) =>
    interest.keywords.some((keyword) =>
      keyword.includes(' ') ? lowered.includes(` ${keyword} `) || lowered.includes(keyword) : tokens.has(keyword),
    ),
  ).map((interest) => interest.id);
}

export function includesAny(text: string, phrases: readonly string[]): boolean {
  const lowered = text.toLowerCase();
  return phrases.some((phrase) => lowered.includes(phrase));
}

const listFormatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

/** ["gaming", "social", "tech"] → "gaming, social, and tech". */
export function formatList(items: readonly string[]): string {
  return listFormatter.format(items);
}
