import { ChevronDown, FlaskConical, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { detailLine } from '@shared/text';
import { useCurrentStudent, useStudents } from '../../lib/queries';
import { useSession } from '../../lib/session';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

/**
 * Account menu. Students see their verified KSU account and can sign out.
 * Admins also get the demo-student switcher (demo accounts only).
 */
export function StudentSwitcher({ variant }: { variant: 'compact' | 'full' }) {
  const [open, setOpen] = useState(false);
  const { studentId, role, email, switchStudent, signOut } = useSession();
  const isAdmin = role === 'admin';
  const { data: student } = useCurrentStudent();
  const { data: students = [] } = useStudents(isAdmin && open);
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
        aria-label={isAdmin ? `Demo student: ${student?.name ?? 'loading'}. Switch student` : `Account: ${student?.name ?? 'loading'}`}
      >
        {student && <Avatar name={student.name} color={student.avatarColor} size={variant === 'full' ? 40 : 34} />}
        {variant === 'full' && student && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{student.name}</span>
            <span className="block truncate text-xs text-muted">{isAdmin ? 'Admin · demo student · switch' : email}</span>
          </span>
        )}
        <ChevronDown size={16} className="text-muted" aria-hidden />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={isAdmin ? 'Switch demo student' : 'Your account'}>
        {isAdmin ? (
          <>
            <p className="mb-4 flex items-start gap-2 rounded-2xl bg-surface p-3 text-sm text-muted">
              <FlaskConical size={16} className="mt-0.5 shrink-0" aria-hidden />
              Admin mode: act as a demo account for testing. Demo accounts are not real students. Add ?as=&lt;id&gt; to the URL to use a
              different one in another tab.
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
                        {detailLine(s.major, s.year, s.onboarded ? null : 'new user')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="flex items-start gap-2 rounded-2xl bg-surface p-3 text-sm text-charcoal">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
            Signed in with Microsoft as <span className="font-semibold break-all">{email}</span>
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            icon={<Settings size={16} />}
            onClick={() => {
              setOpen(false);
              navigate('/settings');
            }}
          >
            Settings
          </Button>
          <Button variant="outline" icon={<LogOut size={16} />} onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Sheet>
    </>
  );
}
