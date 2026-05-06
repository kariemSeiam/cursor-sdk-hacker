# Cursor Claw · API reference appendix

> **Canon** · Maintained with **Cursor Claw** [`cursor-calw`](https://github.com/kariemSeiam/cursor-calw) · MIT · cross-check live behavior with `ca2` before treating tables as gospel.

**You are reading:** endpoint + ConnectRPC catalog — every path this repository has discovered, exercised, and written down.

## Authentication

**Principal:** `crsr_*` values are **your** Cursor subscriber API keys. Bearer tokens and exchanged JWTs identify **your** account; there is no alternate “Cursor-authenticated” persona in these flows.

### Exchange API Key for JWT
```
POST https://api2.cursor.sh/auth/exchange_user_api_key
Authorization: Bearer crsr_xxx
Content-Type: application/json
x-cursor-client-type: sdk
Body: {}

Response:
{
  "accessToken": "eyJhbG...",
  "refreshToken": "..."
}
```
- JWT valid for 1 hour
- Contains: sub, email, apiKeyName, apiKeyId, iss, exp, iat

---

## ConnectRPC Services

Base URL: `https://api2.cursor.sh`
All requests: `POST /{ServiceName}/{MethodName}`

### agent.v1.AgentService

| Method | Status | Description | Data Keys |
|--------|--------|-------------|-----------|
| `GetUsableModels` | ✅ Working | List all available models (96) | models[] |
| `GetDefaultModelForCli` | ✅ Rate-limited | Default model for CLI | — |
| `GetAllowedModelIntents` | ✅ Rate-limited | Model capabilities | — |
| `Run` | ✅ Exists | Execute agent run (streaming) | — |
| `RunSSE` | ✅ Exists | Execute via SSE | — |
| `RunPoll` | ✅ Exists | Execute via polling | — |
| `NameAgent` | ✅ Exists | Name/rename agent | — |
| `ListCloudAgents` | ✅ Exists | List cloud agents | — |
| `CreateCloudAgent` | ✅ Exists | Create cloud agent | — |
| `GetCloudAgent` | ✅ Exists | Get cloud agent details | — |
| `DeleteCloudAgent` | ✅ Exists | Delete cloud agent | — |
| `CancelCloudAgent` | ✅ Exists | Cancel running agent | — |
| `ListCloudAgentRuns` | ✅ Exists | List agent runs | — |
| `GetCloudAgentRun` | ✅ Exists | Get run details | — |
| `GetCloudAgentArtifact` | ✅ Exists | Get artifact | — |
| `ListCloudAgentArtifacts` | ✅ Exists | List artifacts | — |
| `GetCloudAgentConversation` | ✅ Exists | Get conversation | — |
| `ListConversations` | ✅ Exists | List all conversations | — |
| `GetConversation` | ✅ Exists | Get conversation details | — |
| `DeleteConversation` | ✅ Exists | Delete conversation | — |
| `ExportConversation` | ✅ Exists | Export conversation | — |
| `GetSharedConversation` | ✅ Exists | Get shared conversation | — |
| `GetAutomationList` | ✅ Exists | List automations | — |
| `CreateAutomation` | ✅ Exists | Create automation | — |
| `DeleteAutomation` | ✅ Exists | Delete automation | — |
| `GetWebhookList` | ✅ Exists | List webhooks | — |
| `CreateWebhook` | ✅ Exists | Create webhook | — |
| `DeleteWebhook` | ✅ Exists | Delete webhook | — |
| `GetSkillList` | ✅ Exists | List skills | — |
| `GetSkill` | ✅ Exists | Get skill details | — |
| `CreateSkill` | ✅ Exists | Create skill | — |
| `UpdateSkill` | ✅ Exists | Update skill | — |
| `DeleteSkill` | ✅ Exists | Delete skill | — |
| `GetMcpServerList` | ✅ Exists | List MCP servers | — |
| `CreateMcpServer` | ✅ Exists | Create MCP server | — |
| `DeleteMcpServer` | ✅ Exists | Delete MCP server | — |
| `GetPluginList` | ✅ Exists | List plugins | — |
| `InstallPlugin` | ✅ Exists | Install plugin | — |
| `UninstallPlugin` | ✅ Exists | Uninstall plugin | — |
| `GetCursorSettings` | ✅ Exists | Get settings | — |
| `SetCursorSettings` | ✅ Exists | Update settings | — |
| `GetUserPreferences` | ✅ Exists | Get preferences | — |
| `SetUserPreferences` | ✅ Exists | Update preferences | — |
| `GetFeatureFlags` | ✅ Exists | Get feature flags | — |
| `GetOnboardingState` | ✅ Exists | Get onboarding state | — |

### aiserver.v1.DashboardService

| Method | Status | Description | Data Keys |
|--------|--------|-------------|-----------|
| `GetCurrentPeriodUsage` | ✅ 869b | Billing usage breakdown | billingCycleStart, billingCycleEnd, planUsage, spendLimitUsage, displayThreshold, enabled, displayMessage, autoBucketModels |
| `GetCurrentBillingCycle` | ✅ 80b | Billing cycle dates | startDateEpochMillis, endDateEpochMillis |
| `GetMonthlyBillingCycle` | ✅ 80b | Monthly cycle dates | startDateEpochMillis, endDateEpochMillis |
| `GetTokenUsage` | ✅ 2b | Token usage (empty for free tier) | — |
| `GetUsageLimitStatusAndActiveGrants` | ✅ 60b | Usage limit status | usageLimitPolicyStatus |
| `GetHardLimit` | ✅ 29b | Hard spending limit | noUsageBasedAllowed |
| `GetClientUsageData` | ✅ 2b | Client usage data | — |
| `GetClientVisibleCreditGrants` | ✅ 2b | Visible credit grants | — |
| `GetCreditGrantsBalance` | ✅ 2b | Credit balance | — |
| `GetDailySpendByCategory` | ✅ 2b | Daily spend by category | — |
| `GetFilteredUsageEvents` | ✅ 40KB | Detailed usage events log | totalUsageEventsCount, usageEventsDisplay |
| `IsOnNewPricing` | ✅ 80b | Pricing tier check | isOnNewPricing, hasAutoSpillover, dashboardUserId |
| `IsNextSetupRunFree` | ✅ 36b | Free run availability | isFree, remainingRuns |
| `GetYearlyUpgradeEligibility` | ✅ 2b | Yearly upgrade check | — |
| `GetFastRequests` | ✅ 21b | Fast request quota | requestQuota |
| `GetUsageBasedPremiumRequests` | ✅ 2b | Premium requests | — |
| `GetUserPrivacyMode` | ✅ 59b | Privacy mode | privacyMode |
| `SetUserPrivacyMode` | ✅ | Set privacy mode | — |
| `GetUserProfile` | ✅ 2b | User profile | — |
| `ListUserApiKeys` | ✅ 180b | API keys list | apiKeys[] |
| `CreateUserApiKey` | ✅ | Create API key | — |
| `RevokeUserApiKey` | ✅ | Revoke API key | — |
| `GetUserAnalytics` | ✅ 14KB | 30d analytics | dailyMetrics[], period, totalMembersInTeam |
| `GetManagedSkills` | ✅ 73KB | 14 managed skills | skills[] |
| `GetGlobalCommands` | ✅ 22KB | 11 slash commands | commands[] |
| `GetEffectiveUserPlugins` | ✅ 214b | Active plugins | marketplaces[] |
| `ListMarketplacePlugins` | ✅ 762KB | 700+ marketplace plugins | plugins[] |
| `GetMcpConfig` | ✅ 44b | MCP configuration | configJson |
| `GetAvailableMcpServers` | ✅ 2b | Available MCP servers | — |
| `GetBugbotSettings` | ✅ 36b | BugBot availability | available, enabled |
| `GetBugbotUserSettings` | ✅ 264b | BugBot config | suppressNoBugsComments, installationDefaultEnableDraft, installationDefaultIsPrSummaryEnabled, installationDefaultBugbotAutofixMode, installationDefaultBugbotAutofixSeverityFilter |
| `GetGlassEarlyPreviewEnrollment` | ✅ 71b | Glass preview access | enterpriseGlassSelfEnrollEligible, glassAccessGranted |
| `GetLinearSettings` | ✅ 2b | Linear integration | — |
| `GetGithubInstallations` | ✅ 5KB | GitHub apps | installations[], githubConnected, teamHasBugbotRepos, githubUsernames |
| `ListInvoices` | ✅ 4.5KB | Billing history | invoices[], total, totalPages, hasMore |
| `GetEnterpriseCTAEligibility` | ✅ 2b | Enterprise eligibility | — |
| `GetCliDownloadUrl` | ✅ 96b | CLI download info | url, version |
| `GetTeams` | ✅ 2b | Teams list | — |
| `GetTeamUsage` | 🔒 401 | Team usage (requires team) | — |
| `GetTeamSpend` | 🔒 401 | Team spend (requires team) | — |
| `GetTeamMembers` | 🔒 401 | Team members (requires team) | — |
| `GetTeamRepos` | 🔒 401 | Team repos (requires team) | — |
| `GetTeamHooks` | 🔒 401 | Team hooks (requires team) | — |
| `GetTeamRules` | 🔒 401 | Team rules (requires team) | — |
| `ListTeamApiKeys` | 🔒 401 | Team API keys (requires team) | — |
| `GetUserOrganizations` | ✅ 2b | User orgs | — |
| `ListTeamServiceAccounts` | ✅ | Service accounts | — |
| `GetOrganizationGroups` | ✅ | Org groups | — |
| `GetDirectoryGroups` | ✅ | Directory groups | — |
| `GetGroupMembers` | ✅ | Group members | — |
| `ListOrganizationApiKeys` | ✅ | Org API keys | — |

### aiserver.v1.AnalyticsService

| Method | Status | Description |
|--------|--------|-------------|
| `BootstrapStatsig` | ✅ Working | Full Statsig config (user, billing, experiments, segments) |
| `TrackEvents` | ✅ Working | Track analytics events |
| `Batch` | ✅ Working | Batch analytics |
| `SubmitLogs` | ✅ Working | Submit logs |
| `IngestConversation` | ❌ Error | Conversation ingestion |

---

## REST API (api.cursor.com)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/models` | GET | List cloud models |
| `/v1/chat/completions` | POST | OpenAI-compatible chat |
| `/v1/agents` | GET | List cloud agents |
| `/v1/agents` | POST | Create cloud agent |

---

## Model Catalog (96 models)

### Composer (Cursor's own) — 3 models
| Model ID | Display Name | Aliases | Notes |
|----------|-------------|---------|-------|
| `composer-2-fast` | Composer 2 Fast | `composer` | ⚡ Default for CLI |
| `composer-2` | Composer 2 | `composer` | More thorough |
| `composer-1.5` | Composer 1.5 | `composer` | Legacy |

### Codex (OpenAI) — 30+ models
| Model ID | Display Name | Aliases |
|----------|-------------|---------|
| `gpt-5.3-codex` | Codex 5.3 | `codex`, `codex-5.3` |
| `gpt-5.3-codex-fast` | Codex 5.3 Fast | — |
| `gpt-5.3-codex-low` | Codex 5.3 Low | — |
| `gpt-5.3-codex-low-fast` | Codex 5.3 Low Fast | — |
| `gpt-5.3-codex-high` | Codex 5.3 High | — |
| `gpt-5.3-codex-high-fast` | Codex 5.3 High Fast | — |
| `gpt-5.3-codex-xhigh` | Codex 5.3 Extra High | — |
| `gpt-5.3-codex-xhigh-fast` | Codex 5.3 Extra High Fast | — |
| `gpt-5.3-codex-spark-preview` | Codex 5.3 Spark | `codex-spark` |
| `gpt-5.3-codex-spark-preview-low` | Codex 5.3 Spark Low | — |
| `gpt-5.3-codex-spark-preview-high` | Codex 5.3 Spark High | — |
| `gpt-5.3-codex-spark-preview-xhigh` | Codex 5.3 Spark Extra High | — |
| `gpt-5.2-codex` | Codex 5.2 | `codex`, `codex-5.2` |
| `gpt-5.2-codex-fast` | Codex 5.2 Fast | — |
| `gpt-5.2-codex-low` | Codex 5.2 Low | — |
| `gpt-5.2-codex-high` | Codex 5.2 High | — |
| `gpt-5.2-codex-xhigh` | Codex 5.2 Extra High | — |
| `gpt-5.1-codex-max-medium` | Codex 5.1 Max | `codex`, `codex-5.1-max` |
| `gpt-5.1-codex-max-low` | Codex 5.1 Max Low | — |
| `gpt-5.1-codex-max-high` | Codex 5.1 Max High | — |
| `gpt-5.1-codex-max-xhigh` | Codex 5.1 Max Extra High | — |
| `gpt-5.1-codex-mini` | Codex 5.1 Mini | `codex-mini` |

### Claude (Anthropic) — 20+ models
| Model ID | Display Name | Aliases |
|----------|-------------|---------|
| `claude-opus-4-7` | Opus 4.7 1M | — |
| `claude-opus-4-7-low` | Opus 4.7 1M Low | — |
| `claude-opus-4-7-medium` | Opus 4.7 1M Medium | — |
| `claude-opus-4-7-high` | Opus 4.7 1M High | — |
| `claude-opus-4-7-xhigh` | Opus 4.7 1M | — |
| `claude-opus-4-7-max` | Opus 4.7 1M Max | — |
| `claude-opus-4-7-thinking-low` | Opus 4.7 1M Low Thinking | — |
| `claude-opus-4-7-thinking-medium` | Opus 4.7 1M Medium Thinking | — |
| `claude-opus-4-7-thinking-high` | Opus 4.7 1M High Thinking | — |
| `claude-opus-4-7-thinking-xhigh` | Opus 4.7 1M Thinking | — |
| `claude-opus-4-7-thinking-max` | Opus 4.7 1M Max Thinking | — |
| `claude-4.6-opus-high` | Opus 4.6 1M | — |
| `claude-4.6-opus-max` | Opus 4.6 1M Max | — |
| `claude-4.6-opus-high-thinking` | Opus 4.6 1M Thinking | — |
| `claude-4.6-opus-max-thinking` | Opus 4.6 1M Max Thinking | — |
| `claude-4.6-sonnet-medium` | Sonnet 4.6 1M | — |
| `claude-4.6-sonnet-medium-thinking` | Sonnet 4.6 1M Thinking | — |
| `claude-4.5-opus-high` | Opus 4.5 | — |
| `claude-4.5-opus-high-thinking` | Opus 4.5 Thinking | `opus`, `opus-4.5` |
| `claude-4.5-sonnet` | Sonnet 4.5 | — |
| `claude-4.5-sonnet-thinking` | Sonnet 4.5 Thinking | `sonnet`, `sonnet-4.5` |
| `claude-4-sonnet` | Sonnet 4 | `sonnet`, `sonnet-4` |
| `claude-4-sonnet-thinking` | Sonnet 4 Thinking | — |

### GPT-5 Series — 20+ models
| Model ID | Display Name |
|----------|-------------|
| `gpt-5.5-medium` | GPT-5.5 1M |
| `gpt-5.5-high` | GPT-5.5 1M High |
| `gpt-5.5-extra-high` | GPT-5.5 1M Extra High |
| `gpt-5.4-medium` | GPT-5.4 1M |
| `gpt-5.4-fast` | GPT-5.4 Fast |
| `gpt-5.4-high` | GPT-5.4 1M High |
| `gpt-5.4-xhigh` | GPT-5.4 1M Extra High |
| `gpt-5.4-low` | GPT-5.4 1M Low |
| `gpt-5.4-mini` | GPT-5.4 Mini |
| `gpt-5.4-nano` | GPT-5.4 Nano |
| `gpt-5.2` | GPT-5.2 |
| `gpt-5.1` | GPT-5.1 |

### Others — 6 models
| Model ID | Display Name | Aliases |
|----------|-------------|---------|
| `gemini-3.1-pro` | Gemini 3.1 Pro | `gemini` |
| `gemini-3-flash` | Gemini 3 Flash | `gemini-flash` |
| `grok-4-20` | Grok 4.20 | — |
| `grok-4-20-thinking` | Grok 4.20 Thinking | `grok` |
| `kimi-k2.5` | Kimi K2.5 | `kimi` |
| `default` | Auto | `auto` |

---

## Rate Limits

| Code | Meaning | Mitigation |
|------|---------|------------|
| 429 | Standard rate limit | Retry with backoff |
| 464 | IP-level rate limit | Use curl, add delays, cache tokens |
| 401 | Unauthorized (team methods) | Need team membership |

## Tips

1. **Use curl, not fetch** — Node.js `fetch` gets 464'd faster
2. **Cache JWT tokens** — Re-exchange creates unnecessary load
3. **Sequential calls** for DashboardService (parallel triggers 464 faster)
4. **DashboardService > AgentService** for rate limit tolerance
5. **Ghost mode defaults to true** — your data is safe by default
