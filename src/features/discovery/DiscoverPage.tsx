import { useQueryClient } from '@tanstack/react-query';
import { CloudOff, RefreshCw, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
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
  const [search, setSearch] = useState('');
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
          onSuccess: () => decision === 'interested' && setMatchedEventId(item.event.id),
          onError: () => toast('Could not save that swipe. Check your connection.', 'error'),
        },
      );
    },
    [swipe, toast],
  );

  const onOpen = useCallback((item: RecommendationItem) => navigate(`/events/${item.event.id}`), [navigate]);

  /** New picks come from the server, which re-ranks using every swipe saved so far. */
  const refresh = () => {
    setDecided(new Set());
    void queryClient.invalidateQueries({ queryKey: ['recommendations', studentId] });
  };

  const applySearch = (event: React.FormEvent) => {
    event.preventDefault();
    setDecided(new Set());
    setFilters({ ...filters, query: search.trim() || undefined });
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">{student ? `For ${student.name.split(' ')[0]}` : ' '}</p>
          <h1 className="text-[1.85rem] leading-none font-extrabold tracking-[-0.04em] text-ink">Discover</h1>
        </div>
        <ModeIndicator mode={recommendations.data?.mode} loading={recommendations.isFetching} />
      </div>

      <div className="mb-5 flex gap-2">
        <form onSubmit={applySearch} className="relative flex-1" role="search">
          <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="discover-search" className="sr-only">
            Search activities
          </label>
          <input
            id="discover-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activities"
            className="h-12 w-full rounded-full border border-line bg-white pr-4 pl-10 text-[15px] placeholder:text-neutral focus:border-ink focus:outline-none"
          />
        </form>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="relative flex h-12 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-ink/30"
        >
          <SlidersHorizontal size={18} aria-hidden /> <span className="hidden sm:inline">Filters</span>
          {activeFilters > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[11px] font-bold text-ink">
              {activeFilters}
            </span>
          )}
        </button>
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
              {(activeFilters > 0 || filters.query) && (
                <Button variant="outline" onClick={() => { setFilters({}); setSearch(''); }}>
                  Broaden search
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
          setFilters({ ...next, query: filters.query });
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
