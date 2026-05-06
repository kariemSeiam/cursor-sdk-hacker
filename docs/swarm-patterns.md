# Swarm patterns — Cursor Claw (`ca3`)

> **Canon** · **Cursor Claw** [`cursor-calw`](https://github.com/kariemSeiam/cursor-calw) · MIT · prose standard: [`Documentation voice`](./README.md#documentation-voice).

**You are reading:** operator heuristics — when to run **simple swarm**, **`--plan`**, or **`fork`**, and how each mode hits the **ledger** + **rate limiter**.

Cursor Claw (`ca3` swarm) exposes three main ways to parallelize [**`@cursor/sdk`**](https://www.npmjs.com/package/@cursor/sdk) agents across a **Git** repository. This guide frames mode selection, decomposition, and saturation control.

---

## Mode comparison

| Mode | CLI / API | What runs in parallel | Task text |
|------|-----------|------------------------|-----------|
| **Swarm (simple)** | `ca3 swarm "…"` / `swarm(task)` | Same natural-language task on **N** workers | Identical string per worker |
| **Swarm + plan** | `ca3 swarm "…" --plan` / `swarmWithPlan(task)` | Different subtasks from the **leader** (DAG) | **Decomposed** per worker |
| **Fork** | `ca3 fork "<spec1>" "<spec2>" …` / `fork([...])` | **Your** explicit list of specs | One string per worker |

### Swarm (simple parallel)

**Use when:**

- You want **diversity of approach** (multiple independent attempts at the same problem).
- The task is **localized** or **risk-tolerant** (overlap edits may need manual merge).
- You **do not** need a dependency graph — everyone starts together on the same instruction.

**Characteristics:**

- `SwarmOrchestrator` duplicates the task string `workers` times (capped by `MAX_WORKERS`).
- No leader decomposition step → **faster startup**, no `CURSOR_API_KEY` requirement beyond normal agent runs (leader uses key from env in decomposer only when planning).

**Watchouts:**

- Overlapping file edits → use `ca3 review` / `ca3 merge` before integrating.
- Same prompt may yield **correlated** mistakes; bumping `--workers` is not always better.

---

### Swarm + plan (`--plan`)

**Use when:**

- The goal decomposes into **orthogonal** tracks (e.g. API vs. UI vs. migrations).
- You want **path-bound** hints (`allowed_paths`) and optional **dependencies** between subtasks.
- A single long instruction would cause workers to **tread on each other** without structure.

**Characteristics:**

- `decompose()` runs a **leader** agent that must return **valid JSON** (array of tasks with `description`, `scope`, `allowed_paths`, `dependencies`).
- Validation enforces DAG properties (cycles, index bounds, dependency count).
- Subtask count is bounded by `maxTasks` (orchestrator passes `workers` as ceiling).

**Watchouts:**

- Planning adds **latency** and an extra model call.
- Dependencies in the ledger are modeled (`blocked` / `queued`); **ensure your execution strategy** aligns with whether you need strict wave execution vs. current “parallel batch” behavior (see code in `swarm.mjs`).

---

### Fork

**Use when:**

- You already know the split (**“implement A / implement B / fix C”**).
- You need **human-curated** boundaries instead of model-generated ones.
- Tasks differ **strongly** in scope (different files, different libraries).

**Characteristics:**

- `fork(tasks)` sets `workers` to `tasks.length` and passes an **array** into `orch.run(tasks)` — no string duplication.
- Ledger stores the high-level label `"fork"` when the task input is not a single string (see `createSwarm` call sites).

**Watchouts:**

- You own **coherence** across specs (naming, interfaces, shared files).
- Too many narrow tasks → integration burden; too few → you might as well use simple swarm.

---

## Plan-only preview (`ca3 plan`)

Running **`ca3 plan "<task>"`** invokes **`decompose()`** and prints the DAG summary **without** spawning worker worktrees. Use it to:

- Validate that the leader **understands** your repo and task shape.
- Inspect `allowed_paths` and **dependency depth** before spending API quota on a full swarm.

---

## Decision flow (heuristic)

```text
Is the work naturally ONE focused change?
  → Use a single agent (e.g. `ca` / one worker), not swarm.

Is the same task worth multiple independent tries?
  → swarm (no --plan), moderate workers.

Do you need structured subtasks + path hints + DAG?
  → swarm --plan (or fork if you wrote the DAG manually as separate specs).

Do you already have explicit parallel specs?
  → fork.
```

---

## Best practices

### 1. Right-size parallelism

- Start with **2–3** workers; increase only when **review** shows **low overlap** on changed files.
- Respect **`MAX_WORKERS` (5)** unless you change the code — it caps concurrent agents per process.

### 2. Rate limits and pacing

- Swarm uses **staggered batches** (`batchWithStagger`) and **retry with backoff** (`withRetry`). Treat **429/464** as signals to **reduce concurrency** or **increase stagger**, not to hammer retry immediately.

### 3. Git hygiene

- Commit or stash **clean** starting states when you care about deterministic diffs.
- Run **`ca3 clean`** after crashes to drop orphaned worktrees under `$TMPDIR/claw-swarm`.

### 4. Integration path

- After parallel work, use **`ca3 review`** to see **cross-worktree file clashes**.
- Use **`ca3 integrate`** when you want an **integrator** agent to reconcile results (optional `--integrator` on swarm/fork).

### 5. Secrets and environment

- Workers need a **valid API key** (e.g. `CURSOR_API_KEY` or `~/.cursor-api-key` as implemented in your CLI).
- The **decomposer** path requires **`CURSOR_API_KEY`** explicitly (`decomposer.mjs`).

---

## Scaling up (practical ceiling)

| Dimension | Guidance |
|-----------|----------|
| **Workers per repo** | Stay within `MAX_WORKERS`; scale **sequential** swarm runs for unrelated work packages. |
| **Many repositories** | Run separate `ca3` processes per clone; isolate **ledger** paths (each repo has its own `.claw-swarm/`). |
| **Large codebase** | Prefer **plan** or **fork** with **narrow `allowed_paths`** to reduce merge pain. |
| **API quota** | More workers × more tool calls → watch billing and **rate limit** counters (`ca2 usage` in this project’s tooling). |

---

## Mental model summary

- **Swarm** = duplicate effort / explore the same problem in parallel.
- **Plan** = let a **leader** partition the problem **before** parallel execution.
- **Fork** = **you** partition the problem; the orchestrator only schedules it.

For system design details, see [architecture.md](./architecture.md) and [docs/README.md](./README.md).
