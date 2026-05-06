# Cursor Claw · Documentation center

Documentation for [`kariemSeiam/cursor-calw`](https://github.com/kariemSeiam/cursor-calw) · editorial [pigo.dev](https://pigo.dev) · web mirror [claws.pigo.dev/cursor](https://claws.pigo.dev/cursor).

**You are here:** index of `/docs/*.md`. For runnable CLIs, start from the root [README.md](../README.md). For repository topology and agent entry, read [AGENTS.md](../AGENTS.md) and [`docs/architecture.md`](./architecture.md).

---

## Catalog

| Document | Audience | Contents |
|----------|----------|-----------|
| [architecture.md](./architecture.md) | Engineers + agents | Mermaid topology, ledger vs SQLite, constants, orchestration phases. |
| [swarm-patterns.md](./swarm-patterns.md) | Operators | When to choose `swarm` vs `--plan` vs `fork`; scaling heuristics. |
| [troubleshooting.md](./troubleshooting.md) | Operators | Auth, limits, Git worktrees, ledger corruption, SQLite store. |
| [REVERSE_ENGINEERING.md](./REVERSE_ENGINEERING.md) | Researchers | `@cursor/sdk` bundle notes, protocols, surfaces. |
| [API_REFERENCE.md](./API_REFERENCE.md) | Operators + integrators | ConnectRPC paths, HTTP shapes, curated method tables. |
| [METHODS_SCAN.md](./METHODS_SCAN.md) | Researchers | Empirical scan aggregates across services. |

**Outside `/docs/`:** [`examples/README.md`](../examples/README.md) · [`CONTRIBUTING.md`](../CONTRIBUTING.md) · [`CHANGELOG.md`](../CHANGELOG.md) · [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md)

---

## Editorial covenant

Cursor Claw documentation follows this everywhere (including root `README.md`).

1. **Pack line first** on substantive docs — name *Cursor Claw*, repo + npm identifiers, license (`MIT`); link [pigo.dev](https://pigo.dev) and/or [claws.pigo.dev/cursor](https://claws.pigo.dev/cursor) when those surfaces own the voice.
2. **You are reading** — one short sentence states scope before the first deep subsection.
3. **Tables before bullet walls** for comparisons (CLI modes, endpoints, limits, errors, roles).
4. **Single source for CLI tables:** root `README.md` unless a doc intentionally drills into one subsystem (`ca3` internals → architecture + swarm-patterns).
5. **Anchored paths:** cite `` `src/lib/swarm.mjs` `` style paths from repo root so tools can open files deterministically.
6. **Declarative tone:** behavior, prerequisites, caveats (“recovery scaffolding”) — not hype or persona fiction.
7. **Cross-links** end sections where another doc owns the rest of the story.
8. **Emoji:** README marketing band only; spec pages stay ASCII-first.

Patches that contradict `README.md`, `docs/architecture.md`, or live code without updating the affected docs are incomplete.

---

## For autonomous agents editing docs

| Check | Action |
|-------|--------|
| CLI parity | Match `src/*.mjs` help text and parsers — README tables first. |
| Version strings | **`ca3`** banner semver comes from root **`package.json`** — never invent parallel version folklore. |
| Changelog | User-visible behavior changes → [CHANGELOG.md](../CHANGELOG.md) `[Unreleased]` (doc-only typos optional). |

Long-lived maintainer intent belongs in [CHANGELOG.md](../CHANGELOG.md) `[Unreleased]`, a focused `docs/*.md` section, or the PR — not orphan root-level scratch files.
