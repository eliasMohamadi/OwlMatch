import { ArrowRight, Sparkles } from 'lucide-react';
import { INTERESTS } from '@shared/interests';
import type { Student } from '@shared/types';
import { Button } from '../../components/ui/Button';
import { AiProfileCard } from '../profile/AiProfileCard';

/** Final onboarding screen: shows what the AI understood before entering Discover. */
export function ProfileSummary({ student, onContinue }: { student: Student; onContinue: () => void }) {
  return (
    <div className="flex flex-1 animate-fade-up flex-col">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold">
        <Sparkles size={26} className="text-ink" aria-hidden />
      </span>
      <h1 className="text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em] text-ink">You're all set, {student.name.split(' ')[0]}.</h1>
      <p className="mt-2 text-[15px] text-muted">
        Here's how OwlMatch understands you. Your picks: {student.interests.map((id) => INTERESTS[id].shortLabel).join(', ')}.
      </p>
      <div className="mt-6">{student.aiProfile && <AiProfileCard profile={student.aiProfile} />}</div>
      <div className="mt-auto pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <Button size="lg" block onClick={onContinue}>
          Start discovering <ArrowRight size={18} aria-hidden />
        </Button>
      </div>
    </div>
  );
}
