import { cn } from '../../lib/cn';

/**
 * Original OwlMatch mark: two interlocking rings read as a pair of eyes and as
 * two people connecting. Deliberately not based on any official KSU mark.
 */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="14" fill="#000" />
      <circle cx="18.5" cy="25" r="8.5" fill="none" stroke="#FFC629" strokeWidth="4" />
      <circle cx="29.5" cy="25" r="8.5" fill="none" stroke="#fff" strokeWidth="4" />
      <circle cx="18.5" cy="25" r="2.6" fill="#FFC629" />
      <circle cx="29.5" cy="25" r="2.6" fill="#fff" />
      <path d="M21 12.5 24 15.5 27 12.5" fill="none" stroke="#FFC629" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, size = 34, inverted = false }: { className?: string; size?: number; inverted?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <span className={cn('text-[1.35rem] font-extrabold tracking-[-0.04em]', inverted ? 'text-white' : 'text-ink')}>
        Owl<span className="relative">Match<span className="absolute -right-2 bottom-1.5 h-1.5 w-1.5 rounded-full bg-gold" /></span>
      </span>
    </span>
  );
}
