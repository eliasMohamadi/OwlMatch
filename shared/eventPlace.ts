import { OWL_LIFE_PDF_SOURCE } from './schemas';
import type { CampusEvent, CampusPreference } from './types';

/**
 * Whether an event fits a campus preference. Online events fit everyone.
 * Imported listings whose campus we couldn't determine fit a general
 * preference (we can't rule them out), but not an explicit campus request.
 */
export function matchesCampus(event: Pick<CampusEvent, 'campus'>, preference: CampusPreference, { explicit = false } = {}): boolean {
  if (preference === 'both' || event.campus === preference || event.campus === 'online') return true;
  return event.campus === 'unspecified' && !explicit;
}

/**
 * OwlMatch's own "ongoing" listings are drop-in spaces. A multi-day imported
 * listing (a trip, a two-day showcase) is not, so it shows its real dates.
 */
export function isDropIn(event: Pick<CampusEvent, 'kind' | 'source'>): boolean {
  return event.kind === 'ongoing' && event.source.type !== OWL_LIFE_PDF_SOURCE;
}
