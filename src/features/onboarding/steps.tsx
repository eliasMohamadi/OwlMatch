import { Building2, Check, Layers, School } from 'lucide-react';
import type { ReactNode } from 'react';
import { INTEREST_LIST, type InterestId } from '@shared/interests';
import type { Availability, CampusPreference, OnboardingInput } from '@shared/types';
import { Chip } from '../../components/ui/primitives';
import { INTEREST_VISUALS } from '../../lib/interestVisuals';
import { cn } from '../../lib/cn';

/** One component per onboarding step. Each is a controlled input over part of the draft. */

const CAMPUS_OPTIONS: { value: CampusPreference; label: string; body: string; icon: ReactNode }[] = [
  { value: 'kennesaw', label: 'Kennesaw Campus', body: 'Main campus activities', icon: <School size={22} /> },
  { value: 'marietta', label: 'Marietta Campus', body: 'Engineering & tech hub', icon: <Building2 size={22} /> },
  { value: 'both', label: 'Both campuses', body: 'Show me everything', icon: <Layers size={22} /> },
];

export function CampusStep({ value, onChange }: { value: CampusPreference; onChange: (v: CampusPreference) => void }) {
  return (
    <div role="radiogroup" aria-label="Campus" className="grid gap-3">
      {CAMPUS_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center gap-4 rounded-[1.25rem] border-2 bg-white p-4 text-left transition-all active:scale-[0.99]',
              selected ? 'border-ink shadow-card' : 'border-line hover:border-ink/25',
            )}
          >
            <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', selected ? 'bg-gold text-ink' : 'bg-surface text-charcoal')}>
              {option.icon}
            </span>
            <span className="flex-1">
              <span className="block font-bold text-ink">{option.label}</span>
              <span className="block text-sm text-muted">{option.body}</span>
            </span>
            <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border-2', selected ? 'border-ink bg-ink' : 'border-line')}>
              {selected && <Check size={14} className="text-gold" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function InterestsStep({ value, onChange }: { value: InterestId[]; onChange: (v: InterestId[]) => void }) {
  const toggle = (id: InterestId) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {INTEREST_LIST.map((interest) => {
        const Icon = INTEREST_VISUALS[interest.id].icon;
        const selected = value.includes(interest.id);
        return (
          <button
            key={interest.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(interest.id)}
            className={cn(
              'relative flex min-h-24 flex-col justify-between rounded-[1.25rem] border-2 p-3.5 text-left transition-all duration-150 active:scale-[0.97]',
              selected ? 'animate-pop border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-ink/25',
            )}
          >
            <Icon size={24} className={selected ? 'text-gold' : 'text-charcoal'} aria-hidden />
            <span className="mt-3 text-sm leading-snug font-semibold">{interest.label}</span>
            {selected && (
              <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-gold">
                <Check size={12} className="text-ink" strokeWidth={3} aria-hidden />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ChoiceRow<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-[15px] font-semibold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip key={option.value} selected={value === option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

type YesNo = 'yes' | 'no';

export function SocialStep({ value, onChange }: { value: OnboardingInput['social']; onChange: (v: OnboardingInput['social']) => void }) {
  const yesNo = (b: boolean): YesNo => (b ? 'yes' : 'no');
  return (
    <div className="space-y-7">
      <ChoiceRow<YesNo>
        label="Looking to make friends?"
        options={[{ value: 'yes', label: 'Yes, definitely' }, { value: 'no', label: 'Not a priority' }]}
        value={yesNo(value.makeFriends)}
        onChange={(v) => onChange({ ...value, makeFriends: v === 'yes' })}
      />
      <ChoiceRow
        label="Small or large groups?"
        options={[{ value: 'small', label: 'Small groups' }, { value: 'large', label: 'Big crowds' }, { value: 'any', label: 'Either' }]}
        value={value.groupSize}
        onChange={(groupSize) => onChange({ ...value, groupSize })}
      />
      <ChoiceRow<YesNo>
        label="Up for trying something new?"
        options={[{ value: 'yes', label: 'Show me new things' }, { value: 'no', label: 'Stick to what I like' }]}
        value={yesNo(value.tryNew)}
        onChange={(v) => onChange({ ...value, tryNew: v === 'yes' })}
      />
      <ChoiceRow
        label="What energy level?"
        options={[{ value: 'relaxed', label: 'Relaxed' }, { value: 'high', label: 'High-energy' }, { value: 'any', label: 'Depends' }]}
        value={value.energy}
        onChange={(energy) => onChange({ ...value, energy })}
      />
    </div>
  );
}

const ABOUT_LIMIT = 600;
const ABOUT_EXAMPLES = [
  "I'm a CS student who likes basketball and gaming. I want to meet new people, but I prefer smaller groups.",
  'Transfer student, into anime and drawing. Looking for low-key things to do on weekends.',
];

export function AboutStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor="about" className="sr-only">
        About you
      </label>
      <textarea
        id="about"
        value={value}
        maxLength={ABOUT_LIMIT}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder={ABOUT_EXAMPLES[0]}
        className="w-full resize-none rounded-[1.25rem] border-2 border-line bg-white p-4 text-[16px] leading-relaxed text-ink placeholder:text-neutral focus:border-ink focus:outline-none"
      />
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>Gemini turns this into structured preferences. It is never shown to other students.</span>
        <span>
          {value.length}/{ABOUT_LIMIT}
        </span>
      </div>
      <p className="mt-5 mb-2 text-sm font-semibold text-ink">Need a starting point?</p>
      <div className="flex flex-col gap-2">
        {ABOUT_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onChange(example)}
            className="rounded-2xl bg-surface px-4 py-3 text-left text-sm text-charcoal transition-colors hover:bg-line"
          >
            “{example}”
          </button>
        ))}
      </div>
    </div>
  );
}

const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'mornings', label: 'Mornings' },
  { value: 'afternoons', label: 'Afternoons' },
  { value: 'evenings', label: 'Evenings' },
];

export function AvailabilityStep({ value, onChange }: { value: Availability[]; onChange: (v: Availability[]) => void }) {
  const toggle = (a: Availability) => onChange(value.includes(a) ? value.filter((v) => v !== a) : [...value, a]);
  return (
    <div className="flex flex-wrap gap-2.5">
      {AVAILABILITY_OPTIONS.map((option) => (
        <Chip key={option.value} selected={value.includes(option.value)} onClick={() => toggle(option.value)} className="min-h-12 px-5 text-[15px]">
          {option.label}
        </Chip>
      ))}
    </div>
  );
}
