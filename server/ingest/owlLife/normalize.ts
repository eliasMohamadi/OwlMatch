import { createHash } from 'node:crypto';
import type { InterestId } from '../../../shared/interests';
import { OWL_LIFE_PDF_SOURCE } from '../../../shared/schemas';
import { CAMPUS_TIME_ZONE, zonedTimeToUtc } from '../../../shared/time';
import type { CampusEvent, EventCampus, ExternalListing } from '../../../shared/types';
import type { RawCard } from './types';

/**
 * Maps a printed Owl Life card onto OwlMatch's event model. Facts (title,
 * dates, location, organizers, RSVP snapshot) are copied, never invented.
 * OwlMatch-only matching attributes (categories, group size, energy) are
 * derived from words in the listing by fixed, documented rules.
 */

/** The general Owl Life activities page. Individual RSVP links aren't in the export. */
export const OWL_LIFE_ACTIVITIES_URL = 'https://app.suitable.co/institution/10219/activities?tab=upcoming';

const LONG_EVENT_MS = 24 * 60 * 60 * 1000;
const MAX_CATEGORIES = 3;

export interface NormalizeContext {
  /** When the PDF was printed (the "Today" in the listing). */
  snapshotAt: Date;
  /** Wall-clock zone of the printout; Suitable shows times in the viewer's zone. */
  printedZone?: string;
  /** Public URL of the cover image saved for this card, if any. */
  coverImageUrl: string | null;
}

export type MissingField = 'location' | 'organizer' | 'image' | 'rsvpCount' | 'points' | 'level';

export type NormalizeResult =
  | { ok: true; event: CampusEvent; missing: MissingField[]; notes: string[] }
  | { ok: false; reason: string };

/* ------------------------------- Dates -------------------------------- */

const MONTHS: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

/** Abbreviations Suitable appends when an event's zone differs from the viewer's. */
const ZONE_ABBREVIATIONS: Record<string, string> = {
  EST: 'America/New_York',
  EDT: 'America/New_York',
  ET: 'America/New_York',
  CST: 'America/Chicago',
  CDT: 'America/Chicago',
  CT: 'America/Chicago',
  MST: 'America/Denver',
  MDT: 'America/Denver',
  PST: 'America/Los_Angeles',
  PDT: 'America/Los_Angeles',
};

const DAY = String.raw`(Today|Tomorrow|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}(?:, \d{4})?)`;
const TIME = String.raw`(\d{1,2}:\d{2} [AP]M)`;
const ZONE = String.raw`(?: ([A-Z]{2,4}))?`;
const RANGE_SAME_DAY = new RegExp(`^${DAY} from ${TIME}${ZONE} to ${TIME}${ZONE}$`);
const DATE_TIME = new RegExp(`${DAY}, ${TIME}${ZONE}`, 'g');

export const looksLikeDateLine = (line: string): boolean => RANGE_SAME_DAY.test(line) || (line.match(DATE_TIME)?.length ?? 0) >= 2;

interface WallClock {
  date: string;
  time: string;
  zone: string | null;
}

function ymd(date: Date, zone: string): { y: number; m: number; d: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "Today" / "Nov 21" / "Jan 26, 2027" → "YYYY-MM-DD". Suitable omits the year for the current year. */
function resolveDay(day: string, snapshot: Date, zone: string): string | null {
  const today = ymd(snapshot, zone);
  if (day === 'Today' || day === 'Tomorrow') {
    const base = new Date(Date.UTC(today.y, today.m - 1, today.d + (day === 'Tomorrow' ? 1 : 0)));
    return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`;
  }
  const match = day.match(/^(\w{3}) (\d{1,2})(?:, (\d{4}))?$/);
  if (!match) return null;
  const month = MONTHS[match[1]];
  const year = match[3] ? Number(match[3]) : today.y;
  return `${year}-${pad(month)}-${pad(Number(match[2]))}`;
}

function to24h(time: string): string {
  const [, h, m, ap] = time.match(/^(\d{1,2}):(\d{2}) ([AP]M)$/) ?? [];
  const hour = (Number(h) % 12) + (ap === 'PM' ? 12 : 0);
  return `${pad(hour)}:${m}`;
}

export function parseDateLine(line: string, snapshot: Date, printedZone = CAMPUS_TIME_ZONE): { start: WallClock; end: WallClock } | null {
  const same = line.match(RANGE_SAME_DAY);
  if (same) {
    const date = resolveDay(same[1], snapshot, printedZone);
    if (!date) return null;
    return {
      start: { date, time: to24h(same[2]), zone: same[3] ?? null },
      end: { date, time: to24h(same[4]), zone: same[5] ?? same[3] ?? null },
    };
  }
  const points = [...line.matchAll(DATE_TIME)];
  if (points.length < 2) return null;
  const [a, b] = points;
  const startDate = resolveDay(a[1], snapshot, printedZone);
  const endDate = resolveDay(b[1], snapshot, printedZone);
  if (!startDate || !endDate) return null;
  return {
    start: { date: startDate, time: to24h(a[2]), zone: a[3] ?? null },
    end: { date: endDate, time: to24h(b[2]), zone: b[3] ?? null },
  };
}

/* ------------------------------ Campus -------------------------------- */

const ONLINE = /\b(teams|virtual|online|zoom|webinar)\b/i;
const HYBRID = /\bhybrid\b/i;
/** Well-known KSU buildings. Only places we are sure of; anything else stays "unspecified". */
const MARIETTA_PLACES = /marietta|marrieta|\bjmw\b|joe mack wilson|wilson student cent|norton hall|johnson library|engineering technology|\bq ?\d{3}\b|\bj building\b|k-field/i;
const KENNESAW_PLACES =
  /kennesaw|\bsrac\b|siegel|student recreation and activities|fifth third stadium|vystar arena|\balc\b|academic learning center|burruss|social science|willingham|university hall|prillaman|bagwell|morgan concert hall|legacy gazebo|campus green|english building|university village/i;

export function detectCampus(venue: string | null, title: string): { campus: EventCampus; delivery: ExternalListing['delivery'] } {
  // "Login via Kennesaw" names a sign-in method, not a place.
  const place = (venue ?? '').replace(/login via \w+/gi, '');
  const hybrid = HYBRID.test(place);
  if (!hybrid && ONLINE.test(place)) return { campus: 'online', delivery: 'online' };
  const delivery = hybrid ? 'hybrid' : place ? 'in-person' : 'unknown';
  const pick = (text: string): EventCampus | null => {
    const m = MARIETTA_PLACES.test(text);
    const k = KENNESAW_PLACES.test(text);
    if (m && k) return 'unspecified';
    if (m) return 'marietta';
    if (k) return 'kennesaw';
    return null;
  };
  return { campus: pick(place) ?? pick(title) ?? 'unspecified', delivery };
}

/* ---------------------------- Categories ------------------------------ */

/** Keyword rules per OwlMatch interest. Matched against the title (×2), venue and organizers. */
const CATEGORY_RULES: Record<InterestId, RegExp> = {
  wellness: /\b(yoga|pilates|meditation|sound bowl|well-?being|wellness|de-?stress|stress|mental|counseling|self-care|relax|owl reset|naloxone|recovery|addiction|vibe check|hugs|health|neuro nest|relationship)\b/i,
  sports: /\b(fitness|owlfit|zumba|dance basics|strength|circuits|football|basketball|climbing|plunge|class crawl|gym)\b/i,
  outdoors: /\b(outdoor|outdoors|bike|bikes|bicycle|canoe|camp|national park|nature|gardening|garden|plunge|hike|hiking)\b/i,
  career: /\b(tutoring|study|studying|math|factoring|derivatives|antiderivatives|calculus|proofreading|writing center|revision|editing|time management|procrastination|test anxiety|study skills|internship|career|job|teacher|scholarship|research|symposium|showcase|major fair|syllabus|c-day|financial literacy|wise wallets|strengths|info session|academic|lecture|panel|first tuesday)\b/i,
  tech: /\b(generative ai|ai|digital tools|code|coding|computing|c-day|tech|technology)\b/i,
  engineering: /\b(nasa|engineering|robotics|aerospace)\b/i,
  gaming: /\b(arcade|bingo|mafia|trivia|game night|just dance|board games?)\b/i,
  arts: /\b(paint|painting|art cart|art|sketch|ornament|craft|gingerbread|vision boards?|stuff an owl)\b/i,
  music: /\b(disco|concert|ensemble|percussion|music|band|just dance)\b/i,
  social: /\b(social|mixer|night|party|tasting|cocoa|cookies|bagels|freebies|breakfast|celebration|hangout|turn up|scrappy hour|chill|meet|welcome|white elephant|trivia|bingo|silent disco|gingerland|photos|year of thailand|multicultural|cultural|global)\b/i,
  volunteering: /\b(volunteer|volunteerism|alternative fall break|donat\w*|pantry|pantries|service project)\b/i,
  orgs: /\b(club|general body meeting|fraternity|sorority|msa|association|honors|girls who code|student government|leadership|sno)\b/i,
};

/** Suitable competency codes we can map with confidence; used only when no keyword matched. */
const COMPETENCY_FALLBACK: Record<string, InterestId> = { HW: 'wellness', CD: 'career', CE: 'volunteering', L: 'orgs' };

export function categorize(title: string, venue: string | null, organizers: string[], competencies: string[]): {
  categories: InterestId[];
  basis: ExternalListing['categoryBasis'];
  keywordTags: string[];
} {
  const scores = new Map<InterestId, number>();
  const tags = new Set<string>();
  const scan = (text: string, weight: number) => {
    for (const [id, rule] of Object.entries(CATEGORY_RULES) as [InterestId, RegExp][]) {
      const hits = text.match(new RegExp(rule.source, 'gi'));
      if (!hits) continue;
      scores.set(id, (scores.get(id) ?? 0) + weight * hits.length);
      if (weight > 1) for (const hit of hits) tags.add(hit.toLowerCase());
    }
  };
  scan(title, 2);
  scan(`${venue ?? ''} ${organizers.join(' ')}`, 1);
  // Only the title decides categories; venue/organizer hits break ties.
  const fromTitle = [...scores.entries()].filter(([id]) => CATEGORY_RULES[id].test(title));
  if (fromTitle.length > 0) {
    const categories = fromTitle.sort((a, b) => b[1] - a[1]).slice(0, MAX_CATEGORIES).map(([id]) => id);
    return { categories, basis: 'keywords', keywordTags: [...tags] };
  }
  // No title words matched: fall back to the venue and organizer names (e.g. "Academic Coaching").
  if (scores.size > 0) {
    const categories = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_CATEGORIES).map(([id]) => id);
    return { categories, basis: 'keywords', keywordTags: [] };
  }
  const mapped = [...new Set(competencies.map((c) => COMPETENCY_FALLBACK[c]).filter(Boolean))].slice(0, MAX_CATEGORIES);
  if (mapped.length > 0) return { categories: mapped, basis: 'competencies', keywordTags: [] };
  return { categories: ['social'], basis: 'default', keywordTags: [] };
}

const CALM = /\b(yoga|pilates|meditation|sound bowl)\b/i;
const HIGH_ENERGY = /\b(fitness|owlfit|zumba|dance|strength|circuits|football|basketball|climbing|bike ride|plunge|disco|turn up|scrappy hour|arcade|crawl|competition)\b/i;
const LARGE = /\b(football|basketball|stadium|arena|showcase|symposium|fair|ballrooms?|celebration|c-day|plunge|first day|welcome)\b/i;
const SMALL = /\b(workshop|tutoring|coaching|club|meeting|clinic|class|studio|lounge|cart|session|training|study hall)\b/i;
const BEGINNER = /\b(intro|introduction|beginners?|basics|101|clinics?|info session|first contact)\b/i;

/* ----------------------------- Assembly ------------------------------- */

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Suitable sometimes prints a title twice ("Percussion Ensemble Percussion Ensemble"). */
export function cleanTitle(raw: string): string {
  const title = collapse(raw);
  const words = title.split(' ');
  if (words.length % 2 === 0) {
    const half = words.length / 2;
    const a = words.slice(0, half).join(' ');
    if (a === words.slice(half).join(' ')) return a;
  }
  return title;
}

export function fingerprintOf(title: string, start: string, end: string, venue: string | null): string {
  return [title.toLowerCase(), start, end, collapse(venue ?? '').toLowerCase()].join('|');
}

function snapshotLabel(at: Date): string {
  const when = new Intl.DateTimeFormat('en-US', { timeZone: CAMPUS_TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(at);
  return `Owl Life PDF snapshot · ${when} ET`;
}

function parseRsvp(badges: string[]): { count: number | null; limit: number | null } {
  for (const badge of badges) {
    const m = badge.match(/^RSVPs: (\d+)(?: \/ (\d+))?$/);
    if (m) return { count: Number(m[1]), limit: m[2] ? Number(m[2]) : null };
  }
  return { count: null, limit: null };
}

function describe(title: string, venue: string | null, organizers: string[], external: ExternalListing): string {
  const who = organizers.length ? ` from ${organizers.join(', ')}` : '';
  const where = venue ? ` Location as listed: ${venue}.` : ' No location was listed.';
  const extras = [
    external.badges.includes('Incentivized Activity') ? 'Marked as an incentivized activity on Owl Life.' : '',
    external.requirements.length ? `Owl Life notes: ${external.requirements.join(', ')}.` : '',
  ].filter(Boolean);
  return collapse(
    `"${title}" is an Owl Life activity${who}.${where} ${extras.join(' ')} The Owl Life export has no event description, so check Owl Life for full details.`,
  );
}

export function normalizeCard(card: RawCard, ctx: NormalizeContext): NormalizeResult {
  const printedZone = ctx.printedZone ?? CAMPUS_TIME_ZONE;
  const rawTitle = collapse(card.titleLines.join(' '));
  if (!rawTitle) return { ok: false, reason: 'No title' };
  const title = cleanTitle(rawTitle);

  const lines = card.detailLines.map((parts) => collapse(parts.join(' ')));
  const dateLineIndex = lines.findIndex(looksLikeDateLine);
  if (dateLineIndex === -1) return { ok: false, reason: `No readable date/time (${lines.join(' / ') || 'nothing printed'})` };
  const parsed = parseDateLine(lines[dateLineIndex], ctx.snapshotAt, printedZone);
  if (!parsed) return { ok: false, reason: `Unreadable date/time "${lines[dateLineIndex]}"` };

  const zoneOf = (abbr: string | null) => (abbr ? ZONE_ABBREVIATIONS[abbr] : printedZone);
  const startZone = zoneOf(parsed.start.zone);
  const endZone = zoneOf(parsed.end.zone);
  if (!startZone || !endZone) return { ok: false, reason: `Unknown time zone "${parsed.start.zone ?? parsed.end.zone}"` };
  const start = zonedTimeToUtc(parsed.start.date, parsed.start.time, startZone);
  const end = zonedTimeToUtc(parsed.end.date, parsed.end.time, endZone);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { ok: false, reason: `Invalid date "${lines[dateLineIndex]}"` };
  if (end.getTime() <= start.getTime()) return { ok: false, reason: `Ends before it starts ("${lines[dateLineIndex]}")` };

  const venueLines = lines.filter((_, i) => i !== dateLineIndex);
  const venue = venueLines.length ? venueLines.join(', ') : null;
  // Suitable cuts long names with "..."; an ellipsis character keeps that visible without reading as punctuation.
  const organizers = [...new Set(card.organizers.map((o) => collapse(o).replace(/\s*\.\.\.$/, '…')).filter(Boolean))];
  const { campus, delivery } = detectCampus(venue, title);
  const { categories, basis, keywordTags } = categorize(title, venue, organizers, card.competencies);
  const rsvp = parseRsvp(card.badges);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const fingerprint = fingerprintOf(title, startIso, endIso, venue);
  const printedTimeZone = parsed.start.zone ?? parsed.end.zone;

  const external: ExternalListing = {
    provider: 'owl_life',
    snapshotAt: ctx.snapshotAt.toISOString(),
    snapshotRsvpCount: rsvp.count,
    snapshotRsvpLimit: rsvp.limit,
    points: card.points,
    level: card.level,
    competencies: card.competencies,
    badges: card.badges.filter((b) => !b.startsWith('RSVPs:')),
    requirements: card.requirements,
    organizers,
    delivery,
    originalTitle: title === rawTitle ? null : rawTitle,
    printedTimeZone,
    categoryBasis: basis,
    pdfPages: card.pages,
    fingerprint,
  };

  const matchText = `${title} ${venue ?? ''}`;
  const event: CampusEvent = {
    id: `owl-${createHash('sha1').update(fingerprint).digest('hex').slice(0, 12)}`,
    title,
    description: describe(title, venue, organizers, external),
    categories,
    tags: ['owl life', ...(delivery === 'online' || delivery === 'hybrid' ? [delivery] : []), ...keywordTags].slice(0, 8),
    kind: end.getTime() - start.getTime() > LONG_EVENT_MS ? 'ongoing' : 'event',
    campus,
    venue: venue ?? 'Location not listed',
    address: venue ?? 'Location not listed on Owl Life',
    start: startIso,
    end: endIso,
    groupSize: LARGE.test(matchText) ? 'large' : SMALL.test(matchText) ? 'small' : 'medium',
    energy: HIGH_ENERGY.test(title) && !CALM.test(title) ? 'high' : 'relaxed',
    beginnerFriendly: BEGINNER.test(title),
    capacity: null,
    visibility: 'public',
    organizer: { name: organizers.join(' · ') || 'Organizer not listed', kind: 'organization', studentId: null, verification: 'owl-life-listing' },
    source: { type: OWL_LIFE_PDF_SOURCE, label: snapshotLabel(ctx.snapshotAt), url: OWL_LIFE_ACTIVITIES_URL, verifiedAt: ctx.snapshotAt.toISOString() },
    rsvpUrl: null,
    coverImageUrl: ctx.coverImageUrl,
    createdAt: ctx.snapshotAt.toISOString(),
    status: 'active',
    reports: [],
    external,
  };

  const missing: MissingField[] = [];
  if (!venue) missing.push('location');
  if (organizers.length === 0) missing.push('organizer');
  if (!ctx.coverImageUrl) missing.push('image');
  if (rsvp.count === null) missing.push('rsvpCount');
  if (card.points === null) missing.push('points');
  if (!card.level) missing.push('level');

  const notes: string[] = [];
  if (external.originalTitle) notes.push(`Title printed twice; shown as "${title}"`);
  if (printedTimeZone) notes.push(`Times printed in ${printedTimeZone}; converted from ${startZone}`);
  if (campus === 'unspecified') notes.push(`Campus not determinable from "${venue ?? 'no location'}"`);
  if (basis !== 'keywords') notes.push(`Categories from ${basis === 'competencies' ? 'competency codes' : 'default'}: ${categories.join(', ')}`);
  return { ok: true, event, missing, notes };
}
