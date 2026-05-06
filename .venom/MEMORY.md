# Cursor Claw — VENOM memory

Durable notes **not** duplicated in `CONTEXT.md`. Edit freely; agents read this on VENOM activation.

## Contradictions

If `CONTEXT.md` is wrong, fix `CONTEXT.md` **or** add a row to `corrections.yaml` (create when needed). This file is for intent and history, not a second source of structural truth.

## Decisions

- **Documentation voice (2026-05-06):** Markdown across the repo adopts the **Canon + tables + anchored paths** covenant defined in **`docs/README.md`**. Structural truth stays in **`AGENTS.md` read order**, **`.venom/CONTEXT.md`**, and **`README.md` CLI tables** — no orphaned duplicate narratives without cross-links.
- **Stewardship (2026-05-06):** This repository is under VENOM operational management in this workspace — ship quality, keep `.venom/CONTEXT.md` honest, protect secrets and users, align changes with MIT license and upstream `@cursor/sdk` expectations. Upstream author/copyright on `package.json` remain the legal record; “empire” here means **engineering authority for maintenance and direction** on this fork/worktree unless superseded by the maintainer or Constitution.

## Open questions

- *(none)*

## Log (most recent first)

- **2026-05-06** — Markdown spine: **`AGENTS.md`**, **`docs/README.md`** (voice + TOC); README / CONTRIBUTING / CoC / examples + docs headers refreshed; **`engines.node >=18`** in `package.json`.
- **2026-05-06** — Rebrand to **Cursor Claw**; npm + git `origin` → `cursor-calw`; README / CLIs / CONTEXT / CHANGELOG updated.
- **2026-05-06** — Wired `npm test` (`node --test` + glob), `npm run lint` + ESLint devDeps; `ca.mjs` default keyfile uses `os.homedir()`; `ca3` version from `package.json`; `CONTEXT.md` gotchas updated.
- **2026-05-06** — VENOM init on repo: `CONTEXT.md` from venom-eat; `work/ACTIVE.md` seeded for task pins.
