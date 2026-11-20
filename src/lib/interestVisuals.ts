import {
  Code2,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Mountain,
  Music,
  Palette,
  PartyPopper,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { InterestId } from '@shared/interests';

/** Icon + cover palette per interest. Covers use rich tones so gold stays special. */
export const INTEREST_VISUALS: Record<InterestId, { icon: LucideIcon; from: string; to: string; ink: 'light' | 'dark' }> = {
  tech: { icon: Code2, from: '#111111', to: '#3a3a3a', ink: 'light' },
  engineering: { icon: Wrench, from: '#1f2937', to: '#475569', ink: 'light' },
  gaming: { icon: Gamepad2, from: '#1e1b4b', to: '#6d28d9', ink: 'light' },
  sports: { icon: Dumbbell, from: '#9a3412', to: '#f97316', ink: 'light' },
  arts: { icon: Palette, from: '#9d174d', to: '#f472b6', ink: 'light' },
  music: { icon: Music, from: '#4c1d95', to: '#a78bfa', ink: 'light' },
  social: { icon: PartyPopper, from: '#f5b400', to: '#ffd863', ink: 'dark' },
  career: { icon: GraduationCap, from: '#134e4a', to: '#14b8a6', ink: 'light' },
  outdoors: { icon: Mountain, from: '#14532d', to: '#4ade80', ink: 'light' },
  wellness: { icon: HeartPulse, from: '#0c4a6e', to: '#38bdf8', ink: 'light' },
  volunteering: { icon: HandHeart, from: '#7f1d1d', to: '#f87171', ink: 'light' },
  orgs: { icon: Users, from: '#1e3a8a', to: '#60a5fa', ink: 'light' },
};
