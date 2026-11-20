# it. track: how we used It (itcan.do)

**What It is:** an interface layer for coding agents. The agent publishes an interactive page to the user's screens, and what the user does on that page goes back into the agent's conversation. It is *not* a UI component library, and the OwlMatch app is **not** built with It.

**How we used it:** in our development workflow. Our coding agent (Claude Code) used It to put real decisions in front of the team as interactive pages instead of chat text. The team's choices came back to the agent as actions, and the agent built from them.

## Setup (Windows, done on 2026-11-20)

```powershell
irm https://itcan.do/install.ps1 -OutFile "$env:TEMP\it-install.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\it-install.ps1"
& "$env:USERPROFILE\.it\bin\it.exe" setup --only claude-code
```

Result: It's service is running locally (`http://localhost:4700`), and the Claude Code add-on reports as connected.

## Interaction log

| # | Page (source in this folder) | Decision asked | Outcome |
|---|---|---|---|
| 1 | [`deck-direction.html`](deck-direction.html), published as `owlmatch-deck` | Pitch deck visual direction (bold dark / clean light / mixed) and which slides to include | _Filled in when the team's action arrives (see below)_ |

## Honest notes

- The it. track's judging criteria were placeholders in the opening-ceremony deck ("[What to build]", "[How it's judged]"). We could not verify them, so this file only documents what we actually did.
- Installing It is not the claim. The claim is that design decisions for this submission were made through It pages, and those pages are committed here.
