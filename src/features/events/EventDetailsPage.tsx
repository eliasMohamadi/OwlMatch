import { ArrowLeft, CalendarPlus, ExternalLink, Flag, Heart, HeartOff, Lock, MapPin, ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { INTERESTS } from '@shared/interests';
import type { EventView } from '@shared/types';
import { Button, buttonStyles } from '../../components/ui/Button';
import { Badge, EmptyState, Skeleton } from '../../components/ui/primitives';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useEvent, useSwipe, useUnswipe } from '../../lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import { PeopleGoing } from '../social/PeopleGoing';
import { EventCover } from './EventCover';
import { CAMPUS_LABEL, calendarLinkFor, eventWhenLabel, owlLifeRsvpLabel, placeWithCampus, SourceBadge } from './eventMeta';

const VISIBILITY_LABEL = { public: 'Public', approval: 'Approval required', invite: 'Invite only' } as const;
const VERIFICATION_LABEL = {
  'sample-data': 'Sample data — not a confirmed KSU listing',
  'demo-simulated': 'Simulated verification (demo mode) — org affiliation not verified',
  unverified: 'Unverified organizer',
  'owl-life-listing': 'Imported from an Owl Life PDF export — a snapshot, not live',
} as const;

export function EventDetailsPage() {
  const { eventId = '' } = useParams();
  const { data: event, isLoading, isError } = useEvent(eventId);
  const navigate = useNavigate();

  if (isLoading) return <DetailsSkeleton />;
  if (isError || !event)
    return (
      <EmptyState
        icon={<Sparkles size={28} />}
        title="Event not found"
        body="It may have been removed by its host."
        action={<Button onClick={() => navigate('/discover')}>Back to Discover</Button>}
      />
    );
  return <EventDetails event={event} />;
}

function EventDetails({ event }: { event: EventView }) {
  const navigate = useNavigate();
  const toast = useToast();
  const swipe = useSwipe();
  const unswipe = useUnswipe();
  const isInterested = event.viewer.decision === 'interested';

  const toggleInterest = () => {
    if (isInterested) unswipe.mutate(event.id, { onSuccess: () => toast('Removed from your matches', 'info') });
    else swipe.mutate({ eventId: event.id, decision: 'interested' }, { onSuccess: () => toast('Saved to My Matches') });
  };

  return (
    <article className="mx-auto max-w-3xl animate-fade-up">
      <button type="button" onClick={() => navigate(-1)} className="mb-4 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-sm font-semibold text-ink hover:bg-surface">
        <ArrowLeft size={18} aria-hidden /> Back
      </button>

      <div className="overflow-hidden rounded-[2rem] border border-line bg-white shadow-card">
        <EventCover imageUrl={event.coverImageUrl} category={event.categories[0]} title={event.title} className="h-56 md:h-72" iconSize={180} />
        <div className="p-5 md:p-8">
          <div className="flex flex-wrap gap-1.5">
            <SourceBadge event={event} />
            <Badge tone="outline">{CAMPUS_LABEL[event.campus]}</Badge>
            {event.categories.map((id) => (
              <Badge key={id} tone="outline">
                {INTERESTS[id].label}
              </Badge>
            ))}
          </div>
          <h1 className="mt-3 text-balance text-3xl leading-tight font-extrabold tracking-[-0.035em] text-ink md:text-4xl">{event.title}</h1>
          <p className="mt-1.5 text-[15px] text-muted">Hosted by {event.organizer.name}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Fact icon={<CalendarPlus size={18} />} label="When" value={eventWhenLabel(event)} />
            <Fact
              icon={event.address ? <MapPin size={18} /> : <Lock size={18} />}
              label="Where"
              value={event.address ? placeWithCampus(event.address, event.campus) : placeWithCampus(`${event.venue} area`, event.campus)}
              note={event.locationNote}
            />
            <Fact
              icon={<Users size={18} />}
              label="Interest"
              value={`${event.interestedCount} interested on OwlMatch`}
              note={
                event.external
                  ? (owlLifeRsvpLabel(event) ?? 'Owl Life showed no RSVP count in the snapshot')
                  : event.capacity
                    ? `Organizer capacity: ${event.capacity}`
                    : 'No capacity listed'
              }
            />
            <Fact icon={<ShieldCheck size={18} />} label="Access" value={VISIBILITY_LABEL[event.visibility]} note={VERIFICATION_LABEL[event.organizer.verification]} />
          </div>

          <p className="mt-6 text-[16px] leading-relaxed whitespace-pre-line text-charcoal">{event.description}</p>
          {event.external && <OwlLifeFacts external={event.external} />}

          {event.viewer.joinStatus && (
            <p className="mt-5 rounded-2xl bg-gold-soft px-4 py-3 text-sm font-medium text-ink">
              {event.viewer.joinStatus === 'pending' ? 'Request sent — the host will approve you before sharing the exact location.' : "You're approved! The exact location is now visible."}
            </p>
          )}

          <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
            {!event.viewer.isHost && (
              <Button
                variant={isInterested ? 'outline' : 'primary'}
                size="lg"
                onClick={toggleInterest}
                loading={swipe.isPending || unswipe.isPending}
                icon={isInterested ? <HeartOff size={18} /> : <Heart size={18} fill="currentColor" />}
              >
                {isInterested ? 'Not interested anymore' : "I'm Interested"}
              </Button>
            )}
            <a href={calendarLinkFor(event)} target="_blank" rel="noreferrer" className={buttonStyles({ variant: 'google', size: 'lg' })}>
              <CalendarPlus size={18} aria-hidden /> Add to Google Calendar
            </a>
            {event.source.type === 'owl_life_pdf' && event.source.url ? (
              <div className="sm:col-span-2">
                <a href={event.source.url} target="_blank" rel="noreferrer" className={cn(buttonStyles({ variant: 'outline', size: 'lg' }), 'w-full')}>
                  <ExternalLink size={18} aria-hidden /> Find it on Owl Life
                </a>
                <p className="mt-2 text-center text-xs text-muted">
                  The export has no per-event links. Open Owl Life's upcoming activities and search for “{event.title}” to RSVP. {event.source.label}.
                </p>
              </div>
            ) : event.source.url ? (
              <a href={event.source.url} target="_blank" rel="noreferrer" className={cn(buttonStyles({ variant: 'outline', size: 'lg' }), 'sm:col-span-2')}>
                <ExternalLink size={18} aria-hidden /> View Official Event
              </a>
            ) : (
              <p className="text-center text-xs text-muted sm:col-span-2">
                {event.source.label}. {event.source.type === 'sample' ? 'There is no official listing to link to.' : 'RSVP happens here on OwlMatch.'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <PeopleGoing event={event} />
      </div>

      <ModerationActions event={event} />
    </article>
  );
}

/** Extra facts printed on the Owl Life card, shown exactly as listed. */
function OwlLifeFacts({ external }: { external: NonNullable<EventView['external']> }) {
  const facts = [
    external.level,
    external.points !== null ? `${external.points} pts` : null,
    ...external.badges,
    ...external.requirements,
    external.printedTimeZone ? `Times listed in ${external.printedTimeZone}, shown here in Eastern time` : null,
  ].filter((fact): fact is string => Boolean(fact));
  if (facts.length === 0) return null;
  return (
    <p className="mt-3 text-sm text-muted">
      <span className="font-semibold text-charcoal">On Owl Life:</span> {facts.join(' · ')}
    </p>
  );
}

function Fact({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note?: string | null }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-surface p-4">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
        <p className="mt-0.5 text-[15px] font-semibold text-ink">{value}</p>
        {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      </div>
    </div>
  );
}

function ModerationActions({ event }: { event: EventView }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState('');
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const remove = async () => {
    if (!window.confirm("Delete this event permanently? Everyone's RSVPs and join requests for it are deleted too. This can't be undone.")) return;
    await api.removeEvent(event.id);
    void queryClient.invalidateQueries();
    toast('Event deleted', 'info');
    navigate('/matches');
  };

  const submitReport = async () => {
    await api.report(event.id, reason);
    setReportOpen(false);
    toast('Thanks — a moderator will review this event', 'info');
  };

  return (
    <div className="mt-5 flex justify-center gap-2">
      {event.viewer.isHost ? (
        <Button variant="danger" size="sm" icon={<Trash2 size={16} />} onClick={() => void remove()}>
          Delete event
        </Button>
      ) : (
        <Button variant="ghost" size="sm" icon={<Flag size={16} />} onClick={() => setReportOpen(true)}>
          Report event
        </Button>
      )}
      <Sheet open={reportOpen} onClose={() => setReportOpen(false)} title="Report this event">
        <label htmlFor="report-reason" className="text-sm font-semibold text-ink">
          What's wrong?
        </label>
        <textarea
          id="report-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-2xl border-2 border-line p-3 focus:border-ink focus:outline-none"
          placeholder="e.g. spam, unsafe, shares private info"
        />
        <Button block className="mt-4" disabled={reason.trim().length < 3} onClick={() => void submitReport()}>
          Submit report
        </Button>
      </Sheet>
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" role="status" aria-label="Loading event">
      <Skeleton className="h-64 rounded-[2rem]" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-24" />
    </div>
  );
}
