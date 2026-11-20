# Demo Guide

Everything below runs through the real UI and API. The same story is automated in [`e2e/demo-flow.spec.ts`](../e2e/demo-flow.spec.ts) (`npm run test:e2e`).

## Before you present (2 minutes)

1. `npm install` (first time only). Put `GEMINI_API_KEY=…` in `.env` to show the live AI path.
2. `npm run dev`. Note the web URL it prints (usually `http://localhost:5173`).
3. Open `http://localhost:8787/api/health`. `"configured": true` means Gemini is live.
4. **Reset the data:** Profile → *Reset demo data*, or run `npm run demo:reset`. This restores the 18 sample events (dated from today), resets Maya to a brand-new user, and clears previously created events.
5. Open two browser tabs, sized about 430×932 (mobile) or full screen:
   - Tab A: `<web-url>/create?as=stu-jordan` (Student A, Jordan)
   - Tab B: `<web-url>/welcome?as=stu-maya` (Student B, Maya, not onboarded)
6. Keep `docs/demo-assets/game-night-cover.jpg` handy for the upload.

## The six scenes

| # | Tab | Do this | What the audience sees |
|---|---|---|---|
| 1 | A (Jordan) | Create → **Demo example** (prefills a casual game night on Marietta Campus) → **Upload image** → `game-night-cover.jpg` → **Publish event** | Event page with the cover, "Student-hosted" badge and simulated-verification note |
| 2 | B (Maya) | **Find My Matches** → Marietta Campus → Gaming + Technology & Coding + Social Events → *Yes, definitely* / *Small groups* / *Relaxed* → type: *"I'm a software engineering student into gaming and programming. I want to make friends, but I prefer casual, small-group hangouts."* → Weekends + Evenings → **Build my matches** | The AI profile card: "Understood by Gemini", with summary, keywords and preferences |
| 3 | B | **Start discovering** | Jordan's game night is the top card. It shows an AI match % and a reason citing Maya's words and the event |
| 4 | B | Swipe right (or tap the gold ♥) | "You're interested!" sheet with **1 interested on OwlMatch**. Turn on *Show me to others going*: **Jordan · Host** appears, followed by "You and 1 other student are going together." |
| 5 | B | **Calendar** (opens Google Calendar prefilled, 7–10 PM Eastern) → back → **Matches** tab | The event appears under Interested with a "Going together" badge |
| 6 | B | **AI** tab → tap the first suggestion: *"Find me something fun on Marietta Campus where I can meet other people who like gaming."* | A grounded reply and recommendation cards including the game night. Then open **Why AI?** to compare category-only and personalized rankings |

**Fallback talking point:** without a key, every step still works. The UI says "Rule-based · AI offline", and the profile card says "Understood by rule-based parser".

## 90-second video storyboard

Recommended capture: a browser window at **430×932** (mobile layout) for scenes 1–5, plus a 1440×900 shot for the "Why AI?" comparison.

| Time | Screen | Narration |
|---|---|---|
| 0:00–0:12 | Welcome screen (Tab B) | "KSU has hundreds of things to do, but they're scattered, and showing up alone is hard. OwlMatch fixes both." |
| 0:12–0:30 | Onboarding: interests, social taps, typing the "about you" sentence → AI profile card | "Maya picks a few interests and says, in her own words, that she likes gaming and coding but prefers small, casual groups. Gemini turns that into a structured profile." |
| 0:30–0:48 | Discover: game night on top, zoom into the reason | "OwlMatch filters events in code, shortlists them with a scoring model, then Gemini re-ranks and explains each pick. It's grounded in real events only, and validated before display." |
| 0:48–1:02 | Quick cut to Tab A publishing the game night, then back to B swiping right | "That game night was posted minutes ago by another student, Jordan. Maya swipes right…" |
| 1:02–1:16 | Opt-in toggle → Jordan · Host → Calendar → My Matches | "…opts in to find people going, sees Jordan's hosting, and adds it to Google Calendar in one tap." |
| 1:16–1:26 | Concierge answer, then a glance at Why AI? | "She can also just ask, and the concierge answers from OwlMatch's own events." |
| 1:26–1:30 | Welcome/logo | "OwlMatch. Discover your interests. Find your people." |

### Automated recording (already produced)
`docs/demo-video/owlmatch-demo.mp4` (~65 s, 430×932, captioned, no audio) was recorded by [`scripts/record-demo.mjs`](../scripts/record-demo.mjs) driving the real app. It recorded the **rule-based fallback** path, because no Gemini key was configured at recording time. Re-record with the key in place:
```bash
npm run dev                      # in one terminal
BASE=http://localhost:5173 node scripts/record-demo.mjs
ffmpeg -i docs/demo-video/owlmatch-demo.webm -c:v libx264 -pix_fmt yuv420p -vf scale=860:1864 -r 30 docs/demo-video/owlmatch-demo.mp4
```
The Google Calendar scene shows the in-app button rather than opening Google, because a fresh recording browser isn't signed in to Google.

### Recording checklist (narrated version)
- [ ] Demo data reset; `/api/health` shows Gemini configured
- [ ] Browser zoom 100%, bookmarks bar hidden, notifications off
- [ ] Two tabs ready (`?as=stu-jordan`, `?as=stu-maya`)
- [ ] Cover image on the desktop for the file picker
- [ ] Windows: **Win + Alt + R** (Xbox Game Bar) records the active window. Alternatively, run `RECORD=1 npx playwright test` to get an automated, narration-free capture in `test-results/` (shot with the rule-based fallback unless `E2E_USE_GEMINI=1`)
- [ ] Do one dry run, then reset data again before the final take
