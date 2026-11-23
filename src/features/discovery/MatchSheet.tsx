import { CalendarPlus, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, buttonStyles } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { Skeleton } from '../../components/ui/primitives';
import { Sheet } from '../../components/ui/Sheet';
import { useEvent } from '../../lib/queries';
import { calendarLinkFor, eventWhenLabel } from '../events/eventMeta';
import { PeopleGoing } from '../social/PeopleGoing';

/** Shown right after a right-swipe: confirms interest and offers the social + calendar next steps. */
export function MatchSheet({ eventId, onClose }: { eventId: string | null; onClose: () => void }) {
  return (
    <Sheet open={eventId !== null} onClose={onClose} title="You're interested! ✨">
      {eventId && <MatchSheetBody eventId={eventId} onClose={onClose} />}
    </Sheet>
  );
}

function MatchSheetBody({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { data: event } = useEvent(eventId);
  if (!event) return <Skeleton className="h-60" />;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg leading-snug font-bold text-ink">{event.title}</p>
        <p className="text-sm text-muted">{eventWhenLabel(event)}</p>
      </div>
      <PeopleGoing event={event} />
      <div className="grid grid-cols-2 gap-2.5">
        <a href={calendarLinkFor(event)} target="_blank" rel="noreferrer" className={cn(buttonStyles({ variant: 'google' }), 'gap-2')}>
          <CalendarPlus size={18} aria-hidden /> Calendar
        </a>
        <Link to={`/events/${event.id}`} className={buttonStyles({ variant: 'outline' })}>
          Details <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
      <Button variant="ghost" block onClick={onClose}>
        Keep swiping
      </Button>
    </div>
  );
}
