import { ChevronDown, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentStudent, useStudents } from '../../lib/queries';
import { useSession } from '../../lib/session';
import { cn } from '../../lib/cn';
import { Avatar } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

/** Demo-mode account switcher. Clearly labeled: this stands in for university sign-in. */
export function StudentSwitcher({ variant }: { variant: 'compact' | 'full' }) {
  const [open, setOpen] = useState(false);
  const { studentId, switchStudent } = useSession();
  const { data: student } = useCurrentStudent();
  const { data: students = [] } = useStudents();
  const navigate = useNavigate();
  const toast = useToast();

  const choose = (id: string) => {
    const next = students.find((s) => s.id === id);
    switchStudent(id);
    setOpen(false);
    if (next) toast(`Now viewing as ${next.name}`, 'info');
    navigate(next && !next.onboarded ? '/welcome' : '/discover');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-2.5 rounded-full text-left transition-colors hover:bg-surface',
          variant === 'full' ? 'w-full rounded-2xl border border-line bg-white p-2.5' : 'p-1 pr-2',
        )}
        aria-label={`Demo student: ${student?.name ?? 'loading'}. Switch student`}
      >
        {student && <Avatar name={student.name} color={student.avatarColor} size={variant === 'full' ? 40 : 34} />}
        {variant === 'full' && student && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{student.name}</span>
            <span className="block truncate text-xs text-muted">Demo student · switch</span>
          </span>
        )}
        <ChevronDown size={16} className="text-muted" aria-hidden />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Switch demo student">
        <p className="mb-4 flex items-start gap-2 rounded-2xl bg-surface p-3 text-sm text-muted">
          <FlaskConical size={16} className="mt-0.5 shrink-0" aria-hidden />
          Demo mode: these are sample accounts standing in for KSU sign-in. No accounts are verified.
        </p>
        <ul className="space-y-2">
          {students.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => choose(s.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                  s.id === studentId ? 'border-ink bg-gold-soft' : 'border-line hover:bg-surface',
                )}
              >
                <Avatar name={s.name} color={s.avatarColor} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{s.name}</span>
                  <span className="block text-sm text-muted">
                    {s.major} · {s.year}
                    {!s.onboarded && ' · new user'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
