import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { OWL_LIFE_PDF_SOURCE, campusEventSchema } from '../../../shared/schemas';
import type { CampusEvent, Database } from '../../../shared/types';
import { config } from '../../config';

/**
 * The latest Owl Life import lives in its own file, separate from db.json, so
 * a demo reset or a re-seed never loses it and a new export can replace it
 * without touching student data (swipes, opt-ins, student-created events).
 */

export const importsDir = () => path.join(config.dataDir, 'imports');
export const owlLifeImportFile = () => path.join(importsDir(), `${OWL_LIFE_PDF_SOURCE}.json`);
export const owlLifeReportFile = () => path.join(importsDir(), `${OWL_LIFE_PDF_SOURCE}.report.json`);
/** Cover images are served by the existing /uploads static route. */
export const owlLifeImageDir = () => path.join(config.dataDir, 'uploads', 'owl-life');
export const OWL_LIFE_IMAGE_URL_PREFIX = '/uploads/owl-life/';

export const owlLifeImportSchema = z.object({
  version: z.literal(1),
  source: z.literal(OWL_LIFE_PDF_SOURCE),
  snapshotAt: z.string(),
  importedAt: z.string(),
  pdfFileName: z.string(),
  events: z.array(campusEventSchema),
});
export type OwlLifeImport = z.infer<typeof owlLifeImportSchema>;

export function writeOwlLifeImport(data: OwlLifeImport, report: unknown): void {
  mkdirSync(importsDir(), { recursive: true });
  const tmp = `${owlLifeImportFile()}.tmp`;
  writeFileSync(tmp, JSON.stringify(owlLifeImportSchema.parse(data), null, 2));
  renameSync(tmp, owlLifeImportFile());
  writeFileSync(owlLifeReportFile(), JSON.stringify(report, null, 2));
}

export function readOwlLifeImport(): OwlLifeImport | null {
  const file = owlLifeImportFile();
  if (!existsSync(file)) return null;
  const parsed = owlLifeImportSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) {
    console.warn('[import] owl_life_pdf.json failed validation; ignoring it');
    return null;
  }
  return parsed.data;
}

/** Modification time of the import file, so the running server can pick up a new import. */
export function owlLifeImportVersion(): number {
  const file = owlLifeImportFile();
  return existsSync(file) ? statSync(file).mtimeMs : 0;
}

/**
 * Replaces every Owl Life event in the database with the latest import.
 * Moderation state (removed / reports) carries over for events that are still
 * listed, and swipes are untouched, so students keep their matches.
 */
export function applyOwlLifeImport(db: Database, imported: OwlLifeImport | null): Database {
  const previous = new Map(db.events.filter((e) => e.source.type === OWL_LIFE_PDF_SOURCE).map((e) => [e.id, e]));
  const incoming: CampusEvent[] = (imported?.events ?? []).map((event) => {
    const prior = previous.get(event.id);
    return prior ? { ...event, status: prior.status, reports: prior.reports } : event;
  });
  return { ...db, events: [...db.events.filter((e) => e.source.type !== OWL_LIFE_PDF_SOURCE), ...incoming] };
}
