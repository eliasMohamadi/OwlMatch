# Architecture

```
 Browser (React SPA)                       Node API (Express)                         External
┌──────────────────────────┐   /api/*    ┌───────────────────────────────┐   HTTPS   ┌──────────────┐
│ features/* pages         │ ──────────▶ │ routes/ (zod-validated input) │ ────────▶ │ Gemini API   │
│ lib/queries (TanStack)   │ ◀────────── │ ai/  pipeline + prompts       │ ◀──────── │ (JSON mode)  │
│ lib/session (demo user)  │   JSON      │ services/ event views/actions │           └──────────────┘
└──────────────────────────┘             │ store/ JSON file (read/mutate)│
            ▲                            └───────────────────────────────┘
            └──────── shared/  (schemas · types · ranking · time · calendar · validation) ────────┘
```

## Layers

| Layer | Responsibility | Key files |
|---|---|---|
| `shared/` | Pure domain logic with no I/O. One implementation of the rules for client, server and tests. | `schemas.ts`, `ranking.ts`, `time.ts`, `calendar.ts`, `eventValidation.ts` |
| `server/routes` | HTTP only: parse input with zod, call a service, return a view | `students.ts`, `events.ts`, `system.ts` |
| `server/services` | Mutations as plain functions over a `Database` object, plus privacy-aware projections | `eventActions.ts`, `eventViews.ts` |
| `server/ai` | The recommendation pipeline, concierge, prompts, Gemini client and heuristic fallbacks | `recommend.ts`, `concierge.ts`, `profile.ts`, `gemini.ts`, `heuristics.ts` |
| `server/store` | Persistence (`read`, `mutate`, `resetToSeed`) and seed data | `db.ts`, `seed.ts` |
| `src/lib` | Typed API client, query hooks and keys, demo session | `api.ts`, `queries.ts`, `session.tsx` |
| `src/features` | One folder per product area; components stay presentational where possible | `discovery/`, `events/`, `onboarding/`, … |
| `src/components` | Reusable UI primitives (Button, Sheet, Toast, Chip, Toggle…) and the app shell | `ui/`, `layout/` |

## Request flows

**Discover.** `GET /api/students/:id/recommendations?campus=…` runs `filterEligible` (hard constraints), then `rankEvents` (weighted rules), then sends the top 10 to Gemini for re-ranking. The ids Gemini returns are validated and the response comes back with `mode: "ai" | "fallback"`. The client keeps the deck in local state and hides cards as you swipe, so a swipe never triggers a re-rank. "Refresh picks" asks the server again, and the server re-ranks using the swipes saved so far.

**Swipe.** `POST /api/events/:id/swipe` upserts one swipe per student and event. A pass removes any opt-in or join request. Counts are always derived from stored records (`eventViews.ts`).

**Create event.** The client runs the same `validateNewEvent` the server runs, so errors show instantly. Images are downscaled in the browser, then uploaded as base64 to `POST /api/uploads`. The server checks the type and decoded size and stores the file under `OWLMATCH_DATA_DIR/uploads`. The new event is then visible to every other student's next recommendation request.

**Privacy.** `toEventView(db, event, viewerId)` is the single place that decides what a viewer may see. Approval-only events have their address removed until the host approves. `GET /events/:id/people` returns names only if the viewer has opted in themselves, and only for students who opted in and haven't turned off social discovery.

## Why this shape

- **One domain package.** Ranking, validation and time-zone rules are shared, so the UI preview, the API and the tests can never disagree.
- **Mutations are pure functions over data.** Tests run them directly on a seed database with no HTTP layer and no mocks. Routes wrap them in `mutate()` for persistence.
- **AI behind an interface.** Every model call goes through `generateJson(prompt, zodSchema)`, which returns typed data or an explicit failure. Callers must handle that failure, so a fallback is always in place.
