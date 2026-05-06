# Cursor Claw · Documentation center

Documentation for [`kariemSeiam/cursor-calw`](https://github.com/kariemSeiam/cursor-calw).

**You are here:** index of `/docs/*.md`. For runnable CLIs, start from the root [README.md](../README.md). For repository topology and agent entry, read [AGENTS.md](../AGENTS.md) and [.venom/CONTEXT.md](../.venom/CONTEXT.md).

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

## Documentation voice

VENOM-maintained prose obeys the following everywhere (including README and Markdown under `.venom/`).

1. **Pack line first** on substantive docs — a tight block naming *Cursor Claw*, repo/npm links, license (`MIT`).
2. **You are reading** — one italic or short sentence declares doc scope before the first `#` subsection after intros.
3. **Tables before bullet walls** whenever you compare CLI modes, endpoints, constants, errors, roles.
4. **Single source of CLI truth:** root `README.md` owns command tables unless a doc drills into one subsystem (`ca3`-only internals → architecture + swarm-patterns).
5. **Anchored paths:** cite files as `` `src/lib/swarm.mjs` `` relative to repo root so agents can `Read` reliably.
6. **No fluff adjectives:** state behavior, prerequisites, caveats (“recovery scaffolding”), not hype.
7. **Cross-links end sections:** sibling docs (“Where to read more”) kill orphan islands.
8. **Emoji sparingly:** marketing band at top/bottom of README only; specs stay ASCII-clean.

Patches that introduce a second contradictory description of limits, JWT flow, or `npm test` wiring are **incorrect** unless README and CONTEXT migrate together.

---

## For autonomous agents editing docs

Before you rewrite prose:

| Check | Action |
|-------|--------|
| CLI parity | Commands and flags stay aligned with `src/*.mjs` — inspect help strings if README looks stale. |
| Version lines | **`ca3` banner** derives from root `package.json` — cite that, never a mythical hardcoded semver. |
| Changelog impact | Behavioral changes touch [CHANGELOG.md](../CHANGELOG.md); doc-only typo fixes optionally skip. |

When in doubt about intent, [.venom/MEMORY.md](../.venom/MEMORY.md) holds durable stewardship notes (not duplication of CONTEXT).
