import { z } from 'zod';
import { isInterestId, type InterestId } from '../../shared/interests';
import { energyPreferenceSchema, groupSizePreferenceSchema } from '../../shared/schemas';
import type { AiProfile, OnboardingInput } from '../../shared/types';
import { generateJson } from './gemini';
import { heuristicProfile } from './heuristics';
import { profilePrompt } from './prompts';

const MAX_SUMMARY = 200;

/** Lenient on shape details (unknown interest ids are dropped), strict on types. */
const profileDraftSchema = z.object({
  summary: z.string().min(1).transform((s) => s.slice(0, MAX_SUMMARY)),
  inferredInterests: z.array(z.string()).transform((ids) => ids.filter(isInterestId) as InterestId[]),
  keywords: z.array(z.string()).transform((k) => k.map((w) => w.toLowerCase().slice(0, 40)).slice(0, 10)),
  preferredGroupSize: groupSizePreferenceSchema.catch('any'),
  preferredEnergy: energyPreferenceSchema.catch('any'),
  goals: z.array(z.string()).transform((g) => g.map((x) => x.slice(0, 80)).slice(0, 3)),
});

/**
 * Step A of the pipeline: understand the student. Gemini reads their own words;
 * the heuristic parser takes over if Gemini is unavailable or returns bad data.
 */
export async function understandStudent(input: OnboardingInput, now: Date): Promise<AiProfile> {
  if (input.about.trim().length === 0) return heuristicProfile(input, now);
  const result = await generateJson(profilePrompt(input), profileDraftSchema, { temperature: 0.2 });
  if (!result.ok) {
    console.warn(`[ai] profile fallback: ${result.reason}`);
    return heuristicProfile(input, now);
  }
  const draft = result.data;
  return {
    ...draft,
    inferredInterests: draft.inferredInterests.filter((id) => !input.interests.includes(id)),
    source: 'gemini',
    generatedAt: now.toISOString(),
  };
}
