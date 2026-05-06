# Troubleshooting — Cursor Claw (Swarm, Git, API)

> **Canon** · **Cursor Claw** [`cursor-calw`](https://github.com/kariemSeiam/cursor-calw) · MIT · doc voice: [`docs/README.md`](./README.md#documentation-voice).

**You are reading:** operator playbook — symptom → cause → fix for **Swarm** (`ca3`), **Git worktrees**, **Cursor API / SDK**, and local **state** files.

---

## Quick diagnostic checklist

1. **Git:** `git rev-parse --show-toplevel` succeeds from your project (Swarm requires a repo).
2. **Your key:** `CURSOR_API_KEY` exports **your** subscriber key, or `~/.cursor-api-key` is readable (**you** authenticate—see `ca` / `ca3` resolution).
3. **Disk:** Enough space for OS temp worktrees under `$TMPDIR/claw-swarm`.
4. **State:** If behavior is weird after a crash, check `.claw-swarm/ledger.json` and `.tmp-cli/swarm-state.json`.

---

## Cursor SDK & API errors

### “No API key” / auth failures

**Symptoms:** Errors creating agents, 401 from cloud APIs, or decomposer: `CURSOR_API_KEY required`.

**Fixes:**

- Export **`CURSOR_API_KEY`** (**your** key) or write it to **`~/.cursor-api-key`** with restrictive permissions (`chmod 600`). **You** are always the authenticated party—there is no “Cursor authenticates” side channel.
- For `@cursor/sdk`, **`apiKey` must be passed into `Agent.create()`**; ConnectRPC transport does not infer the key from the environment alone (see [REVERSE_ENGINEERING.md](./REVERSE_ENGINEERING.md)).

### Rate limits: HTTP 429

**Cause:** Standard application rate limiting.

**Mitigation:**

- Swarm already uses **`withRetry`** with exponential backoff + jitter (`rate-limiter.mjs`).
- Reduce **`--workers`**, enable **cleanup** between runs, or increase **time between swarm invocations**.
- Avoid spawning **many CLIs** against the same key simultaneously.

### Rate limits: HTTP 464 (IP-level)

**Cause:** Heavier throttling at the network/IP tier (documented in README for `ca2`).

**Mitigation:**

- Same as 429, but backoff may need to be **longer**; `isIPRateLimit` doubles the delay multiplier in `withRetry`.
- For **`ca2`**, README suggests **curl** for heavy recon to reduce Node-side rate limiting — not directly applicable to SDK Swarm, but **lowering concurrency** is the parallel for swarm runs.

### 401 on team / enterprise methods

**Cause:** Method requires **team membership** or different auth scope.

**Mitigation:** Use documented personal account flows; avoid team-only RPCs unless authorized.

### Agent / tool failures mid-run

**Symptoms:** Worker returns `success: false`, tool errors in streamed events.

**Mitigation:**

- Re-run with **`--workers 1`** to get a deterministic trace.
- Inspect **`ca3` stderr** and ledger task **`error`** / **`result`** fields in `.claw-swarm/ledger.json`.

---

## Git & worktree issues

### “Not in a git repository”

Swarm resolves the repo with `git rev-parse --show-toplevel`.

**Fix:** `cd` into your clone; initialize **`git init`** if you truly need Swarm on a new project.

### `Failed to create worktree`

**Causes:**

- Invalid **`git` state** (corrupt repo, permission denied).
- **Path collision** or OS temp issues.

**Fixes:**

- Run `git worktree list` and remove stale entries if needed.
- Ensure **write access** to `$TMPDIR` and the main `.git` directory.
- Retry after `ca3 clean` (removes swarm temp trees under the **`claw-swarm`** prefix).

### Detached HEAD confusion

Swarm uses **`git worktree add --detach <path> <sha>`** so workers do not share a branch ref.

**Expect:** Workers are **not** “on” `main` by name; they are at a **fixed commit**. This is intentional — see [architecture.md](./architecture.md).

### Orphan worktrees filling disk

**Symptoms:** Old directories under **`/tmp/.../claw-swarm`** (or `$TMPDIR`) after crashes.

**Fix:**

- `ca3 clean` → **`cleanupOrphanedWorktrees`**
- Manually remove paths only if **`git worktree remove`** has already failed and you know the path is unregistered.

### Merge conflicts after parallel runs

**Symptoms:** `ca3 review` shows same file touched by multiple workers.

**Mitigation:**

- Use **`ca3 merge`** for a summary; merge **clean** worktrees first, then resolve conflicted files manually.
- Prefer **`--plan`** or **`fork`** with disjoint **`allowed_paths`** to reduce overlap (see [swarm-patterns.md](./swarm-patterns.md)).

---

## Swarm-specific state & recovery

### `.claw-swarm/ledger.json`

- Written by **`Ledger`** (`ledger.mjs`).
- Intended for **crash recovery** and task bookkeeping (status per index, worktree paths, timestamps).

**If corrupt:** Delete the `.claw-swarm` directory only if you accept **loss of recovery metadata**; next run creates a fresh ledger.

### `.tmp-cli/swarm-state.json`

- Used by **`ca3`** for **UI state** (e.g. which worktrees to review after a run).
- If it references missing paths after manual deletion, run **`ca3 clean`** and start a new swarm.

### `resume` / “No active swarm to resume”

**`resumeSwarm`** (`swarm.mjs`) loads the ledger via **`loadLedger(repo)`**. If no ledger file exists or swarm never started, you get **no active swarm**.

**Note:** The orchestrator’s **`resumeSwarm`** path includes a **TODO** for fully re-executing failed/queued tasks; treat **resume** as **best-effort** until completion of that logic — check the ledger contents and re-run specific tasks manually if needed.

---

## SQLite agent store (`~/.cursor/sdk-agent-store`)

**Symptoms:** Odd persistence, disk growth, or SDK errors after many runs.

**Mitigation:**

- This store is **managed by the SDK**, not Cursor Claw. Ensure **disk space** and consider **Cursor / SDK** upgrades if behavior changes.
- Do not delete SQLite files while agents are running.

---

## Getting a minimal repro

1. `ca3 swarm "make a trivial one-line change to README"` `--workers 1`
2. If that passes, scale to **2 workers** on the same task.
3. If only **plan** fails, run **`ca3 plan "…"`** alone to isolate **decomposer** / JSON validation.

---

## Where to read more

- [docs/README.md](./README.md) — full documentation index + voice standard.
- [architecture.md](./architecture.md) — data flow, worktree model, SQLite vs. ledger.
- [swarm-patterns.md](./swarm-patterns.md) — mode selection and scaling.
- [API_REFERENCE.md](./API_REFERENCE.md) — REST / ConnectRPC surfaces for broader diagnostics.
