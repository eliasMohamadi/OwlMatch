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

/**
 * Moves an unreadable db.json aside instead of overwriting it, so a bad edit or
 * a schema change never silently destroys data. Returns the backup path.
 */
function quarantine(reason: string): string {
  const backup = `${dbFile()}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  renameSync(dbFile(), backup);
  console.error(`[store] db.json ${reason}. It was moved to ${backup} and a fresh database was started.`);
  return backup;
}

function load(): Database {
  if (existsSync(dbFile())) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(dbFile(), 'utf8'));
    } catch {
      raw = undefined;
    }
    const parsed = raw === undefined ? null : databaseSchema.safeParse(raw);
    if (parsed?.success) {
      const db = withImports(realDataOnly(parsed.data));
      persist(db);
      return db;
    }
    quarantine(parsed ? `failed validation (${parsed.error.issues[0]?.path.join('.')}: ${parsed.error.issues[0]?.message})` : 'is not valid JSON');
  }
  const seeded = withImports(freshDatabase(new Date()));
  persist(seeded);
  return seeded;
}

/** How often `read()` checks whether `npm run import:owl-life` wrote a new import file. */
const IMPORT_CHECK_INTERVAL_MS = 2000;
let lastImportCheck = 0;

export function read(): Readonly<Database> {
  cache ??= load();
  // A new import was written by `npm run import:owl-life`; layer it in without a restart.
  const now = Date.now();
  if (now - lastImportCheck >= IMPORT_CHECK_INTERVAL_MS) {
    lastImportCheck = now;
    if (owlLifeImportVersion() !== appliedImportVersion) {
      cache = withImports(cache);
      persist(cache);
    }
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
 * OWLMATCH_SAMPLE_EVENTS=1), keeping the latest imported listings and the
 * accounts of real students who signed in with Microsoft (so their sessions
 * stay valid). Their swipes and events are cleared like everyone else's.
 */
export function resetToSeed(now = new Date()): Database {
  const realStudents = (cache ?? (existsSync(dbFile()) ? read() : null))?.students.filter((s) => s.account.type === 'microsoft') ?? [];
  const fresh = freshDatabase(now);
  const seeded = withImports({ ...fresh, students: [...fresh.students, ...structuredClone(realStudents)] });
  persist(seeded);
  cache = seeded;
  return seeded;
}
