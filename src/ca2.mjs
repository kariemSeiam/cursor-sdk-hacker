#!/usr/bin/env node
/**
 * ca2 — Cursor Claw · ConnectRPC / curl (VENOM) 🦀
 * Full ConnectRPC access to Cursor's 250+ API methods
 * Uses curl under the hood to avoid Node.js rate limiting
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { homedir } from 'os';

// ─── Config ───────────────────────────────────────────────
const API2 = 'https://api2.cursor.sh';
const REST = 'https://api.cursor.com';
const KEY_FILE = process.env.CURSOR_KEY_FILE || `${homedir()}/.cursor-api-key`;
const VERSION = '2.0.0-venom';

// ─── Auth ─────────────────────────────────────────────────
let cachedToken = null;
let tokenFile = `${homedir()}/.cache/cursor-jwt-cache.json`;

function getApiKey() {
  if (process.env.CURSOR_API_KEY) return process.env.CURSOR_API_KEY;
  if (existsSync(KEY_FILE)) return readFileSync(KEY_FILE, 'utf8').trim();
  throw new Error('No API key. Set CURSOR_API_KEY or save to ' + KEY_FILE);
}

function loadCachedToken() {
  try {
    if (existsSync(tokenFile)) {
      const { token, exp } = JSON.parse(readFileSync(tokenFile, 'utf8'));
      if (Date.now() < exp) return token;
    }
  } catch {}
  return null;
}

function saveCachedToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const exp = (payload.exp * 1000) - 300000; // 5 min before expiry
    writeFileSync(tokenFile, JSON.stringify({ token, exp }));
  } catch {}
}

function getToken() {
  if (cachedToken) return cachedToken;
  cachedToken = loadCachedToken();
  if (cachedToken) return cachedToken;
  
  const key = getApiKey();
  const result = execSync(
    `curl -s -X POST "${API2}/auth/exchange_user_api_key" ` +
    `-H "Authorization: Bearer ${key}" ` +
    `-H "Content-Type: application/json" ` +
    `-H "x-cursor-client-type: sdk" ` +
    `-d '{}'`,
    { timeout: 10000, encoding: 'utf8' }
  );
  
  const data = JSON.parse(result);
  if (!data.accessToken) throw new Error('Auth failed: no token returned');
  cachedToken = data.accessToken;
  saveCachedToken(cachedToken);
  return cachedToken;
}

// ─── RPC Client (via curl) ───────────────────────────────
function rpc(service, method, body = {}) {
  const token = getToken();
  const url = `${API2}/${service}/${method}`;
  const jsonBody = typeof body === 'string' ? body : JSON.stringify(body);
  const result = execSync(
    `curl -s -X POST "${url}" ` +
    `-H "Authorization: Bearer ${token}" ` +
    `-H "Content-Type: application/json" ` +
    `-H "Connect-Protocol-Version: 1" ` +
    `-H "x-cursor-client-type: sdk" ` +
    `-H "x-cursor-client-version: ${VERSION}" ` +
    `-H "x-ghost-mode: true" ` +
    `-H "x-request-id: ${randomUUID()}" ` +
    `-d '${jsonBody.replace(/'/g, "'\\''")}'`,
    { timeout: 15000, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
  );
  return JSON.parse(result);
}

function rpcStream(service, method, body = {}) {
  const token = getToken();
  const url = `${API2}/${service}/${method}`;
  const jsonBody = typeof body === 'string' ? body : JSON.stringify(body);
  return execSync(
    `curl -s -N -X POST "${url}" ` +
    `-H "Authorization: Bearer ${token}" ` +
    `-H "Content-Type: application/json" ` +
    `-H "Connect-Protocol-Version: 1" ` +
    `-H "x-cursor-client-type: sdk" ` +
    `-H "x-cursor-client-version: ${VERSION}" ` +
    `-H "x-ghost-mode: true" ` +
    `-H "x-cursor-streaming: true" ` +
    `-H "x-request-id: ${randomUUID()}" ` +
    `-d '${jsonBody.replace(/'/g, "'\\''")}'`,
    { timeout: 120000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
}

function restApi(path, method = 'GET', body = null) {
  const token = getToken();
  let cmd = `curl -s -X ${method} "${REST}${path}" ` +
    `-H "Authorization: Bearer ${token}" ` +
    `-H "Content-Type: application/json" ` +
    `-H "x-cursor-client-type: sdk" ` +
    `-H "x-ghost-mode: true" ` +
    `-H "x-request-id: ${randomUUID()}"`;
  if (body) cmd += ` -d '${JSON.stringify(body).replace(/'/g, "'\\''")}'`;
  return JSON.parse(execSync(cmd, { timeout: 30000, encoding: 'utf8' }));
}

// ─── Formatters ───────────────────────────────────────────
function formatUsage() {
  const usage = rpc('aiserver.v1.DashboardService', 'GetCurrentPeriodUsage');
  const u = usage.planUsage || {};
  const from = new Date(+usage.billingCycleStart).toLocaleDateString();
  const to = new Date(+usage.billingCycleEnd).toLocaleDateString();
  const total = u.totalSpend || 0;
  const included = u.includedSpend || 0;
  const bonus = u.bonusSpend || 0;
  const cap = included + bonus;
  const pct = cap > 0 ? ((total / cap) * 100).toFixed(1) : 0;
  
  console.log(`
📊 Usage: ${from} → ${to}
   Total Spend: $${(total/100).toFixed(2)} / $${(cap/100).toFixed(2)} (${pct}%)
   Included: $${(included/100).toFixed(2)}
   Bonus: $${(bonus/100).toFixed(2)}
   ${u.bonusTooltip ? '   Note: ' + u.bonusTooltip.slice(0, 100) : ''}`);
}

function formatAnalytics(days = 30) {
  const a = rpc('aiserver.v1.DashboardService', 'GetUserAnalytics', { days });
  let totalAdds = 0, totalDel = 0, totalAccepts = 0, totalReqs = 0;
  const models = {};
  for (const d of (a.dailyMetrics || [])) {
    totalAdds += d.linesAdded || 0;
    totalDel += d.linesDeleted || 0;
    totalAccepts += d.totalAccepts || 0;
    totalReqs += d.agentRequests || 0;
    for (const m of (d.modelUsage || [])) {
      models[m.name] = (models[m.name] || 0) + m.count;
    }
  }
  const topModels = Object.entries(models).sort((a,b) => b[1]-a[1]).slice(0, 10);
  console.log(`
📈 Analytics (${days} days):
   Lines Added: ${totalAdds.toLocaleString()}
   Lines Deleted: ${totalDel.toLocaleString()}
   Accepts: ${totalAccepts}
   Agent Requests: ${totalReqs}
   
   Top Models:
${topModels.map(([n,c]) => `   ${String(c).padStart(4)}x ${n}`).join('\n')}`);
}

function fmtModel(m) {
  const max = m.maxMode ? ' ⚡MAX' : '';
  const aliases = m.aliases ? ` (${m.aliases.join(', ')})` : '';
  return `   ${m.displayNameShort}${aliases}${max}`;
}

// ─── Commands ─────────────────────────────────────────────

function cmdModels() {
  const data = rpc('agent.v1.AgentService', 'GetUsableModels');
  const models = data.models || [];
  const composers = models.filter(m => m.modelId.includes('composer'));
  const codex = models.filter(m => m.modelId.includes('codex'));
  const claude = models.filter(m => m.modelId.includes('claude'));
  const gpt = models.filter(m => m.modelId.includes('gpt-5') && !m.modelId.includes('codex') && !m.modelId.includes('mini') && !m.modelId.includes('nano'));
  const small = models.filter(m => m.modelId.includes('mini') || m.modelId.includes('nano'));
  const others = models.filter(m => !m.modelId.includes('composer') && !m.modelId.includes('codex') && !m.modelId.includes('claude') && !m.modelId.includes('gpt-5'));

  console.log(`
🐙 Cursor Models (${models.length} total)
${'─'.repeat(50)}

🧠 Composer (Cursor's own):
${composers.map(fmtModel).join('\n')}

🦾 Codex (OpenAI):
${codex.map(fmtModel).join('\n')}

🟣 Claude (Anthropic):
${claude.map(fmtModel).join('\n')}

🟢 GPT-5:
${gpt.map(fmtModel).join('\n')}

🔵 GPT-5 Mini/Nano:
${small.map(fmtModel).join('\n')}

🟡 Others:
${others.map(fmtModel).join('\n')}`);
}

function cmdUsage() {
  formatUsage();
  formatAnalytics();
}

function cmdAccount() {
  const [privacy, bugbot, apikeys, glass] = ['GetUserPrivacyMode','GetBugbotUserSettings','ListUserApiKeys','GetGlassEarlyPreviewEnrollment'].map(
    m => rpc('aiserver.v1.DashboardService', m)
  );
  const statsig = rpc('aiserver.v1.AnalyticsService', 'BootstrapStatsig');
  const user = JSON.parse(statsig.config).user;
  const custom = user.custom;

  console.log(`
🐙 Account Info
${'─'.repeat(50)}

👤 Profile:
   User ID: ${user.userID}
   Email: ${user.email || '(not exposed)'}
   Country: ${user.country}
   IP: ${user.ip}

💳 Billing:
   Plan: ${custom.stripeMembershipStatus} (${custom.stripeProductId})
   Status: ${custom.stripeSubscriptionStatus}
   Customer: ${custom.stripeCustomerID}
   Valid Until: ${custom.stripeMembershipExpiration}
   New Pricing: ${custom.shouldUseNewPricing}

🔒 Privacy:
   Mode: ${privacy.privacyMode}

🔑 API Keys:
${(apikeys.apiKeys || []).map(k => `   [${k.id}] ${k.name}: ${k.maskedKey} (created ${new Date(+k.createdAt).toLocaleDateString()})`).join('\n')}

🤖 BugBot:
   Autofix: ${bugbot.installationDefaultBugbotAutofixMode}
   PR Summary: ${bugbot.installationDefaultIsPrSummaryEnabled}
   Severity: ${(bugbot.installationDefaultBugbotAutofixSeverityFilter || []).join(', ')}

🪟 Glass Preview:
   Access: ${glass.glassAccessGranted}
   Self-Enroll: ${glass.enterpriseGlassSelfEnrollEligible}

🏷️ Segments:
${(custom.userSegments || []).map(s => `   • ${s}`).join('\n')}`);
}

function cmdSkills() {
  const [skills, commands] = ['GetManagedSkills','GetGlobalCommands'].map(
    m => rpc('aiserver.v1.DashboardService', m)
  );
  console.log(`
🐙 Skills & Commands
${'─'.repeat(50)}

📋 Skills (${(skills.skills || []).length}):
${(skills.skills || []).map(s => `   📌 ${s.id}: ${s.description}`).join('\n')}

⚡ Commands (${(commands.commands || []).length}):
${(commands.commands || []).map(c => `   /${c.name}: ${(c.description || '').slice(0, 70)}`).join('\n')}`);
}

function cmdExperiments() {
  const statsig = rpc('aiserver.v1.AnalyticsService', 'BootstrapStatsig');
  const config = JSON.parse(statsig.config);
  const active = Object.entries(config.dynamic_configs || {})
    .filter(([, e]) => e.is_experiment_active);
  const layers = Object.entries(config.layer_configs || {});

  console.log(`
🐙 Active Experiments: ${active.length} | Layer Configs: ${layers.length}
${'─'.repeat(50)}
${active.slice(0, 15).map(([id, e]) => `   ✅ [${id}] ${e.group_name || e.rule_id}: ${JSON.stringify(e.value).slice(0, 80)}`).join('\n')}
${active.length > 15 ? `\n   ... and ${active.length - 15} more` : ''}
`);
}

function cmdRpc(args) {
  const [service, method, ...rest] = args;
  if (!service || !method) {
    console.log(`Usage: ca rpc <service> <method> [json-body]

Services:
  agent.v1.AgentService
  aiserver.v1.DashboardService  
  aiserver.v1.AnalyticsService

Examples:
  ca rpc agent.v1.AgentService GetUsableModels
  ca rpc aiserver.v1.DashboardService GetUserAnalytics '{"days": 7}'
  ca rpc aiserver.v1.DashboardService GetUserPrivacyMode`);
    return;
  }
  let body = {};
  if (rest.length > 0) {
    const raw = rest.join(' ');
    try { body = JSON.parse(raw); } catch { body = { prompt: raw }; }
  }
  const result = rpc(service, method, body);
  console.log(JSON.stringify(result, null, 2));
}

function cmdScan() {
  console.log('🐙 Scanning DashboardService methods...\n');
  const methods = [
    'GetCurrentBillingCycle','GetCurrentPeriodUsage','GetTokenUsage',
    'GetUsageLimitStatusAndActiveGrants','GetUserPrivacyMode','GetHardLimit',
    'GetClientUsageData','GetClientVisibleCreditGrants','GetCreditGrantsBalance',
    'GetUserAnalytics','GetManagedSkills','ListUserApiKeys','GetGlobalCommands',
    'GetGlassEarlyPreviewEnrollment','GetBugbotSettings','GetBugbotUserSettings',
    'GetAvailableMcpServers','GetMcpConfig','GetEffectiveUserPlugins',
    'GetUserProfile','GetTeams','GetMonthlyBillingCycle','GetYearlyUpgradeEligibility',
    'GetTeamUsage','GetTeamSpend','GetTeamMembers','GetTeamRepos',
    'GetTeamHooks','GetTeamRules','GetTeamPluginPopularity',
    'GetUserOrganizations','GetUserAdminOrganizations',
    'GetOrganizationGroups','GetDirectoryGroups','GetGroupMembers',
    'ListTeamApiKeys','ListOrganizationApiKeys','ListInvoices',
    'GetDailySpendByCategory','GetFilteredUsageEvents',
    'GetAuditLogs','ListTeamServiceAccounts',
    'GetBackgroundComposerSlashCommands','ListTeamPluginInstalls',
    'GetTeamPluginPrimitiveUsage','ListMarketplacePlugins',
    'GetLinearSettings','GetJiraProjectSettings','GetJiraRoutingRules',
    'GetSlackRepoRoutingRules','GetGithubInstallations',
    'IsOnNewPricing','IsNextSetupRunFree','GetCliDownloadUrl',
    'GetEnterpriseCTAEligibility','GetFastRequests',
  ];

  let ok = 0, err = 0, empty = 0;
  for (const method of methods) {
    try {
      const resp = rpc('aiserver.v1.DashboardService', method);
      const isErr = resp.error || resp.statusCode;
      const isEmpty = !isErr && JSON.stringify(resp) === '{}';
      if (isErr) { err++; console.log(`  ❌ ${method}: ${resp.message || resp.error}`); }
      else if (isEmpty) { empty++; console.log(`  ⚪ ${method}`); }
      else { ok++; console.log(`  ✅ ${method}`); }
    } catch (e) {
      err++; console.log(`  💥 ${method}: ${e.message.slice(0, 50)}`);
    }
  }
  console.log(`\nResults: ${ok} working, ${empty} empty, ${err} failed`);
}

function cmdExplore() {
  console.log('🐙 Probing hidden endpoints...\n');
  const tests = [
    ['agent.v1.AgentService', 'GetUserApiKeyAccess', { apiKeyName: 'venom' }],
    ['agent.v1.AgentService', 'GetCloudAgentPluginsSnapshot', {}],
    ['agent.v1.AgentService', 'GetMe', {}],
    ['agent.v1.AgentService', 'GetCopyStatus', {}],
    ['aiserver.v1.DashboardService', 'GetFastRequests', {}],
    ['aiserver.v1.DashboardService', 'GetEnterpriseCTAEligibility', {}],
    ['aiserver.v1.DashboardService', 'IsOnNewPricing', {}],
    ['aiserver.v1.DashboardService', 'IsNextSetupRunFree', {}],
    ['aiserver.v1.DashboardService', 'GetCliDownloadUrl', {}],
    ['aiserver.v1.DashboardService', 'GetJoinableTeamsByDomain', {}],
    ['aiserver.v1.DashboardService', 'GetUsageBasedPremiumRequests', {}],
    ['aiserver.v1.DashboardService', 'GetManagedSkills', {}],
  ];
  for (const [svc, method, body] of tests) {
    try {
      const resp = rpc(svc, method, body);
      const isErr = resp.error || resp.statusCode;
      const isEmpty = JSON.stringify(resp) === '{}';
      if (!isErr && !isEmpty) {
        console.log(`✅ ${svc}/${method}`);
        console.log(`   ${JSON.stringify(resp).slice(0, 200)}\n`);
      } else if (isEmpty) {
        console.log(`⚪ ${svc}/${method} (empty)\n`);
      } else {
        console.log(`❌ ${svc}/${method}: ${resp.message || resp.error}\n`);
      }
    } catch (e) {
      console.log(`💥 ${svc}/${method}: ${e.message.slice(0, 60)}\n`);
    }
  }
}

function cmdAsk(prompt, model) {
  model = model || 'composer-2-fast';
  console.log(`🐙 ${model}: "${prompt}"\n`);
  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  }).replace(/'/g, "'\\''");
  
  const token = getToken();
  const result = execSync(
    `curl -s -X POST "${REST}/v1/chat/completions" ` +
    `-H "Authorization: Bearer ${token}" ` +
    `-H "Content-Type: application/json" ` +
    `-H "x-cursor-client-type: sdk" ` +
    `-H "x-ghost-mode: true" ` +
    `-H "x-request-id: ${randomUUID()}" ` +
    `-d '${body}'`,
    { timeout: 60000, encoding: 'utf8' }
  );
  const data = JSON.parse(result);
  const msg = data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
  console.log(msg);
}

function cmdStream(prompt, model) {
  model = model || 'composer-2-fast';
  console.log(`🐙 Streaming ${model}: "${prompt}"\n`);
  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  }).replace(/'/g, "'\\''");
  
  const token = getToken();
  execSync(
    `curl -s -N -X POST "${REST}/v1/chat/completions" ` +
    `-H "Authorization: Bearer ${token}" ` +
    `-H "Content-Type: application/json" ` +
    `-H "x-cursor-client-type: sdk" ` +
    `-H "x-ghost-mode: true" ` +
    `-H "x-request-id: ${randomUUID()}" ` +
    `-d '${body}'`,
    { timeout: 120000, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] }
  );
  console.log();
}

function cmdAgents() {
  try {
    const data = restApi('/v1/agents');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('No cloud agents found (may need usage-based pricing)');
  }
}

function cmdPrivacy(mode) {
  const valid = ['PRIVACY_MODE_USAGE_DATA_TRAINING_ALLOWED', 'PRIVACY_MODE_ALL_DATA_PRIVATE', 'PRIVACY_MODE_ALL_DATA_PRIVATE_AND_NO_TRAINING'];
  if (!mode) {
    const current = rpc('aiserver.v1.DashboardService', 'GetUserPrivacyMode');
    console.log(`Current privacy mode: ${current.privacyMode}`);
    console.log(`\nOptions:`);
    valid.forEach(m => console.log(`   ${m}`));
    return;
  }
  try {
    const result = rpc('aiserver.v1.DashboardService', 'SetUserPrivacyMode', { privacyMode: mode });
    console.log(`✅ Privacy mode set to: ${mode}`);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.log(`❌ Failed: ${e.message}`);
  }
}

// ─── CLI ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const cmd = args[0];

try {
  switch (cmd) {
    case 'models':     cmdModels(); break;
    case 'usage':      cmdUsage(); break;
    case 'account':    cmdAccount(); break;
    case 'skills':     cmdSkills(); break;
    case 'experiments':cmdExperiments(); break;
    case 'rpc':        cmdRpc(args.slice(1)); break;
    case 'scan':       cmdScan(); break;
    case 'explore':    cmdExplore(); break;
    case 'agents':     cmdAgents(); break;
    case 'ask':        cmdAsk(args.slice(1).join(' ')); break;
    case 'stream':     cmdStream(args.slice(1).join(' ')); break;
    case 'privacy':    cmdPrivacy(args[1]); break;
    default:
      console.log(`
🦀 ca2 — Cursor Claw · ConnectRPC (VENOM)

Usage: ca <command> [args]

Commands:
  models        List all available models (100+)
  usage         Show billing usage + analytics (30d)
  account       Full account info (billing, privacy, keys, segments)
  skills        List managed skills + global commands
  experiments   Show active A/B experiments + layer configs
  scan          Scan all DashboardService methods (50+ endpoints)
  explore       Probe hidden/undocumented endpoints
  rpc           Call any ConnectRPC method directly
                ca rpc <service> <method> [json-body]
  agents        List cloud agents (REST)
  ask           Ask any model a question
                ca ask "question" [model]
  stream        Stream response from any model
                ca stream "question" [model]
  privacy       Get/set privacy mode
                ca privacy [MODE]

ConnectRPC Services:
  agent.v1.AgentService          — Agent/Model operations
  aiserver.v1.DashboardService   — Account/Billing/Admin (50+ methods)
  aiserver.v1.AnalyticsService   — Statsig/Feature flags

Quick Examples:
  ca models
  ca usage
  ca account
  ca ask "write a python web server" claude-4.6-opus-high
  ca rpc aiserver.v1.DashboardService GetUserAnalytics '{"days": 7}'
  ca rpc agent.v1.AgentService GetUsableModels
  ca scan
  ca explore
`);
  }
} catch (e) {
  console.error(`❌ Error: ${e.message}`);
  process.exit(1);
}