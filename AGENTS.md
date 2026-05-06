# AGENTS.md — How to work inside Cursor Claw

This repository is optimized for **human operators** and **autonomous coding agents** (Cursor Agents, Codex-class tools, CI bots). Read this once per session before you mutate code or docs.

## What this repo is

| Concept | Detail |
|---------|--------|
| **Product** | **Cursor Claw** — CLIs (`ca`, `ca2`, `ca3`, `ca3-review`) on top of official [`@cursor/sdk`](https://www.npmjs.com/package/@cursor/sdk) plus ConnectRPC recon. |
| **GitHub** | [`kariemSeiam/cursor-calw`](https://github.com/kariemSeiam/cursor-calw) (published npm name **`cursor-calw`** matches slug). |
| **Ethics** | Tooling for **paying Cursor subscribers** exploring APIs they fund — not bypass, scraping-for-abuse, or credential sharing. Maintain that posture in edits. |

## Read order (do not invert)

| Step | Artifact | Purpose |
|------|-----------|---------|
| 1 | [.venom/CONTEXT.md](.venom/CONTEXT.md) | Machine-stable map: paths, stacks, CLIs, gotchas — **minimal prose**. |
| 2 | [docs/README.md](docs/README.md) | Human/agent doc index + **voice covenant** for every Markdown change. |
| 3 | [README.md](README.md) | User-facing CLI reference, workflows, ops tables. |
| 4 | Target deep doc (`docs/*.md`) or `examples/README.md` | Only after you know which subsystem you touch. |

If `.venom/CONTEXT.md` conflicts with reality, **`CONTEXT wins only after it is corrected`** — patch the CONTEXT or open a contradiction note in [.venom/MEMORY.md](.venom/MEMORY.md), not orphaned comments scattered in six files.

## Directory contract

| Area | Responsibility |
|------|----------------|
| `src/*.mjs` | Executable CLIs; keep shebang `node`. |
| `src/lib/*.mjs` | Swarm orchestration primitives — edits here affect concurrency, ledger, merges. |
| `test/*.test.mjs` | **`node:test`** suites; mocks live in `test/helpers/`. **Do not break `npm test`** without migrating tests. |
| `docs/` | Long-form narrative + reference (`docs/README.md` is the TOC). |
| `examples/` | Runnable scripts illustrating `src/lib/` — paired with [`examples/README.md`](examples/README.md). |
| `.venom/` | VENOM session layer (**optional** clone-side); ignore for npm publish tarball. |

## Commands you must green before a PR-worthy diff

```bash
npm run lint
npm test
```

If you bump CLI semantics, **`README.md`** and any affected **`docs/*`** sections change in the **same PR**.

## Operational guardrails

- **Secrets:** Never commit keys. CLIs honor `CURSOR_API_KEY` and `~/.cursor-api-key` — see README. `.env.example` lists variable names only.
- **Rate limits:** Swarm retries 429 / 464 / transient 5xx; do not strip backoff without benchmarking.
- **Resume / ledger:** `resumeSwarm` is **recovery scaffolding** — describe behavior honestly; avoid promising full automatic replay unless the code does it.

## Tone for doc patches

Follow **[docs/README.md → Documentation voice](docs/README.md#documentation-voice)**. Tables beat rambling bullets; linking beats duplicating prose from README into four files.
