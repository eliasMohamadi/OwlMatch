import { Sparkles } from 'lucide-react';
import { INTERESTS } from '@shared/interests';
import type { AiProfile } from '@shared/types';
import { Badge } from '../../components/ui/primitives';

const GROUP_LABEL = { small: 'Small groups', large: 'Big crowds', any: 'Any group size' } as const;
const ENERGY_LABEL = { relaxed: 'Relaxed', high: 'High-energy', any: 'Any energy' } as const;

/** What Step A of the AI pipeline produced, shown transparently to the student. */
export function AiProfileCard({ profile }: { profile: AiProfile }) {
  const fromGemini = profile.source === 'gemini';
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] bg-ink p-5 text-white shadow-card" aria-label="Your AI profile">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-gold">
          <Sparkles size={16} aria-hidden /> {fromGemini ? 'Understood by Gemini' : 'Understood by rule-based parser'}
        </p>
        {!fromGemini && <span className="text-xs text-white/50">AI offline fallback</span>}
      </div>
      <p className="mt-3 text-[17px] leading-snug font-semibold">{profile.summary}</p>

      <dl className="mt-4 space-y-3 text-sm">
        {profile.inferredInterests.length > 0 && (
          <div>
            <dt className="text-white/55">Also picked up from your own words</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {profile.inferredInterests.map((id) => (
                <Badge key={id} tone="gold">
                  + {INTERESTS[id].shortLabel}
                </Badge>
              ))}
            </dd>
          </div>
        )}
        {profile.keywords.length > 0 && (
          <div>
            <dt className="text-white/55">Keywords we match on</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {profile.keywords.map((k) => (
                <span key={k} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium">
                  {k}
                </span>
              ))}
            </dd>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium">{GROUP_LABEL[profile.preferredGroupSize]}</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium">{ENERGY_LABEL[profile.preferredEnergy]}</span>
          {profile.goals.map((g) => (
            <span key={g} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium">
              {g}
            </span>
          ))}
        </div>
      </dl>
    </section>
  );
}
