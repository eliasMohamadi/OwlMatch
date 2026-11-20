import { Heart, Info, X } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from 'motion/react';
import { useCallback, useEffect, useRef } from 'react';
import type { RecommendationItem, SwipeDecision } from '@shared/types';
import { DiscoveryCard } from './DiscoveryCard';

/** Drag distance (px) or fling speed (px/s) that commits a swipe. */
const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 650;
const FLY_OUT_DISTANCE = 600;
const MAX_ROTATION_DEG = 14;
const VISIBLE_STACK = 3;

interface SwipeDeckProps {
  items: RecommendationItem[];
  onDecide: (item: RecommendationItem, decision: SwipeDecision) => void;
  onOpen: (item: RecommendationItem) => void;
}

/**
 * Swipeable card stack. Every gesture has an equivalent: buttons below the
 * card, and ←/→/Enter on the keyboard, so nothing requires touch.
 */
export function SwipeDeck({ items, onDecide, onOpen }: SwipeDeckProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-MAX_ROTATION_DEG, MAX_ROTATION_DEG]);
  const likeOpacity = useTransform(x, [20, SWIPE_DISTANCE], [0, 1]);
  const passOpacity = useTransform(x, [-SWIPE_DISTANCE, -20], [1, 0]);
  const reduceMotion = useReducedMotion();
  const busy = useRef(false);
  const top = items[0];

  const commit = useCallback(
    async (decision: SwipeDecision) => {
      if (!top || busy.current) return;
      busy.current = true;
      const direction = decision === 'interested' ? 1 : -1;
      if (!reduceMotion) await animate(x, direction * FLY_OUT_DISTANCE, { duration: 0.28, ease: 'easeIn' });
      onDecide(top, decision);
      x.set(0);
      busy.current = false;
    },
    [top, onDecide, reduceMotion, x],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [role="dialog"]')) return;
      if (event.key === 'ArrowRight') void commit('interested');
      else if (event.key === 'ArrowLeft') void commit('passed');
      else if (event.key === 'Enter' && target === document.body && top) onOpen(top);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit, onOpen, top]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) void commit('interested');
    else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) void commit('passed');
    else void animate(x, 0, { type: 'spring', stiffness: 500, damping: 32 });
  };

  if (!top) return null;
  const stack = items.slice(0, VISIBLE_STACK);

  return (
    <div className="mx-auto w-full max-w-[26rem]">
      <div className="relative h-[clamp(25rem,calc(100dvh-24.5rem),34rem)]" aria-live="polite">
        {stack
          .map((item, index) => {
            const isTop = index === 0;
            const depthStyle = { scale: 1 - index * 0.045, y: index * 14 };
            if (!isTop) {
              return (
                <motion.div
                  key={item.event.id}
                  className="absolute inset-0 rounded-[2rem] border border-line bg-white shadow-card"
                  initial={false}
                  animate={depthStyle}
                  aria-hidden
                />
              );
            }
            return (
              <motion.div
                key={item.event.id}
                className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
                style={{ x, rotate }}
                drag="x"
                dragDirectionLock
                dragElastic={0.9}
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={onDragEnd}
                onTap={() => onOpen(item)}
                initial={{ scale: 0.96, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <DiscoveryCard item={item} />
                <motion.span
                  style={{ opacity: likeOpacity }}
                  className="pointer-events-none absolute top-24 left-6 -rotate-12 rounded-xl border-4 border-gold bg-ink/80 px-3 py-1 text-2xl font-black tracking-wide text-gold"
                >
                  INTERESTED
                </motion.span>
                <motion.span
                  style={{ opacity: passOpacity }}
                  className="pointer-events-none absolute top-24 right-6 rotate-12 rounded-xl border-4 border-white bg-ink/70 px-3 py-1 text-2xl font-black tracking-wide text-white"
                >
                  PASS
                </motion.span>
              </motion.div>
            );
          })
          .reverse()}
      </div>

      <div className="mt-7 flex items-center justify-center gap-5" role="group" aria-label="Card actions">
        <DeckButton label="Pass" onClick={() => void commit('passed')} className="h-16 w-16 border border-line bg-white text-ink hover:border-ink/30">
          <X size={28} strokeWidth={2.5} />
        </DeckButton>
        <DeckButton label="Details" onClick={() => onOpen(top)} className="h-12 w-12 bg-surface text-charcoal hover:bg-line">
          <Info size={20} />
        </DeckButton>
        <DeckButton label="Interested" onClick={() => void commit('interested')} className="h-16 w-16 bg-gold text-ink shadow-[0_10px_30px_-10px_rgb(224_168_0/0.9)] hover:bg-[#ffd04f]">
          <Heart size={28} strokeWidth={2.5} fill="currentColor" />
        </DeckButton>
      </div>
      <p className="mt-3 hidden text-center text-xs text-muted md:block">Tip: use ← and → keys to swipe</p>
    </div>
  );
}

function DeckButton({ label, onClick, className, children }: { label: string; onClick: () => void; className: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button type="button" onClick={onClick} aria-label={label} className={`flex items-center justify-center rounded-full transition-transform active:scale-90 ${className}`}>
        {children}
      </button>
      <span className="text-xs font-semibold text-muted">{label}</span>
    </div>
  );
}
