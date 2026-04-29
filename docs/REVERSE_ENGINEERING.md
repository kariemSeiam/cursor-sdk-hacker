# Cursor SDK Reverse Engineering Report

> Complete technical analysis of Cursor's SDK bundle and API infrastructure.

## Overview

The Cursor SDK (`@cursor/sdk@1.0.7`) is a TypeScript library that provides programmatic access to Cursor's AI coding agent. This report documents the reverse engineering of its internal architecture, authentication system, and API protocols.

## Bundle Analysis

### Files Analyzed
- `index.js` — 5.4MB minified (main bundle)
- `829.index.js` — 3.2MB minified (secondary)

### Key Findings from Bundle

**1,500+ Protobuf Type Definitions**
```
aiserver.v1.* — Server types
agent.v1.* — Agent types  
```

**3 ConnectRPC Services Discovered:**
- `agent.v1.AgentService`
- `aiserver.v1.AnalyticsService`
- `aiserver.v1.DashboardService`

**22 Builtin Agent Tools:**
`SEARCH`, `EDIT`, `LS`, `READ_FILE`, `WRITE_FILE`, `WEB_FETCH`, `RUN_TERMINAL_COMMAND`, `APPLY_DIFF`, `COMPUTER_USE`, `MCP_CALL`, `GOTODEF`, `RIPGREP_SEARCH`, `SEARCH_SYMBOLS`, `NEW_FILE`, `DELETE_FILE`, `TODO_READ`, `TODO_WRITE`, `CREATE_DIAGRAM`, `CREATE_PLAN`, `KNOWLEDGE_BASE`, `DEEP_SEARCH`, `WRITE_SHELL_STDIN`

## Dual API System

### 1. ConnectRPC (Primary) — `api2.cursor.sh`

**Protocol:** ConnectRPC with JSON encoding over HTTP POST

**Authentication:**
```
POST /auth/exchange_user_api_key
Authorization: Bearer crsr_xxx
Content-Type: application/json
x-cursor-client-type: sdk
Body: {}
→ { accessToken: "JWT...", refreshToken: "..." }
```

**Required Headers for RPC Calls:**
```
Authorization: Bearer <JWT>
Content-Type: application/json
Connect-Protocol-Version: 1
x-cursor-client-type: sdk
x-ghost-mode: true
x-request-id: <uuid>
```

**Path Format (CONFIRMED):**
```
POST https://api2.cursor.sh/{service.typeName}/{method}
Example: POST https://api2.cursor.sh/agent.v1.AgentService/GetUsableModels
```

**Key Discovery:** ConnectRPC accepts JSON encoding (not just protobuf binary). This means no protobuf compilation needed — plain JSON works.

### 2. REST API (Cloud Agents) — `api.cursor.com`

**Endpoints:**
- `GET /v1/models` — List cloud models
- `POST /v1/chat/completions` — OpenAI-compatible chat
- `GET /v1/agents` — List cloud agents
- `POST /v1/agents` — Create cloud agent

**Authentication:** `Authorization: Bearer crsr_xxx` (direct API key, no JWT exchange needed)

### 15 Custom Headers Found

| Header | Purpose |
|--------|---------|
| `x-ghost-mode` | Training data control (true/false) |
| `x-cursor-client-type` | Client identifier ("sdk") |
| `x-cursor-client-version` | Version string |
| `x-request-id` | Fresh UUID per request |
| `x-original-request-id` | First request in chain |
| `x-parent-request-id` | Parent-child linking |
| `x-root-parent-request-id` | Root trace ID |
| `x-parent-agent-tool-call-id` | Tool call chain |
| `x-direct-meta-parent-child-subagent` | Direct routing flag |
| `x-cursor-hook-conversation-id` | Hook conversation link |
| `x-cursor-hook-generation-id` | Hook generation link |
| `x-cursor-hook-model` | Hook model identifier |

### Ghost Mode Analysis

**DEBUNKED:** Ghost mode is NOT a hash of the API key. It's a simple boolean string.

Privacy Mode Enum:
- `UNSPECIFIED=0` → ghost=true
- `NO_STORAGE=1` → ghost=true
- `NO_TRAINING=2` → ghost=true
- `USAGE_DATA_TRAINING_ALLOWED=3` → ghost=false
- `USAGE_CODEBASE_TRAINING_ALLOWED=4` → ghost=false

Default on error: **true** (safe by design)

### SDK Internal Architecture

**Local Mode Pipeline:**
```
Agent.create({ apiKey, model, local: { cwd } })
  → StoreBackedAgent
  → agent.send(prompt)
  → LocalExecutor.run()
  → streams events (assistant, thinking, tool_call, status)
  → run.wait()
```

**Cloud Mode Pipeline:**
```
Agent.create({ apiKey, model, cloud: { repo } })
  → Routes to REST API
  → Runs in sandboxed VM
  → Supports repos, auto-create PR, MCP servers
```

**State Storage:**
- SQLite under `~/.cursor/sdk-agent-store/<hash>/`

### Sandbox/VM Infrastructure

- Types: `INSECURE_NONE`, `WORKSPACE_READWRITE`, `WORKSPACE_READONLY`
- 20+ VM environments: `dev`, `test1`, `eval1-2`, `train1-7`, `us1-us7` + privacy variants
- Network policy: `DefaultAction ALLOW/DENY`, strict mode, explicit allowlists
- Default SDK: model `gpt-5`, sandbox disabled, allowlist approval mode

### Critical SDK Quirk

**`apiKey` MUST be passed as parameter to `Agent.create()`** — the ConnectRPC transport does NOT read `CURSOR_API_KEY` from env var. The REST API (cloud) does read it from env.

```typescript
// ❌ WRONG — will fail with "Invalid API key"
Agent.create({ model: { id: "composer-2" }, local: { cwd: "/repo" } })

// ✅ CORRECT
Agent.create({ apiKey: "crsr_xxx", model: { id: "composer-2" }, local: { cwd: "/repo" } })
```

### Event Structure

Local SDK streams `event.type === "assistant"` events containing `event.message.content[]` blocks (type "text"), NOT `text-delta` events. The `text-delta` pattern is from cloud SSE streaming.

### Environment Variables

`CURSOR_API_KEY`, `CURSOR_API_BASE_URL`, `CURSOR_BACKEND_URL`, `CURSOR_CONFIG_DIR`, `CURSOR_DATA_DIR`, `CURSOR_USE_HTTP1`, `CURSOR_WEBSITE_URL`, `CURSOR_PRIVACY_CACHE_MAX_AGE_MS`, `VSCODE_VERSION`, `AGENT_CLI_STATIC_VERSION`
