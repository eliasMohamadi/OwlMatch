# Submission checklist — due Fri Nov 20, 2026, 12:00 PM ET

| Deliverable | Location | Status |
|---|---|---|
| Pitch deck (PowerPoint) | `presentation/OwlMatch-Pitch.pptx` (8 slides, speaker notes) | Generated from real screenshots (`cd presentation && npm i && npm run build`) |
| Demo video | `docs/demo-video/owlmatch-demo.mp4` (~65 s, captioned) | Recorded from the real app (`scripts/record-demo.mjs`). Re-record once the Gemini key is set |
| Live demo script | `docs/DEMO.md` | Six scenes plus 90-second narration storyboard |
| Source code | This repository | `npm install && npm run dev` |
| Docs | `README.md`, `docs/*.md` | Architecture, AI system, data model, decisions, it. track |
| Tests | `npm test` (43 Vitest), `npm run test:e2e` (Playwright demo story) | All passing at time of writing |

## Before submitting
- [ ] `GEMINI_API_KEY` in `.env`, then `curl localhost:8787/api/health` shows `"configured": true`
- [ ] Re-run `.qa`-style screenshots and rebuild the deck if you want "AI match" (gold) instead of "rules" badges in slides
- [ ] Re-record the video with the key (`docs/DEMO.md` → Automated recording)
- [ ] Push to GitHub and add the repo link to the submission (the IEEE resource slide asks for it)
- [ ] Add team member names to slide 1 if desired (`presentation/build-deck.js`)
- [ ] Reset demo data before the live pitch (Profile → Reset demo data)

## Honest disclosures for judges
- All seeded events are labeled sample data. There is no live KSU, Owl Life or Handshake feed.
- Demo accounts replace KSU sign-in, and nothing is verified. Organization affiliation is a labeled claim.
- Without a Gemini key, every AI step runs on a labeled rule-based fallback.
- No survey data. We make no statistical claims about the problem.
