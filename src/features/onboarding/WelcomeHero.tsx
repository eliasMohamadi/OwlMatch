import { ArrowRight, CalendarCheck, Sparkles, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';

const PROMISES = [
  { icon: Sparkles, text: 'AI picks based on what you actually enjoy' },
  { icon: Users, text: 'See who else is going — only if you both opt in' },
  { icon: CalendarCheck, text: 'One tap to add it to Google Calendar' },
];

export function WelcomeHero({ studentName, onStart }: { studentName?: string; onStart: () => void }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-ink text-white">
      <div className="pointer-events-none absolute -top-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-gold/25 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-48 -left-40 h-[26rem] w-[26rem] rounded-full bg-gold/10 blur-3xl" aria-hidden />

      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] md:justify-center">
        <Logo size={36} inverted />

        <div className="mt-auto pt-16 md:mt-14">
          {studentName && <p className="mb-3 text-sm font-semibold text-gold">Hi {studentName.split(' ')[0]} 👋</p>}
          <h1 className="text-balance text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.045em] md:text-6xl">
            Your campus. Your people. <span className="text-gold">Your next experience.</span>
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/70">
            Discover events, explore new interests, and meet students who enjoy the same things you do.
          </p>

          <ul className="mt-8 space-y-3">
            {PROMISES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] text-white/85">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <Icon size={18} className="text-gold" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <Button size="lg" block className="mt-10" onClick={onStart}>
            Find My Matches <ArrowRight size={18} aria-hidden />
          </Button>
          <p className="mt-4 text-center text-xs text-white/45">Student-built project inspired by Kennesaw State. Not an official KSU service.</p>
        </div>
      </div>
    </div>
  );
}
