import type { z } from 'zod';
import type {
  aiProfileSchema,
  availabilitySchema,
  campusEventSchema,
  campusPreferenceSchema,
  campusSchema,
  conciergeIntentSchema,
  connectionSchema,
  databaseSchema,
  discoverFiltersSchema,
  eventCampusSchema,
  externalListingSchema,
  joinRequestSchema,
  newEventInputSchema,
  onboardingInputSchema,
  studentSchema,
  swipeDecisionSchema,
  swipeSchema,
} from './schemas';

export type { InterestId } from './interests';

export type Campus = z.infer<typeof campusSchema>;
export type EventCampus = z.infer<typeof eventCampusSchema>;
export type ExternalListing = z.infer<typeof externalListingSchema>;
export type CampusPreference = z.infer<typeof campusPreferenceSchema>;
export type Availability = z.infer<typeof availabilitySchema>;
export type AiProfile = z.infer<typeof aiProfileSchema>;
export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
export type Student = z.infer<typeof studentSchema>;
export type CampusEvent = z.infer<typeof campusEventSchema>;
export type NewEventInput = z.infer<typeof newEventInputSchema>;
export type Swipe = z.infer<typeof swipeSchema>;
export type SwipeDecision = z.infer<typeof swipeDecisionSchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type JoinRequest = z.infer<typeof joinRequestSchema>;
export type Database = z.infer<typeof databaseSchema>;
export type DiscoverFilters = z.infer<typeof discoverFiltersSchema>;
export type ConciergeIntent = z.infer<typeof conciergeIntentSchema>;

/** Public, privacy-safe view of another student. */
export interface StudentSummary {
  id: string;
  name: string;
  major: string;
  year: string;
  avatarColor: string;
  onboarded: boolean;
}

/** An event as one particular viewer is allowed to see it. */
export interface EventView extends Omit<CampusEvent, 'address' | 'reports'> {
  /** null when the precise location is withheld from this viewer. */
  address: string | null;
  locationNote: string | null;
  interestedCount: number;
  goingTogetherCount: number;
  reportCount: number;
  viewer: {
    decision: SwipeDecision | null;
    optedIn: boolean;
    isHost: boolean;
    joinStatus: JoinRequest['status'] | null;
  };
}

export type ScoreSource = 'ai' | 'rules';

export interface ScoreBreakdown {
  interest: number;
  keyword: number;
  availability: number;
  social: number;
  feedback: number;
}

export interface Recommendation {
  eventId: string;
  /** 0–100. From Gemini when scoreSource is "ai", from the weighted rules otherwise. */
  score: number;
  scoreSource: ScoreSource;
  reason: string;
  matchedInterests: string[];
  socialNote: string | null;
  breakdown: ScoreBreakdown;
}

export interface RecommendationItem {
  event: EventView;
  recommendation: Recommendation;
}

export type AiMode = 'ai' | 'fallback';

export interface RecommendationsResponse {
  mode: AiMode;
  /** Human-readable reason when mode is "fallback". */
  notice: string | null;
  items: RecommendationItem[];
}

export interface ComparisonResponse {
  categoryOnly: RecommendationItem[];
  personalized: RecommendationsResponse;
}

export interface ConciergeResponse {
  mode: AiMode;
  reply: string;
  intent: ConciergeIntent;
  relaxed: string[];
  items: RecommendationItem[];
}

export interface PersonGoing {
  id: string;
  name: string;
  major: string;
  year: string;
  avatarColor: string;
  sharedInterests: string[];
  isHost: boolean;
}

export interface PeopleResponse {
  interestedCount: number;
  goingTogetherCount: number;
  /** Only populated when the viewer has opted in themselves (mutual visibility). */
  people: PersonGoing[];
  viewerOptedIn: boolean;
}

export interface MatchesResponse {
  interested: EventView[];
  hosting: EventView[];
  past: EventView[];
  pendingRequests: { event: EventView; student: StudentSummary }[];
}

export interface HealthResponse {
  ok: true;
  ai: { configured: boolean; model: string };
  storage: 'json-file';
}
