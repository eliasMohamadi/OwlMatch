# Nudox: code index for coding agents

[Nudox](https://nudox.org) compiles a repository into a symbol graph. Coding agents such as Claude Code query that graph over MCP, so they look up real signatures and call sites instead of guessing. We used it while building OwlMatch. The app itself does not depend on it.

## Setup (Windows, Nudox app v0.1.0)

The hosted endpoint (`mcp.nudox.org`) was serving an invalid TLS certificate, so we run the Nudox app locally. It hosts an MCP server on loopback.

1. Download the app from `https://api.nudox.org/v1/downloads/windows`. Check it against the `.sha256` file on the GitHub release.
2. Start `lindsey.exe` and sign in with your `ndx_` key. The key stays inside the app.
3. The app writes its loopback port and a **per-launch** session token to `%LOCALAPPDATA%\nudox\endpoint.json`. Register that endpoint with Claude Code at **local** scope, so the token never lands in this repo:

   ```bash
   claude mcp add --transport http nudox "http://127.0.0.1:<port>/mcp" --header "Authorization: Bearer <session token>"
   ```

   The port and token change every time the app starts, so re-run `claude mcp remove nudox -s local` and this command after each launch.
4. Index the checkout by asking the agent to call Nudox's `index` tool with this repository's path.

## Why `package.json` has an `exports` map

Nudox finds TypeScript source by following the entry points in `package.json`, and from there it follows relative imports. Without entry points it fell back to the built `dist/` bundle and `presentation/node_modules`. The `exports` map therefore names:

| Entry | Covers |
|---|---|
| `.` → `server/index.ts` | Express API, AI layer, store, Owl Life ingest |
| `./web` → `src/main.tsx` | React app |
| `./shared/*` (each file listed) | Shared domain code. The `@shared/*` path alias isn't resolved by Nudox, and wildcard exports aren't followed, so each file is listed |
| `./scripts/*` (each file listed) | CLI scripts (Owl Life import, demo reset) |

Nothing imports `owlmatch` as a package, so the map has no runtime effect. Vite, `tsx`, typecheck and tests behave as before. **When you add a file under `shared/` or a new script, add it to `exports`, or Nudox will not index it.**

## What it gives the agent

With the source indexed (~20k symbols, including `.d.ts` types from dependencies), `search` and `read` return exact declarations by name, for example:

- `matchesCampus` in `shared/eventPlace.ts`
- `rankEvents` in `shared/ranking.ts`
- `normalizeCard` in `server/ingest/owlLife/normalize.ts`
- `EventDetailsPage` in `src/features/events/EventDetailsPage.tsx`

Limits we saw with app v0.1.0:

- Semantic search needs the embedding model configured (`NUDOX_EMBED_MODEL_DIR`), so search matches names only.
- Caller lookups (`refs`) returned nothing for this TypeScript project.
- Re-indexing the same path string returns the cached result. Restart the app, or vary the path, after changing `package.json`.
