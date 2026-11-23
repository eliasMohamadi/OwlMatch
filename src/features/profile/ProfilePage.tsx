import { FlaskConical, Pencil, Settings, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { INTERESTS } from '@shared/interests';
import { detailLine } from '@shared/text';
import { Button } from '../../components/ui/Button';
import { Avatar, Badge, Skeleton } from '../../components/ui/primitives';
import { useCurrentStudent } from '../../lib/queries';
import { AiProfileCard } from './AiProfileCard';

const CAMPUS_PREF = { kennesaw: 'Kennesaw Campus', marietta: 'Marietta Campus', both: 'Both campuses' } as const;

/** Who you are and what you're into. App settings (privacy, swiping, sign out) live on /settings. */
export function ProfilePage() {
  const { data: student } = useCurrentStudent();
  const navigate = useNavigate();

  if (!student) return <Skeleton className="mx-auto h-80 max-w-2xl" />;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="flex items-start gap-4">
        <Avatar name={student.name} color={student.avatarColor} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{student.name}</h1>
          {detailLine(student.major, student.year) && <p className="text-muted">{detailLine(student.major, student.year)}</p>}
          {student.account.type === 'microsoft' ? (
            <Badge tone="outline" className="mt-1.5 max-w-full">
              <ShieldCheck size={12} aria-hidden /> <span className="truncate">KSU account · {student.account.email}</span>
            </Badge>
          ) : (
            <Badge tone="outline" className="mt-1.5">
              <FlaskConical size={12} aria-hidden /> Demo account · admin testing
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" icon={<Settings size={16} />} onClick={() => navigate('/settings')}>
          Settings
        </Button>
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

      <p className="pb-4 text-center text-xs text-muted">OwlMatch is a student-built hackathon project inspired by Kennesaw State University. It is not operated or endorsed by KSU.</p>
    </div>
  );
}
