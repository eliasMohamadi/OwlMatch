import { Cpu, FlaskConical, Pencil, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { INTERESTS } from '@shared/interests';
import { Button } from '../../components/ui/Button';
import { Avatar, Badge, Skeleton, Toggle } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Toast';
import { useCurrentStudent, useHealth, useResetDemo, useUpdateSettings } from '../../lib/queries';
import { useSession } from '../../lib/session';
import { AiProfileCard } from './AiProfileCard';

const CAMPUS_PREF = { kennesaw: 'Kennesaw Campus', marietta: 'Marietta Campus', both: 'Both campuses' } as const;

export function ProfilePage() {
  const { data: student } = useCurrentStudent();
  const { data: health } = useHealth();
  const settings = useUpdateSettings();
  const reset = useResetDemo();
  const { switchStudent } = useSession();
  const navigate = useNavigate();
  const toast = useToast();

  if (!student) return <Skeleton className="mx-auto h-80 max-w-2xl" />;

  const resetDemo = () => {
    if (!window.confirm('Reset all data? This permanently deletes every event students created, plus all swipes and profile changes. Owl Life imports are kept.')) return;
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
      <section className="flex items-center gap-4">
        <Avatar name={student.name} color={student.avatarColor} size={64} />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{student.name}</h1>
          <p className="text-muted">
            {student.major} · {student.year}
          </p>
          <Badge tone="outline" className="mt-1.5">
            <FlaskConical size={12} aria-hidden /> Demo account · not verified
          </Badge>
        </div>
      </section>

      {student.aiProfile && <AiProfileCard profile={student.aiProfile} />}

      <section className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-ink">Preferences</h2>
          <Button size="sm" variant="outline" icon={<Pencil size={14} />} onClick={() => navigate('/welcome')}>
            Edit
          </Button>
        </div>
        <p className="text-sm text-muted">{CAMPUS_PREF[student.campus]}</p>
        <div className="flex flex-wrap gap-1.5">
          {student.interests.map((id) => (
            <Badge key={id} tone="dark">
              {INTERESTS[id].label}
            </Badge>
          ))}
        </div>
        {student.availability.length > 0 && <p className="text-sm text-muted">Usually free: {student.availability.join(', ')}</p>}
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-white p-5">
        <h2 className="mb-3 font-bold text-ink">Privacy</h2>
        <Toggle
          checked={student.socialVisible}
          disabled={settings.isPending}
          onChange={(socialVisible) => settings.mutate({ socialVisible })}
          label="Social discovery"
          description="When off, you never appear in “Find people to go with”, even for events you opted into."
        />
        <p className="mt-3 text-xs text-muted">Other students only ever see your first name, major and year — never your email or what you wrote about yourself.</p>
      </section>

      <section className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-5">
        <h2 className="font-bold text-ink">Demo & system</h2>
        <p className="flex items-center gap-2 text-sm text-charcoal">
          <Cpu size={16} className="text-muted" aria-hidden />
          AI: {health?.ai.configured ? <span className="font-semibold">Gemini connected ({health.ai.model})</span> : <span>Gemini not configured — rule-based fallback active</span>}
        </p>
        <p className="text-sm text-muted">Storage: local JSON database on the OwlMatch server (shared by all demo students).</p>
        <Button variant="danger" size="sm" icon={<RotateCcw size={14} />} loading={reset.isPending} onClick={resetDemo}>
          Reset demo data
        </Button>
      </section>

      <p className="pb-4 text-center text-xs text-muted">OwlMatch is a student-built hackathon project inspired by Kennesaw State University. It is not operated or endorsed by KSU.</p>
    </div>
  );
}
