import { useQueryClient } from '@tanstack/react-query';
import { CloudOff, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscoverFilters, RecommendationItem, SwipeDecision } from '@shared/types';
import { Button } from '../../components/ui/Button';
import { EmptyState, Skeleton } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Toast';
import { useCurrentStudent, useRecommendations, useSwipe } from '../../lib/queries';
import { useSession } from '../../lib/session';
import { FilterSheet, countActiveFilters } from './FilterSheet';
import { MatchSheet } from './MatchSheet';
import { SwipeDeck } from './SwipeDeck';

export function DiscoverPage() {
  const [filters, setFilters] = useState<DiscoverFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [decided, setDecided] = useState<Set<string>>(new Set());
  const [matchedEventId, setMatchedEventId] = useState<string | null>(null);
  const { studentId } = useSession();
  const { data: student } = useCurrentStudent();
  const recommendations = useRecommendations(filters);
  const swipe = useSwipe();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  const deck = (recommendations.data?.items ?? []).filter((item) => !decided.has(item.event.id));
  const activeFilters = countActiveFilters(filters);

  const onDecide = useCallback(
    (item: RecommendationItem, decision: SwipeDecision) => {
      setDecided((current) => new Set(current).add(item.event.id));
      swipe.mutate(
        { eventId: item.event.id, decision },
        {
          onSuccess: () => {
            if (decision !== 'interested') return;
            // Settings → "Pop-up after swiping right". When off, a short toast confirms the save instead.
            if (student?.showMatchSheet === false) toast('Saved to My Matches');
            else setMatchedEventId(item.event.id);
          },
          onError: () => toast('Could not save that swipe. Check your connection.', 'error'),
        },
      );
    },
    [swipe, toast, student?.showMatchSheet],
  );

  const onOpen = useCallback((item: RecommendationItem) => navigate(`/events/${item.event.id}`), [navigate]);

  /** New picks come from the server, which re-ranks using every swipe saved so far. */
  const refresh = () => {
    setDecided(new Set());
    void queryClient.invalidateQueries({ queryKey: ['recommendations', studentId] });
  };

  return (
    <div className="mx-auto max-w-xl">
      {/* No search bar: the AI concierge handles free-text searching, so the card gets that space. */}
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">{student ? `For ${student.name.split(' ')[0]}` : ' '}</p>
          <h1 className="text-[1.85rem] leading-none font-extrabold tracking-[-0.04em] text-ink">Discover</h1>
        </div>
        <div className="flex items-center gap-2">
          <ModeIndicator mode={recommendations.data?.mode} loading={recommendations.isFetching} />
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label={activeFilters > 0 ? `Filters (${activeFilters} active)` : 'Filters'}
            className="relative flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-sm font-semibold text-ink hover:border-ink/30"
          >
            <SlidersHorizontal size={16} aria-hidden /> <span className="hidden sm:inline">Filters</span>
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[11px] font-bold text-ink">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
      </div>

      {recommendations.data?.mode === 'fallback' && (
        <p className="mb-4 hidden items-start gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-muted md:flex">
          <CloudOff size={16} className="mt-0.5 shrink-0" aria-hidden />
          AI ranking is unavailable right now, so these picks use OwlMatch's rule-based matcher.
        </p>
      )}

      {recommendations.isLoading ? (
        <DeckLoading />
      ) : recommendations.isError ? (
        <EmptyState icon={<CloudOff size={28} />} title="Couldn't load activities" body="Something went wrong reaching OwlMatch." action={<Button onClick={refresh}>Try again</Button>} />
      ) : deck.length > 0 ? (
        <SwipeDeck items={deck} onDecide={onDecide} onOpen={onOpen} />
      ) : (
        <EmptyState
          icon={<Sparkles size={28} />}
          title={decided.size > 0 ? "You've seen every pick" : 'Nothing matches yet'}
          body={
            decided.size > 0
              ? 'Refresh to get new picks re-ranked with what you just liked and passed.'
              : 'Try another campus, a wider time range, or fewer categories.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={refresh} icon={<RefreshCw size={16} />}>
                Refresh picks
              </Button>
              {activeFilters > 0 && (
                <Button variant="outline" onClick={() => setFilters({})}>
                  Clear filters
                </Button>
              )}
            </div>
          }
        />
      )}

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={(next) => {
          setDecided(new Set());
          setFilters(next);
        }}
      />
      <MatchSheet eventId={matchedEventId} onClose={() => setMatchedEventId(null)} />
    </div>
  );
}

function ModeIndicator({ mode, loading }: { mode?: 'ai' | 'fallback'; loading: boolean }) {
  if (loading) return <span className="text-xs font-semibold text-muted">Ranking…</span>;
  if (mode === 'ai')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-gold">
        <Sparkles size={12} aria-hidden /> Gemini-ranked
      </span>
    );
  if (mode === 'fallback')
    return (
      <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-muted" title="AI ranking unavailable; using OwlMatch's rule-based matcher">
        Rule-based · AI offline
      </span>
    );
  return null;
}

function DeckLoading() {
  return (
    <div className="mx-auto max-w-[26rem]" role="status">
      <div className="overflow-hidden rounded-[2rem] border border-line bg-white">
        <Skeleton className="h-48 rounded-none" />
        <div className="space-y-3 p-5">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-20" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <p className="mt-5 flex items-center justify-center gap-2 text-sm font-medium text-muted">
        <Sparkles size={16} className="animate-pulse text-gold-deep" aria-hidden />
        OwlMatch AI is ranking activities for you…
      </p>
    </div>
  );
}
