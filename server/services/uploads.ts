import { readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Database } from '../../shared/types';
import { config } from '../config';

export const UPLOAD_DIR = () => path.join(config.dataDir, 'uploads');

/** Student cover uploads are `/uploads/<uuid>.<ext>`; anything else (e.g. Owl Life images in a subfolder) is left alone. */
const STUDENT_UPLOAD_FILE = /^[0-9a-f-]{36}\.(?:jpg|png|webp)$/;
const STUDENT_UPLOAD_URL = /^\/uploads\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/;

/** An upload younger than this may belong to an event form that hasn't been published yet. */
export const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const referencedUploads = (db: Readonly<Database>) =>
  new Set(db.events.map((e) => e.coverImageUrl?.match(STUDENT_UPLOAD_URL)?.[1]).filter((name): name is string => Boolean(name)));

/** Deletes one event's cover image, unless another event still uses it. */
export function deleteCoverImage(db: Readonly<Database>, url: string | null): void {
  const fileName = url?.match(STUDENT_UPLOAD_URL)?.[1];
  if (!fileName || referencedUploads(db).has(fileName)) return;
  rmSync(path.join(UPLOAD_DIR(), fileName), { force: true });
}

/**
 * Removes student uploads that no event points at: images uploaded for events
 * that were never published, and images left behind by a reset or the sample
 * purge. Recent files are kept so an in-progress form doesn't lose its image.
 * Returns the number of files removed.
 */
export function pruneOrphanUploads(db: Readonly<Database>, now = Date.now(), minAgeMs = ORPHAN_MIN_AGE_MS): number {
  let entries: string[];
  try {
    entries = readdirSync(UPLOAD_DIR());
  } catch {
    return 0; // no uploads yet
  }
  const keep = referencedUploads(db);
  let removed = 0;
  for (const name of entries) {
    if (!STUDENT_UPLOAD_FILE.test(name) || keep.has(name)) continue;
    const file = path.join(UPLOAD_DIR(), name);
    try {
      if (now - statSync(file).mtimeMs < minAgeMs) continue;
      rmSync(file, { force: true });
      removed += 1;
    } catch {
      // Already gone or locked; the next sweep will retry.
    }
  }
  return removed;
}
