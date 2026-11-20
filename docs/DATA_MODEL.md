# Data Model

All shapes are defined once as zod schemas in [`shared/schemas.ts`](../shared/schemas.ts). TypeScript types are inferred from them in [`shared/types.ts`](../shared/types.ts). The server validates `db.json` against `databaseSchema` on load.

```
Student 1───* Swipe *───1 CampusEvent *───1 Organizer (embedded; studentId → Student for student-hosted)
   │                         │
   ├──* Connection *─────────┤   "find people to go with" opt-in
   └──* JoinRequest *────────┘   approval-required events
```

## Entities

**Student**: `id, name, major, year, avatarColor, onboarded, campus (kennesaw|marietta|both), interests[], about, availability[], social{makeFriends, groupSize, tryNew, energy}, socialVisible, aiProfile`
- `aiProfile` (output of AI Step A): `summary, inferredInterests[], keywords[], preferredGroupSize, preferredEnergy, goals[], source (gemini|heuristic), generatedAt`
- `about` is never shown to other students.

**CampusEvent**: `id, title, description, categories[1..3], tags[], kind (event|ongoing), campus, venue, address, start, end (UTC ISO), groupSize, energy, beginnerFriendly, capacity?, visibility (public|approval|invite), organizer, source, rsvpUrl?, coverImageUrl?, createdAt, status (active|removed), reports[]`
- `organizer`: `name, kind (official|organization|student), studentId?, verification (sample-data|demo-simulated|unverified)`
- `source`: `type (sample|student), label, url?, verifiedAt?`. This is ready for an ingestion adapter, which would add a new type and set `url` and `verifiedAt`.

**Swipe**: `studentId, eventId, decision (interested|passed), at`. There is at most one per pair (upsert).

**Connection**: `studentId, eventId, at`. Opt-in to mutual visibility. It requires an `interested` swipe.

**JoinRequest**: `studentId, eventId, status (pending|approved), at`. Created when a student shows interest in an approval-only event.

## Derived values (never stored)

| Value | Derived from |
|---|---|
| `interestedCount` | Swipes with `decision = interested` |
| `goingTogetherCount` | Connections whose student is still interested and has `socialVisible = true` |
| `EventView.address` | `null` unless the event is public, the viewer is the host, or the viewer's join request is approved |
| Match score | `shared/ranking.ts` (rules) or Gemini re-rank (clamped) |

## Storage

`server/data/db.json` (gitignored) is written atomically (tmp file + rename) after each mutation. Uploads go in `server/data/uploads/`. Supabase mapping: each entity above becomes one table. `Swipe`, `Connection` and `JoinRequest` get a composite primary key `(student_id, event_id)`. Row-level security would replace `toEventView`'s viewer checks.
