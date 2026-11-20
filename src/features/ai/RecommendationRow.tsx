import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RecommendationItem } from '@shared/types';
import { useToast } from '../../components/ui/Toast';
import { useSwipe } from '../../lib/queries';
import { EventCover } from '../events/EventCover';
import { eventWhenLabel, MatchScore } from '../events/eventMeta';

/** Compact recommendation card used by the concierge and the comparison view. */
export function RecommendationRow({ item, showSave = true }: { item: RecommendationItem; showSave?: boolean }) {
  const { event, recommendation } = item;
  const swipe = useSwipe();
  const toast = useToast();
  const saved = event.viewer.decision === 'interested' || swipe.isSuccess;

  return (
    <article className="animate-fade-up rounded-[1.5rem] border border-line bg-white p-3 transition-shadow hover:shadow-card">
      <div className="flex gap-3">
        <Link to={`/events/${event.id}`} className="shrink-0" aria-label={`Open ${event.title}`}>
          <EventCover imageUrl={event.coverImageUrl} category={event.categories[0]} title={event.title} className="h-20 w-20 rounded-2xl" iconSize={56} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/events/${event.id}`} className="line-clamp-2 leading-snug font-bold text-ink hover:underline">
            {event.title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted">
            {eventWhenLabel(event)} · {event.campus === 'marietta' ? 'Marietta' : 'Kennesaw'}
          </p>
          <div className="mt-1.5">
            <MatchScore recommendation={recommendation} compact />
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-sm leading-snug text-charcoal">{recommendation.reason}</p>
      {showSave && !event.viewer.isHost && (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            disabled={saved || swipe.isPending}
            onClick={() => swipe.mutate({ eventId: event.id, decision: 'interested' }, { onSuccess: () => toast('Saved to My Matches') })}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gold px-3.5 text-xs font-bold text-ink disabled:bg-surface disabled:text-muted"
          >
            <Heart size={14} fill="currentColor" aria-hidden /> {saved ? 'Saved' : "I'm interested"}
          </button>
          <Link to={`/events/${event.id}`} className="inline-flex h-9 items-center rounded-full bg-surface px-3.5 text-xs font-bold text-ink hover:bg-line">
            View details
          </Link>
        </div>
      )}
    </article>
  );
}
