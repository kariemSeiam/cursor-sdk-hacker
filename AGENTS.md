# AGENTS.md — Working inside Cursor Claw

This repository is optimized for **humans** and **coding agents** (Cursor Agents, CI bots, local harnesses). Read once per session before changing source or shipped Markdown.

## What this repo is

| Concept | Detail |
|---------|--------|
| **Product** | **Cursor Claw** — CLIs `ca`, `ca2`, `ca3`, `ca3-review` on [`@cursor/sdk`](https://www.npmjs.com/package/@cursor/sdk) plus documented ConnectRPC recon. |
| **Package / repo** | npm **`cursor-calw`** · GitHub [`kariemSeiam/cursor-calw`](https://github.com/kariemSeiam/cursor-calw) · editorial pointer [pigo.dev](https://pigo.dev). Long-form **`docs/`** in repo · public mirror [claws.pigo.dev/cursor](https://claws.pigo.dev/cursor). |
| **Use posture** | For **paying Cursor subscribers** inspecting APIs they fund — not abuse tooling, credential sharing, or dark-pattern automation. |
| **Auth / identity** | **You** run with **your** subscriber API key (**you** are the authenticated principal to Cursor’s APIs; CLIs never mean “Cursor as user”). |

## Read order

| Step | Path | Role |
|------|------|------|
| 1 | [docs/README.md](docs/README.md) | Doc index + **editorial covenant**. |
| 2 | [README.md](README.md) | Operator CLI reference + repo layout. |
| 3 | Target `docs/*.md` or [examples/README.md](examples/README.md) | Subsystem depth. |

If orientation docs drift from code (especially [`docs/architecture.md`](docs/architecture.md)), **fix docs and code in the same change set**.

## Layout contract

| Path | Purpose |
|------|---------|
| `src/*.mjs` | Entry CLIs (`#!/usr/bin/env node`). |
| `src/lib/*.mjs` | Swarm engine — concurrency, ledger, Git worktrees, merge helpers. |
| `test/*.test.mjs` | `node:test`; helpers in `test/helpers/`. |
| `docs/` | Long-form docs (`docs/README.md` is the spine). |
| `examples/` | Runnable API demos — see `examples/README.md`. |
| `.venom/` | Optional local agent workflow / standards (**gitignored**); **not** published on npm. |

## Quality gate

```bash
npm run lint
npm test
```

CLI behavior changes ship with matching **`README.md`** + **`docs/*`** updates in one PR.

## Guardrails

- **Secrets:** never commit keys; use `CURSOR_API_KEY` / `~/.cursor-api-key` (see README).
- **Identity:** every call identifies **your** account via **your** key—operators are authenticating **themselves**, not handing control to Cursor as a surrogate user.
- **Rate limits:** respect backoff / stagger — measure before weakening retries.
- **Resume:** treat `resumeSwarm` as **scaffolding** until code guarantees full replay; document honestly.

Doc tone: **[docs/README.md — Editorial covenant](docs/README.md#editorial-covenant)**.
