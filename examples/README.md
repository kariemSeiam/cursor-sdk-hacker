# Cursor Claw · `examples/` index

Runnable scripts calling the **same programmatic surfaces** Venom Swarm uses under `src/lib/*` (`SwarmOrchestrator`, ledger, decomposition, integration). Mirrors what you invoke from [`src/ca3.mjs`](../src/ca3.mjs).

> **Canon** · **Cursor Claw** · npm [`cursor-calw`](https://www.npmjs.com/package/cursor-calw) · repo [`cursor-calw`](https://github.com/kariemSeiam/cursor-calw) · MIT · **VENOM-maintained.**

**You are reading:** runnable example catalog — programmatic API complements the root [README CLI tables](../README.md).

---

## Prerequisites

| Item | Requirement |
|------|--------------|
| **Install** | `npm install` once from repo root. |
| **Node.js** | ESM (`"type": "module"` — align with **`package.json` `engines`**). |
| **CWD** | Run from **repository root** so relative imports resolve and `git rev-parse` succeeds. |
| **Git repo** | Swarm allocates detached worktrees; ad-hoc directories without `.git/` will fail orchestration. |

### Cursor credentials flow

| Path | Key lookup |
|------|-------------|
| **Most swarm / decomposer runs** | `CURSOR_API_KEY` **or** `~/.cursor-api-key` (see [`src/lib/swarm.mjs`](../src/lib/swarm.mjs)). |
| **`3-plan-decompose.mjs`** leadership pass | **`CURSOR_API_KEY` env only** — decomposer does not read key file fallback. |
| **`4-with-integrator.mjs` integration phase** | Integrator wired to **`CURSOR_API_KEY`** (see [`src/lib/integrator.mjs`](../src/lib/integrator.mjs)). |

---

## How to run

```bash
node examples/1-basic-swarm.mjs
node examples/2-fork-tasks.mjs
node examples/3-plan-decompose.mjs
node examples/4-with-integrator.mjs
node examples/5-crash-recovery.mjs
```

Optional flags:

```bash
node examples/1-basic-swarm.mjs --workers 2
node examples/3-plan-decompose.mjs --workers 4
node examples/5-crash-recovery.mjs --keep-ledger
```

---

## Map to features

| File | Mechanism surfaced |
|------|---------------------|
| `1-basic-swarm.mjs` | Parallel swarm — identical task to **N** workers; console hooks (`swarm_start` / `status` / `event` / `swarm_end`). |
| `2-fork-tasks.mjs` | `fork()` distinct specs per worker. |
| `3-plan-decompose.mjs` | `swarmWithPlan()` leader JSON DAG (`decomposer.mjs`). |
| `4-with-integrator.mjs` | `integrator` + `forceIntegrator` after dual successes (`integrator.mjs`). |
| `5-crash-recovery.mjs` | Ledger read/write `.venom-swarm/ledger.json`, `resumeSwarm()` scaffolding. |

---

## CLI equivalents

| Script | Mirrors |
|--------|---------|
| `1-basic-swarm.mjs` | `ca3 swarm "<task>" [--workers N]` |
| `2-fork-tasks.mjs` | `ca3 fork "<a>" "<b>" ...` |
| `3-plan-decompose.mjs` | `ca3 swarm "<task>" --plan` |
| `4-with-integrator.mjs` | `ca3 fork … --integrator` (given enough successes) |
| `5-crash-recovery.mjs` | Mental model behind `ca3 status` · `ca3 resume` |

---

## Notes

| Topic | Operational reality |
|-------|---------------------|
| **Prompt size** | Examples use deliberately **small prompts** — swap yours when experimenting financially. |
| **Integrator gating** | Integration triggers only when `integrator` flags align **and multiple workers succeed** — see orchestrator semantics in [`src/lib/swarm.mjs`](../src/lib/swarm.mjs). |
| **`resumeSwarm`** | Loads persisted ledger; **full deterministic replay of queued failures remains incomplete** (`TODO` traces in swarm module) — read before promising automation externally. |

**Related docs:** [`docs/swarm-patterns.md`](../docs/swarm-patterns.md) · [`docs/architecture.md`](../docs/architecture.md) · [`docs/troubleshooting.md`](../docs/troubleshooting.md)
