<div align="center">

# Cursor Claw

### **VENOM Edition**

*`@cursor/sdk` harness · ConnectRPC surface · Venom Swarm (`ca3`)*

[![License: MIT](https://img.shields.io/badge/License-MIT-9cf?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Cursor](https://img.shields.io/badge/Cursor-Pro%2B-000000?style=flat-square)](https://cursor.com/)

**We pay for Cursor Pro+. This repository is our receipt turned into machinery:** documented APIs, runnable CLIs, and parallel agent workflows you can audit, extend, and run locally.

[Installation](#installation) · [Quickstart](#quickstart) · [Architecture](#architecture) · [Swarm workflows](#swarm-fork-plan-integrate-workflows) · [CLI reference](#cli-reference) · [Rate limiting](#rate-limiting--resilience) · [Crash recovery](#crash-recovery) · [Security model](#security-model) · [Benchmarks & tuning](#benchmarks--tuning)

[Agents](AGENTS.md) · [Documentation index](docs/README.md)

</div>

---

> **Canon** · **Cursor Claw** ships as **`cursor-calw`** ([npm](https://www.npmjs.com/package/cursor-calw)) from [`kariemSeiam/cursor-calw`](https://github.com/kariemSeiam/cursor-calw). MIT licensed. Executable CLIs bind official [`@cursor/sdk`](https://www.npmjs.com/package/@cursor/sdk) — this repo exposes and documents what subscribers already pay for.

## Why this exists

| Goal | What you get |
|------|----------------|
| **Transparency** | A map of Cursor’s dual backends (REST + ConnectRPC), auth flow, and privacy headers—backed by scanned methods and live CLIs. |
| **Control** | Run the official SDK locally (`ca`), call arbitrary RPCs (`ca2`), or orchestrate isolated git worktrees with multiple agents (`ca3`). |
| **Ownership** | Your API key, your machine, your repo. Swarm mode keeps blast radius bounded to disposable worktrees under a temp prefix. |

This is **educational and operational** tooling for subscribers exploring an API they pay for—not a circumvention or abuse kit. Use it responsibly.

---

## Repository layout

```
cursor-calw/
├── AGENTS.md               # Orientation for autonomous agents & tooling
├── src/
│   ├── ca.mjs              # Local SDK agent + REST (api.cursor.com)
│   ├── ca2.mjs             # ConnectRPC + curl (api2.cursor.sh)
│   ├── ca3.mjs             # Venom Swarm orchestrator (parallel agents)
│   ├── ca3-review.mjs      # Standalone diff/review helper
│   └── lib/
│       ├── swarm.mjs       # Orchestration, ledger hooks, integrator stage
│       ├── rate-limiter.mjs# Retries, backoff, batch staggering
│       ├── ledger.mjs      # Persistent swarm task state (.venom-swarm/)
│       ├── worktrees.mjs   # Git worktree lifecycle
│       ├── decomposer.mjs  # Planner / task decomposition
│       ├── integrator.mjs  # Merge + semantic integration agent
│       └── reviewer.mjs    # Diffs, conflicts, merge order
├── docs/
│   ├── README.md           # Documentation index + voice covenant
│   ├── architecture.md
│   ├── swarm-patterns.md
│   ├── troubleshooting.md
│   ├── REVERSE_ENGINEERING.md
│   ├── API_REFERENCE.md
│   └── METHODS_SCAN.md
├── examples/               # Runnable scripts (see examples/README.md)
├── test/
├── CHANGELOG.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── package.json
├── .env.example
└── LICENSE
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           YOUR ENVIRONMENT                                   │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────────────┐ │
│  │   ~/.cursor  │   │   git repo   │   │  $TMPDIR/venom-swarm/            │ │
│  │ -api-key     │   │  (worktrees) │   │  isolated agent worktrees        │ │
│  └──────┬───────┘   └──────┬───────┘   └──────────────────────────────────┘ │
│         │                  │                      ▲                           │
│         v                  v                      │ ca3 swarm / fork           │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        Cursor Claw CLIs                                  │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐  │ │
│  │  │ ca.mjs      │    │ ca2.mjs     │    │ ca3.mjs + lib/*.mjs         │  │ │
│  │  │ SDK Agent   │    │ curl RPC    │    │ Orchestrator + ledger +     │  │ │
│  │  │ + REST      │    │ + JWT cache │    │ rate limit + integrator     │  │ │
│  │  └──────┬──────┘    └──────┬──────┘    └─────────────────────────────┘  │ │
│  └─────────┼──────────────────┼────────────────────────────────────────────┘ │
└────────────┼──────────────────┼──────────────────────────────────────────────┘
             │                  │
             v                  v
┌──────────────────────────────┴───────────────────────────────────────────────┐
│                        CURSOR CLOUD                                           │
│  ┌─────────────────────┐          ┌─────────────────────────────────────────┐ │
│  │ api.cursor.com      │          │ api2.cursor.sh (ConnectRPC)            │ │
│  │ REST: /v1/*         │          │ POST /{service}/{method}                 │ │
│  │ Bearer: API key     │          │ Bearer: JWT from key exchange           │ │
│  └─────────────────────┘          └─────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────┘

Auth trail (ConnectRPC path):
   crsr_* API key ──► POST .../auth/exchange_user_api_key ──► JWT (cached ~1h, refresh margin 5m)
```

**Design principles**

- **`ca2` uses `curl`** to reduce Node-side rate-limit pressure (documented in upstream recon).
- **`ca3` uses staggered batches** (`batchWithStagger`) so parallel agents do not hammer the API in one tick.
- **Worktrees are detached** at the current `HEAD` commit so workers do not fight over branch ref updates.

---

## Installation

**Requirements:** Node.js **18+**, `git`, `curl`, and a Cursor API key from [cursor.com/dashboard/integrations](https://cursor.com/dashboard/integrations).

```bash
git clone https://github.com/kariemSeiam/cursor-calw.git
cd cursor-calw
npm install
```

Binaries (from `package.json`): `ca`, `ca2`, `ca3`, `ca3-review`.

```bash
npx ca --version
npx ca2 models
npx ca3 help
```

Optional global links:

```bash
chmod +x src/*.mjs
sudo ln -sf "$(pwd)/src/ca.mjs" /usr/local/bin/ca
sudo ln -sf "$(pwd)/src/ca2.mjs" /usr/local/bin/ca2
sudo ln -sf "$(pwd)/src/ca3.mjs" /usr/local/bin/ca3
sudo ln -sf "$(pwd)/src/ca3-review.mjs" /usr/local/bin/ca3-review
```

### Credentials

```bash
# Option A — environment
export CURSOR_API_KEY="crsr_xxxxxxxxxxxx"

# Option B — file (default path both CLIs look for)
printf '%s\n' "crsr_xxxxxxxxxxxx" > ~/.cursor-api-key
chmod 600 ~/.cursor-api-key
```

Copy `.env.example` to `.env` if your tooling loads it; the CLIs primarily use `CURSOR_API_KEY` / `~/.cursor-api-key`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `CURSOR_API_KEY` | — | API key |
| `CURSOR_KEY_FILE` | `~/.cursor-api-key` | Alternate key file |
| `CURSOR_MODEL` | `composer-2` | Default model for `ca` (overridable with `--model`) |
| `CURSOR_BACKEND_URL` | `https://api.cursor.com` | REST base for `ca` |

---

## Quickstart

**1 — Local coding agent (SDK on your disk)**

```bash
cd /path/to/your/project
npx ca ask "Summarize this repo in three bullets"
npx ca code "Add a minimal README section on testing"
```

**2 — Cloud / RPC inspection**

```bash
npx ca2 usage          # Billing + 30d-style analytics bundle
npx ca2 models         # Full ConnectRPC catalog (90+ models)
npx ca2 rpc agent.v1.AgentService GetUsableModels
```

**3 — Multi-agent swarm (git repo required)**

```bash
cd /path/to/git/repo
npx ca3 plan "Ship OAuth2 login and session middleware"
npx ca3 swarm "Ship OAuth2 login and session middleware" --plan --workers 3
```

---

## CLI reference

### `ca` — local SDK + REST (`src/ca.mjs`)

| Command | Description |
|---------|-------------|
| `ca ask <question>` | Ask-only; streams assistant + tool traces |
| `ca code <task>` | Coding task in **current working directory** |
| `ca me` | `GET /v1/me` |
| `ca models` | REST models + local SDK model hints |
| `ca repos` | `GET /v1/repositories` |
| `ca agents [limit]` | List cloud agents |
| `ca prompt <text>` | Create cloud agent run + stream + delete |
| `ca runs <agentId>` | List runs |
| `ca stream <agentId> <runId>` | Resume SSE stream |
| `ca delete <agentId>` | Delete agent |
| `ca raw <METHOD> <path> [json]` | Escape hatch REST |

**Flags:** `--model <id[:k=v,k2=v2]>`, `--version`, `--help`

```bash
ca code "Refactor config loading" --model composer-2:fast=false
ca agents 50
ca raw GET /v1/models
ca raw POST /v1/some/path '{"example":true}'
```

**Model note (SDK ≥ 1.0.9):** parameters live on the model object—e.g. thorough Composer: `composer-2:fast=false`.

---

### `ca2` — ConnectRPC via `curl` (`src/ca2.mjs`)

| Command | Description |
|---------|-------------|
| `ca2 models` | Printable catalog (grouped) |
| `ca2 usage` | Usage + analytics |
| `ca2 account` | Deep account / billing / keys / segments |
| `ca2 skills` | Managed skills + slash commands |
| `ca2 experiments` | Statsig experiments snapshot |
| `ca2 scan` | Probe many `DashboardService` methods |
| `ca2 explore` | Ad-hoc undocumented / interesting RPC probes |
| `ca2 rpc <service> <method> [json]` | Generic RPC |
| `ca2 agents` | REST agents listing |
| `ca2 ask "<question>"` | REST chat completion (non-streaming) |
| `ca2 stream "<question>"` | Streaming chat completion |
| `ca2 privacy` | Get privacy mode |
| `ca2 privacy <MODE>` | Set privacy mode enum |

```bash
ca2 rpc aiserver.v1.DashboardService GetUserAnalytics '{"days": 7}'
ca2 scan
ca2 ask "Explain async iterators in JS"
ca2 stream "Draft a regex for IPv6"
```

Note: `ca2 ask` / `ca2 stream` concatenate every token after the subcommand into one prompt string; override the default chat model by editing `cmdAsk` / `cmdStream` in `src/ca2.mjs` or call `ca2 rpc` / `ca raw` for full control.


---

### `ca3` — Venom Swarm (`src/ca3.mjs`)

| Command | Description |
|---------|-------------|
| `ca3 swarm "<task>"` | N parallel workers (same task or planner-driven with `--plan`) |
| `ca3 fork "<spec1>" "<spec2>" ...` | One agent per spec string |
| `ca3 plan "<task>"` | Decomposition preview (leader agent) |
| `ca3 resume` | Resume path tied to ledger (see [Crash recovery](#crash-recovery)) |
| `ca3 status` | Swarm file + ledger summary when running |
| `ca3 kill` | Clear swarm state file |
| `ca3 clean` | Remove orphaned swarm worktrees |
| `ca3 models` | Curated model cheat-sheet |
| `ca3 review` | Diff/conflict review for registered worktree paths |
| `ca3 merge` | Conflict-aware merge ordering |
| `ca3 integrate` | Run integrator agent on combined results |
| `ca3 help` | Full inline help |

**Flags**

| Flag | Meaning |
|------|---------|
| `--workers N` | Parallel agents, **1–5** (default **3**) |
| `--model <id[:p=v]>` | Override model |
| `--plan` | Leader decomposes task, then workers execute specs |
| `--integrator` | After success, run semantic integrator (`success > 1`) |
| `--force-integrator` | Always run integrator agent when integrating |
| `--no-cleanup` | Keep git worktrees after run (inspect / merge manually) |

```bash
ca3 plan "Build a blog with auth and comments"
ca3 swarm "Build a blog with auth and comments" --plan --workers 4
ca3 swarm "Fix all TODOs in src/" --workers 3 --model claude-sonnet-4-0
ca3 fork "Add Stripe webhook" "Add admin dashboard" "Write API tests"
ca3 swarm "Parallel refactor" --integrator
ca3 resume
ca3 clean
```

---

### `ca3-review` — review-only (`src/ca3-review.mjs`)

```bash
ca3-review                  # human-readable report
ca3-review --json           # machine-readable
ca3-review --conflicts      # conflicts only
ca3-review --merge          # merge feasibility summary
ca3-review --no-diff        # stats without unified diff body
```

---

## Swarm, fork, plan, integrate workflows

### 1 · Plan (dry run)

Use when the task is broad and you want **structure before spend**.

```bash
ca3 plan "Migrate JWT to session cookies across API and frontend"
```

The decomposer emits task scopes, optional path hints, dependencies, and a **level-style execution order** preview.

### 2 · Swarm (parallel same task)

Best for **speed / diversity**: multiple isolated actors attempt the same mission; you compare diffs.

```bash
ca3 swarm "Harden input validation on all public routes" --workers 3
```

### 3 · Swarm + plan (leader → workers)

Best for **large features** with natural splits (auth, UI, migrations).

```bash
ca3 swarm "Implement billing: plans, Stripe, webhooks, emails" --plan --workers 5 --integrator
```

Sequence: **decompose → worktrees → staggered agent batch → optional integrator → cleanup**.

### 4 · Fork (explicit specs)

When you already know the breakdown—three prompts, three agents:

```bash
ca3 fork \
  "Task A: database migrations" \
  "Task B: GraphQL schema" \
  "Task C: Playwright smoke tests"
```

### 5 · Integrate

Optional second tier that merges semantically:

- Pass `--integrator` on `swarm` / `fork`, **or**
- Run `ca3 integrate` after a run **if** worktree paths are available to the tool (see ledger / `--no-cleanup` and `git worktree list` when debugging).

The integrator builds a dedicated worktree under `.venom-swarm/integration-<timestamp>`, applies non-conflicting patches, and may invoke an agent for conflict resolution when needed.

---

## Rate limiting & resilience

### HTTP / SDK (`lib/rate-limiter.mjs`)

| Signal | Handling |
|--------|----------|
| **429** | Retry with exponential backoff + jitter |
| **464** | Treated as stricter / IP-style cap: **longer** backoff |
| **502 / 503 / 504** | Retried as network-class failures |
| Non-retryable SDK errors | Fail fast |

**Defaults:** up to **3** retries, base delay **1s**, cap **30s**, small jitter.

### Orchestration (`lib/swarm.mjs`)

- **`batchWithStagger`**: default **2000 ms** between waves to avoid synchronized spikes when many agents start together.
- **Concurrency** follows configured worker count (capped at **5**).

### ConnectRPC client (`ca2`)

- Uses **`curl`** instead of Node’s HTTP stack for heavy RPC workloads (reduces self-inflicted throttling).
- JWT cached under `~/.cache/cursor-jwt-cache.json` with refresh margin (see source).

### Historical / observed codes (from recon)

| Code | Meaning | Mitigation |
|------|---------|------------|
| 429 | Standard rate limit | Backoff, fewer parallel agents, cache |
| 464 | IP-level pressure | Increase stagger, reduce concurrency, pause |
| 401 | Missing team / feature | Check membership or endpoint eligibility |

---

## Crash recovery

| Mechanism | Location | Role |
|-----------|----------|------|
| **Ledger** | `<repo>/.venom-swarm/ledger.json` | Persists swarm id, task text, per-task status, attempts, worktree paths |
| **Swarm state** | `<project>/.tmp-cli/swarm-state.json` | Lightweight session metadata (used by CLI `status` / `kill`) |
| **`ca3 resume`** | API | Reloads ledger-oriented orchestration state |

**Operational guidance**

1. If a run dies mid-flight, inspect `.venom-swarm/ledger.json` for **queued / failed / running** tasks and associated `worktreePath` entries.
2. Use `ca3 clean` to garbage-collect **orphaned** worktrees (see `cleanupOrphanedWorktrees`).
3. **`resumeSwarm` is still evolving** (checkpoint + ledger exist; full automatic replay may require following repo issues / PRs). Treat resume as **recovery scaffolding**, not a guarantee of hands-free continuation until your checkout matches mainline behavior.

---

## Security model

| Topic | Behavior |
|-------|----------|
| **Secrets** | API key from `CURSOR_API_KEY` or `~/.cursor-api-key`. **Never** commit keys; chmod `600` on key files. |
| **Transport** | HTTPS to Cursor endpoints; JWT short-lived for `api2`. |
| **Ghost / privacy** | `ca2` sends `x-ghost-mode: true` on RPC by default—aligns with “no training” stance; use `ca2 privacy` for account-level policy. |
| **Local execution** | `ca` / `ca3` run the SDK with **`local.cwd`** pointing at your tree or isolated worktrees—agents can edit files and run tools per Cursor’s model policy. |
| **Isolation** | Swarm uses **detached git worktrees** under `$TMPDIR/venom-swarm/` so parallel experiments do not corrupt your main working tree until you merge intentionally. |
| **Supply chain** | `npm install` pins `@cursor/sdk`; audit upgrades consciously. |

---

## Benchmarks & tuning

There is **no substitute** for measuring on *your* network, model, and repository. Use this table of **implementation defaults** as a baseline for expectations and load shaping:

| Constant | Value | Source (conceptual) |
|----------|------|---------------------|
| Max swarm workers | 5 | `MAX_WORKERS` |
| Default workers | 3 | `DEFAULT_WORKERS` |
| Batch stagger | ~2000 ms | `BATCH_STAGGER` |
| Retry attempts | 3 | `MAX_RETRIES` (rate limiter) |
| Backoff cap | 30 s | `MAX_DELAY` |

**How to benchmark**

```bash
/usr/bin/time -p npx ca3 swarm "Microbench: add JSDoc to lib/*.mjs" --workers 3
/usr/bin/time -p npx ca2 rpc agent.v1.AgentService GetUsableModels
```

Record wall time, **USD usage** from `ca2 usage`, and qualitative diff size. Regressions usually trace to **model choice**, **429/464**, or **IO-heavy repos** (large `node_modules` in scope).

---

## Further reading

| Document | Contents |
|----------|----------|
| [AGENTS.md](AGENTS.md) | Entry path for Cursor / autonomous agents cloning this repo. |
| [docs/README.md](docs/README.md) | Full documentation TOC + Markdown voice covenant (VENOM standard). |
| [docs/architecture.md](docs/architecture.md) | Swarm internals, mermaid diagrams, SQLite vs ledger. |
| [docs/swarm-patterns.md](docs/swarm-patterns.md) | Choosing `swarm` / `--plan` / `fork`, scaling cues. |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Symptoms → fixes for auth, rate limits, Git, ledger. |
| [docs/REVERSE_ENGINEERING.md](docs/REVERSE_ENGINEERING.md) | `@cursor/sdk` bundle narrative and protocol recon. |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Curated endpoints + RPC tables. |
| [docs/METHODS_SCAN.md](docs/METHODS_SCAN.md) | Empirical scan aggregations across services. |
| [examples/README.md](examples/README.md) | Programmatic API examples mirrored from `ca3`. |

---

## License

MIT — see [LICENSE](LICENSE). Copyright © 2026 VENOM.

---

<div align="center">

**VENOM** · *Turning subscription dollars into sunlight on the wire.*

[Report issues](https://github.com/kariemSeiam/cursor-calw/issues) · [Upstream package](https://www.npmjs.com/package/@cursor/sdk)

</div>
