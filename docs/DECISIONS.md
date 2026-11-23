# Decisions & Trade-offs

Each entry gives the context, the decision and its consequences.

### 1. JSON file store instead of Supabase (for now)
No Supabase project or credentials were available during the build. A frontend-only mock would lose data and couldn't support two students interacting. **Decision:** use a small Express API with a persistent JSON file. All access goes through `read()` and `mutate()`, and mutations are pure functions over the data. **Consequence:** the demo is reproducible offline and shared across tabs. It is single-process and not built for concurrent production writes. Moving to Supabase means replacing `server/store/db.ts`, and the data model already maps onto tables (see DATA_MODEL.md).

### 2. Gemini over REST, server-side, JSON mode + zod
**Decision:** use `fetch` against the `generateContent` endpoint with `responseMimeType: application/json`. There is one helper, `generateJson(prompt, schema)`, with an AbortController timeout. **Why:** it needs no SDK dependency, the key never reaches the browser, and every result is validated or rejected explicitly. **Consequence:** the model name is configurable (`GEMINI_MODEL`) in case a model version is retired.

### 3. Rule-based shortlist, then LLM re-rank (no embeddings)
Vector infrastructure would have cost hours. **Decision:** apply hard filters in code, then weighted rules with a keyword semantic layer, then Gemini re-ranks the top 10. **Consequence:** the model gets a small, grounded candidate set, so it is fast, cheap and can't invent events. The rules are a complete fallback. Embeddings are a clear next step.

### 4. Scores are shown only when they're real
The UI shows "AI match NN%" only for Gemini scores, and "Match NN% · rules" for the weighted rules. Both are computed values, not decoration.

### 5. Sample data, clearly labeled
We found no documented public KSU events API we could rely on in the time available. Owl Life and Handshake require login, and we did not scrape them. **Decision:** seed 18 plausible sample activities with dates relative to "now", each with `source.type = "sample"`, a "Sample event" badge, and no fake official links. **Consequence:** the demo always has upcoming events, and no fictional event is presented as a real KSU listing. `source.url` and `verifiedAt` are ready for a future ingestion adapter.

**Update:** real Owl Life activities can now be imported from a PDF export the student downloads themselves (`npm run import:owl-life`). We still don't scrape or log in to Owl Life. Each import is a labeled snapshot, and sample events remain alongside it. See [OWL_LIFE_IMPORT.md](OWL_LIFE_IMPORT.md).

### 6. Microsoft school-account sign-in, with demo accounts behind an admin login
**Decision:** students sign in with their KSU Microsoft account (OpenID Connect against the university's Entra tenant). Microsoft runs the password and Microsoft Authenticator steps under the university's MFA policy, and OwlMatch verifies the ID token, pins the tenant, and allows only KSU email domains. The five demo students remain for testing, reachable only through a password-protected admin sign-in that acts as one demo student per tab (`?as=<id>`). Every API call acts as the session's student; ids in requests are never trusted. Organization affiliation on student events is still shown as a claim ("simulated verification"), because a verified student is not a verified officer of a club. **Consequence:** real use needs an Entra app registration that KSU approves (see [AUTH.md](AUTH.md)). We chose the tenant's own MFA over building our own TOTP enrollment, so OwlMatch never stores second factors. A tenant without an MFA policy gives a password-only sign-in.

### 7. Generated covers instead of stock photos
Hotlinked photos could break during a live demo, and their licensing is unclear. **Decision:** generate category covers in CSS (gradient + icon pattern), and show the student's uploaded image when present. Uploads are downscaled in the browser, and the server re-validates type and size.

### 8. Shared domain package
Validation, time-zone math and ranking live in `shared/` and are imported by the client, the server and the tests. The create-event form gives instant feedback using exactly the rules the server enforces.

### 9. Time zone
All times are stored in UTC. Wall-clock interpretation always uses America/New_York, through `Intl`-based conversion that is DST-safe and tested. Calendar links send UTC times plus `ctz`.

### 10. Bundle size
The single JS bundle is about 164 KB gzipped (React, Motion, zod, TanStack Query). That's acceptable for a demo. Route-level code splitting is a known follow-up.
