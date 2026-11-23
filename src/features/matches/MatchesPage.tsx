import { CalendarPlus, Check, Compass, Heart, PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { EventView } from '@shared/types';
import { Button, buttonStyles } from '../../components/ui/Button';
import { Avatar, Badge, EmptyState, Skeleton } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useMatches, useUnswipe } from '../../lib/queries';
import { detailLine } from '@shared/text';
import { useQueryClient } from '@tanstack/react-query';
import { EventCover } from '../events/EventCover';
import { calendarLinkFor, eventWhenLabel } from '../events/eventMeta';
import { SwipeToRemoveRow } from './SwipeToRemoveRow';

const TABS = [
  { id: 'interested', label: 'Interested' },
  { id: 'hosting', label: 'Hosting' },
  { id: 'past', label: 'Past' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function MatchesPage() {
  const [tab, setTab] = useState<Tab>('interested');
  const { data, isLoading } = useMatches();
  const unswipe = useUnswipe();
  const toast = useToast();
  /** The one Interested row whose delete button is showing. */
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  /** Rows removed on this screen, hidden right away while the server catches up. */
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const lists = {
    interested: (data?.interested ?? []).filter((e) => !removedIds.has(e.id)),
    hosting: data?.hosting ?? [],
    past: data?.past ?? [],
  };

  /** Same as "Not interested anymore": also clears "Going together" and any join request. */
  const removeInterest = (event: EventView) => {
    setOpenRowId(null);
    setRemovedIds((current) => new Set(current).add(event.id));
    unswipe.mutate(event.id, {
      onSuccess: () => toast('Removed from your interests'),
      onError: () => {
        setRemovedIds((current) => {
          const next = new Set(current);
          next.delete(event.id);
          return next;
        });
        toast(`Couldn't remove ${event.title}. Try again.`, 'error');
      },
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-medium text-muted">Your campus life</p>
      <h1 className="text-[1.85rem] leading-none font-extrabold tracking-[-0.04em] text-ink">My Matches</h1>

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <Stat value={lists.interested.length} label="Upcoming" />
        <Stat value={lists.interested.filter((e) => e.viewer.optedIn).length} label="Going together" />
        <Stat value={lists.hosting.length} label="Hosting" />
      </div>

      <div role="tablist" aria-label="Match lists" className="mt-6 flex gap-1 rounded-full bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn('h-10 flex-1 rounded-full text-sm font-semibold transition-colors', tab === t.id ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink')}
          >
            {t.label}
            <span className="ml-1 text-muted">{lists[t.id].length}</span>
          </button>
        ))}
      </div>

      <div className="mt-5" role="tabpanel">
        {tab === 'hosting' && data && data.pendingRequests.length > 0 && <PendingRequests requests={data.pendingRequests} />}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : lists[tab].length === 0 ? (
          <EmptyForTab tab={tab} />
        ) : (
          <>
            {tab === 'interested' && <p className="mb-2.5 text-xs text-muted">Swipe an event left to remove it.</p>}
            <ul className="space-y-3">
              {lists[tab].map((event) => (
                <li key={event.id}>
                  {tab === 'interested' ? (
                    <SwipeToRemoveRow
                      open={openRowId === event.id}
                      onOpenChange={(open) => setOpenRowId(open ? event.id : (current) => (current === event.id ? null : current))}
                      onRemove={() => removeInterest(event)}
                      label={event.title}
                    >
                      <MatchRow event={event} />
                    </SwipeToRemoveRow>
                  ) : (
                    <MatchRow event={event} />
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3.5">
      <p className="text-2xl font-extrabold tracking-tight text-ink">{value}</p>
      <p className="text-xs font-medium text-muted">{label}</p>
    </div>
  );
}

function MatchRow({ event }: { event: EventView }) {
  return (
    <article className="flex gap-3.5 rounded-[1.5rem] border border-line bg-white p-3 transition-shadow hover:shadow-card">
      <Link to={`/events/${event.id}`} className="shrink-0" aria-label={`Open ${event.title}`}>
        <EventCover imageUrl={event.coverImageUrl} category={event.categories[0]} title={event.title} className="h-24 w-24 rounded-2xl" iconSize={64} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link to={`/events/${event.id}`} className="line-clamp-2 leading-snug font-bold text-ink hover:underline">
          {event.title}
        </Link>
        <p className="mt-0.5 text-sm text-muted">{eventWhenLabel(event)}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          {event.viewer.isHost && <Badge tone="dark">Hosting</Badge>}
          {event.viewer.optedIn && <Badge tone="gold">Going together</Badge>}
          {event.viewer.joinStatus === 'pending' && <Badge tone="outline">Awaiting approval</Badge>}
          <Badge tone="outline">
            <Heart size={11} aria-hidden /> {event.interestedCount}
          </Badge>
          <a href={calendarLinkFor(event)} target="_blank" rel="noreferrer" className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-gcal px-3 text-xs font-semibold text-white hover:bg-gcal-deep" aria-label={`Add ${event.title} to Google Calendar`}>
            <CalendarPlus size={14} aria-hidden /> Calendar
          </a>
        </div>
      </div>
    </article>
  );
}

function PendingRequests({ requests }: { requests: { event: EventView; student: { id: string; name: string; avatarColor: string; major: string } }[] }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const approve = async (eventId: string, requesterId: string, name: string) => {
    await api.approve(eventId, requesterId);
    void queryClient.invalidateQueries();
    toast(`Approved ${name}. They can now see the exact location.`);
  };
  return (
    <section className="mb-5 rounded-[1.5rem] bg-gold-soft p-4">
      <h2 className="mb-3 font-bold text-ink">Join requests</h2>
      <ul className="space-y-2.5">
        {requests.map(({ event, student }) => (
          <li key={`${event.id}-${student.id}`} className="flex items-center gap-3">
            <Avatar name={student.name} color={student.avatarColor} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{detailLine(student.name.split(' ')[0], student.major)}</p>
              <p className="truncate text-xs text-muted">{event.title}</p>
            </div>
            <Button size="sm" variant="dark" icon={<Check size={14} />} onClick={() => void approve(event.id, student.id, student.name.split(' ')[0])}>
              Approve
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyForTab({ tab }: { tab: Tab }) {
  if (tab === 'hosting')
    return (
      <EmptyState
        icon={<PlusCircle size={28} />}
        title="Host your first event"
        body="Game night, pickup game, study group — post it and OwlMatch finds students who'd love it."
        action={<Link to="/create" className={buttonStyles()}>Create an event</Link>}
      />
    );
  if (tab === 'past') return <EmptyState icon={<Check size={28} />} title="No past events yet" body="Events you were interested in show up here after they happen." />;
  return (
    <EmptyState
      icon={<Compass size={28} />}
      title="Nothing saved yet"
      body="Swipe right on activities you like and they'll land here, ready for your calendar."
      action={<Link to="/discover" className={buttonStyles()}>Start discovering</Link>}
    />
  );
}
