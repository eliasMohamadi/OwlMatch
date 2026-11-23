/**
 * Resets the data directory's db.json to the starting dataset: demo students,
 * sample events only when OWLMATCH_SAMPLE_EVENTS=1, the latest Owl Life import,
 * and the accounts (not the activity) of students who signed in with Microsoft.
 */
import { resetToSeed } from '../server/store/db';
import { pruneOrphanUploads } from '../server/services/uploads';

const db = resetToSeed();
pruneOrphanUploads(db);
const count = (type: string) => db.events.filter((e) => e.source.type === type).length;
const demo = db.students.filter((s) => s.account.type === 'demo').length;
console.log(
  `Data reset: ${demo} demo students, ${db.students.length - demo} real student accounts kept, ` +
    `${count('sample')} sample events, ${count('owl_life_pdf')} Owl Life listings.`,
);
