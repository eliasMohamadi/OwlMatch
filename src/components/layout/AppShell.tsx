import { Heart, PlusCircle, Sparkles, Compass, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { Logo } from '../ui/Logo';
import { StudentSwitcher } from './StudentSwitcher';

const NAV_ITEMS = [
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/matches', label: 'Matches', icon: Heart },
  { to: '/create', label: 'Create', icon: PlusCircle },
  { to: '/ai', label: 'AI', icon: Sparkles },
  { to: '/profile', label: 'Profile', icon: UserRound },
] as const;

/**
 * Mobile: top bar + thumb-reachable bottom tabs. Desktop: compact sidebar with
 * the content column kept at a readable width.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-white px-5 py-6 md:flex">
        <Logo />
        <nav aria-label="Main" className="mt-10 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <SideLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <p className="px-1 text-xs leading-relaxed text-muted">Student-built project inspired by KSU. Not an official university service.</p>
          <StudentSwitcher variant="full" />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/70 bg-paper/85 px-4 py-2.5 backdrop-blur-lg md:hidden">
          <Logo size={30} />
          <StudentSwitcher variant="compact" />
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 md:px-10 md:pt-10 md:pb-12">
          <Outlet />
        </main>
      </div>

      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-lg md:hidden">
        <ul className="mx-auto flex max-w-md items-stretch justify-around">
          {NAV_ITEMS.map((item) => (
            <li key={item.to} className="flex-1">
              <TabLink {...item} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

type NavItem = (typeof NAV_ITEMS)[number];

function SideLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-semibold transition-colors',
          isActive ? 'bg-ink text-white' : 'text-charcoal hover:bg-surface',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={20} className={isActive ? 'text-gold' : ''} aria-hidden />
          {label}
        </>
      )}
    </NavLink>
  );
}

function TabLink({ to, label, icon: Icon }: NavItem): ReactNode {
  const isCreate = to === '/create';
  return (
    <NavLink to={to} className="flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold">
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex h-8 w-12 items-center justify-center rounded-full transition-colors',
              isCreate ? 'bg-gold text-ink' : isActive ? 'bg-ink text-gold' : 'text-muted',
            )}
          >
            <Icon size={20} aria-hidden />
          </span>
          <span className={isActive ? 'text-ink' : 'text-muted'}>{label}</span>
        </>
      )}
    </NavLink>
  );
}
