import { Trash2 } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';

/** Width of the revealed delete button (px). */
const ACTION_WIDTH = 88;
/** Dragging past this share of the row's width removes it without tapping the button. */
const FULL_SWIPE_RATIO = 0.5;
/** A fast leftward flick (px/s) that has at least revealed the button also counts as a full swipe. */
const FULL_SWIPE_VELOCITY = -900;
const SNAP = { type: 'spring', stiffness: 500, damping: 40 } as const;

interface SwipeToRemoveRowProps {
  /** Whether the delete button is showing. The parent keeps one row open at a time. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
  /** Used for the delete button's accessible name, e.g. the event title. */
  label: string;
  children: ReactNode;
}

/**
 * A list row that slides left to reveal a delete button (like Mail on iPhone).
 * - Swipe a little and release: the row stays open on the delete button; tap it to remove.
 * - Keep swiping past half the row (or flick): it slides away and is removed straight away.
 * - Tapping an open row, or swiping it back right, closes it.
 * A swipe never counts as a tap on the links inside the row.
 */
export function SwipeToRemoveRow({ open, onOpenChange, onRemove, label, children }: SwipeToRemoveRowProps) {
  const x = useMotionValue(0);
  // Hidden at rest so no red shows at the card's rounded corners; appears as soon as the row moves.
  const actionOpacity = useTransform(x, [-4, 0], [1, 0]);
  const rowRef = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const removing = useRef(false);
  const reduceMotion = useReducedMotion();

  // With a mouse, pressing a link or image and moving starts the browser's own drag-and-drop,
  // which would steal the swipe. Rows aren't meant to be dragged out, so turn that off.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const stopNativeDrag = (event: DragEvent) => event.preventDefault();
    row.addEventListener('dragstart', stopNativeDrag);
    return () => row.removeEventListener('dragstart', stopNativeDrag);
  }, []);

  // Follow the parent's open state (e.g. another row opened, so this one closes).
  useEffect(() => {
    if (!removing.current) void animate(x, open ? -ACTION_WIDTH : 0, SNAP);
  }, [open, x]);

  const remove = async () => {
    if (removing.current) return;
    removing.current = true;
    const width = rowRef.current?.offsetWidth ?? 400;
    if (!reduceMotion) await animate(x, -width, { duration: 0.2, ease: 'easeIn' });
    onRemove();
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const offset = x.get();
    const width = rowRef.current?.offsetWidth ?? 400;
    if (offset < -width * FULL_SWIPE_RATIO || (info.velocity.x < FULL_SWIPE_VELOCITY && offset < -ACTION_WIDTH / 2)) {
      void remove();
    } else if (offset < -ACTION_WIDTH / 2) {
      void animate(x, -ACTION_WIDTH, SNAP);
      onOpenChange(true);
    } else {
      void animate(x, 0, SNAP);
      onOpenChange(false);
    }
  };

  return (
    <div ref={rowRef} className="relative overflow-hidden rounded-[1.5rem]">
      {/* The delete area sits underneath and is uncovered as the row slides left. */}
      <motion.div style={{ opacity: actionOpacity }} className="absolute inset-0 flex justify-end rounded-[1.5rem] bg-red-600">
        <button
          type="button"
          onClick={() => void remove()}
          onFocus={() => onOpenChange(true)}
          aria-label={`Remove ${label} from your interests`}
          className="flex h-full flex-col items-center justify-center gap-1 text-xs font-semibold text-white focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-white"
          style={{ width: ACTION_WIDTH }}
        >
          <Trash2 size={22} aria-hidden />
          Remove
        </button>
      </motion.div>

      <motion.div
        className="relative touch-pan-y"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ right: 0 }}
        dragElastic={{ right: 0.08, left: 0 }}
        dragMomentum={false}
        onPointerDown={() => (dragged.current = false)}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={onDragEnd}
        onClickCapture={(event) => {
          // A swipe that ends over a link must not open it, and a tap on an open row just closes it.
          if (dragged.current || open) {
            event.preventDefault();
            event.stopPropagation();
            if (open && !dragged.current) onOpenChange(false);
          }
          dragged.current = false;
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
