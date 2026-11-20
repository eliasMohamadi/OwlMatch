/**
 * Interest catalog shared by onboarding, event categories and the matcher.
 * `keywords` power the lightweight semantic layer: an event that never says
 * "gaming" can still match a gamer if it talks about "game jams" or "esports".
 */
export const INTEREST_IDS = [
  'tech',
  'engineering',
  'gaming',
  'sports',
  'arts',
  'music',
  'social',
  'career',
  'outdoors',
  'wellness',
  'volunteering',
  'orgs',
] as const;

export type InterestId = (typeof INTEREST_IDS)[number];

export interface InterestDefinition {
  id: InterestId;
  label: string;
  shortLabel: string;
  keywords: readonly string[];
}

export const INTERESTS: Record<InterestId, InterestDefinition> = {
  tech: {
    id: 'tech',
    label: 'Technology & Coding',
    shortLabel: 'Tech',
    keywords: ['coding', 'code', 'programming', 'software', 'computer', 'cs', 'hackathon', 'ai', 'web', 'app', 'developer', 'python', 'javascript', 'tech', 'technology', 'cyber', 'data'],
  },
  engineering: {
    id: 'engineering',
    label: 'Engineering',
    shortLabel: 'Engineering',
    keywords: ['engineering', 'robotics', 'robot', 'hardware', 'maker', 'circuits', 'arduino', 'cad', '3d', 'printing', 'mechanical', 'electrical', 'build', 'prototype'],
  },
  gaming: {
    id: 'gaming',
    label: 'Gaming',
    shortLabel: 'Gaming',
    keywords: ['gaming', 'game', 'games', 'gamer', 'esports', 'smash', 'valorant', 'league', 'nintendo', 'console', 'tournament', 'board', 'tabletop', 'mario', 'jam', 'gamedev', 'anime'],
  },
  sports: {
    id: 'sports',
    label: 'Sports & Fitness',
    shortLabel: 'Sports',
    keywords: ['sports', 'basketball', 'soccer', 'volleyball', 'gym', 'workout', 'pickup', 'intramural', 'running', 'run', 'fitness', 'lifting', 'tennis', 'pickleball', 'frisbee'],
  },
  arts: {
    id: 'arts',
    label: 'Arts & Creativity',
    shortLabel: 'Arts',
    keywords: ['art', 'arts', 'drawing', 'draw', 'painting', 'paint', 'design', 'photography', 'craft', 'sketch', 'creative', 'illustration', 'pottery', 'anime', 'writing'],
  },
  music: {
    id: 'music',
    label: 'Music & Entertainment',
    shortLabel: 'Music',
    keywords: ['music', 'concert', 'band', 'open mic', 'karaoke', 'dj', 'movie', 'movies', 'film', 'comedy', 'jam', 'guitar', 'singing', 'theater'],
  },
  social: {
    id: 'social',
    label: 'Social Events',
    shortLabel: 'Social',
    keywords: ['social', 'meet', 'hangout', 'mixer', 'party', 'friends', 'food', 'trivia', 'people', 'new people', 'community', 'night'],
  },
  career: {
    id: 'career',
    label: 'Academic & Career',
    shortLabel: 'Career',
    keywords: ['career', 'resume', 'internship', 'networking', 'study', 'tutoring', 'interview', 'research', 'job', 'recruiters', 'academic', 'exam'],
  },
  outdoors: {
    id: 'outdoors',
    label: 'Outdoor Activities',
    shortLabel: 'Outdoors',
    keywords: ['outdoor', 'outdoors', 'hiking', 'hike', 'nature', 'camping', 'kayak', 'trail', 'climbing', 'park', 'sunset'],
  },
  wellness: {
    id: 'wellness',
    label: 'Wellness',
    shortLabel: 'Wellness',
    keywords: ['wellness', 'yoga', 'meditation', 'mental', 'health', 'mindfulness', 'stress', 'relax', 'calm', 'self-care'],
  },
  volunteering: {
    id: 'volunteering',
    label: 'Volunteering',
    shortLabel: 'Volunteer',
    keywords: ['volunteer', 'volunteering', 'service', 'community', 'donate', 'nonprofit', 'cleanup', 'food bank', 'mentoring'],
  },
  orgs: {
    id: 'orgs',
    label: 'Student Organizations',
    shortLabel: 'Orgs',
    keywords: ['club', 'organization', 'org', 'chapter', 'fraternity', 'sorority', 'general meeting', 'student government', 'leadership'],
  },
};

export const INTEREST_LIST: readonly InterestDefinition[] = INTEREST_IDS.map((id) => INTERESTS[id]);

export function isInterestId(value: string): value is InterestId {
  return (INTEREST_IDS as readonly string[]).includes(value);
}
