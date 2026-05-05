# ca3 / Venom Swarm examples

Runnable scripts that exercise the programmatic API under `src/lib/` (the same engine used by the `ca3` CLI).

## Prerequisites

- Install dependencies once from the repo root: `npm install`.
- **Node.js** (ES modules; matches project `"type": "module"`).
- Run commands from the **repository root** so imports resolve and `git rev-parse` finds your repo.
- **Git**: each example assumes you are inside a git work tree (swarm uses detached worktrees under your OS temp dir).
- **Cursor credentials**
  - Most swarm/decomposer flows resolve the key like `src/lib/swarm.mjs` (`CURSOR_API_KEY`, else `~/.cursor-api-key`).
  - **Planning / decomposition** (`3-plan-decompose.mjs`) requires **`CURSOR_API_KEY`** — the decomposer does not read the key file.
  - **Integrator agent** (`4-with-integrator.mjs`) only reads **`CURSOR_API_KEY`** from the environment for the integration step (`src/lib/integrator.mjs`).

## How to run

From the repo root:

```bash
node examples/1-basic-swarm.mjs
node examples/2-fork-tasks.mjs
node examples/3-plan-decompose.mjs
node examples/4-with-integrator.mjs
node examples/5-crash-recovery.mjs
```

Optional flags where supported:

```bash
node examples/1-basic-swarm.mjs --workers 2
node examples/3-plan-decompose.mjs --workers 4
node examples/5-crash-recovery.mjs --keep-ledger
```

## What each example shows

| File | Feature |
|------|---------|
| `1-basic-swarm.mjs` | **Parallel swarm**: same task to multiple workers via `SwarmOrchestrator`, with `swarm_start` / `status` / `event` / `swarm_end` hooks. |
| `2-fork-tasks.mjs` | **Forked tasks**: `fork()` runs **different** prompts per worker (one agent per spec). |
| `3-plan-decompose.mjs` | **Plan / decompose**: `swarmWithPlan()` — leader breaks one goal into subtasks (`decomposer.mjs`) before workers run. |
| `4-with-integrator.mjs` | **Integrator**: `run(..., { integrator: true, forceIntegrator: true })` triggers `integrateResults()` after **two** successful workers. |
| `5-crash-recovery.mjs` | **Ledger**: writes and reads `.venom-swarm/ledger.json` via `Ledger` / `loadLedger`, and demonstrates `resumeSwarm()` when a ledger is present. |

## CLI equivalents

These scripts mirror what you can do with `src/ca3.mjs`, for example:

- `1-basic-swarm.mjs` ≈ `ca3 swarm "<task>" [--workers N]`
- `2-fork-tasks.mjs` ≈ `ca3 fork "<spec1>" "<spec2>" ...`
- `3-plan-decompose.mjs` ≈ `ca3 swarm "<task>" --plan`
- `4-with-integrator.mjs` ≈ `ca3 fork ... --integrator` (with enough workers and successes)
- `5-crash-recovery.mjs` concepts ≈ `ca3 status` / `ca3 resume` (persistent state)

## Notes

- Examples use **short, low-impact prompts** so runs finish quickly; substitute real tasks for your codebase when experimenting.
- Swarm **integration only runs** when `integrator` is enabled and **more than one worker succeeds** (`src/lib/swarm.mjs`).
- **`resumeSwarm`** loads persisted state; **re-dispatching failed agents is still a TODO** in `resumeSwarm` — see `src/lib/swarm.mjs` for current behavior.
