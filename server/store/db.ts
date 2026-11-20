import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { databaseSchema } from '../../shared/schemas';
import type { Database } from '../../shared/types';
import { config } from '../config';
import { createSeedDatabase } from './seed';

/**
 * Persistent JSON-file store. It keeps the whole (small) dataset in memory and
 * writes it atomically after each mutation, so two demo students on different
 * tabs share the same state and nothing is lost on restart.
 *
 * Swapping in Supabase means re-implementing `read`/`mutate` only; every
 * caller goes through these two functions.
 */
const dbFile = () => path.join(config.dataDir, 'db.json');

let cache: Database | null = null;

function persist(db: Database): void {
  mkdirSync(config.dataDir, { recursive: true });
  const tmp = `${dbFile()}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, dbFile());
}

function load(): Database {
  if (existsSync(dbFile())) {
    const parsed = databaseSchema.safeParse(JSON.parse(readFileSync(dbFile(), 'utf8')));
    if (parsed.success) return parsed.data;
    console.warn('[store] db.json failed validation; reseeding demo data');
  }
  const seeded = createSeedDatabase(new Date());
  persist(seeded);
  return seeded;
}

export function read(): Readonly<Database> {
  cache ??= load();
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

export function resetToSeed(now = new Date()): Database {
  const seeded = createSeedDatabase(now);
  persist(seeded);
  cache = seeded;
  return seeded;
}
