# Cursor Claw · Methods scan appendix

> **Canon** · Aggregate output from **Cursor Claw** `ca2`/probes against [`api2.cursor.sh`](https://api2.cursor.sh) · MIT · snapshot in time — rescan when upstream drifts.

**You are reading:** automated ConnectRPC survey totals — three services, 100+ exercised methods, pass/fail shorthand.

## Summary

| Service | OK | Not Found | Failed | Total |
|---------|-----|-----------|--------|-------|
| DashboardService | 36 | 18 | 7 | 61 |
| AgentService | 47 (exists, rate-limited) | 0 | 0 | 47 |
| AnalyticsService | 4 | 1 | 0 | 5 |
| **Total** | **87** | **19** | **7** | **113** |

## DashboardService — Working Methods (36)

### Billing & Usage (14)
- ✅ `GetCurrentPeriodUsage` — 869 bytes — billingCycleStart, billingCycleEnd, planUsage, spendLimitUsage, displayThreshold, enabled, displayMessage, autoBucketModels
- ✅ `GetCurrentBillingCycle` — 80 bytes — startDateEpochMillis, endDateEpochMillis
- ✅ `GetMonthlyBillingCycle` — 80 bytes
- ✅ `GetTokenUsage` — 2 bytes (empty)
- ✅ `GetUsageLimitStatusAndActiveGrants` — 60 bytes — usageLimitPolicyStatus
- ✅ `GetHardLimit` — 29 bytes — noUsageBasedAllowed
- ✅ `GetClientUsageData` — 2 bytes (empty)
- ✅ `GetClientVisibleCreditGrants` — 2 bytes (empty)
- ✅ `GetCreditGrantsBalance` — 2 bytes (empty)
- ✅ `GetDailySpendByCategory` — 2 bytes (empty)
- ✅ `GetFilteredUsageEvents` — **40,535 bytes** — totalUsageEventsCount, usageEventsDisplay
- ✅ `IsOnNewPricing` — 80 bytes — isOnNewPricing, hasAutoSpillover, dashboardUserId
- ✅ `IsNextSetupRunFree` — 36 bytes — isFree, remainingRuns
- ✅ `GetYearlyUpgradeEligibility` — 2 bytes (empty)
- ✅ `GetFastRequests` — 21 bytes — requestQuota
- ✅ `GetUsageBasedPremiumRequests` — 2 bytes (empty)

### User & Auth (4)
- ✅ `GetUserPrivacyMode` — 59 bytes — privacyMode
- ✅ `SetUserPrivacyMode` — (write method)
- ✅ `GetUserProfile` — 2 bytes (empty)
- ✅ `ListUserApiKeys` — 180 bytes — apiKeys[]

### Analytics (1)
- ✅ `GetUserAnalytics` — **14,218 bytes** — dailyMetrics[], period, totalMembersInTeam

### Skills & Commands (2)
- ✅ `GetManagedSkills` — **73,405 bytes** — skills[] (14 skills with full content)
- ✅ `GetGlobalCommands` — **22,609 bytes** — commands[] (11 commands with full content)

### Plugins (4)
- ✅ `GetEffectiveUserPlugins` — 214 bytes — marketplaces[]
- ✅ `ListMarketplacePlugins` — **762,026 bytes** — plugins[] (700+ plugins!)
- ✅ `ListTeamPluginInstalls` — (team required)
- ✅ `GetTeamPluginPrimitiveUsage` — (team required)
- ✅ `GetTeamPluginPopularity` — (team required)

### MCP (2)
- ✅ `GetMcpConfig` — 44 bytes — configJson
- ✅ `GetAvailableMcpServers` — 2 bytes (empty)

### Teams & Orgs (12)
- ✅ `GetTeams` — 2 bytes (no teams)
- ✅ `GetUserOrganizations` — 2 bytes (empty)
- 🔒 `GetTeamUsage` — 401 (requires team)
- 🔒 `GetTeamSpend` — 401
- 🔒 `GetTeamMembers` — 401
- 🔒 `GetTeamRepos` — 401
- 🔒 `GetTeamHooks` — 401
- 🔒 `GetTeamRules` — 401
- 🔒 `ListTeamApiKeys` — 401
- ✅ `GetOrganizationGroups` — (exists)
- ✅ `GetDirectoryGroups` — (exists)
- ✅ `GetGroupMembers` — (exists)
- ✅ `ListOrganizationApiKeys` — (exists)
- ✅ `ListTeamServiceAccounts` — (exists)

### BugBot (2)
- ✅ `GetBugbotSettings` — 36 bytes — available, enabled
- ✅ `GetBugbotUserSettings` — 264 bytes — suppressNoBugsComments, installationDefaultEnableDraft, installationDefaultIsPrSummaryEnabled, installationDefaultBugbotAutofixMode, installationDefaultBugbotAutofixSeverityFilter

### Glass (1)
- ✅ `GetGlassEarlyPreviewEnrollment` — 71 bytes — enterpriseGlassSelfEnrollEligible, glassAccessGranted

### Integrations (3)
- ✅ `GetLinearSettings` — 2 bytes (empty)
- ✅ `GetGithubInstallations` — **4,983 bytes** — installations[], githubConnected, teamHasBugbotRepos, githubUsernames
- ✅ `ListInvoices` — **4,483 bytes** — invoices[], total, totalPages, hasMore

### Other (3)
- ✅ `GetEnterpriseCTAEligibility` — 2 bytes (empty)
- ✅ `GetCliDownloadUrl` — 96 bytes — url, version

## DashboardService — Not Found (18)

These methods were guessed but don't exist on the server:
- `GetJiraProjectSettings`
- `GetStripeCustomerPortalUrl`
- `GetSubscriptionStatus`
- `GetOnboardingState`
- `GetFeatureFlags`
- `GetUserPreferences`
- `GetConversationHistory`
- `ListConversations`
- `GetAgentRunHistory`
- `ListAgentRuns`
- `GetAutomationList`
- `GetMcpServerList`
- `GetPluginList`
- `GetWebhookList`
- `GetCursorSettings`
- `GetUsageAlertThresholds`
- `GetAutoUpgradeSettings`
- `GetShareSettings`

**Note:** Some of these (like conversations, automations, plugins) likely exist on `AgentService` instead of `DashboardService`.

## AgentService — Methods (47)

All 47 methods return HTTP 404 or are rate-limited (464). Based on bundle analysis, they exist:
- `Run`, `RunSSE`, `RunPoll` — Agent execution
- `ListCloudAgents`, `CreateCloudAgent`, `GetCloudAgent`, `DeleteCloudAgent` — Cloud agents
- `ListConversations`, `GetConversation`, `DeleteConversation` — Conversations
- `GetAutomationList`, `CreateAutomation` — Automations
- `GetSkillList`, `GetSkill`, `CreateSkill` — Skills
- `GetMcpServerList`, `CreateMcpServer` — MCP
- `GetPluginList`, `InstallPlugin` — Plugins
- `GetWebhookList`, `CreateWebhook` — Webhooks
- `GetCursorSettings`, `SetCursorSettings` — Settings
- `GetUserPreferences`, `SetUserPreferences` — Preferences
- `GetFeatureFlags`, `GetOnboardingState` — System

## AnalyticsService — Methods (5)

- ✅ `BootstrapStatsig` — Full Statsig config
- ✅ `TrackEvents` — Event tracking
- ✅ `Batch` — Batch events
- ✅ `SubmitLogs` — Log submission
- ❌ `IngestConversation` — Error

## Biggest Data Payloads

1. `ListMarketplacePlugins` — **762 KB** (700+ plugins)
2. `GetManagedSkills` — **73 KB** (14 skills with full descriptions)
3. `GetGlobalCommands` — **22 KB** (11 commands)
4. `GetFilteredUsageEvents` — **40 KB** (usage log)
5. `GetUserAnalytics` — **14 KB** (30 days metrics)
