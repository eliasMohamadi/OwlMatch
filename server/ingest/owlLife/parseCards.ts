import type { LayoutImage, LayoutText, PdfLayout, RawCard } from './types';

/**
 * Turns the positioned text of a printed Owl Life (Suitable) activity list into
 * one RawCard per activity. The printout is a single column of cards that can
 * break across pages, so pages are stitched into one continuous strip first.
 *
 * Card anatomy (top to bottom):
 *   [badges: "RSVPs: 3", "Incentivized Activity"]   left column, small
 *   Title (one or more lines)                       largest text
 *   Location line(s) and a date line                left column, small
 *   "Level N"  competency codes ... "NN pts"
 *   "Added by" | "Shared by"  [requirements]
 *   organizer chips                                 right side
 */

const ROW_TOLERANCE = 3;
const TITLE_MIN_SIZE = 11.5;
const TITLE_LINE_GAP = 22;
const ORGANIZER_OFFSET = 100;
const BADGE_COLUMN_OFFSET = 40;
const MIN_COVER_SIZE = 60;
const CARD_TOP_MARGIN = 40;

const HEADER_TIMESTAMP = /^(\d{1,2})\/(\d{1,2})\/(\d{2}), (\d{1,2}):(\d{2}) ([AP]M)$/;
const FOOTER_PAGE = /^(\d+)\/(\d+)$/;
const POINTS = /^(\d+) pts?$/;
const LEVEL = /^Level (\d+)$/;
const ATTRIBUTION = /^(Added by|Shared by)$/;
/** Labels Suitable prints above a card's title. Anything else after "Added by" is an organizer chip. */
const BADGE = /^(RSVPs: \d+( \/ \d+)?|Incentivized Activity)$/;

interface Row {
  y: number;
  page: number;
  items: LayoutText[];
}

export interface PrintMetadata {
  /** Header timestamp exactly as printed, e.g. "11/20/26, 8:12 AM". */
  printedAt: string | null;
  /** Page numbers from the footer ("2/32"), to detect pages missing from the file. */
  printedPageNumbers: number[];
  printedPageTotal: number | null;
}

export interface ParsedPdf {
  cards: RawCard[];
  metadata: PrintMetadata;
}

function isHeaderOrFooter(text: LayoutText, pageHeight: number): boolean {
  return text.y < 35 || text.y > pageHeight - 25;
}

export function readPrintMetadata(layout: PdfLayout): PrintMetadata {
  let printedAt: string | null = null;
  let printedPageTotal: number | null = null;
  const printedPageNumbers: number[] = [];
  for (const page of layout.pages) {
    for (const text of page.texts) {
      if (!isHeaderOrFooter(text, page.height)) continue;
      if (!printedAt && HEADER_TIMESTAMP.test(text.str)) printedAt = text.str;
      const footer = text.str.match(FOOTER_PAGE);
      if (footer) {
        printedPageNumbers.push(Number(footer[1]));
        printedPageTotal = Number(footer[2]);
      }
    }
  }
  return { printedAt, printedPageNumbers, printedPageTotal };
}

/** Stitches every page into one strip and groups text into rows (reading order). */
function toRows(layout: PdfLayout): { rows: Row[]; offsets: Map<number, number> } {
  const offsets = new Map<number, number>();
  const all: (LayoutText & { gy: number; page: number })[] = [];
  let offset = 0;
  for (const page of layout.pages) {
    offsets.set(page.number, offset);
    for (const text of page.texts) {
      if (isHeaderOrFooter(text, page.height)) continue;
      all.push({ ...text, gy: offset + text.y, page: page.number });
    }
    offset += page.height;
  }
  all.sort((a, b) => a.gy - b.gy || a.x - b.x);
  const rows: Row[] = [];
  for (const text of all) {
    const last = rows.at(-1);
    if (last && Math.abs(text.gy - last.y) <= ROW_TOLERANCE) last.items.push(text);
    else rows.push({ y: text.gy, page: text.page, items: [text] });
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return { rows, offsets };
}

/** The x of the "Added by" labels marks the card's left edge; everything else is relative to it. */
function contentLeft(rows: Row[]): number {
  const xs = rows.flatMap((r) => r.items.filter((i) => ATTRIBUTION.test(i.str)).map((i) => i.x));
  if (xs.length === 0) return 0;
  xs.sort((a, b) => a - b);
  return xs[Math.floor(xs.length / 2)];
}

type Phase = 'title' | 'details' | 'level' | 'attribution' | 'organizers';

interface Building extends RawCard {
  phase: Phase;
  top: number;
  bottom: number;
  lastTitleY: number;
}

export function parseCards(layout: PdfLayout): ParsedPdf {
  const metadata = readPrintMetadata(layout);
  const { rows, offsets } = toRows(layout);
  const left = contentLeft(rows);
  const cards: Building[] = [];
  let pendingBadges: string[] = [];
  let pendingTop: number | null = null;
  let current: Building | null = null;

  const isTitleRow = (row: Row) => row.items.some((i) => i.size >= TITLE_MIN_SIZE && i.x > left);
  const notePage = (card: Building, page: number) => {
    if (!card.pages.includes(page)) card.pages.push(page);
  };

  for (const row of rows) {
    // Text left of the card column is image alt text (e.g. "Event"), not card content.
    const items = row.items.filter((i) => i.x >= left - 5);
    if (items.length === 0) continue;
    const strings = items.map((i) => i.str);

    if (isTitleRow({ ...row, items })) {
      const titleText = items.filter((i) => i.size >= TITLE_MIN_SIZE).map((i) => i.str).join(' ');
      if (current && current.phase === 'title' && row.y - current.lastTitleY <= TITLE_LINE_GAP) {
        current.titleLines.push(titleText);
        current.lastTitleY = row.y;
        notePage(current, row.page);
        continue;
      }
      current = {
        index: cards.length + 1,
        pages: [row.page],
        titleLines: [titleText],
        detailLines: [],
        badges: pendingBadges,
        level: null,
        competencies: [],
        points: null,
        attribution: null,
        requirements: [],
        organizers: [],
        image: null,
        phase: 'title',
        top: pendingTop ?? row.y - CARD_TOP_MARGIN,
        bottom: row.y,
        lastTitleY: row.y,
      };
      cards.push(current);
      pendingBadges = [];
      pendingTop = null;
      continue;
    }

    const finished = !current || current.phase === 'level' || current.phase === 'attribution' || current.phase === 'organizers';
    const firstX = items[0].x;

    if (current && strings.some((s) => LEVEL.test(s))) {
      for (const s of strings) {
        const level = s.match(LEVEL);
        const points = s.match(POINTS);
        if (level) current.level = `Level ${level[1]}`;
        else if (points) current.points = Number(points[1]);
        else current.competencies.push(s);
      }
      current.phase = 'level';
    } else if (current && strings.some((s) => ATTRIBUTION.test(s))) {
      current.attribution = strings.find((s) => ATTRIBUTION.test(s)) ?? null;
      current.requirements.push(...strings.filter((s) => !ATTRIBUTION.test(s)));
      current.phase = 'attribution';
    } else if (
      current &&
      (current.phase === 'attribution' || current.phase === 'organizers') &&
      !strings.every((s) => BADGE.test(s)) &&
      (current.phase === 'attribution' || firstX > left + ORGANIZER_OFFSET)
    ) {
      current.organizers.push(...strings);
      current.phase = 'organizers';
    } else if (finished && firstX < left + BADGE_COLUMN_OFFSET) {
      // Labels above the next card's title.
      pendingBadges.push(...strings);
      pendingTop ??= row.y - 15;
      continue;
    } else if (current && (current.phase === 'title' || current.phase === 'details')) {
      const points = strings.filter((s) => POINTS.test(s));
      if (points.length) current.points = Number(points[0].match(POINTS)?.[1]);
      const rest = strings.filter((s) => !POINTS.test(s));
      if (rest.length) current.detailLines.push(rest);
      current.phase = 'details';
    } else {
      continue;
    }
    if (current) {
      current.bottom = row.y;
      notePage(current, row.page);
    }
  }

  attachImages(cards, layout, offsets);
  return {
    metadata,
    cards: cards.map(({ phase: _phase, top: _top, bottom: _bottom, lastTitleY: _last, ...card }) => card),
  };
}

/** Assigns each card the cover image that overlaps it most on the stitched strip. */
function attachImages(cards: Building[], layout: PdfLayout, offsets: Map<number, number>): void {
  const covers = layout.pages.flatMap((page) =>
    page.images
      .filter((img) => img.width >= MIN_COVER_SIZE && img.height >= MIN_COVER_SIZE)
      .map((img) => ({ img, top: (offsets.get(page.number) ?? 0) + img.top, bottom: (offsets.get(page.number) ?? 0) + img.top + img.height })),
  );
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    const nextTop = cards[i + 1]?.top ?? Number.POSITIVE_INFINITY;
    const top = card.top;
    const bottom = Math.min(nextTop, card.bottom + 30);
    let best: { img: LayoutImage; overlap: number } | null = null;
    for (const cover of covers) {
      const overlap = Math.min(bottom, cover.bottom) - Math.max(top, cover.top);
      if (overlap > 0 && (!best || overlap > best.overlap)) best = { img: cover.img, overlap };
    }
    card.image = best?.img ?? null;
  }
}
