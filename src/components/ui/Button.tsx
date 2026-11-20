import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gold text-ink hover:bg-[#ffd04f] shadow-[0_6px_20px_-8px_rgb(224_168_0/0.8)]',
  dark: 'bg-ink text-white hover:bg-charcoal',
  outline: 'border border-line bg-white text-ink hover:border-ink/30 hover:bg-surface',
  ghost: 'text-ink hover:bg-surface',
  danger: 'border border-orange-200 bg-white text-danger hover:bg-orange-50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-[15px] gap-2',
  lg: 'h-14 px-7 text-base gap-2.5',
};

/** Shared look so links (router or external) can be styled exactly like buttons. */
export function buttonStyles({ variant = 'primary', size = 'md', block = false }: { variant?: Variant; size?: Size; block?: boolean } = {}): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[-0.01em] transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, block = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(buttonStyles({ variant, size, block }), className)}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" size={18} aria-hidden /> : icon}
      {children}
    </button>
  );
});
