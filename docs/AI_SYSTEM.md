# AI System

OwlMatch uses AI to decide what a student sees and to explain why. The pipeline has four steps. Each step has a deterministic fallback, and the UI labels which path produced the result.

```
Onboarding answers + "about you" text
        │  Step A  Understand the student           server/ai/profile.ts
        ▼          Gemini → zod-validated AiProfile  (fallback: heuristics.ts)
Structured profile ─┐
Swipe history ──────┤  Step B  Hard filters (code, never the model)   shared/ranking.ts › filterEligible
Event database ─────┘          visibility · moderation · not ended · campus · user filters · already swiped
        ▼
Eligible events
        │  Step C  Weighted rule ranking → shortlist (top 10)      shared/ranking.ts › rankEvents
        ▼
Shortlist
        │  Step D  Gemini re-rank + explain                         server/ai/recommend.ts
        │          only shortlisted ids accepted · scores clamped 0–100 · cached
        ▼
Deck: AI-ranked items first (score source "ai"), the rest by rules (score source "rules")
        │
        └── swipes saved ──▶ learnFromSwipes() feeds the next ranking (rules + Gemini prompt)
```

## Step A: understanding the student

`understandStudent()` sends Gemini the student's selections and their free text. Gemini returns a summary, *inferred interests* (categories implied by their words that they didn't select), keywords, a group-size preference, an energy preference and goals. The output is parsed with zod. Unknown interest ids are dropped, and enum values fall back to `"any"`. If Gemini is unavailable, `heuristicProfile()` extracts the same fields with keyword and phrase rules. The profile card shows "Understood by Gemini" or "Understood by rule-based parser".

## Steps B and C: rule-based shortlist

`scoreEvent()` combines five signals, each scored 0 to 1:

| Signal | Weight | How it's computed |
|---|---:|---|
| Interest | 40 | Overlap of event categories with selected interests. Overlap with AI-inferred interests earns 70% credit, plus a bonus for extra overlaps |
| Keyword (semantic layer) | 20 | Overlap between event text and the student's vocabulary: interest keyword lists, AI keywords and their own words. This is how "game jam / Godot" matches a coder who loves games without a "gaming" tag |
| Availability | 15 | Weekday or weekend and morning, afternoon or evening, computed in America/New_York |
| Social fit | 15 | Group size, energy, "make friends" and "try something new" (which favors beginner-friendly events) |
| Feedback | 10 | Category affinity learned from past swipes, as smoothed (likes − passes) / (n + 1) |

The total is a real percentage because the weights sum to 100. This is the number shown as **"Match NN% · rules"**.

## Step D: Gemini re-rank

The top 10 events and a compact profile go to Gemini. The profile includes the student's own words, social preferences, availability, and the titles they liked and passed. The prompt requires second-person reasons that cite something the student said and something specific about the event, and it bans generic praise. We then do the following:

- **Grounding.** Any `eventId` not in the shortlist is discarded, along with duplicates. The model can never add an event.
- **Clamping.** Scores are rounded and clamped to the 0–100 range.
- **Caching.** Results are cached per student, keyed on the student's profile, swipes and shortlist ids, for 15 minutes. A new swipe or a new event produces a new cache key.
- **Fallback.** On a timeout, HTTP error, non-JSON output, schema failure or zero valid ids, the response is the rule ranking with `mode: "fallback"` and a reason. The UI then shows "Rule-based · AI offline".

These items show **"AI match NN%"** in gold. Gemini's score is displayed only when it came from Gemini.

## Campus Concierge

`askConcierge()` uses two Gemini calls, each with a fallback:

1. **Intent parsing.** The request becomes `{campus, categories, keywords, timeWindow, afterHour, beginnerFriendly, wantsSocial, unsupported}`, validated with zod. The fallback is `heuristicIntent()`.
2. Our code applies the intent as hard filters. If nothing matches, it relaxes the time filter, then the campus filter, and tells the student which one it relaxed. Our ranking then picks the top 3.
3. **Grounded reply.** Gemini writes a 2–3 sentence answer about **only those events** and may give a reason for each pick. Picks for ids outside the list are ignored. If the request asks for something we have no data on, such as parking, the prompt tells Gemini to say OwlMatch can't answer that part.

## Learning from swipes, honestly

Swipes are persisted, and `learnFromSwipes()` turns them into per-category affinity. Liked and passed titles are also included in the Gemini prompt. After swiping, **Refresh picks** fetches a new ranking that uses those signals, and the cache key changes. Learning happens per student at request time. There is no model training.

## Demonstrating AI value ("Why AI?" tab)

`GET /api/students/:id/comparison` ranks **the same eligible events** two ways:

- **Category filter only.** The fraction of an event's categories the student selected. It ignores everything else.
- **OwlMatch pipeline.** The ranking described above.

Verified live example (Gemini `gemini-3.8-flash`, 2026-11-20, after Jordan published the game night). Maya selected Gaming, Tech and Social and wrote *"I'm a software engineering student into gaming and programming. I want to make friends, but I prefer casual, small-group hangouts."*

| # | Category filter only | OwlMatch + Gemini (live) |
|---|---|---|
| 1 | 100 · Intro to Game Dev | 98 · Casual Game Night (Jordan's event) |
| 2 | 100 · Casual Game Night | 94 · Intro to Game Dev: *"…pair programming a Godot platformer in a small weekend group is an ideal fit."* |
| 3 | 100 · **Valorant Scrims & Tryouts** | 78 · Robotics Build Session: *"You like programming, so mentoring Arduino controllers…"* (not tagged gaming) |
| 4 | 67 · Hackathon Team Mixer | 75 · Hackathon Mixer: *"…though the energy is higher than your preferred relaxed vibe."* |
| 5 | 50 · Anime & Sketch Night | 70 · Anime & Sketch Night |

In the full deck, Valorant falls to 6th of 9 (62). Gemini output varies slightly between runs, and the rule-based path produces a similar ordering (Game Dev first, Valorant lowered).

## Safety and limits

- The API key is read only by the server (`server/config.ts`) and is never bundled. `.env` is gitignored.
- Prompts contain only OwlMatch data. Model output is treated as untrusted, so every field is schema-validated and every id is checked against the database.
- Hard constraints, including visibility, removed events, past events, campus and invite-only events, are enforced in code before the model sees anything.
- Limitations: the semantic layer is keyword-based (no embeddings), the ranking is evaluated qualitatively rather than with offline metrics, and reasons can only be as good as event descriptions.
