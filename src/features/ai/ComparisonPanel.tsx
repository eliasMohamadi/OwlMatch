import { ListFilter, Sparkles } from 'lucide-react';
import { Skeleton } from '../../components/ui/primitives';
import { useComparison, useCurrentStudent } from '../../lib/queries';
import { RecommendationRow } from './RecommendationRow';

/**
 * The AI-value demo: the same eligible events ranked two ways. Left is plain
 * category overlap; right is the full pipeline using the student's own words,
 * social preferences, availability and swipe history.
 */
export function ComparisonPanel() {
  const { data: student } = useCurrentStudent();
  const { data, isLoading } = useComparison(true);

  return (
    <div>
      <div className="rounded-[var(--radius-card)] bg-ink p-5 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold text-gold">
          <Sparkles size={16} aria-hidden /> Same events, two rankings
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-white/80">
          {student?.about ? (
            <>
              In your words: <span className="text-white">“{student.about}”</span>
            </>
          ) : (
            'Add a few sentences about yourself in onboarding to see the difference grow.'
          )}
        </p>
      </div>

      {isLoading || !data ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-1 flex items-center gap-2 font-bold text-ink">
              <ListFilter size={18} aria-hidden /> Category filter only
            </h2>
            <p className="mb-3 text-sm text-muted">Ranks by how many selected categories overlap. Ignores everything else.</p>
            <ol className="space-y-2.5">
              {data.categoryOnly.map((item) => (
                <li key={item.event.id}>
                  <RecommendationRow item={item} showSave={false} />
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h2 className="mb-1 flex items-center gap-2 font-bold text-ink">
              <Sparkles size={18} className="text-gold-deep" aria-hidden /> OwlMatch {data.personalized.mode === 'ai' ? 'AI' : 'rules (AI offline)'}
            </h2>
            <p className="mb-3 text-sm text-muted">
              {data.personalized.mode === 'ai'
                ? 'Gemini re-ranks a shortlist using your words, group-size and energy preferences, schedule and swipes.'
                : 'Weighted rules over interests, keywords from your words, schedule, social fit and swipes.'}
            </p>
            <ol className="space-y-2.5">
              {data.personalized.items.map((item) => (
                <li key={item.event.id}>
                  <RecommendationRow item={item} showSave={false} />
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
