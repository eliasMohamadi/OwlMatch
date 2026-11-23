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
/** A press that moves less than this (px) is a tap that opens details; anything more is a drag. */
const TAP_SLOP = 8;
/** Peak opacity of the swipe glow, reached at the commit distance. */
const GLOW_MAX_OPACITY = 0.38;

/** Faint green glow while swiping right (interested), red while swiping left (pass). */
function glowFor(offset: number): string {
  const strength = Math.min(1, Math.abs(offset) / SWIPE_DISTANCE) * GLOW_MAX_OPACITY;
  if (strength < 0.01) return '0 0 0 0 rgb(0 0 0 / 0)';
  const color = offset > 0 ? '34 197 94' : '239 68 68';
  return `0 0 48px 6px rgb(${color} / ${strength.toFixed(3)})`;
}

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
  const glow = useTransform(x, glowFor);
  /** Where the current press started, and whether it turned into a drag. Used to tell a tap from a swipe. */
  const press = useRef<{ x: number; y: number; dragged: boolean } | null>(null);
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
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [role="dialog"]')) return;
      if (event.key === 'ArrowRight') void commit('interested');
      else if (event.key === 'ArrowLeft') void commit('passed');
      else if (event.key === 'Enter' && (target === document.body || target === window) && top) onOpen(top);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit, onOpen, top]);

  /**
   * Opens details only for a real tap: released close to where it was pressed,
   * without ever becoming a drag. Motion's onTap also fired when a swipe ended
   * over the card (the card moves with the finger), which opened details instead
   * of finishing the swipe. Detecting it on pointer release works the same for
   * mouse and touch; a touch on a draggable card doesn't reliably produce `click`.
   */
  const onCardPointerUp = (event: React.PointerEvent, item: RecommendationItem) => {
    const start = press.current;
    press.current = null;
    if (!start || start.dragged || busy.current) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP) return;
    onOpen(item);
  };

  /** The swipe is decided when the finger or mouse is released. */
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) void commit('interested');
    else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) void commit('passed');
    else void animate(x, 0, { type: 'spring', stiffness: 500, damping: 32 });
  };

  if (!top) return null;
  const stack = items.slice(0, VISIBLE_STACK);

  return (
    <div className="mx-auto w-full max-w-[26rem]">
      <div className="relative h-[clamp(29.25rem,calc(100dvh-20.25rem),38.25rem)]" aria-live="polite">
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
                className="absolute inset-0 cursor-grab touch-pan-y rounded-[2rem] active:cursor-grabbing"
                style={{ x, rotate, boxShadow: glow }}
                drag="x"
                dragDirectionLock
                dragElastic={0.9}
                dragConstraints={{ left: 0, right: 0 }}
                onPointerDown={(e) => (press.current = { x: e.clientX, y: e.clientY, dragged: false })}
                onDragStart={() => press.current && (press.current.dragged = true)}
                onDragEnd={onDragEnd}
                onPointerUp={(e) => onCardPointerUp(e, item)}
                onPointerCancel={() => (press.current = null)}
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

      {/* On phones the actions stay pinned above the tab bar so they're reachable on short screens. */}
      <div
        className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-7 flex items-center justify-center gap-5 bg-gradient-to-t from-paper via-paper/90 to-transparent px-4 pt-3 pb-1 md:static md:mx-0 md:bg-none md:p-0"
        role="group"
        aria-label="Card actions"
      >
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
