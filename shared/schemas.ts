import { z } from 'zod';
import { INTEREST_IDS } from './interests';

/**
 * Single source of truth for OwlMatch's data shapes. Types are inferred from
 * these schemas, and the same schemas validate API input and Gemini output.
 */

export const interestIdSchema = z.enum(INTEREST_IDS);
export const campusSchema = z.enum(['kennesaw', 'marietta']);
/**
 * Where an event happens. Students post to a physical campus; imported listings
 * can also be online, or name a place we can't honestly map to a campus.
 */
export const eventCampusSchema = z.enum(['kennesaw', 'marietta', 'online', 'unspecified']);
export const campusPreferenceSchema = z.enum(['kennesaw', 'marietta', 'both']);
export const availabilitySchema = z.enum(['weekdays', 'weekends', 'mornings', 'afternoons', 'evenings']);
export const groupSizePreferenceSchema = z.enum(['small', 'large', 'any']);
export const energyPreferenceSchema = z.enum(['relaxed', 'high', 'any']);
export const eventGroupSizeSchema = z.enum(['small', 'medium', 'large']);
export const eventEnergySchema = z.enum(['relaxed', 'high']);
export const visibilitySchema = z.enum(['public', 'approval', 'invite']);
export const eventKindSchema = z.enum(['event', 'ongoing']);
export const swipeDecisionSchema = z.enum(['interested', 'passed']);

export const socialPreferencesSchema = z.object({
  makeFriends: z.boolean(),
  groupSize: groupSizePreferenceSchema,
  tryNew: z.boolean(),
  energy: energyPreferenceSchema,
});

/** Structured profile produced from the student's own words (Gemini or heuristic). */
export const aiProfileSchema = z.object({
  summary: z.string().max(280),
  inferredInterests: z.array(interestIdSchema).max(INTEREST_IDS.length),
  keywords: z.array(z.string().min(1).max(40)).max(15),
  preferredGroupSize: groupSizePreferenceSchema,
  preferredEnergy: energyPreferenceSchema,
  goals: z.array(z.string().max(80)).max(5),
  source: z.enum(['gemini', 'heuristic']),
  generatedAt: z.string(),
});

export const onboardingInputSchema = z.object({
  campus: campusPreferenceSchema,
  interests: z.array(interestIdSchema).min(1, 'Pick at least one interest'),
  social: socialPreferencesSchema,
  about: z.string().max(600),
  availability: z.array(availabilitySchema),
});

/**
 * How a student signs in. Demo students exist only for testing and can be used
 * only by a signed-in admin. Microsoft accounts are real students identified by
 * their university tenant and Entra object id (never by email, which can change).
 * Records written before accounts existed are demo students.
 */
export const studentAccountSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('demo') }),
  z.object({
    type: z.literal('microsoft'),
    tenantId: z.string(),
    objectId: z.string(),
    email: z.string(),
    createdAt: z.string(),
    lastSignInAt: z.string(),
  }),
]);

export const studentSchema = onboardingInputSchema.extend({
  id: z.string(),
  name: z.string(),
  major: z.string(),
  year: z.string(),
  avatarColor: z.string(),
  onboarded: z.boolean(),
  socialVisible: z.boolean(),
  /** Setting: open the "You're interested!" pop-up after each right swipe. Older records default to on. */
  showMatchSheet: z.boolean().default(true),
  aiProfile: aiProfileSchema.nullable(),
  interests: z.array(interestIdSchema),
  account: studentAccountSchema.default({ type: 'demo' }),
});

export const organizerSchema = z.object({
  name: z.string(),
  kind: z.enum(['official', 'organization', 'student']),
  studentId: z.string().nullable(),
  /** Never "verified" in demo mode: we only label what we can honestly say. */
  verification: z.enum(['sample-data', 'demo-simulated', 'unverified', 'owl-life-listing']),
});

export const OWL_LIFE_PDF_SOURCE = 'owl_life_pdf';

export const eventSourceSchema = z.object({
  type: z.enum(['sample', 'student', OWL_LIFE_PDF_SOURCE]),
  label: z.string(),
  url: z.string().nullable(),
  verifiedAt: z.string().nullable(),
});

/**
 * Facts captured from an external listing at a point in time. Kept apart from
 * OwlMatch's own counts: `snapshotRsvpCount` is what Owl Life showed when the
 * export was made, never live availability.
 */
export const externalListingSchema = z.object({
  provider: z.literal('owl_life'),
  snapshotAt: z.string(),
  snapshotRsvpCount: z.number().int().nonnegative().nullable(),
  snapshotRsvpLimit: z.number().int().positive().nullable(),
  points: z.number().int().nonnegative().nullable(),
  level: z.string().nullable(),
  competencies: z.array(z.string()),
  badges: z.array(z.string()),
  requirements: z.array(z.string()),
  /** Organizer names exactly as printed (Suitable truncates long names with "..."). */
  organizers: z.array(z.string()),
  delivery: z.enum(['in-person', 'online', 'hybrid', 'unknown']),
  /** Title exactly as printed, when the display title was cleaned up. */
  originalTitle: z.string().nullable(),
  /** Time zone the listing printed, when it wasn't campus time (e.g. "CST"). */
  printedTimeZone: z.string().nullable(),
  /** Why the OwlMatch categories were chosen: keywords in the listing, competency codes, or a default. */
  categoryBasis: z.enum(['keywords', 'competencies', 'default']),
  pdfPages: z.array(z.number().int().positive()),
  fingerprint: z.string(),
});

export const reportSchema = z.object({
  studentId: z.string(),
  reason: z.string().max(300),
  at: z.string(),
});

export const campusEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  categories: z.array(interestIdSchema).min(1),
  tags: z.array(z.string()),
  kind: eventKindSchema,
  campus: eventCampusSchema,
  venue: z.string(),
  /** Precise location; redacted for approval-only events until the host approves. */
  address: z.string(),
  start: z.string(),
  end: z.string(),
  groupSize: eventGroupSizeSchema,
  energy: eventEnergySchema,
  beginnerFriendly: z.boolean(),
  capacity: z.number().int().positive().nullable(),
  visibility: visibilitySchema,
  organizer: organizerSchema,
  source: eventSourceSchema,
  rsvpUrl: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  createdAt: z.string(),
  status: z.enum(['active', 'removed']),
  reports: z.array(reportSchema),
  /** Present only on imported listings. */
  external: externalListingSchema.optional(),
});

const MAX_TITLE = 80;
const MAX_DESCRIPTION = 1200;

/** What a student submits from the Create Event form. Times are campus-local wall-clock. */
export const newEventInputSchema = z.object({
  organizerId: z.string().min(1),
  title: z.string().trim().min(3, 'Give your event a name').max(MAX_TITLE),
  description: z.string().trim().min(20, 'Add a short description (20+ characters)').max(MAX_DESCRIPTION),
  categories: z.array(interestIdSchema).min(1, 'Pick at least one category').max(3),
  campus: campusSchema,
  venue: z.string().trim().min(2, 'Where is it?').max(120),
  address: z.string().trim().max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a start time'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Pick an end time'),
  capacity: z.number().int().positive().max(5000).nullable(),
  visibility: visibilitySchema,
  groupSize: eventGroupSizeSchema,
  energy: eventEnergySchema,
  beginnerFriendly: z.boolean(),
  organizationName: z.string().trim().max(80),
  coverImageUrl: z.string().nullable(),
});

export const swipeSchema = z.object({
  studentId: z.string(),
  eventId: z.string(),
  decision: swipeDecisionSchema,
  at: z.string(),
});

/** Opt-in to "find people to go with" for one event. */
export const connectionSchema = z.object({
  studentId: z.string(),
  eventId: z.string(),
  at: z.string(),
});

export const joinRequestSchema = z.object({
  studentId: z.string(),
  eventId: z.string(),
  status: z.enum(['pending', 'approved']),
  at: z.string(),
});

export const databaseSchema = z.object({
  version: z.literal(1),
  seededAt: z.string(),
  students: z.array(studentSchema),
  events: z.array(campusEventSchema),
  swipes: z.array(swipeSchema),
  connections: z.array(connectionSchema),
  joinRequests: z.array(joinRequestSchema),
});

/** Discover filters. All optional; omitted means "use the student's profile". */
export const discoverFiltersSchema = z.object({
  campus: campusPreferenceSchema.optional(),
  categories: z.array(interestIdSchema).optional(),
  when: z.enum(['any', 'today', 'week', 'weekend']).optional(),
  kind: z.enum(['all', 'event', 'ongoing']).optional(),
  query: z.string().max(100).optional(),
});

/* ---------- Gemini output contracts (never trusted until parsed) ---------- */

export const aiRankingResponseSchema = z.object({
  rankings: z
    .array(
      z.object({
        eventId: z.string(),
        score: z.number(),
        reason: z.string().min(1).max(400),
        matchedInterests: z.array(z.string().max(40)).max(6).default([]),
        // Models sometimes send null for "no note"; treat it like an omitted field.
        socialNote: z.string().max(200).nullish(),
      }),
    )
    .max(30),
});

export const conciergeIntentSchema = z.object({
  campus: campusPreferenceSchema.nullable().default(null),
  categories: z.array(interestIdSchema).default([]),
  keywords: z.array(z.string().max(40)).max(10).default([]),
  timeWindow: z.enum(['any', 'today', 'tonight', 'weekend', 'week']).default('any'),
  afterHour: z.number().int().min(0).max(23).nullable().default(null),
  beginnerFriendly: z.boolean().default(false),
  wantsSocial: z.boolean().default(false),
  /** Set when the student asks for something OwlMatch has no data for. */
  unsupported: z.string().max(200).nullable().default(null),
});

export const conciergeReplySchema = z.object({
  reply: z.string().min(1).max(700),
  picks: z
    .array(z.object({ eventId: z.string(), reason: z.string().min(1).max(300) }))
    .max(5),
});
