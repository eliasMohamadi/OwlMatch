import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { databaseSchema } from '../../shared/schemas';
import type { Database } from '../../shared/types';
import { config } from '../config';
import { applyOwlLifeImport, owlLifeImportVersion, readOwlLifeImport } from '../ingest/owlLife/importStore';
import { createSeedDatabase, withoutSampleEvents } from './seed';

/**
 * Persistent JSON-file store. It keeps the whole (small) dataset in memory and
 * writes it atomically after each mutation, so two demo students on different
 * tabs share the same state and nothing is lost on restart.
 *
 * Imported listings (Owl Life PDF snapshots) are layered on top: whenever the
 * import file changes, its events replace the previous import's events.
 *
 * Swapping in Supabase means re-implementing `read`/`mutate` only; every
 * caller goes through these two functions.
 */
const dbFile = () => path.join(config.dataDir, 'db.json');

let cache: Database | null = null;
let appliedImportVersion = -1;

function persist(db: Database): void {
  mkdirSync(config.dataDir, { recursive: true });
  const tmp = `${dbFile()}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, dbFile());
}

function withImports(db: Database): Database {
  appliedImportVersion = owlLifeImportVersion();
  return applyOwlLifeImport(db, readOwlLifeImport());
}

/** Sample events are purged from existing data unless the sample fixture is switched on. */
const realDataOnly = (db: Database): Database => (config.sampleEvents ? db : withoutSampleEvents(db));
const freshDatabase = (now: Date) => createSeedDatabase(now, { sampleEvents: config.sampleEvents });

function load(): Database {
  if (existsSync(dbFile())) {
    const parsed = databaseSchema.safeParse(JSON.parse(readFileSync(dbFile(), 'utf8')));
    if (parsed.success) {
      const db = withImports(realDataOnly(parsed.data));
      persist(db);
      return db;
    }
    console.warn('[store] db.json failed validation; starting a fresh database');
  }
  const seeded = withImports(freshDatabase(new Date()));
  persist(seeded);
  return seeded;
}

export function read(): Readonly<Database> {
  cache ??= load();
  // A new import was written by `npm run import:owl-life`; layer it in without a restart.
  if (owlLifeImportVersion() !== appliedImportVersion) {
    cache = withImports(cache);
    persist(cache);
  }
  return cache;
}

/** Applies a change and persists it. The mutator may return a value for the caller. */
export function mutate<T>(change: (db: Database) => T): T {
  const db = structuredClone(read()) as Database;
  const result = change(db);
  persist(db);
  cache = db;
  return result;
}

/**
 * Restores the starting dataset (demo students, plus sample events only when
 * OWLMATCH_SAMPLE_EVENTS=1), keeping the latest imported listings.
 */
export function resetToSeed(now = new Date()): Database {
  const seeded = withImports(freshDatabase(now));
  persist(seeded);
  cache = seeded;
  return seeded;
}
