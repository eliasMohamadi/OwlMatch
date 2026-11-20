/** Joins truthy class names. Small enough that a dependency isn't worth it. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
