# OwlMatch

**Discover your interests. Find your people.**

OwlMatch is a mobile-first, AI-powered campus discovery app for Kennesaw State University students. Students tell OwlMatch what they're into, in their own words. OwlMatch turns that into a structured profile and ranks real campus activities for them, with a specific reason for each pick. Students swipe on what they like. They can opt in to see who else is going and add the event to Google Calendar. Any student can post an activity that other students can then discover.

> Student-built hackathon project (KSU AI Club Hackathon 2026), inspired by KSU. It is **not** an official university service, and it does not use KSU marks.

## The core loop

1. **Student A** posts an activity, for example a casual game night on the Marietta campus.
2. **Student B** onboards by picking interests, social preferences and availability, and writing a sentence about themselves.
3. **AI matching**: Gemini turns B's words into a structured profile. A rule-based shortlist is then re-ranked by Gemini with validated, grounded reasons.
4. B **swipes right**. The interest count updates from stored records, and B can opt in to *find people to go with* (mutual visibility).
5. B adds it to **Google Calendar** and finds it in **My Matches**.
6. The **Campus Concierge** answers natural-language requests using only OwlMatch events.

## Features

| Area | What works |
|---|---|
| Onboarding | Campus, 12 interest categories, social preferences, free-text "about you" (sent to Gemini), availability, and an AI profile summary |
| Discover | Swipe deck (touch/mouse drag, ← → keys, and buttons), match score with its source labeled, a personalized reason, filters (campus, category, time, type), search, empty states |
| AI | Gemini profile extraction, Gemini re-ranking of a deterministic shortlist, concierge intent parsing and grounded replies, a labeled rule-based fallback for every step, and swipe feedback learning |
| Why AI? | Side-by-side view of the same events ranked by category-only matching and by the full pipeline |
| Events | Student event creation with image upload, validation, and visibility (public, approval required, invite link). The location stays hidden until the host approves. Students can report events, and hosts can permanently delete their own (the event, its RSVPs and join requests, and its uploaded image) |
| Social | Interest counts come from real swipes. "Find people to go with" uses mutual opt-in, shares first name and major only, and has a global privacy switch |
| Calendar | A prefilled Google Calendar link with correct UTC times and `ctz=America/New_York` |
| My Matches | Interested, hosting (with join-request approvals) and past events |
| Owl Life import | Real KSU activities from a PDF export of Owl Life: `npm run import:owl-life -- <pdf>`. Each import is labeled "Owl Life listing", RSVP counts are shown as a dated snapshot, past listings are hidden, and a new export replaces the old one ([details](docs/OWL_LIFE_IMPORT.md)) |
| Sign-in | *Sign in with Microsoft* with a KSU account. Microsoft runs the Authenticator approval under the university's MFA policy; the server verifies the ID token, pins the university tenant and allows only KSU email domains ([details](docs/AUTH.md)) |
| Admin & demo mode | A password-protected admin sign-in that acts as demo students (`?as=<id>` per tab, never real students), and an admin-only data reset that clears student-created events and swipes (Owl Life imports and real accounts are kept) |

## Stack

- **Client:** React 18, TypeScript (strict), Vite, Tailwind CSS v4 (design tokens in `src/styles/index.css`), TanStack Query, React Router, Motion, Lucide
- **Server:** Node 22 + Express. Gemini is called **server-side only** through its REST API.
- **Shared domain:** zod schemas, ranking, time-zone, calendar and validation logic in `shared/`, used by the client, the server and the tests
- **Storage:** a persistent JSON file store behind a two-function repository (`read` / `mutate`). It can be swapped for Supabase. See [docs/DECISIONS.md](docs/DECISIONS.md).
- **Tests:** Vitest + React Testing Library (unit, pipeline and component tests) and Playwright (the full demo story)

## Getting started

```bash
npm install
cp .env.example .env        # set ADMIN_PASSWORD to test with demo students; GEMINI_API_KEY is optional
npm run dev                 # API on :8787, web on :5173 (Vite picks the next free port if taken)
```

Open the printed web URL and sign in. To test with demo students, expand **Admin sign-in** and enter `ADMIN_PASSWORD`. The default demo student is **Jordan**. Use the avatar menu to switch, or open a second tab with `?as=stu-maya`. Students sign in with Microsoft once an Entra app registration is set up ([docs/AUTH.md](docs/AUTH.md)). Use `npm run dev:demo` to also load the invented sample events.

| Command | Purpose |
|---|---|
| `npm run dev` | API + web with hot reload |
| `npm run dev:demo` | Same, with the invented sample events loaded (for demos, screenshots and the demo video) |
| `npm run build` | Typecheck + production build |
| `npm start` | Serve the built app and API from one Node process (`NODE_ENV=production`) |
| `npm test` | Vitest unit/component tests |
| `npm run test:e2e` | Playwright demo-story test (isolated port and data directory) |
| `npm run import:owl-life -- <pdf>` | Import an Owl Life PDF export (`--dry-run` to preview) |
| `npm run demo:reset` | Reset to the starting data: demo students, the latest Owl Life import and real student accounts, with no student events or swipes |

### Environment variables

| Name | Required | Default | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | no | — | Server-only. Without it every AI step uses the labeled fallback |
| `GEMINI_MODEL` | no | `gemini-2.5-flash` | Any Gemini model that supports JSON output |
| `GEMINI_TIMEOUT_MS` | no | `25000` | Per-call timeout before falling back |
| `PORT` | no | `8787` | API port; the Vite dev proxy follows it |
| `OWLMATCH_DATA_DIR` | no | `server/data` | Where `db.json` and uploads live |
| `OWLMATCH_SAMPLE_EVENTS` | no | off | `1` loads the invented sample events (`npm run dev:demo` and the e2e test). When off, any sample events left in `db.json` are purged on startup |
| `APP_BASE_URL` | for Microsoft sign-in | `http://localhost:5173` | The URL students open; Microsoft redirects to `<APP_BASE_URL>/api/auth/microsoft/callback` |
| `SESSION_SECRET` | in production | random per process (dev) | Signs session cookies; 32+ characters |
| `ENTRA_TENANT_ID` / `ENTRA_CLIENT_ID` / `ENTRA_CLIENT_SECRET` | for Microsoft sign-in | — | The university tenant GUID and the app registration ([setup](docs/AUTH.md)) |
| `ALLOWED_EMAIL_DOMAINS` | no | `students.kennesaw.edu,kennesaw.edu` | Comma-separated, exact match |
| `ADMIN_PASSWORD` | no | — | Enables admin sign-in to test as demo students (12+ characters in production) |
| `OWLMATCH_ALLOW_RESET` | no | off | Production only: `1` allows the admin data reset |

## Project layout

```
shared/     Domain: schemas & types, interest catalog, ranking engine, time zone, calendar, validation
server/     Express API
  ai/       Gemini client, prompts, profile understanding, recommendation pipeline, concierge, heuristics
  auth/     Microsoft (Entra) sign-in, session cookies, acting-student resolution
  routes/   HTTP endpoints (auth, students, events, system)
  services/ Event mutations and privacy-aware event views
  store/    JSON store + seed data (demo students; sample events for test fixtures)
src/        React client
  app/      Routing and error boundary
  components/ui, components/layout
  features/ onboarding · discovery · events · social · ai · matches · profile
  lib/      API client, query hooks, demo session
tests/      Vitest      e2e/   Playwright      docs/   Architecture, AI, data model, decisions, demo
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Sign-in](docs/AUTH.md): Microsoft school accounts, admin testing, sessions
- [AI system](docs/AI_SYSTEM.md): how matching works, the fallback, and evidence that the AI adds value
- [Data model](docs/DATA_MODEL.md)
- [Decisions & trade-offs](docs/DECISIONS.md)
- [Demo script](docs/DEMO.md): the exact reproducible demo
- [Owl Life PDF import](docs/OWL_LIFE_IMPORT.md): the reusable ingestion workflow and its report
- [it. track usage](docs/IT_TRACK.md)

## What's real vs. simulated

- **Real:** Gemini calls (when a key is set), validation of model output, rule-based fallback ranking, swipe persistence and learning, student-created events, image upload, interest counts, mutual opt-in, and Google Calendar links.
- **Real, as a snapshot:** activities imported from an Owl Life PDF export. Their title, dates, location, organizers and RSVP counts are as of the export time, and the app never presents them as live.
- **Simulated / sample:** The app ships with **no sample events**. The invented sample dataset (labeled "Sample event" in the UI) is loaded only for tests and the e2e fixture (`OWLMATCH_SAMPLE_EVENTS=1`). Students sign in with their KSU Microsoft account; demo students exist only behind the admin sign-in. Organization affiliation on student events is shown as a claim ("simulated verification"). There is no live KSU calendar, Owl Life or Handshake integration. Owl Life data comes only from PDF exports (see Decisions).

## License

MIT
