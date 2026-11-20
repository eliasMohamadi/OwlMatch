import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { campusTimeToUtc } from '../shared/time';
import { importOwlLifePdf } from '../server/ingest/owlLife/importPdf';
import { owlLifeImportFile, owlLifeReportFile, writeOwlLifeImport } from '../server/ingest/owlLife/importStore';

/**
 * Imports a PDF export of the Owl Life (Suitable) "Upcoming activities" list.
 *
 *   npm run import:owl-life -- "path/to/Activities - Suitable.pdf"
 *   npm run import:owl-life -- export.pdf --dry-run
 *   npm run import:owl-life -- export.pdf --snapshot 2026-11-20T08:12
 *
 * The newest import replaces the previous one. A running server picks it up on
 * its next request; no restart or code change is needed.
 */

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'dry-run': { type: 'boolean', default: false },
    snapshot: { type: 'string' },
    json: { type: 'boolean', default: false },
  },
});

const pdfPath = positionals[0];
if (!pdfPath || !existsSync(pdfPath)) {
  console.error('Usage: npm run import:owl-life -- <export.pdf> [--dry-run] [--snapshot YYYY-MM-DDTHH:mm] [--json]');
  process.exit(1);
}

let snapshotAt: Date | undefined;
if (values.snapshot) {
  const [date, time] = values.snapshot.split('T');
  snapshotAt = campusTimeToUtc(date, time ?? '00:00');
  if (Number.isNaN(snapshotAt.getTime())) {
    console.error(`Invalid --snapshot "${values.snapshot}"`);
    process.exit(1);
  }
}

const dryRun = values['dry-run'];
const { data, report } = await importOwlLifePdf({ pdfPath, snapshotAt, writeImages: !dryRun });

if (!dryRun) writeOwlLifeImport(data, report);

if (values.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const list = (record: Record<string, number>) =>
    Object.entries(record)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(', ');
  console.log(`Owl Life PDF import${dryRun ? ' (dry run, nothing saved)' : ''}`);
  console.log(`  File:              ${report.pdfFileName} (${report.pdfPages} pages)`);
  console.log(`  Snapshot:          ${report.snapshotAt} (from ${report.snapshotFrom})`);
  if (report.printedPagesMissing.length) console.log(`  Printed pages missing from the file: ${report.printedPagesMissing.join(', ')}`);
  console.log(`  Extracted cards:   ${report.extracted}`);
  console.log(`  Imported records:  ${report.imported}`);
  console.log(`  Duplicates merged: ${report.duplicates.length}`);
  for (const d of report.duplicates) console.log(`    - ${d.title} (${d.start}), page ${d.pdfPages.join('/')}`);
  console.log(`  Rejected:          ${report.rejected.length}`);
  for (const r of report.rejected) console.log(`    - #${r.card} ${r.title}: ${r.reason}`);
  console.log(`  Already ended:     ${report.alreadyEndedAtImport} (imported, hidden automatically)`);
  console.log(`  Missing fields:    ${list(report.missingFields)}`);
  console.log(`  Cover images:      ${report.imagesSaved}`);
  console.log(`  By campus:         ${list(report.byCampus)}`);
  console.log(`  By category:       ${list(report.byCategory)}`);
  if (!dryRun) console.log(`\nSaved ${owlLifeImportFile()}\nReport ${owlLifeReportFile()}`);
}
