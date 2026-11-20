import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OnboardingInput, Student } from '@shared/types';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { useToast } from '../../components/ui/Toast';
import { useCurrentStudent, useSaveOnboarding } from '../../lib/queries';
import { AboutStep, AvailabilityStep, CampusStep, InterestsStep, SocialStep } from './steps';
import { ProfileSummary } from './ProfileSummary';
import { WelcomeHero } from './WelcomeHero';

const STEPS = ['campus', 'interests', 'social', 'about', 'availability'] as const;
type Step = (typeof STEPS)[number];

const STEP_TITLES: Record<Step, { title: string; subtitle: string }> = {
  campus: { title: 'Where do you spend your time?', subtitle: 'We will show activities on the campus that works for you.' },
  interests: { title: 'What are you into?', subtitle: 'Pick as many as you like. You can change these later.' },
  social: { title: 'How do you like to hang out?', subtitle: 'Quick taps — skip anything you are unsure about.' },
  about: { title: 'Tell OwlMatch a little about yourself.', subtitle: 'Our AI reads this to understand what you would actually enjoy.' },
  availability: { title: 'When are you usually free?', subtitle: 'Leave blank if your schedule changes a lot.' },
};

function draftFrom(student: Student | undefined): OnboardingInput {
  return {
    campus: student?.campus ?? 'both',
    interests: student?.interests ?? [],
    social: student?.social ?? { makeFriends: false, groupSize: 'any', tryNew: false, energy: 'any' },
    about: student?.about ?? '',
    availability: student?.availability ?? [],
  };
}

export function OnboardingPage() {
  const { data: student } = useCurrentStudent();
  const [stepIndex, setStepIndex] = useState(-1);
  const [draft, setDraft] = useState<OnboardingInput | null>(null);
  const save = useSaveOnboarding();
  const navigate = useNavigate();
  const toast = useToast();

  const value = draft ?? draftFrom(student);
  const update = (patch: Partial<OnboardingInput>) => setDraft({ ...value, ...patch });

  if (save.isSuccess) {
    return (
      <Frame>
        <ProfileSummary student={save.data} onContinue={() => navigate('/discover')} />
      </Frame>
    );
  }

  if (stepIndex < 0) return <WelcomeHero studentName={student?.name} onStart={() => setStepIndex(0)} />;

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const canContinue = step !== 'interests' || value.interests.length > 0;

  const next = () => {
    if (!isLast) return setStepIndex(stepIndex + 1);
    save.mutate(value, { onError: () => toast('Could not save your profile. Try again.', 'error') });
  };

  return (
    <Frame>
      <div className="mb-8 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStepIndex(stepIndex - 1)}
          className="-ml-2 rounded-full p-2 text-ink hover:bg-surface"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>
        <div
          className="flex flex-1 gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={stepIndex + 1}
          aria-label="Onboarding progress"
        >
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= stepIndex ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </div>
      </div>

      <div key={step} className="animate-fade-up">
        <h1 className="text-balance text-[1.75rem] leading-tight font-extrabold tracking-[-0.03em] text-ink md:text-4xl">{STEP_TITLES[step].title}</h1>
        <p className="mt-2 text-[15px] text-muted">{STEP_TITLES[step].subtitle}</p>
        <div className="mt-7">
          {step === 'campus' && <CampusStep value={value.campus} onChange={(campus) => update({ campus })} />}
          {step === 'interests' && <InterestsStep value={value.interests} onChange={(interests) => update({ interests })} />}
          {step === 'social' && <SocialStep value={value.social} onChange={(social) => update({ social })} />}
          {step === 'about' && <AboutStep value={value.about} onChange={(about) => update({ about })} />}
          {step === 'availability' && <AvailabilityStep value={value.availability} onChange={(availability) => update({ availability })} />}
        </div>
      </div>

      <div className="sticky bottom-0 mt-10 bg-gradient-to-t from-paper via-paper to-transparent pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {save.isPending ? (
          <div className="flex items-center justify-center gap-3 rounded-full bg-ink px-6 py-4 text-white" role="status">
            <Sparkles className="animate-pulse text-gold" size={20} aria-hidden />
            <span className="font-semibold">OwlMatch AI is building your profile…</span>
          </div>
        ) : (
          <Button size="lg" block onClick={next} disabled={!canContinue} icon={isLast ? <Sparkles size={18} /> : undefined}>
            {isLast ? 'Build my matches' : 'Continue'}
            {!isLast && <ArrowRight size={18} aria-hidden />}
          </Button>
        )}
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 md:pt-12">
      <div className="mb-6">
        <Logo size={30} />
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
