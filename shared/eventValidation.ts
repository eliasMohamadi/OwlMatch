import { newEventInputSchema } from './schemas';
import { campusTimeToUtc } from './time';
import type { NewEventInput } from './types';

export type FieldErrors = Partial<Record<keyof NewEventInput | 'form', string>>;

export type ValidationResult =
  | { ok: true; value: NewEventInput; start: Date; end: Date }
  | { ok: false; errors: FieldErrors };

/** Events may be planned up to this far out; anything later is almost always a typo. */
const MAX_DAYS_AHEAD = 180;
const MIN_DURATION_MINUTES = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_PATTERN = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;

/** Schema checks plus the rules a schema cannot express (dates, privacy). */
export function validateNewEvent(input: unknown, now: Date): ValidationResult {
  const parsed = newEventInputSchema.safeParse(input);
  if (!parsed.success) {
    const errors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = (issue.path[0] ?? 'form') as keyof FieldErrors;
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }

  const value = parsed.data;
  const errors: FieldErrors = {};
  const start = campusTimeToUtc(value.date, value.startTime);
  const end = campusTimeToUtc(value.date, value.endTime);

  if (Number.isNaN(start.getTime())) errors.date = 'That date is not valid';
  else if (start.getTime() < now.getTime()) errors.startTime = 'Start time is in the past';
  else if (start.getTime() - now.getTime() > MAX_DAYS_AHEAD * DAY_MS) errors.date = `Events can be at most ${MAX_DAYS_AHEAD} days out`;
  if (end.getTime() - start.getTime() < MIN_DURATION_MINUTES * 60 * 1000) errors.endTime = 'End time must be after the start time';

  const publicText = `${value.title} ${value.description}`;
  if (EMAIL_PATTERN.test(publicText) || PHONE_PATTERN.test(publicText)) {
    errors.description = 'Keep personal emails and phone numbers out of public event text';
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value, start, end };
}
