import { Sparkles } from 'lucide-react';
import type { RecommendationItem } from '@shared/types';
import { Badge } from '../../components/ui/primitives';
import { EventCover } from '../events/EventCover';
import { CAMPUS_LABEL, EventFacts, MatchScore, SourceBadge } from '../events/eventMeta';
import { INTERESTS } from '@shared/interests';

/** The face of a swipe card. Purely presentational; gestures live in SwipeDeck. */
export function DiscoveryCard({ item }: { item: RecommendationItem }) {
  const { event, recommendation } = item;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-line bg-white shadow-card" aria-label={event.title}>
      <div className="relative">
        <EventCover imageUrl={event.coverImageUrl} category={event.categories[0]} title={event.title} className="h-32 shrink-0 sm:h-44" iconSize={130} />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3.5">
          <MatchScore recommendation={recommendation} />
          <SourceBadge event={event} />
        </div>
        <div className="absolute bottom-3.5 left-3.5 flex flex-wrap gap-1.5">
          <Badge tone="dark">{CAMPUS_LABEL[event.campus]}</Badge>
          <Badge className="bg-white/95 text-ink">{INTERESTS[event.categories[0]].shortLabel}</Badge>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
        <h2 className="text-balance text-[1.25rem] leading-tight sm:text-[1.35rem] font-extrabold tracking-[-0.03em] text-ink">{event.title}</h2>
        <p className="mt-1 truncate text-sm text-muted">by {event.organizer.name}</p>

        <div className="mt-3.5 rounded-2xl bg-gold-soft p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-ink uppercase">
            <Sparkles size={13} aria-hidden /> Why it's for you
          </p>
          <p className="mt-1 line-clamp-4 text-[14.5px] leading-snug text-charcoal">{recommendation.reason}</p>
        </div>

        <div className="mt-3.5">
          <EventFacts event={event} />
        </div>
      </div>
    </article>
  );
}
