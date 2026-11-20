import { Lock, UsersRound } from 'lucide-react';
import type { EventView } from '@shared/types';
import { Avatar, Skeleton, Toggle } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Toast';
import { useConnect, useCurrentStudent, usePeople } from '../../lib/queries';

/**
 * "Find people to go with": mutual, opt-in visibility. A student sees who else
 * opted in only after opting in themselves, and only first names + majors.
 */
export function PeopleGoing({ event }: { event: EventView }) {
  const isInterested = event.viewer.decision === 'interested';
  const { data: people, isLoading } = usePeople(event.id, isInterested || event.viewer.isHost);
  const { data: student } = useCurrentStudent();
  const connect = useConnect();
  const toast = useToast();

  const optedIn = people?.viewerOptedIn ?? event.viewer.optedIn;
  const socialHidden = student?.socialVisible === false;

  const toggle = (optIn: boolean) =>
    connect.mutate(
      { eventId: event.id, optIn },
      {
        onSuccess: () => toast(optIn ? 'You are visible to others going' : 'You are hidden for this event', 'info'),
        onError: (error) => toast(error.message, 'error'),
      },
    );

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-white p-5" aria-labelledby={`people-${event.id}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-soft">
          <UsersRound size={22} className="text-ink" aria-hidden />
        </span>
        <div>
          <h3 id={`people-${event.id}`} className="font-bold text-ink">
            Find people to go with
          </h3>
          <p className="text-sm text-muted">
            {event.interestedCount} interested on OwlMatch · {people?.goingTogetherCount ?? event.goingTogetherCount} open to meeting up
          </p>
        </div>
      </div>

      {event.viewer.isHost ? (
        <p className="mt-4 text-sm text-muted">You're hosting. Students who opt in can see that you're the host.</p>
      ) : !isInterested ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <Lock size={14} aria-hidden /> Mark yourself interested to see who else is going.
        </p>
      ) : socialHidden ? (
        <p className="mt-4 text-sm text-muted">You turned off social discovery in your Profile, so you won't appear to others.</p>
      ) : (
        <>
          <div className="mt-4 rounded-2xl bg-surface p-4">
            <Toggle
              checked={optedIn}
              disabled={connect.isPending}
              onChange={toggle}
              label="Show me to others going"
              description="Only students who also opt in can see you — first name and major only."
            />
          </div>
          {optedIn && (
            <div className="mt-4">
              {isLoading ? (
                <Skeleton className="h-14" />
              ) : people && people.people.length > 0 ? (
                <ul className="space-y-2.5">
                  {people.people.map((person) => (
                    <li key={person.id} className="flex animate-fade-up items-center gap-3">
                      <Avatar name={person.name} color={person.avatarColor} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">
                          {person.name} {person.isHost && <span className="ml-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-gold">Host</span>}
                        </p>
                        <p className="truncate text-sm text-muted">
                          {person.major} · {person.year}
                          {person.sharedInterests.length > 0 && ` · also into ${person.sharedInterests.join(', ').toLowerCase()}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">You're the first one here. We'll show others as they opt in.</p>
              )}
              {people && people.people.length > 0 && (
                <p className="mt-4 rounded-2xl bg-gold-soft px-4 py-3 text-sm font-medium text-ink">
                  🎉 You and {people.people.length} other {people.people.length === 1 ? 'student' : 'students'} are going together.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
