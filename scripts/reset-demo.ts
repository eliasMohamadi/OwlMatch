/** Resets server/data/db.json to the seeded demo dataset (dates relative to now). */
import { resetToSeed } from '../server/store/db';

const db = resetToSeed();
console.log(`Demo data reset: ${db.students.length} students, ${db.events.length} sample events.`);
