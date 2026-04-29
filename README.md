# 🐙 Cursor SDK Hacker

> VENOM's deep dive into Cursor's SDK — ConnectRPC reverse engineering, 96 models, 50+ RPC methods, full CLI tool.

We pay $60/mo for Cursor Pro+. This repo documents **everything** we've extracted, hacked, and built.

## What's Inside

```
cursor-sdk-hacker/
├── src/
│   ├── ca.mjs          # Local SDK agent (ask, code) + REST API client
│   └── ca2.mjs         # ConnectRPC recon (96 models, 50+ RPC, full account)
├── docs/
│   ├── REVERSE_ENGINEERING.md  # Complete reverse engineering report
│   ├── API_REFERENCE.md        # Every endpoint documented
│   └── METHODS_SCAN.md         # Scan results (113 methods tested)
├── package.json
├── .gitignore
├── .env.example
├── LICENSE
└── README.md
```

## Install

```bash
git clone https://github.com/kariemSeiam/cursor-sdk-hacker.git
cd cursor-sdk-hacker
npm install

# The CLIs are now available globally via npm bin:
npx ca --version
npx ca2 --version

# Or symlink manually:
sudo ln -sf $(pwd)/src/ca.mjs /usr/local/bin/ca
sudo ln -sf $(pwd)/src/ca2.mjs /usr/local/bin/ca2
```

## Setup

```bash
# Option 1: Environment variable
export CURSOR_API_KEY="crsr_xxxxxxxxxxxx"

# Option 2: Save to file (auto-detected by both CLIs)
echo "crsr_xxxxxxxxxxxx" > ~/.cursor-api-key
chmod 600 ~/.cursor-api-key
```

## `ca` — Local SDK Agent + REST API

Uses `@cursor/sdk` to run Composer locally on your machine (reads/writes files, runs commands).

```bash
# Ask anything
ca ask "what is 2+2?"

# Give it a coding task (it creates/modifies files in your CWD)
ca code "create a hello.py that prints 'Hello from VENOM'"

# Use thorough mode (slower, better reasoning)
ca code "refactor the auth module" --model composer-2:fast=false

# Cloud REST API commands
ca models                # List all cloud models
ca me                    # Account info
ca agents                # List cloud agents
ca raw GET /v1/models    # Raw API call

# Flags
ca --version             # Show version
ca --help                # This help
ca --model <id[:params]> # Override model
```

### Model System (SDK v1.0.9+)

Models use **parameters**, not separate IDs. `composer-2-fast` is now `composer-2` with `{ fast: "true" }`:

```bash
ca ask "quick question"                    # default: composer-2 (fast=true)
ca code "hard task" --model composer-2:fast=false  # thorough mode
```

Available local models:
- `composer-2` (default, fast=true)
- `composer-2:fast=false` (more thorough)
- `composer-1.5` (legacy)

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CURSOR_API_KEY` | — | API key (or save to `~/.cursor-api-key`) |
| `CURSOR_MODEL` | `composer-2` | Override default model |
| `CURSOR_KEY_FILE` | `~/.cursor-api-key` | Custom key file path |
| `CURSOR_BACKEND_URL` | `https://api.cursor.com` | REST API base URL |

## `ca2` — ConnectRPC Recon

Direct access to Cursor's ConnectRPC backend (`api2.cursor.sh`). Uses curl to avoid Node.js rate limiting.

```bash
# Account & billing
ca2 usage                 # Billing usage + 30d analytics
ca2 account               # Full account dump (billing, privacy, keys, segments)
ca2 privacy               # Get/set privacy mode

# Models & tools
ca2 models                # List all 96 models (ConnectRPC catalog)
ca2 skills                # 14 managed skills + 11 slash commands
ca2 experiments           # Active A/B experiments

# Deep recon
ca2 scan                  # Test 50+ DashboardService methods
ca2 explore               # Probe hidden/undocumented endpoints
ca2 rpc <service> <method> [body]  # Call ANY RPC method directly

# Chat (REST, not SDK)
ca2 ask "question" [model]
ca2 stream "question" [model]
```

### ConnectRPC Services

| Service | Methods | Purpose |
|---------|---------|---------|
| `agent.v1.AgentService` | 47 | Models, agents, cloud runs, skills, MCP, webhooks |
| `aiserver.v1.DashboardService` | 61 | Account, billing, plugins, privacy, teams |
| `aiserver.v1.AnalyticsService` | 5 | Statsig, feature flags, event tracking |

## What We Found

### 🔓 Dual API System

| Backend | URL | Protocol | Methods |
|---------|-----|----------|---------|
| **ConnectRPC** | `api2.cursor.sh` | JSON over HTTP POST | 250+ |
| **REST** | `api.cursor.com` | OpenAI-compatible | 5+ |

### 🔑 Auth Flow

```
API Key (crsr_xxx)
  → POST api2.cursor.sh/auth/exchange_user_api_key
  → { accessToken: "JWT...", refreshToken: "..." }
  → Use JWT as Bearer token for all RPC calls
  → JWT valid 1hr, auto-refresh 5min before expiry
```

### 🛡️ Ghost Mode (Privacy)

- Header: `x-ghost-mode: true/false`
- **NOT a hash** — just a boolean string
- Modes 0,1,2 → ghost=true (no training)
- Modes 3,4 → ghost=false (training allowed)
- Default: true (safe by design)

### 🧠 96 Models

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for the full catalog.

### 🔌 22 Builtin Agent Tools

`SEARCH`, `EDIT`, `LS`, `READ_FILE`, `WRITE_FILE`, `WEB_FETCH`, `RUN_TERMINAL_COMMAND`, `APPLY_DIFF`, `COMPUTER_USE`, `MCP_CALL`, `GOTODEF`, `RIPGREP_SEARCH`, `SEARCH_SYMBOLS`, `NEW_FILE`, `DELETE_FILE`, `TODO_READ`, `TODO_WRITE`, `CREATE_DIAGRAM`, `CREATE_PLAN`, `KNOWLEDGE_BASE`, `DEEP_SEARCH`, `WRITE_SHELL_STDIN`

## Rate Limits

| Code | Meaning | Mitigation |
|------|---------|------------|
| 429 | Standard rate limit | Retry with backoff |
| 464 | IP-level rate limit | Use curl, add delays, cache tokens |
| 401 | Unauthorized (team methods) | Need team membership |

## Requirements

- Node.js 18+
- A Cursor API key from [cursor.com/dashboard/integrations](https://cursor.com/dashboard/integrations)
- `curl` (for ca2)

## Documentation

- [docs/REVERSE_ENGINEERING.md](docs/REVERSE_ENGINEERING.md) — Full technical report
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md) — Every endpoint documented
- [docs/METHODS_SCAN.md](docs/METHODS_SCAN.md) — 113 methods tested

## Disclaimer

This is for educational and personal use. We're exploring an API we pay for. Don't abuse it.

---

**Built by VENOM 🐙** — [Kariem Seiam](https://github.com/kariemSeiam)
