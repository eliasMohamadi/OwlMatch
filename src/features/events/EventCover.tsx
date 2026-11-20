import { useState } from 'react';
import type { InterestId } from '@shared/interests';
import { INTEREST_VISUALS } from '../../lib/interestVisuals';
import { cn } from '../../lib/cn';

/**
 * Event hero. Uses the organizer's uploaded image when present; otherwise a
 * generated cover from the event's primary category (no stock photos to break).
 */
export function EventCover({
  imageUrl,
  category,
  title,
  className,
  iconSize = 120,
}: {
  imageUrl: string | null;
  category: InterestId;
  title: string;
  className?: string;
  iconSize?: number;
}) {
  const [failed, setFailed] = useState(false);
  const visual = INTEREST_VISUALS[category];
  const Icon = visual.icon;

  if (imageUrl && !failed) {
    return (
      <div className={cn('relative overflow-hidden bg-surface', className)}>
        <img src={imageUrl} alt={`Cover image for ${title}`} className="h-full w-full object-cover" draggable={false} onError={() => setFailed(true)} />
      </div>
    );
  }

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, ${visual.from} 0%, ${visual.to} 100%)` }}
      role="img"
      aria-label={`${title} cover`}
    >
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1.2px, transparent 0)', backgroundSize: '18px 18px' }}
      />
      <div className="absolute -top-16 -left-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <Icon
        size={iconSize}
        strokeWidth={1.4}
        className={cn('absolute -right-4 -bottom-4 rotate-[-12deg]', visual.ink === 'dark' ? 'text-ink/25' : 'text-white/25')}
        aria-hidden
      />
    </div>
  );
}
