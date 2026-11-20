import { INTEREST_LIST } from '../../shared/interests';
import { formatEventWhen } from '../../shared/time';
import type { CampusEvent, OnboardingInput, Student } from '../../shared/types';

/**
 * Prompt builders. Prompts only ever contain data from our own database, and
 * each one states the exact JSON contract that the zod schemas then enforce.
 */

const INTEREST_KEY = INTEREST_LIST.map((i) => `${i.id} = ${i.label}`).join('; ');
const DESCRIPTION_LIMIT = 280;

export function profilePrompt(input: OnboardingInput): string {
  return `You turn a university student's onboarding answers into a structured preference profile for a campus activity matcher.

Interest ids (use ONLY these ids): ${INTEREST_KEY}

Student answers:
${JSON.stringify(input, null, 2)}

Return JSON exactly like:
{"summary": string (one friendly sentence, max 200 chars, second person is NOT required),
 "inferredInterests": interest ids implied by the free text that the student did NOT already select,
 "keywords": up to 10 short lowercase activity keywords from the free text (e.g. "valorant", "basketball", "game dev"),
 "preferredGroupSize": "small" | "large" | "any",
 "preferredEnergy": "relaxed" | "high" | "any",
 "goals": up to 3 short goals such as "Meet new people"}
Infer only what the answers support. Do not invent hobbies. A major or degree name (e.g. "software engineering student") describes what they study, not a hobby: do not infer an interest from it.`;
}

function compactEvent(event: CampusEvent) {
  return {
    id: event.id,
    title: event.title,
    categories: event.categories,
    tags: event.tags,
    description: event.description.slice(0, DESCRIPTION_LIMIT),
    campus: event.campus,
    when: event.kind === 'ongoing' ? 'ongoing / drop-in' : formatEventWhen(event.start, event.end),
    groupSize: event.groupSize,
    energy: event.energy,
    beginnerFriendly: event.beginnerFriendly,
    hostedByStudent: event.organizer.kind === 'student',
  };
}

export function compactStudent(student: Student, likedTitles: string[], passedTitles: string[]) {
  return {
    selectedInterests: student.interests,
    inTheirOwnWords: student.about,
    aiProfile: student.aiProfile && {
      summary: student.aiProfile.summary,
      keywords: student.aiProfile.keywords,
      goals: student.aiProfile.goals,
    },
    campus: student.campus,
    availability: student.availability,
    social: student.social,
    likedBefore: likedTitles,
    passedBefore: passedTitles,
  };
}

export function rankingPrompt(profile: ReturnType<typeof compactStudent>, events: CampusEvent[]): string {
  return `You are OwlMatch's recommendation ranker for Kennesaw State University students.
Re-rank ONLY the candidate events below for this student. Never invent events, times, people or details.

Student:
${JSON.stringify(profile, null, 2)}

Candidate events:
${JSON.stringify(events.map(compactEvent), null, 2)}

For each candidate return a relevance score 0-100 and a reason.
Reason rules: 1-2 sentences, max 220 characters, address the student as "you", cite something specific they said or selected AND something specific about the event. Avoid generic praise like "aligns with your diverse interests". Vary phrasing between events. Consider semantic fit (e.g. a coder who loves games may enjoy game development even if the event is not tagged gaming), their social preferences, availability and past likes/passes.

Return JSON exactly like:
{"rankings": [{"eventId": string (must be one of the candidate ids), "score": number, "reason": string, "matchedInterests": string[] (short labels), "socialNote": string (optional, one short sentence on the social experience)}]}
Order rankings from best to worst.`;
}

export function intentPrompt(message: string): string {
  return `Extract search filters from a KSU student's request for campus activities.
Interest ids: ${INTEREST_KEY}
Campuses: "kennesaw", "marietta", or "both".

Request: ${JSON.stringify(message)}

Return JSON exactly like:
{"campus": "kennesaw" | "marietta" | "both" | null,
 "categories": interest ids clearly implied,
 "keywords": up to 8 lowercase activity keywords,
 "timeWindow": "any" | "today" | "tonight" | "weekend" | "week",
 "afterHour": 24h integer if they say e.g. "after 5" (assume PM), else null,
 "beginnerFriendly": boolean,
 "wantsSocial": boolean (they want to meet people),
 "unsupported": null, or a short note if they ask for something an event database cannot answer (e.g. parking availability, grades, dining menus)}`;
}

export function conciergeReplyPrompt(
  message: string,
  profile: ReturnType<typeof compactStudent>,
  events: CampusEvent[],
  relaxed: string[],
  unsupported: string | null,
): string {
  return `You are the OwlMatch Campus Concierge. Answer the student using ONLY the events listed. Never invent events, times, prices, people or links.

Student request: ${JSON.stringify(message)}
Student profile: ${JSON.stringify(profile)}
Matching events (already filtered by our app, best first):
${JSON.stringify(events.map(compactEvent), null, 2)}
${relaxed.length ? `Note: no exact matches, so these filters were relaxed: ${relaxed.join(', ')}. Say so briefly.` : ''}
${unsupported ? `The student also asked about something we have no data for: ${unsupported}. Say plainly that OwlMatch can't answer that part.` : ''}
${events.length === 0 ? 'There are no matching events. Say so and suggest broadening the search.' : ''}

Return JSON exactly like:
{"reply": string (2-3 friendly sentences, max 450 chars, no markdown),
 "picks": [{"eventId": string (from the list), "reason": string (one sentence tying the event to the request)}] (up to 3)}`;
}
