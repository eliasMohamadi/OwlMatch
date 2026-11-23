import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/** Points the store at a throwaway data directory before any server module reads the config. */
const dataDir = mkdtempSync(path.join(tmpdir(), 'owlmatch-test-'));
process.env.OWLMATCH_DATA_DIR = dataDir;

const { read, mutate, resetToSeed } = await import('../server/store/db');
const { pruneOrphanUploads, deleteCoverImage, UPLOAD_DIR } = await import('../server/services/uploads');
const { upsertMicrosoftStudent } = await import('../server/services/accounts');
const { createStudentEvent } = await import('../server/services/eventActions');

afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

describe('JSON store', () => {
  it('moves an unreadable db.json aside instead of overwriting it', () => {
    writeFileSync(path.join(dataDir, 'db.json'), '{ not json');
    const db = read();
    expect(db.students.length).toBeGreaterThan(0);
    const backups = readdirSync(dataDir).filter((f) => f.startsWith('db.json.corrupt-'));
    expect(backups).toHaveLength(1);
  });

  it('reset keeps real student accounts but clears their events', () => {
    const real = mutate((db) => upsertMicrosoftStudent(db, { tenantId: 't', objectId: 'o', email: 'a@students.kennesaw.edu', name: 'A' }, new Date()));
    mutate((db) => createStudentEvent(db, eventInput(real.id), new Date()));
    const after = resetToSeed();
    expect(after.students.some((s) => s.id === real.id)).toBe(true);
    expect(after.events.some((e) => e.organizer.studentId === real.id)).toBe(false);
  });
});

describe('uploads', () => {
  const file = (name: string, ageMs: number) => {
    mkdirSync(UPLOAD_DIR(), { recursive: true });
    const full = path.join(UPLOAD_DIR(), name);
    writeFileSync(full, 'x');
    const t = (Date.now() - ageMs) / 1000;
    utimesSync(full, t, t);
    return full;
  };
  const HOUR = 60 * 60 * 1000;

  it('prunes old unreferenced images only', () => {
    const used = '00000000-0000-0000-0000-000000000001.jpg';
    const orphan = '00000000-0000-0000-0000-000000000002.png';
    const fresh = '00000000-0000-0000-0000-000000000003.webp';
    const other = 'readme.txt';
    [used, orphan, other].forEach((n) => file(n, 2 * HOUR));
    file(fresh, 0);
    const db = { ...read(), events: [{ coverImageUrl: `/uploads/${used}` }] } as unknown as Parameters<typeof pruneOrphanUploads>[0];
    expect(pruneOrphanUploads(db)).toBe(1);
    expect(existsSync(path.join(UPLOAD_DIR(), orphan))).toBe(false);
    for (const kept of [used, fresh, other]) expect(existsSync(path.join(UPLOAD_DIR(), kept))).toBe(true);
  });

  it('deletes a cover image unless another event still uses it', () => {
    const name = '00000000-0000-0000-0000-000000000004.jpg';
    const full = file(name, 0);
    const shared = { ...read(), events: [{ coverImageUrl: `/uploads/${name}` }] } as unknown as Parameters<typeof deleteCoverImage>[0];
    deleteCoverImage(shared, `/uploads/${name}`);
    expect(existsSync(full)).toBe(true);
    deleteCoverImage({ ...read(), events: [] }, `/uploads/${name}`);
    expect(existsSync(full)).toBe(false);
    deleteCoverImage({ ...read(), events: [] }, '/uploads/../../db.json'); // never touches anything outside the pattern
    expect(existsSync(path.join(dataDir, 'db.json'))).toBe(true);
  });
});

function eventInput(organizerId: string) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    organizerId, title: 'Casual Game Night', description: 'Smash, Mario Kart and student-made indie games.',
    categories: ['gaming'], campus: 'marietta', venue: 'Student Center', address: 'Room 210',
    date: tomorrow, startTime: '19:00', endTime: '22:00', capacity: 16, visibility: 'public',
    groupSize: 'small', energy: 'relaxed', beginnerFriendly: true, organizationName: '', coverImageUrl: null,
  };
}
