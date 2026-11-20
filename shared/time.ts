/**
 * Time helpers. Both KSU campuses are in America/New_York, so every wall-clock
 * interpretation (availability, "this weekend", calendar links) uses that zone
 * regardless of the server's or viewer's machine time zone.
 */
export const CAMPUS_TIME_ZONE = 'America/New_York';

const MORNING_END_HOUR = 12;
const AFTERNOON_END_HOUR = 17;

export type DayPart = 'morning' | 'afternoon' | 'evening';

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPUS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

export function campusParts(date: Date): ZonedParts {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

/** Converts a campus wall-clock date/time ("2026-11-21", "19:30") to a UTC Date. */
export function campusTimeToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const asIfUtc = Date.UTC(y, m - 1, d, hh, mm);
  // Find the zone offset at that instant, then correct once more for DST edges.
  let guess = asIfUtc;
  for (let i = 0; i < 2; i += 1) {
    const p = campusParts(new Date(guess));
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += asIfUtc - shown;
  }
  return new Date(guess);
}

export function campusDateKey(date: Date): string {
  const p = campusParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function dayPartOf(date: Date): DayPart {
  const { hour } = campusParts(date);
  if (hour < MORNING_END_HOUR) return 'morning';
  if (hour < AFTERNOON_END_HOUR) return 'afternoon';
  return 'evening';
}

export function isWeekend(date: Date): boolean {
  const { weekday } = campusParts(date);
  return weekday === 0 || weekday === 6;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Campus-local date keys for the coming Saturday and Sunday (today counts if it is the weekend). */
export function upcomingWeekendKeys(now: Date): string[] {
  const { weekday } = campusParts(now);
  const daysToSaturday = weekday === 0 ? -1 : 6 - weekday;
  const saturday = new Date(now.getTime() + daysToSaturday * DAY_MS);
  const sunday = new Date(saturday.getTime() + DAY_MS);
  return [campusDateKey(saturday), campusDateKey(sunday)];
}

export type TimeWindow = 'any' | 'today' | 'tonight' | 'week' | 'weekend';

/** True when an event starting at `start` falls in the requested window relative to `now`. */
export function inTimeWindow(start: Date, window: TimeWindow, now: Date): boolean {
  switch (window) {
    case 'any':
      return true;
    case 'today':
      return campusDateKey(start) === campusDateKey(now);
    case 'tonight':
      return campusDateKey(start) === campusDateKey(now) && dayPartOf(start) === 'evening';
    case 'week':
      return start.getTime() - now.getTime() <= 7 * DAY_MS;
    case 'weekend':
      return upcomingWeekendKeys(now).includes(campusDateKey(start));
  }
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPUS_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CAMPUS_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

/** "Sat, Nov 21 · 7:00 PM – 10:00 PM" in campus time. */
export function formatEventWhen(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${dateFormatter.format(start)} · ${timeFormatter.format(start)} – ${timeFormatter.format(end)}`;
}

export function formatEventDay(startIso: string): string {
  return dateFormatter.format(new Date(startIso));
}

export function formatEventTime(startIso: string): string {
  return timeFormatter.format(new Date(startIso));
}
