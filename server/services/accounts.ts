import { createHash, randomUUID } from 'node:crypto';
import type { Database, Student } from '../../shared/types';
import type { MicrosoftIdentity } from '../auth/entra';

const AVATAR_COLORS = ['#FFC629', '#7DD3FC', '#A7F3D0', '#F9A8D4', '#FDBA74', '#C4B5FD', '#FDE68A', '#99F6E4'];

/** A stable color per account, so avatars don't change between sign-ins. */
function avatarColorFor(objectId: string): string {
  const byte = createHash('sha256').update(objectId).digest()[0];
  return AVATAR_COLORS[byte % AVATAR_COLORS.length];
}

/**
 * Finds the student for a verified Microsoft identity (by tenant + object id),
 * or creates a new, not-yet-onboarded student. Name and email are refreshed on
 * every sign-in because the university can change them.
 */
export function upsertMicrosoftStudent(db: Database, identity: MicrosoftIdentity, now: Date): Student {
  const at = now.toISOString();
  const existing = db.students.find(
    (s) => s.account.type === 'microsoft' && s.account.tenantId === identity.tenantId && s.account.objectId === identity.objectId,
  );
  if (existing && existing.account.type === 'microsoft') {
    existing.name = identity.name;
    existing.account = { ...existing.account, email: identity.email, lastSignInAt: at };
    return existing;
  }
  const student: Student = {
    id: `stu-${randomUUID()}`,
    name: identity.name,
    major: '',
    year: '',
    avatarColor: avatarColorFor(identity.objectId),
    onboarded: false,
    socialVisible: true,
    showMatchSheet: true,
    aiProfile: null,
    campus: 'both',
    interests: [],
    availability: [],
    about: '',
    social: { makeFriends: false, groupSize: 'any', tryNew: false, energy: 'any' },
    account: { type: 'microsoft', tenantId: identity.tenantId, objectId: identity.objectId, email: identity.email, createdAt: at, lastSignInAt: at },
  };
  db.students.push(student);
  return student;
}
