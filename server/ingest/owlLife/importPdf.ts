import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { OWL_LIFE_PDF_SOURCE } from '../../../shared/schemas';
import { CAMPUS_TIME_ZONE, campusTimeToUtc } from '../../../shared/time';
import type { CampusEvent } from '../../../shared/types';
import { OWL_LIFE_IMAGE_URL_PREFIX, type OwlLifeImport, owlLifeImageDir } from './importStore';
import { type MissingField, normalizeCard } from './normalize';
import { parseCards } from './parseCards';
import { loadPdfLayout, type LoadedPdf } from './pdfLayout';
import type { LayoutImage, RawCard } from './types';

/**
 * PDF → events, with a report of everything that was extracted, merged,
 * rejected or missing. Pure apart from writing cover images; the caller
 * decides whether to save the result.
 */

const COVER_WIDTH = 640;
const COVER_QUALITY = 80;

export interface ImportOptions {
  pdfPath: string;
  /** Overrides the print timestamp found in the PDF header. */
  snapshotAt?: Date;
  /** Skip writing cover images (dry runs). */
  writeImages?: boolean;
  now?: Date;
}

export interface ImportReport {
  source: typeof OWL_LIFE_PDF_SOURCE;
  pdfFileName: string;
  snapshotAt: string;
  snapshotFrom: 'pdf-header' | 'option';
  importedAt: string;
  pdfPages: number;
  printedPagesMissing: number[];
  extracted: number;
  imported: number;
  duplicates: { title: string; start: string; keptId: string; pdfPages: number[] }[];
  rejected: { card: number; title: string; reason: string; pdfPages: number[] }[];
  missingFields: Record<MissingField, number>;
  missingByRecord: { id: string; title: string; missing: MissingField[] }[];
  notes: { id: string; title: string; notes: string[] }[];
  alreadyEndedAtImport: number;
  byCampus: Record<string, number>;
  byCategory: Record<string, number>;
  imagesSaved: number;
}

/** "11/20/26, 8:12 AM" printed in campus time. */
export function parsePrintedAt(printed: string | null): Date | null {
  const m = printed?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}), (\d{1,2}):(\d{2}) ([AP]M)$/);
  if (!m) return null;
  const [, mo, d, yy, h, min, ap] = m;
  const hour = (Number(h) % 12) + (ap === 'PM' ? 12 : 0);
  return campusTimeToUtc(`20${yy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`, `${String(hour).padStart(2, '0')}:${min}`);
}

async function saveCover(pdf: LoadedPdf, image: LayoutImage, cache: Map<string, string | null>, write: boolean): Promise<string | null> {
  if (cache.has(image.id)) return cache.get(image.id) ?? null;
  const pixels = await pdf.pixels(image);
  if (!pixels) {
    cache.set(image.id, null);
    return null;
  }
  const name = `${createHash('sha1').update(pixels.data).digest('hex').slice(0, 16)}.jpg`;
  const file = path.join(owlLifeImageDir(), name);
  if (write && !existsSync(file)) {
    mkdirSync(owlLifeImageDir(), { recursive: true });
    const jpeg = await sharp(Buffer.from(pixels.data), { raw: { width: pixels.width, height: pixels.height, channels: pixels.channels } })
      .resize({ width: COVER_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: COVER_QUALITY, mozjpeg: true })
      .toBuffer();
    writeFileSync(file, jpeg);
  }
  const url = `${OWL_LIFE_IMAGE_URL_PREFIX}${name}`;
  cache.set(image.id, url);
  return url;
}

const titleOf = (card: RawCard) => card.titleLines.join(' ').replace(/\s+/g, ' ').trim();

function countBy<T>(items: T[], key: (item: T) => string | string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) for (const k of [key(item)].flat()) out[k] = (out[k] ?? 0) + 1;
  return out;
}

export async function importOwlLifePdf(options: ImportOptions): Promise<{ data: OwlLifeImport; report: ImportReport }> {
  const now = options.now ?? new Date();
  const pdf = await loadPdfLayout(options.pdfPath);
  try {
    const { cards, metadata } = parseCards(pdf.layout);
    const printed = parsePrintedAt(metadata.printedAt);
    const snapshotAt = options.snapshotAt ?? printed;
    if (!snapshotAt) throw new Error('Could not find the print timestamp in the PDF header; pass --snapshot "YYYY-MM-DDTHH:mm" (campus time).');

    const images = new Map<string, string | null>();
    const byFingerprint = new Map<string, CampusEvent>();
    const report: ImportReport = {
      source: OWL_LIFE_PDF_SOURCE,
      pdfFileName: path.basename(options.pdfPath),
      snapshotAt: snapshotAt.toISOString(),
      snapshotFrom: options.snapshotAt ? 'option' : 'pdf-header',
      importedAt: now.toISOString(),
      pdfPages: pdf.layout.pages.length,
      printedPagesMissing: metadata.printedPageTotal
        ? Array.from({ length: metadata.printedPageTotal }, (_, i) => i + 1).filter((n) => !metadata.printedPageNumbers.includes(n))
        : [],
      extracted: cards.length,
      imported: 0,
      duplicates: [],
      rejected: [],
      missingFields: { location: 0, organizer: 0, image: 0, rsvpCount: 0, points: 0, level: 0 },
      missingByRecord: [],
      notes: [],
      alreadyEndedAtImport: 0,
      byCampus: {},
      byCategory: {},
      imagesSaved: 0,
    };

    for (const card of cards) {
      const coverImageUrl = card.image ? await saveCover(pdf, card.image, images, options.writeImages !== false) : null;
      const result = normalizeCard(card, { snapshotAt, printedZone: CAMPUS_TIME_ZONE, coverImageUrl });
      if (!result.ok) {
        report.rejected.push({ card: card.index, title: titleOf(card) || '(no title)', reason: result.reason, pdfPages: card.pages });
        continue;
      }
      const { event } = result;
      const fingerprint = event.external?.fingerprint ?? event.id;
      const existing = byFingerprint.get(fingerprint);
      if (existing) {
        // Same title, time and place printed twice: keep one, remember where both were.
        report.duplicates.push({ title: event.title, start: event.start, keptId: existing.id, pdfPages: card.pages });
        if (existing.external) existing.external.pdfPages = [...new Set([...existing.external.pdfPages, ...card.pages])];
        existing.coverImageUrl ??= event.coverImageUrl;
        continue;
      }
      byFingerprint.set(fingerprint, event);
      if (result.missing.length) report.missingByRecord.push({ id: event.id, title: event.title, missing: result.missing });
      if (result.notes.length) report.notes.push({ id: event.id, title: event.title, notes: result.notes });
    }

    const events = [...byFingerprint.values()];
    // Recount missing fields after duplicates may have filled an image.
    report.missingByRecord = report.missingByRecord
      .map((r) => {
        const event = events.find((e) => e.id === r.id);
        return { ...r, missing: r.missing.filter((m) => !(m === 'image' && event?.coverImageUrl)) };
      })
      .filter((r) => r.missing.length > 0);
    for (const r of report.missingByRecord) for (const m of r.missing) report.missingFields[m] += 1;
    report.imported = events.length;
    report.alreadyEndedAtImport = events.filter((e) => new Date(e.end).getTime() <= now.getTime()).length;
    report.byCampus = countBy(events, (e) => e.campus);
    report.byCategory = countBy(events, (e) => e.categories);
    report.imagesSaved = new Set(events.map((e) => e.coverImageUrl).filter(Boolean)).size;

    const data: OwlLifeImport = {
      version: 1,
      source: OWL_LIFE_PDF_SOURCE,
      snapshotAt: snapshotAt.toISOString(),
      importedAt: now.toISOString(),
      pdfFileName: report.pdfFileName,
      events,
    };
    return { data, report };
  } finally {
    await pdf.close();
  }
}
