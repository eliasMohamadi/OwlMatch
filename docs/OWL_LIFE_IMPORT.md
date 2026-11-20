# Owl Life PDF import

OwlMatch can import real KSU activities from a PDF export of the Owl Life (Suitable) **Upcoming activities** list. Each import is a **snapshot**, not a live sync: nothing is fetched from Owl Life, and the data is only as current as the PDF.

## Running an import

1. In Owl Life, open the upcoming activities list and print it to PDF. Keep the browser's header and footer on, because the importer reads the print timestamp from the header.
2. Run:

```bash
npm run import:owl-life -- "path/to/Activities - Suitable _ Holistic Student Development.pdf"
npm run import:owl-life -- export.pdf --dry-run                    # report only, saves nothing
npm run import:owl-life -- export.pdf --snapshot 2026-11-20T08:12  # override the timestamp (campus time)
npm run import:owl-life -- export.pdf --json                       # full machine-readable report
```

The newest import **replaces** the previous one. A running server applies it on its next request, so no restart or code change is needed. Students' swipes, opt-ins and student-created events are untouched. If a student reported or removed an imported event, that moderation state carries over while the listing still appears in later exports.

| Output | Location (gitignored) |
|---|---|
| Normalized events | `server/data/imports/owl_life_pdf.json` |
| Import report | `server/data/imports/owl_life_pdf.report.json` |
| Cover images | `server/data/uploads/owl-life/<content-hash>.jpg`, served at `/uploads/owl-life/…` |

**Demo reset** (Profile → Reset demo data) restores the demo students and sample events and **keeps** the latest import.

## Pipeline

```
PDF ─▶ pdfLayout.ts   positioned text + image placements (the only pdfjs code)
    ─▶ parseCards.ts  pages stitched into one strip → one RawCard per activity card
    ─▶ normalize.ts   RawCard → CampusEvent (+ missing fields, notes) or a rejection
    ─▶ importPdf.ts   cover images, de-duplication, report
    ─▶ importStore.ts saved import, merged into the database by store/db.ts
```

All of these files live in `server/ingest/owlLife/`. Each card is recognized by its printed layout:

1. Badges (`RSVPs: 8 / 30`, `Incentivized Activity`)
2. The title (the largest text)
3. Location and date lines
4. The `Level N` row with competency codes and points
5. `Added by` or `Shared by`, then the organizer names

Cards that break across pages are stitched together. Image alt text such as "Event", printed when a cover failed to load, is ignored.

## What is copied, and what is derived

| Field | Rule |
|---|---|
| Title, location, organizers | Copied as printed. Suitable truncates long organizer names, so they show with "…". A title printed twice ("Percussion Ensemble Percussion Ensemble") is shown once, and the original text is kept in `external.originalTitle` |
| Start/end | "Today" means the print date. A missing year means the print year, because Suitable prints the year only for other years. A printed zone suffix (e.g. `CST`) is converted, and the event is flagged in the report |
| RSVPs | `external.snapshotRsvpCount` / `snapshotRsvpLimit`, always labeled "on Owl Life as of <snapshot> (snapshot)". It is never merged into OwlMatch's `interestedCount`, which comes only from swipes, and it is never used as `capacity` |
| Points, level, competencies, badges, requirements | Stored in `external` and shown under "On Owl Life:" on the details page |
| Description | The export has none. OwlMatch writes a short factual line from the fields above and tells students to check Owl Life |
| Link | The export has no per-event links. `source.url` is the general Owl Life activities page, and the details page tells students to search for the title there. `rsvpUrl` stays `null` |
| Campus | `online` for Teams, virtual or online listings. `kennesaw` or `marietta` only when the location (or, failing that, the title) names the campus or a building we know. Everything else is `unspecified` and shows as "Campus not listed" |
| Categories | Keyword rules on the title first, then the venue and organizers. If nothing matches, the competency codes we're sure of (HW → Wellness, CD → Career, CE → Volunteering, L → Orgs), and finally Social. `external.categoryBasis` records which rule applied |
| Group size, energy, beginner-friendly | OwlMatch matching attributes derived from title words. They are not Owl Life facts |
| Cover image | The image embedded on the card, re-encoded as JPEG (≤ 640 px) |

**Duplicates:** two cards with the same title, start, end and location are merged into one record, and the pages of both are kept. The same title at a different time is a separate occurrence and is kept. **Ids** are a hash of those four fields, so re-importing the same listing keeps its id, and students keep their matches.

**Rejections:** a card with no title, no readable date, an unknown time-zone suffix or an end before its start is rejected and listed in the report. Nothing is guessed.

**Expiry:** past listings are imported but never shown. Discover, the concierge and the comparison use the existing `end > now` filter. My Matches moves past events to "Past".

## How imported events behave

- **Discover / Why AI?:** imported events go through the same hard filters, the rule shortlist and the Gemini re-rank as other events. The Gemini prompt labels them "real KSU Owl Life listing (snapshot; no description available)" and includes the venue.
- **Concierge:** online events match any campus request. "Campus not listed" events match general preferences but not an explicit campus request.
- **Calendar:** Google Calendar links use the real start and end (multi-day listings span days) and include the Owl Life page.
- **Badges:** cards carry an "Owl Life listing" badge. Sample events keep "Sample event", and student events keep "Student-hosted".

## First import (Nov 20, 2026, 8:12 AM ET export)

| | Count |
|---|---:|
| Activity cards extracted | 110 |
| Records imported | 109 |
| Duplicates merged | 1 ("Art Cart", Dec 1, printed twice on page 7) |
| Rejected | 0 |
| Missing RSVP count (none printed) | 39 |
| Missing cover image (none printed) | 9 |
| Missing location | 5 |
| Missing organizer, points or level | 0 |
| Distinct cover images | 85 |

The file contains printed pages 2–32. **Page 1 is not in the PDF**, so any activities on it were not imported. "Percussion Ensemble" was listed in CST (7:30 PM CST = 8:30 PM ET), and it is shown converted, as listed.

## Permissions and privacy

The PDF and the extracted cover images (organizers' flyers) stay in the gitignored data directory and are served only by this app. The imported data contains only public activity listings: no student names or RSVP lists.
