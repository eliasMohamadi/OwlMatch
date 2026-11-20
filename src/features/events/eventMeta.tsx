import { BadgeCheck, CalendarDays, FlaskConical, MapPin, Sparkles, Users } from 'lucide-react';
import { googleCalendarUrl } from '@shared/calendar';
import { INTERESTS } from '@shared/interests';
import { formatEventWhen } from '@shared/time';
import type { EventView, Recommendation } from '@shared/types';
import { Badge } from '../../components/ui/primitives';

/** Small shared pieces of event presentation, used by cards, lists and details. */

export const CAMPUS_LABEL = { kennesaw: 'Kennesaw Campus', marietta: 'Marietta Campus' } as const;

export function eventWhenLabel(event: Pick<EventView, 'kind' | 'start' | 'end'>): string {
  return event.kind === 'ongoing' ? 'Ongoing · drop in anytime' : formatEventWhen(event.start, event.end);
}

export function calendarLinkFor(event: EventView): string {
  const location = [event.address ?? event.venue, CAMPUS_LABEL[event.campus], 'Kennesaw State University'].join(', ');
  return googleCalendarUrl({
    title: event.title,
    start: event.start,
    end: event.kind === 'ongoing' ? new Date(new Date(event.start).getTime() + 2 * 60 * 60 * 1000).toISOString() : event.end,
    description: `${event.description}\n\nFound on OwlMatch (student-built project, not an official KSU service).`,
    location,
  });
}

export function CategoryBadges({ event, limit = 2 }: { event: Pick<EventView, 'categories'>; limit?: number }) {
  return (
    <>
      {event.categories.slice(0, limit).map((id) => (
        <Badge key={id} tone="outline">
          {INTERESTS[id].shortLabel}
        </Badge>
      ))}
    </>
  );
}

export function SourceBadge({ event }: { event: Pick<EventView, 'source' | 'organizer'> }) {
  if (event.source.type === 'sample') {
    return (
      <Badge tone="neutral">
        <FlaskConical size={12} aria-hidden /> Sample event
      </Badge>
    );
  }
  return (
    <Badge tone="neutral">
      <BadgeCheck size={12} aria-hidden /> Student-hosted
    </Badge>
  );
}

export function MatchScore({ recommendation, compact = false }: { recommendation: Recommendation; compact?: boolean }) {
  const isAi = recommendation.scoreSource === 'ai';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${isAi ? 'bg-gold text-ink' : 'bg-ink text-white'}`}
      title={isAi ? 'Relevance score from Gemini re-ranking' : 'Score from OwlMatch weighted rules (AI offline)'}
    >
      <Sparkles size={12} aria-hidden />
      {isAi ? 'AI match' : 'Match'} {recommendation.score}%{!compact && !isAi && <span className="font-medium opacity-70"> · rules</span>}
    </span>
  );
}

export function EventFacts({ event }: { event: EventView }) {
  return (
    <ul className="space-y-1.5 text-sm text-charcoal">
      <li className="flex items-center gap-2">
        <CalendarDays size={16} className="shrink-0 text-muted" aria-hidden />
        {eventWhenLabel(event)}
      </li>
      <li className="flex items-center gap-2">
        <MapPin size={16} className="shrink-0 text-muted" aria-hidden />
        <span className="truncate">
          {event.venue} · {CAMPUS_LABEL[event.campus].replace(' Campus', '')}
        </span>
      </li>
      <li className="flex items-center gap-2">
        <Users size={16} className="shrink-0 text-muted" aria-hidden />
        {event.interestedCount === 0 ? 'Be the first to show interest' : `${event.interestedCount} interested on OwlMatch`}
        {event.goingTogetherCount > 0 && <span className="text-muted">· {event.goingTogetherCount} want company</span>}
      </li>
    </ul>
  );
}
