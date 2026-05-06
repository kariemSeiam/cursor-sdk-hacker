# Cursor Claw — Context

(repo slug: **cursor-calw**, npm `name`: **cursor-calw**)

## Stack

- **Runtime:** Node.js 18+ (`"type": "module"`). CI matrix: 20.x, 22.x.
- **Package:** **Cursor Claw** (`cursor-calw` on npm/GitHub); publishes `src/` + `docs/` per `package.json` `files`.
- **Dependencies:** `@cursor/sdk` ^1.0.12 (local agent + APIs). Dev: `tsx` ^4.21.0.
- **Tooling:** ESLint 9 flat config (`eslint.config.js`); `npm run lint` → `eslint .`. Dev deps: `eslint`, `@eslint/js`, `globals`.

## Architecture

**CLIs (`package.json` `bin`):**

| Command | Entry | Role |
|---------|-------|------|
| `ca` | `src/ca.mjs` | `@cursor/sdk` agents with `local.cwd`; REST to `CURSOR_BACKEND_URL` (default `https://api.cursor.com`). Bearer = API key. |
| `ca2` | `src/ca2.mjs` | ConnectRPC to `api2.cursor.sh` via **`curl`**; JWT from key exchange, cached (~`~/.cache/cursor-jwt-cache.json`). |
| `ca3` | `src/ca3.mjs` | Multi-agent swarm: plan / swarm / fork / resume / merge / integrate / review / cleanup. |
| `ca3-review` | `src/ca3-review.mjs` | Diff and merge-feasibility report without full orchestrator. |

**Swarm libs (`src/lib/`):**

- `swarm.mjs` — `SwarmOrchestrator`, staggered batches, ledger hooks, optional integrator stage.
- `decomposer.mjs` — planner JSON DAG (scopes, paths, dependencies).
- `worktrees.mjs` — `git worktree add --detach` under OS temp (`venom-swarm` prefix), orphan cleanup.
- `ledger.mjs` — JSON persistence under repo `.venom-swarm/ledger.json`.
- `rate-limiter.mjs` — retries (429, 464, 5xx-class), `batchWithStagger`.
- `reviewer.mjs` — cross-worktree overlap / conflict preview.
- `integrator.mjs` — integration worktree and semantic merge path.

**State & paths:**

- Ephemeral CLI session: `<repo>/.tmp-cli/swarm-state.json` (used by `ca3` status / kill).
- Durable swarm task state: `<repo>/.venom-swarm/ledger.json`.
- Worker trees: temp dir (e.g. `$TMPDIR/venom-swarm/…`), detached at current `HEAD`.

**Docs:** `AGENTS.md` (agent entry), `docs/README.md` (TOC + voice covenant), `docs/architecture.md`, `REVERSE_ENGINEERING.md`, `API_REFERENCE.md`, `METHODS_SCAN.md`, `swarm-patterns.md`, `troubleshooting.md`.

**Examples:** `examples/*.mjs` (numbered scenarios).

## Conventions

- ESM **`.mjs`** CLIs with `#!/usr/bin/env node`; shared pattern: small color helpers, `fail()` → `process.exit(1)`.
- Model CLI shape: `id` or `id:param=value,...` (SDK v1.0.9+ parameters on model object).
- Tests: `node:test` + `node:assert` in `test/**/*.mjs`; git/SDK mocked in helpers (`test/helpers/`).

## Hot Paths

- **Primary use:** `npx ca` / `npx ca2` / `npx ca3` from consumer projects after `npm install`.
- **Swarm execution:** `ca3` → `SwarmOrchestrator` → optional `decompose` → ledger → worktrees → `Agent.create({ local: { cwd } })` per worker with rate limiting and stagger.
- **ConnectRPC traffic:** `ca2` shelling to `curl` (not Node `fetch` for heavy RPC).

## Gotchas

- **`npm test`** uses `node --test "test/*.test.mjs"` (glob). Passing a bare `test/` **directory** to `node --test` on Node 22 can fail (runner treats the path like a single module); add new top-level suites as `test/*.test.mjs` or extend the script pattern.
- **ESLint:** `npm run lint` completes with **warnings** (mostly `no-unused-vars`) — CI still passes unless `--max-warnings 0` is added.
- **Resume:** README documents `resume` / ledger as **recovery scaffolding**, not guaranteed full replay.
- **`examples/`** and **`test/`** are not listed in npm `files`; published tarball is CLI + docs only.
- **`ca3.mjs` `VERSION`:** read from root `package.json` at load time (must stay colocated with `src/` layout).
