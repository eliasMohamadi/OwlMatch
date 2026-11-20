import { describe, expect, it } from 'vitest';
import { isDropIn, matchesCampus } from '../shared/eventPlace';
import { campusEventSchema } from '../shared/schemas';
import { campusTimeToUtc } from '../shared/time';
import type { Database } from '../shared/types';
import { applyOwlLifeImport, type OwlLifeImport } from '../server/ingest/owlLife/importStore';
import { categorize, cleanTitle, detectCampus, normalizeCard, parseDateLine } from '../server/ingest/owlLife/normalize';
import { parseCards } from '../server/ingest/owlLife/parseCards';
import type { LayoutText, PdfLayout, RawCard } from '../server/ingest/owlLife/types';
import { createSeedDatabase } from '../server/store/seed';

/** Owl Life PDF ingestion against a synthetic printout: no PDF or network needed. */

const SNAPSHOT = campusTimeToUtc('2026-11-20', '08:12');
const t = (str: string, x: number, y: number, size = 9): LayoutText => ({ str, x, y, size, font: 'f' });

/** Two cards; the second one breaks across a page and has a doubled title. */
const layout: PdfLayout = {
  pages: [
    {
      number: 1,
      width: 612,
      height: 792,
      images: [{ id: 'img1', page: 1, x: 49, top: 38, width: 150, height: 150, pixelWidth: 560, pixelHeight: 560 }],
      texts: [
        t('11/20/26, 8:12 AM', 24, 22, 8),
        t('RSVPs: 8 / 30', 226, 48),
        t('Incentivized Activity', 300, 48),
        t('Honors- BINGO Night (Marietta)', 229, 70, 12),
        t('Marietta Honors Lounge - Ground Floor, Norton Hall', 226, 94),
        t('Today from 6:30 PM to 8:00 PM', 226, 115),
        t('Level 2', 208, 142),
        t('C', 251, 142),
        t('20 pts', 525, 142, 10),
        t('Added by', 208, 172, 7),
        t('Honors College', 487, 199),
        t('RSVPs: 0', 226, 700),
        t('Percussion Ensemble Percussion Ensemble', 229, 722, 12),
        t('Event', 110, 722, 12),
        t('2/32', 572, 775, 8),
      ],
    },
    {
      number: 2,
      width: 612,
      height: 792,
      images: [],
      texts: [
        t('Morgan Concert Hall', 226, 48),
        t('Nov 30, 7:30 PM CST', 226, 70),
        t('Nov 30, 9:30 PM CST', 325, 70),
        t('Level 1', 208, 97),
        t('C', 251, 97),
        t('10 pts', 525, 97, 10),
        t('Added by', 208, 126, 7),
        t('Student Activities', 487, 154),
        t('3/32', 572, 775, 8),
      ],
    },
  ],
};

describe('parseCards', () => {
  const { cards, metadata } = parseCards(layout);

  it('reads the print timestamp and notices missing printed pages', () => {
    expect(metadata.printedAt).toBe('11/20/26, 8:12 AM');
    expect(metadata.printedPageTotal).toBe(32);
    expect(metadata.printedPageNumbers).toEqual([2, 3]);
  });

  it('splits the strip into one card per activity, even across a page break', () => {
    expect(cards).toHaveLength(2);
    const [bingo, percussion] = cards;
    expect(bingo).toMatchObject({
      titleLines: ['Honors- BINGO Night (Marietta)'],
      badges: ['RSVPs: 8 / 30', 'Incentivized Activity'],
      level: 'Level 2',
      competencies: ['C'],
      points: 20,
      attribution: 'Added by',
      organizers: ['Honors College'],
    });
    expect(bingo.image?.id).toBe('img1');
    // Alt text left of the column ("Event") is ignored; the card continues on page 2.
    expect(percussion.titleLines).toEqual(['Percussion Ensemble Percussion Ensemble']);
    expect(percussion.pages).toEqual([1, 2]);
    expect(percussion.detailLines).toEqual([['Morgan Concert Hall'], ['Nov 30, 7:30 PM CST', 'Nov 30, 9:30 PM CST']]);
    expect(percussion.organizers).toEqual(['Student Activities']);
    expect(percussion.image).toBeNull();
  });
});

describe('dates', () => {
  it('resolves "Today" to the snapshot date in campus time', () => {
    expect(parseDateLine('Today from 9:00 AM to 10:30 AM', SNAPSHOT)).toEqual({
      start: { date: '2026-11-20', time: '09:00', zone: null },
      end: { date: '2026-11-20', time: '10:30', zone: null },
    });
  });

  it('uses the snapshot year unless a year is printed', () => {
    expect(parseDateLine('Dec 1, 9:30 AM Dec 2, 2:00 PM', SNAPSHOT)?.end.date).toBe('2026-12-02');
    expect(parseDateLine('Jan 26, 2027, 10:00 AM Jan 26, 2027, 1:00 PM', SNAPSHOT)?.start.date).toBe('2027-01-26');
    expect(parseDateLine('Nov 16, 12:00 AM Today, 11:59 PM', SNAPSHOT)?.end).toEqual({ date: '2026-11-20', time: '23:59', zone: null });
  });
});

describe('normalizeCard', () => {
  const { cards } = parseCards(layout);

  it('keeps listing facts and the RSVP snapshot apart from OwlMatch counts', () => {
    const result = normalizeCard(cards[0], { snapshotAt: SNAPSHOT, coverImageUrl: '/uploads/owl-life/x.jpg' });
    if (!result.ok) throw new Error(result.reason);
    const { event } = result;
    expect(campusEventSchema.safeParse(event).success).toBe(true);
    expect(event.title).toBe('Honors- BINGO Night (Marietta)');
    expect(event.campus).toBe('marietta');
    expect(event.start).toBe(campusTimeToUtc('2026-11-20', '18:30').toISOString());
    expect(event.source).toMatchObject({ type: 'owl_life_pdf', url: expect.stringContaining('app.suitable.co') });
    expect(event.rsvpUrl).toBeNull();
    expect(event.capacity).toBeNull();
    expect(event.external).toMatchObject({ snapshotRsvpCount: 8, snapshotRsvpLimit: 30, points: 20, badges: ['Incentivized Activity'] });
    expect(event.categories).toEqual(expect.arrayContaining(['gaming', 'social']));
    expect(event.id).toMatch(/^owl-[0-9a-f]{12}$/);
  });

  it('converts a listed time zone and cleans a doubled title', () => {
    const result = normalizeCard(cards[1], { snapshotAt: SNAPSHOT, coverImageUrl: null });
    if (!result.ok) throw new Error(result.reason);
    expect(result.event.title).toBe('Percussion Ensemble');
    expect(result.event.external?.originalTitle).toBe('Percussion Ensemble Percussion Ensemble');
    // 7:30 PM Central is 8:30 PM Eastern.
    expect(result.event.start).toBe(campusTimeToUtc('2026-11-30', '20:30').toISOString());
    expect(result.missing).toEqual(expect.arrayContaining(['image']));
  });

  it('rejects a card without a readable date instead of guessing', () => {
    const broken: RawCard = { ...cards[0], detailLines: [['Somewhere'], ['Sometime soon']] };
    expect(normalizeCard(broken, { snapshotAt: SNAPSHOT, coverImageUrl: null })).toMatchObject({ ok: false });
  });

  it('gives the same id to the same listing on every import', () => {
    const a = normalizeCard(cards[0], { snapshotAt: SNAPSHOT, coverImageUrl: null });
    const b = normalizeCard(cards[0], { snapshotAt: SNAPSHOT, coverImageUrl: null });
    expect(a.ok && b.ok && a.event.id === b.event.id).toBe(true);
  });
});

describe('classification helpers', () => {
  it('detects campus only from places it knows', () => {
    expect(detectCampus('Online - Microsoft Teams', 'Workshop').campus).toBe('online');
    expect(detectCampus('Hybrid: Johnson Library 101 and Teams', 'Proofreading')).toEqual({ campus: 'marietta', delivery: 'hybrid' });
    expect(detectCampus('Siegel Recreation and Activities Center (SRAC) Climbing Gym', 'Climbing').campus).toBe('kennesaw');
    expect(detectCampus('North Cobb Library', 'Year of Thailand').campus).toBe('unspecified');
    expect(detectCampus('Apply in GivePulse. Login via Kennesaw.', 'Trip').campus).toBe('unspecified');
  });

  it('categorizes from the words in the listing', () => {
    expect(categorize('OwlFit Group Fitness Class- Vinyasa Yoga', 'SRAC Studio 2-3', [], ['HW']).categories).toEqual(['sports', 'wellness']);
    expect(categorize('Digital Tools/Generative AI Workshop', null, [], ['CS']).categories).toContain('tech');
    expect(categorize('Hit Your Goals', null, [], ['C', 'S'])).toMatchObject({ categories: ['social'], basis: 'default' });
    expect(categorize('Keeping Up with KAB 3', 'ALC Lobby', [], ['HW', 'C'])).toMatchObject({ categories: ['wellness'], basis: 'competencies' });
  });

  it('collapses only exact doubled titles', () => {
    expect(cleanTitle('Art Cart')).toBe('Art Cart');
    expect(cleanTitle('Scrappy Hour Scrappy Hour')).toBe('Scrappy Hour');
  });
});

describe('campus rules', () => {
  it('shows online everywhere and unknown campuses unless a campus was asked for', () => {
    expect(matchesCampus({ campus: 'online' }, 'marietta', { explicit: true })).toBe(true);
    expect(matchesCampus({ campus: 'unspecified' }, 'kennesaw')).toBe(true);
    expect(matchesCampus({ campus: 'unspecified' }, 'kennesaw', { explicit: true })).toBe(false);
    expect(matchesCampus({ campus: 'marietta' }, 'kennesaw')).toBe(false);
  });

  it('treats multi-day imported listings as dated, not drop-in', () => {
    expect(isDropIn({ kind: 'ongoing', source: { type: 'sample', label: '', url: null, verifiedAt: null } })).toBe(true);
    expect(isDropIn({ kind: 'ongoing', source: { type: 'owl_life_pdf', label: '', url: null, verifiedAt: null } })).toBe(false);
  });
});

describe('applyOwlLifeImport', () => {
  it('replaces the previous import but keeps student events, swipes and moderation', () => {
    const { cards } = parseCards(layout);
    const result = normalizeCard(cards[0], { snapshotAt: SNAPSHOT, coverImageUrl: null });
    if (!result.ok) throw new Error(result.reason);
    const imported: OwlLifeImport = { version: 1, source: 'owl_life_pdf', snapshotAt: SNAPSHOT.toISOString(), importedAt: SNAPSHOT.toISOString(), pdfFileName: 'x.pdf', events: [result.event] };

    const seed = createSeedDatabase(new Date('2026-11-20T14:00:00Z'));
    const stale = { ...result.event, id: 'owl-stale', title: 'Old listing' };
    const removed = { ...result.event, status: 'removed' as const };
    const db: Database = { ...seed, events: [...seed.events, stale, removed], swipes: [...seed.swipes, { studentId: 'stu-maya', eventId: result.event.id, decision: 'interested', at: 'x' }] };

    const next = applyOwlLifeImport(db, imported);
    const owl = next.events.filter((e) => e.source.type === 'owl_life_pdf');
    expect(owl.map((e) => e.id)).toEqual([result.event.id]);
    expect(owl[0].status).toBe('removed');
    expect(next.events.filter((e) => e.source.type === 'sample')).toHaveLength(seed.events.length);
    expect(next.swipes).toHaveLength(db.swipes.length);
  });
});
