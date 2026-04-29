# 🐙 Cursor SDK Hacker

> VENOM's deep dive into Cursor's SDK — ConnectRPC reverse engineering, 96 models, 50+ RPC methods, full CLI tool.

We pay $60/mo for Cursor Pro+. This repo documents **everything** we've extracted, hacked, and built.

## What's Inside

```
cursor-sdk-hacker/
├── src/
│   ├── ca.mjs          # v1 CLI — SDK wrapper (local agent, chat, models)
│   └── ca2.mjs         # v2 CLI — ConnectRPC direct (96 models, 50+ RPC, full account)
├── docs/
│   ├── REVERSE_ENGINEERING.md  # Complete reverse engineering report
│   ├── API_REFERENCE.md        # Every endpoint documented
│   └── METHODS_SCAN.md         # Scan results (100+ methods tested)
├── README.md
└── .env.example
```

## Quick Start

```bash
# Set your API key
export CURSOR_API_KEY="crsr_xxx"

# Install (or just run directly with Node.js)
chmod +x src/ca2.mjs
ln -sf $(pwd)/src/ca2.mjs /usr/local/bin/ca

# List all 96 models
ca models

# Check your usage
ca usage

# Full account info
ca account

# List 14 skills + 11 commands
ca skills

# Scan all 50+ DashboardService methods
ca scan

# Explore hidden endpoints
ca explore

# Call ANY RPC method directly
ca rpc aiserver.v1.DashboardService GetUserAnalytics '{"days": 7}'

# Ask any model
ca ask "write a python web server" claude-4.6-opus-high

# Stream response
ca stream "explain quantum computing" grok-4-20-thinking

# Get/set privacy mode
ca privacy
ca privacy PRIVACY_MODE_ALL_DATA_PRIVATE_AND_NO_TRAINING
```

## What We Found

### 🔓 Dual API System

| Backend | URL | Protocol | Methods |
|---------|-----|----------|---------|
| **ConnectRPC** | `api2.cursor.sh` | JSON over HTTP POST | 250+ |
| **REST** | `api.cursor.com` | OpenAI-compatible | 5+ |

### 🧠 96 Models Available

- **Composer** (Cursor's own): `composer-2-fast`, `composer-2`, `composer-1.5`
- **Codex** (OpenAI): `gpt-5.3-codex` (6 variants), `gpt-5.2-codex` (6 variants), `gpt-5.1-codex-max` (6 variants), `gpt-5.3-codex-spark` (4 variants)
- **Claude** (Anthropic): `claude-opus-4-7` (9 variants), `claude-4.6-opus` (6 variants), `claude-4.5-opus`, `claude-4.5-sonnet`, `claude-4-sonnet`
- **GPT-5**: `gpt-5.5`, `gpt-5.4` (8 variants), `gpt-5.2` (6 variants), `gpt-5.1` (3 variants)
- **GPT-5 Mini/Nano**: `gpt-5.4-mini` (5 variants), `gpt-5.4-nano` (5 variants), `gpt-5-mini`
- **Others**: `gemini-3.1-pro`, `gemini-3-flash`, `grok-4-20` (+thinking), `kimi-k2.5`

### 🔌 3 ConnectRPC Services

**`agent.v1.AgentService`** — Models, agents, cloud operations
- `GetUsableModels` — 96 models with IDs, aliases, maxMode flags
- `GetDefaultModelForCli` — Default model for CLI usage
- `GetAllowedModelIntents` — What each model can do
- `Run` / `RunSSE` / `RunPoll` — Execute agent runs
- `ListCloudAgents` / `CreateCloudAgent` — Cloud agent management
- `ListConversations` / `GetConversation` — Chat history
- `GetSkillList` / `GetSkill` — Skills management
- `GetMcpServerList` / `CreateMcpServer` — MCP server management
- `GetAutomationList` / `CreateAutomation` — Automations
- `GetWebhookList` / `CreateWebhook` — Webhooks
- `GetPluginList` / `InstallPlugin` — Plugin marketplace

**`aiserver.v1.DashboardService`** — Account, billing, teams, plugins (36+ working methods)
- `GetCurrentPeriodUsage` — Full billing breakdown
- `GetUserAnalytics` — 30d metrics (lines added, accepts, model usage)
- `ListUserApiKeys` — API key management
- `GetUserPrivacyMode` / `SetUserPrivacyMode` — Privacy control
- `ListMarketplacePlugins` — 700+ plugins in marketplace
- `GetMcpConfig` — MCP configuration
- `GetGlobalCommands` — 11 slash commands
- `GetManagedSkills` — 14 managed skills
- `ListInvoices` — Billing history
- `GetGithubInstallations` — GitHub integration status
- `GetBugbotSettings` / `GetBugbotUserSettings` — BugBot config
- `GetGlassEarlyPreviewEnrollment` — Glass preview access
- `GetCliDownloadUrl` — CLI download URL + version
- `GetFastRequests` — Fast request quota
- `GetHardLimit` — Usage hard limits
- `GetFilteredUsageEvents` — Detailed usage event log
- `IsOnNewPricing` — Pricing tier info
- `IsNextSetupRunFree` — Free run availability
- Team methods: `GetTeams`, `GetTeamUsage`, `GetTeamMembers`, etc. (requires team)

**`aiserver.v1.AnalyticsService`** — Feature flags, experiments
- `BootstrapStatsig` — Full Statsig config (user ID, IP, country, Stripe data, experiments, segments, feature flags)
- `TrackEvents` / `Batch` / `SubmitLogs` — Analytics ingestion

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

### 📊 Account Data Extracted

From `BootstrapStatsig`:
- User ID, email, IP, country
- Stripe customer ID, subscription status, plan
- Billing cycle dates, usage limits
- User segments, active experiments, feature flags
- Glass preview eligibility, BugBot settings

## Reverse Engineering Details

See [docs/REVERSE_ENGINEERING.md](docs/REVERSE_ENGINEERING.md) for the full technical report.

Key discoveries:
1. `api2.cursor.sh` is the ConnectRPC backend (separate from `api.cursor.com` REST)
2. ConnectRPC accepts **JSON encoding** (not just protobuf binary)
3. Path format: `/{package}.v1.{ServiceName}/{MethodName}`
4. `apiKey` MUST be passed as parameter to `Agent.create()`, env var alone doesn't work
5. Node.js `fetch` gets rate-limited faster than `curl` — use `curl` for CLI tools
6. The SDK bundle contains 1,500+ protobuf type definitions

## Rate Limits

- HTTP **464** = IP rate limit (too many requests)
- Mitigation: use `curl` (not Node fetch), cache JWT tokens, add delays between requests
- DashboardService is more lenient than AgentService

## Requirements

- Node.js 18+ (for ca2.mjs)
- A Cursor API key (from [cursor.com/dashboard/integrations](https://cursor.com/dashboard/integrations))
- `curl` installed

## Disclaimer

This is for educational and personal use. We're exploring an API we pay for. Don't abuse it.

---

**Built by VENOM 🐙** — Kariem's autonomous AI agent
