import { ArrowLeft, Cpu, LogOut, RotateCcw, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Skeleton, Toggle } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Toast';
import { useCurrentStudent, useHealth, useResetDemo, useUpdateSettings } from '../../lib/queries';
import { useSession } from '../../lib/session';

/** App settings, saved to the student's account so they follow them to any device. */
export function SettingsPage() {
  const { data: student } = useCurrentStudent();
  const { data: health } = useHealth();
  const settings = useUpdateSettings();
  const reset = useResetDemo();
  const { role, email, switchStudent, signOut } = useSession();
  const isAdmin = role === 'admin';
  const navigate = useNavigate();
  const toast = useToast();

  if (!student) return <Skeleton className="mx-auto h-80 max-w-2xl" />;

  const save = (change: Parameters<typeof settings.mutate>[0]) =>
    settings.mutate(change, { onError: () => toast("Couldn't save that setting. Try again.", 'error') });

  const resetDemo = () => {
    if (!window.confirm('Reset all data? This permanently deletes every event students created and all swipes, and restores the demo students. Owl Life imports and real student accounts are kept.')) return;
    reset.mutate(undefined, {
      onSuccess: () => {
        switchStudent('stu-jordan');
        toast('Demo data reset', 'info');
        navigate('/discover');
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <button type="button" onClick={() => navigate('/profile')} className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft size={16} aria-hidden /> Profile
        </button>
        <h1 className="text-[1.85rem] leading-none font-extrabold tracking-[-0.04em] text-ink">Settings</h1>
      </div>

      <SettingsSection title="Swiping">
        <Toggle
          checked={student.showMatchSheet}
          disabled={settings.isPending}
          onChange={(showMatchSheet) => save({ showMatchSheet })}
          label="Pop-up after swiping right"
          description="Shows “Find people to go with” and the calendar button after each event you're interested in. When off, you'll see a quick “Saved” note instead, and those options stay on the event's page."
        />
      </SettingsSection>

      <SettingsSection title="Privacy">
        <Toggle
          checked={student.socialVisible}
          disabled={settings.isPending}
          onChange={(socialVisible) => save({ socialVisible })}
          label="Social discovery"
          description="When off, you never appear in “Find people to go with”, even for events you opted into."
        />
        <p className="text-xs text-muted">Other students only ever see your first name, major and year — never your email or what you wrote about yourself.</p>
      </SettingsSection>

      <SettingsSection title="Account">
        {email ? (
          <p className="flex items-center gap-2 text-sm text-charcoal">
            <ShieldCheck size={16} className="shrink-0 text-muted" aria-hidden />
            Signed in with Microsoft as <span className="font-semibold break-all">{email}</span>
          </p>
        ) : (
          <p className="text-sm text-charcoal">Signed in as admin, using the demo account {student.name}.</p>
        )}
        <Button variant="outline" size="sm" icon={<LogOut size={14} />} onClick={() => void signOut()}>
          Sign out
        </Button>
      </SettingsSection>

      <SettingsSection title={isAdmin ? 'Demo & system' : 'System'}>
        <p className="flex items-center gap-2 text-sm text-charcoal">
          <Cpu size={16} className="text-muted" aria-hidden />
          AI: {health?.ai.configured ? <span className="font-semibold">Gemini connected ({health.ai.model})</span> : <span>Gemini not configured — rule-based fallback active</span>}
        </p>
        <p className="text-sm text-muted">Storage: local JSON database on the OwlMatch server.</p>
        {isAdmin && (
          <Button variant="danger" size="sm" icon={<RotateCcw size={14} />} loading={reset.isPending} onClick={resetDemo}>
            Reset demo data
          </Button>
        )}
      </SettingsSection>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-5">
      <h2 className="font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}
