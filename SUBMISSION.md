# Submission checklist — due Fri Nov 20, 2026, 12:00 PM ET

| Deliverable | Location | Status |
|---|---|---|
| Pitch deck (PowerPoint) | `presentation/OwlMatch-Pitch.pptx` (8 slides, speaker notes) | Built from real live-AI screenshots: `node scripts/capture-screenshots.mjs`, then `cd presentation && npm i && npm run build` |
| Demo video | `docs/demo-video/owlmatch-demo.mp4` (~83 s, captioned) | Recorded from the real app with live Gemini (`scripts/record-demo.mjs`) |
| Live demo script | `docs/DEMO.md` | Six scenes plus 90-second narration storyboard |
| Source code | This repository | `npm install && npm run dev` |
| Docs | `README.md`, `docs/*.md` | Architecture, AI system, data model, decisions, it. track |
| Tests | `npm test` (43 Vitest), `npm run test:e2e` (Playwright demo story; `E2E_USE_GEMINI=1` for live AI) | All passing, both with live Gemini and with AI disabled |

## Before submitting
- [x] `GEMINI_API_KEY` in `.env`, and `/api/health` shows `"configured": true` (verified live 2026-11-20)
- [x] Deck screenshots and demo video regenerated with live Gemini
- [ ] Push to GitHub and add the repo link to the submission (the IEEE resource slide asks for it)
- [ ] Add team member names to slide 1 if desired (`presentation/build-deck.js`)
- [ ] Reset demo data before the live pitch (Profile → Reset demo data)

## Honest disclosures for judges
- All seeded events are labeled sample data. There is no live KSU, Owl Life or Handshake feed.
- Demo accounts replace KSU sign-in, and nothing is verified. Organization affiliation is a labeled claim.
- Without a Gemini key, or when a call fails or times out, every AI step runs on a labeled rule-based fallback.
- Gemini output varies between runs. Each live call takes about 5–9 s, and the app shows a loading state meanwhile.
- No survey data. We make no statistical claims about the problem.
