import { CAMPUS_TIME_ZONE } from './time';

export interface CalendarEventDetails {
  title: string;
  start: string;
  end: string;
  description: string;
  location: string;
}

const GOOGLE_CALENDAR_BASE = 'https://calendar.google.com/calendar/render';

/** 2026-11-21T00:00:00.000Z → 20261121T000000Z (the format Google Calendar expects). */
export function toCalendarTimestamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Prefilled "create event" link. Times are sent in UTC (the trailing Z) so they
 * are unambiguous; `ctz` makes Google display them in campus time.
 */
export function googleCalendarUrl(details: CalendarEventDetails): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: details.title,
    dates: `${toCalendarTimestamp(details.start)}/${toCalendarTimestamp(details.end)}`,
    details: details.description,
    location: details.location,
    ctz: CAMPUS_TIME_ZONE,
  });
  return `${GOOGLE_CALENDAR_BASE}?${params.toString()}`;
}
