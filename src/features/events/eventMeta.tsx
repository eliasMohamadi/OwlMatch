import { BadgeCheck, CalendarDays, FlaskConical, ListChecks, MapPin, Sparkles, Users } from 'lucide-react';
import { googleCalendarUrl } from '@shared/calendar';
import { isDropIn } from '@shared/eventPlace';
import { INTERESTS } from '@shared/interests';
import { CAMPUS_TIME_ZONE, formatEventWhen } from '@shared/time';
import type { EventView, Recommendation } from '@shared/types';
import { Badge } from '../../components/ui/primitives';

/** Small shared pieces of event presentation, used by cards, lists and details. */

export const CAMPUS_LABEL = {
  kennesaw: 'Kennesaw Campus',
  marietta: 'Marietta Campus',
  online: 'Online',
  unspecified: 'Campus not listed',
} as const;

const isPhysicalCampus = (campus: EventView['campus']) => campus === 'kennesaw' || campus === 'marietta';

/** Short form for tight rows: "Kennesaw", "Online". Empty when the campus is unknown. */
export function campusShort(campus: EventView['campus']): string {
  return campus === 'unspecified' ? '' : CAMPUS_LABEL[campus].replace(' Campus', '');
}

export function eventWhenLabel(event: Pick<EventView, 'kind' | 'start' | 'end' | 'source'>): string {
  return isDropIn(event) ? 'Ongoing · drop in anytime' : formatEventWhen(event.start, event.end);
}

/** "Room 210, Marietta Campus" — adds the campus only if the place doesn't already name it. */
export function placeWithCampus(place: string, campus: EventView['campus']): string {
  if (!isPhysicalCampus(campus)) return place;
  return place.includes(CAMPUS_LABEL[campus]) ? place : `${place}, ${CAMPUS_LABEL[campus]}`;
}

export function calendarLinkFor(event: EventView): string {
  const place = placeWithCampus(event.address ?? event.venue, event.campus);
  const location = isPhysicalCampus(event.campus) ? `${place}, Kennesaw State University` : place;
  const listing = event.source.type === 'owl_life_pdf' && event.source.url ? `\n\nListed on Owl Life: ${event.source.url}` : '';
  return googleCalendarUrl({
    title: event.title,
    start: event.start,
    end: isDropIn(event) ? new Date(new Date(event.start).getTime() + 2 * 60 * 60 * 1000).toISOString() : event.end,
    description: `${event.description}${listing}\n\nFound on OwlMatch (student-built project, not an official KSU service).`,
    location,
  });
}

const snapshotFormatter = new Intl.DateTimeFormat('en-US', { timeZone: CAMPUS_TIME_ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "8 / 30 RSVPs on Owl Life as of Nov 20, 8:12 AM ET (snapshot)" — never presented as live. */
export function owlLifeRsvpLabel(event: Pick<EventView, 'external'>): string | null {
  const ext = event.external;
  if (!ext || ext.snapshotRsvpCount === null) return null;
  const count = ext.snapshotRsvpLimit ? `${ext.snapshotRsvpCount} / ${ext.snapshotRsvpLimit}` : String(ext.snapshotRsvpCount);
  const noun = ext.snapshotRsvpCount === 1 && !ext.snapshotRsvpLimit ? 'RSVP' : 'RSVPs';
  return `${count} ${noun} on Owl Life as of ${snapshotFormatter.format(new Date(ext.snapshotAt))} ET (snapshot)`;
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
  if (event.source.type === 'owl_life_pdf') {
    return (
      <Badge tone="gold">
        <ListChecks size={12} aria-hidden /> Owl Life listing
      </Badge>
    );
  }
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
  const rsvp = owlLifeRsvpLabel(event);
  return (
    <ul className="space-y-1.5 text-sm text-charcoal">
      <li className="flex items-center gap-2">
        <CalendarDays size={16} className="shrink-0 text-muted" aria-hidden />
        {eventWhenLabel(event)}
      </li>
      <li className="flex items-center gap-2">
        <MapPin size={16} className="shrink-0 text-muted" aria-hidden />
        <span className="truncate">{[event.venue, campusShort(event.campus)].filter(Boolean).join(' · ')}</span>
      </li>
      <li className="flex items-center gap-2">
        <Users size={16} className="shrink-0 text-muted" aria-hidden />
        {event.interestedCount === 0 ? 'Be the first to show interest' : `${event.interestedCount} interested on OwlMatch`}
        {event.goingTogetherCount > 0 && <span className="text-muted">· {event.goingTogetherCount} want company</span>}
      </li>
      {rsvp && (
        <li className="flex items-center gap-2 text-muted">
          <ListChecks size={16} className="shrink-0" aria-hidden />
          <span className="truncate">{rsvp}</span>
        </li>
      )}
    </ul>
  );
}
