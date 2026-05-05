#!/usr/bin/env node
/**
 * ca3 — Venom Swarm CLI v4 🐙
 * Multi-agent parallel orchestration via Cursor SDK
 *
 * Usage:
 *   ca3 swarm "<task>" [--workers 3] [--model composer-2] [--plan]
 *   ca3 fork "<spec1>" "<spec2>" ... [--model X]
 *   ca3 resume                   — resume crashed swarm
 *   ca3 plan "<task>"            — preview decomposition plan
 *   ca3 status                   — show active swarm
 *   ca3 kill                     — cancel all running agents
 *   ca3 clean                    — remove all worktrees
 *   ca3 models                   — list available models
 *   ca3 review                   — auto-diff and review
 *   ca3 merge                    — merge analysis
 *   ca3 integrate                — run integrator agent
 */

import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { SwarmOrchestrator, swarm, swarmWithPlan, fork, resumeSwarm } from "./lib/swarm.mjs";
import { decompose } from "./lib/decomposer.mjs";
import { reviewWorktrees, reviewToJSON, mergeAnalysis } from "./lib/reviewer.mjs";
import { integrateResults, applyIntegration } from "./lib/integrator.mjs";
import { loadLedger } from "./lib/ledger.mjs";
import { cleanupOrphanedWorktrees, getRepoRoot } from "./lib/worktrees.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SWARM_STATE = join(REPO_ROOT, ".tmp-cli", "swarm-state.json");
const VERSION = "4.0.0-venom-swarm";

// ─── Colors ────────────────────────────────────────────────

const c = {
  r: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", grn: "\x1b[32m", yel: "\x1b[33m",
  blu: "\x1b[34m", mag: "\x1b[35m", cyn: "\x1b[36m",
};

const log = m => console.log(m);
const ok = m => console.log(`${c.grn}✔${c.r} ${m}`);
const fail = m => { console.error(`${c.red}✖${c.r} ${m}`); process.exit(1); };
const warn = m => console.log(`${c.yel}⚠${c.r} ${m}`);
const swarm_ = m => console.log(`${c.mag}🐙${c.r} ${m}`);
const info = m => console.log(`${c.dim}ℹ${c.r} ${m}`);

// ─── State ─────────────────────────────────────────────────

function loadSwarmState() {
  if (!existsSync(SWARM_STATE)) return null;
  try { return JSON.parse(readFileSync(SWARM_STATE, "utf8")); } catch { return null; }
}

function saveSwarmState(state) {
  mkdirSync(dirname(SWARM_STATE), { recursive: true });
  writeFileSync(SWARM_STATE, JSON.stringify(state, null, 2));
}

function clearSwarmState() {
  if (existsSync(SWARM_STATE)) rmSync(SWARM_STATE);
}

// ─── Commands ──────────────────────────────────────────────

async function cmdSwarm(args) {
  const parsed = parseArgs(args, "swarm");
  const { task, workers, model, usePlan, integrator, forceIntegrator } = parsed;

  if (!task) fail("Usage: ca3 swarm <task description>");

  swarm_(`${c.bold}VENOM SWARM${c.r} v${VERSION}`);

  const repo = getRepoRoot();
  if (!repo) fail("Not in a git repository");

  const orch = new SwarmOrchestrator({
    repo,
    workers,
    model,
    autoCleanup: !parsed.noCleanup,
  });

  orch.on("swarm_start", (e) => {
    info(`Repo: ${e.repo}`);
    info(`Branch: ${e.branch}`);
    info(`Workers: ${e.workers}`);
    info(`Model: ${e.model}`);
    if (usePlan) info(`Mode: ${c.yel}planner${c.r} (leader decomposes task)`);
    else info(`Mode: ${c.cyn}parallel${c.r} (same task, multiple workers)`);
  });

  orch.on("status", (e) => {
    const phase = e.phase.padEnd(10);
    info(`[${phase}] ${e.message}`);
  });

  orch.on("event", (e) => {
    if (e.event.type === "tool_call") {
      const icon = e.event.status === "completed" ? c.grn : e.event.status === "error" ? c.red : c.yel;
      log(`  ${icon}${e.event.status === "completed" ? "✔" : e.event.status === "error" ? "✖" : "⟳"}${c.r} ${e.event.name} [worker ${e.agentIndex + 1}]`);
    }
  });

  saveSwarmState({
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    repo,
    branch: orch.branch,
    workers,
    model: model.id,
    worktrees: [],
    tasks: usePlan ? [] : Array(workers).fill(task),
  });

  try {
    const results = await orch.run(task, {
      usePlan,
      integrator,
      forceIntegrator,
    });

    clearSwarmState();
    printResults(results, orch);
  } catch (err) {
    clearSwarmState();
    orch.cleanup();
    fail(err.message);
  }
}

async function cmdFork(args) {
  const parsed = parseArgs(args, "fork");
  const { specs, model, integrator } = parsed;

  if (!specs || specs.length === 0) fail("Usage: ca3 fork <spec1> <spec2> ...");

  swarm_(`${c.bold}VENOM FORK${c.r} v${VERSION}`);

  const repo = getRepoRoot();
  if (!repo) fail("Not in a git repository");

  const orch = new SwarmOrchestrator({
    repo,
    workers: specs.length,
    model,
    autoCleanup: !parsed.noCleanup,
  });

  orch.on("status", (e) => info(`[${e.phase.padEnd(10)}] ${e.message}`));
  orch.on("event", (e) => {
    if (e.event.type === "tool_call") {
      const icon = e.event.status === "completed" ? c.grn : c.yel;
      log(`  ${icon}${e.event.status === "completed" ? "✔" : "⟳"}${c.r} ${e.event.name} [worker ${e.agentIndex + 1}]`);
    }
  });

  saveSwarmState({
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    repo,
    branch: orch.branch,
    workers: specs.length,
    model: model.id,
    worktrees: [],
    tasks: specs,
  });

  try {
    const results = await orch.run(specs, { integrator });
    clearSwarmState();
    printResults(results, orch);
  } catch (err) {
    clearSwarmState();
    orch.cleanup();
    fail(err.message);
  }
}

async function cmdPlan(args) {
  const task = args.join(" ");
  if (!task) fail("Usage: ca3 plan <task description>");

  swarm_(`${c.bold}VENOM PLAN${c.r} v${VERSION}`);

  const repo = getRepoRoot();
  if (!repo) fail("Not in a git repository");

  info("Leader agent decomposing task...");

  const parsed = parseArgs(args);
  const plan = await decompose(task, {
    repo,
    maxTasks: parsed.workers || 5,
    model: parsed.model,
  });

  log(`\n${c.bold}DECOMPOSITION PLAN${c.r}`);
  info(`Total tasks: ${plan.summary.totalTasks}`);
  info(`Parallelizable: ${plan.summary.parallelizable}`);
  info(`Sequential: ${plan.summary.sequential}`);
  info(`Max dependency depth: ${plan.summary.maxDepth}`);

  log(`\n${c.bold}Tasks:${c.r}`);
  for (let i = 0; i < plan.tasks.length; i++) {
    const t = plan.tasks[i];
    log(`\n${c.cyn}[${i + 1}]${c.r} ${c.bold}${t.description.slice(0, 80)}${c.r}`);
    info(`Scope: ${t.scope.slice(0, 80)}${t.scope.length > 80 ? "..." : ""}`);
    if (t.allowed_paths?.length > 0) info(`Paths: ${t.allowed_paths.join(", ")}`);
    if (t.dependencies?.length > 0) info(`Depends on: ${t.dependencies.map(d => d + 1).join(", ")}`);
    else info(`Dependencies: none (can run in parallel)`);
  }

  // Show parallel execution levels
  log(`\n${c.bold}Execution Order:${c.r}`);
  for (let level = 0; level <= plan.summary.maxDepth; level++) {
    const levelTasks = plan.tasks
      .map((t, i) => ({ task: t, index: i }))
      .filter(({ task }) => {
        const deps = task.dependencies || [];
        if (deps.length === 0) return level === 0;
        return Math.max(...deps.map(d => plan.tasks[d].dependencies?.length || 0)) + 1 === level;
      });

    if (levelTasks.length > 0) {
      log(`  ${c.yel}Level ${level}:${c.r} ${levelTasks.map(t => t.index + 1).join(", ")}`);
    }
  }
}

async function cmdResume(args) {
  const parsed = parseArgs(args);
  const repo = getRepoRoot();
  if (!repo) fail("Not in a git repository");

  swarm_(`${c.bold}VENOM RESUME${c.r} v${VERSION}`);

  try {
    const result = await resumeSwarm({ repo, model: parsed.model });
    ok("Swarm resumed");
    info(JSON.stringify(result.getSummary(), null, 2));
  } catch (err) {
    fail(err.message);
  }
}

function cmdStatus() {
  const state = loadSwarmState();
  const repo = getRepoRoot();
  const ledger = repo ? loadLedger(repo) : null;

  if (!state && !ledger) {
    info("No active swarm.");
    return;
  }

  if (state) {
    const started = new Date(state.startedAt);
    const elapsed = Date.now() - started.getTime();
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    swarm_(`${c.bold}Active Swarm${c.r}`);
    info(`ID: ${state.id}`);
    info(`Started: ${started.toLocaleTimeString()} (${minutes}m ${seconds}s ago)`);
    info(`Repo: ${state.repo}`);
    info(`Branch: ${state.branch}`);
    info(`Workers: ${state.workers}`);
    info(`Model: ${state.model}`);
  }

  if (ledger && ledger.state.status === "running") {
    log(`\n${c.bold}Ledger State:${c.r}`);
    const summary = ledger.getSummary();
    info(`Task: ${summary.task}`);
    info(`Status: ${summary.status}`);
    info(`Queued: ${summary.queued} | Running: ${summary.running} | Done: ${summary.done} | Failed: ${summary.failed}`);
  }
}

function cmdKill() {
  const state = loadSwarmState();
  if (!state) { info("No active swarm to kill."); return; }
  swarm_(`Killing swarm ${state.id}...`);
  clearSwarmState();
  ok("Swarm state cleared (run 'ca3 clean' to remove worktrees)");
}

function cmdClean() {
  const repo = getRepoRoot();
  if (!repo) { info("Not in a git repository"); return; }

  swarm_("Cleaning all swarm worktrees...");
  const cleaned = cleanupOrphanedWorktrees(repo);
  clearSwarmState();

  if (cleaned.length === 0) ok("No worktrees to clean");
  else ok(`Removed ${cleaned.length} worktrees`);
}

async function cmdModels() {
  swarm_("Fetching available models...");

  const known = [
    { id: "composer-2", name: "Composer 2 (fast=true)", default: true },
    { id: "composer-2", name: "Composer 2 (fast=false)", params: [{ id: "fast", value: "false" }] },
    { id: "claude-opus-4-7", name: "Claude Opus 4.7" },
    { id: "claude-sonnet-4-0", name: "Claude Sonnet 4.0" },
    { id: "gpt-5-high", name: "GPT-5 High" },
    { id: "gpt-5", name: "GPT-5" },
    { id: "gpt-5-mini", name: "GPT-5 Mini" },
    { id: "gpt-5-nano", name: "GPT-5 Nano" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  ];

  log(`\n${c.bold}Available Models:${c.r}`);
  for (const m of known) {
    const icon = m.default ? c.grn : c.blu;
    log(`  ${icon}●${c.r} ${c.bold}${m.id}${c.r} ${c.dim}${m.name}${c.r}`);
  }
}

function cmdReview() {
  const state = loadSwarmState();
  const repo = getRepoRoot();

  const worktrees = state?.worktrees || [];
  if (worktrees.length === 0) fail("No active swarm worktrees found");

  printReview(worktrees);
}

function cmdMerge() {
  const state = loadSwarmState();
  const repo = getRepoRoot();

  const worktrees = state?.worktrees || [];
  if (worktrees.length === 0) fail("No active swarm worktrees found");

  const analysis = mergeAnalysis(worktrees);

  if (analysis.canAutoMerge) ok("All worktrees can be auto-merged (no conflicts)");
  else {
    warn(`${analysis.conflictCount} conflicts detected`);
    for (const c of analysis.conflicts) {
      log(`  ${c.red}●${c.r} ${c.file}`);
    }
  }

  log(`\n${c.bold}Merge order:${c.r}`);
  for (const p of analysis.mergeOrder) log(`  ${c.grn}●${c.r} ${basename(p)}`);

  if (analysis.needsManualMerge.length > 0) {
    log(`\n${c.bold}${c.red}Needs manual merge:${c.r}`);
    for (const p of analysis.needsManualMerge) log(`  ${c.red}●${c.r} ${basename(p)}`);
  }
}

async function cmdIntegrate(args) {
  const state = loadSwarmState();
  const repo = getRepoRoot();
  const parsed = parseArgs(args);

  const worktrees = state?.worktrees || [];
  if (worktrees.length === 0) fail("No active swarm worktrees found");

  swarm_(`${c.bold}VENOM INTEGRATE${c.r} v${VERSION}`);

  const result = await integrateResults({
    repo,
    worktrees: worktrees.map(p => ({ path: p })),
    tasks: state?.tasks || [],
    model: parsed.model || { id: "claude-opus-4-7" },
    taskDescription: "swarm integration",
    forceIntegrator: true,
  });

  if (result.success) {
    ok("Integration complete");
    info(`Integration worktree: ${result.integrationPath}`);
  } else {
    fail(`Integration failed: ${result.error}`);
  }
}

// ─── Output ────────────────────────────────────────────────

function printResults(results, orch) {
  const summary = orch.getSummary();

  log(`\n${c.bold}━${"─".repeat(50)}${c.r}`);
  swarm_(`${c.bold}SWARM COMPLETE${c.r}`);
  log(`${c.bold}━${"─".repeat(50)}${c.r}`);

  log(`\n${c.grn}✔ Success: ${summary.success}${c.r} | ${c.red}✖ Failed: ${summary.failed}${c.r}`);
  info(`Duration: ${summary.duration ? (summary.duration / 1000).toFixed(1) + "s" : "unknown"}`);
  info(`Total files changed: ${summary.totalChanges}`);

  for (const r of results) {
    if (r.success) {
      log(`\n${c.grn}✔${c.r} ${c.bold}${r.name}${c.r} [${r.worktree.id}]`);
      info(`Status: ${r.result.status}`);
      info(`Duration: ${r.result.durationMs ? (r.result.durationMs / 1000).toFixed(1) + "s" : "unknown"}`);
      info(`Files changed: ${r.changedFiles?.length || 0}`);
      if (r.changedFiles?.length) {
        for (const f of r.changedFiles.slice(0, 10)) log(`  ${c.cyn}●${c.r} ${f}`);
        if (r.changedFiles.length > 10) info(`  ... and ${r.changedFiles.length - 10} more`);
      }
    } else {
      log(`\n${c.red}✖${c.r} ${c.bold}${r.name || `Worker ${r.index + 1}`}${c.r}`);
      fail(`Error: ${r.error}`);
    }
  }

  if (summary.integration) {
    log(`\n${c.bold}Integration:${c.r}`);
    if (summary.integration.success) ok("Integration successful");
    else fail(`Integration failed: ${summary.integration.error}`);
  }
}

async function printReview(worktreePaths) {
  const review = await reviewWorktrees(worktreePaths);

  for (const r of review.reviews) {
    log(`\n${c.bold}${c.cyn}[${r.index + 1}]${c.r} ${c.bold}${basename(r.path)}${c.r}`);
    info(`Stats: ${r.stats.files} files, +${r.stats.insertions} -${r.stats.deletions}`);

    if (r.changedFiles.length > 0) {
      log(`\n${c.bold}Changed:${c.r}`);
      for (const f of r.changedFiles) log(`  ${c.blu}M${c.r} ${f}`);
    }
    if (r.newFiles.length > 0) {
      log(`\n${c.bold}New:${c.r}`);
      for (const f of r.newFiles) log(`  ${c.grn}A${c.r} ${f}`);
    }
    if (r.deletedFiles.length > 0) {
      log(`\n${c.bold}Deleted:${c.r}`);
      for (const f of r.deletedFiles) log(`  ${c.red}D${c.r} ${f}`);
    }

    if (r.diff) {
      const lines = r.diff.split("\n").slice(0, 30);
      log(`\n${c.dim}${lines.join("\n")}${r.diff.split("\n").length > 30 ? "\n  ... (truncated)" : ""}${c.r}`);
    }
  }

  if (review.conflicts.length > 0) {
    log(`\n${c.bold}${c.red}CONFLICTS (${review.conflicts.length})${c.r}`);
    for (const c of review.conflicts) log(`  ${c.red}●${c.r} ${c.file}`);
  } else {
    log(`\n${c.grn}✔ No conflicts detected${c.r}`);
  }
}

// ─── Helpers ───────────────────────────────────────────────

function parseArgs(args, command = "") {
  const result = {
    task: null,
    specs: [],
    workers: 3,
    model: { id: "composer-2", params: [] },
    usePlan: false,
    integrator: false,
    forceIntegrator: false,
    noCleanup: false,
  };

  // First pass: extract flags
  const remaining = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--workers" && args[i + 1]) {
      result.workers = Math.min(5, Math.max(1, parseInt(args[++i], 10) || 3));
    } else if (args[i] === "--model" && args[i + 1]) {
      const modelStr = args[++i];
      const [id, paramsStr] = modelStr.split(":");
      result.model = { id, params: [] };
      if (paramsStr) {
        result.model.params = paramsStr.split(",").map(pair => {
          const [k, v] = pair.split("=");
          return { id: k, value: v };
        });
      }
    } else if (args[i] === "--plan") {
      result.usePlan = true;
    } else if (args[i] === "--integrator") {
      result.integrator = true;
    } else if (args[i] === "--force-integrator") {
      result.forceIntegrator = true;
    } else if (args[i] === "--no-cleanup") {
      result.noCleanup = true;
    } else {
      remaining.push(args[i]);
    }
  }

  // Second pass: extract task/specs from remaining
  if (command === "fork") {
    result.specs = remaining;
  } else if (remaining.length > 0) {
    result.task = remaining.join(" ");
  }

  return result;
}

// ─── Help ──────────────────────────────────────────────────

function help() {
  log(`
${c.mag}🐙 VENOM SWARM${c.r} ${c.dim}v${VERSION}${c.r}

${c.bold}Commands:${c.r}
  ${c.cyn}swarm${c.r} <task> [--plan] [--workers N] [--model X]
    Run parallel agents. With --plan, leader decomposes task first

  ${c.cyn}fork${c.r} <spec1> <spec2> ... [--model X]
    Run each spec on a separate agent in parallel

  ${c.cyn}plan${c.r} <task>
    Preview decomposition plan without executing

  ${c.cyn}resume${c.r}
    Resume a crashed swarm from ledger

  ${c.cyn}review${c.r}
    Auto-diff and review of all agent outputs

  ${c.cyn}merge${c.r}
    Show merge analysis and conflict detection

  ${c.cyn}integrate${c.r}
    Run integrator agent to merge results

  ${c.cyn}models${c.r}
    List available models

  ${c.cyn}status${c.r}
    Show active swarm state

  ${c.cyn}kill${c.r}
    Kill active swarm (clears state)

  ${c.cyn}clean${c.r}
    Remove all swarm worktrees

${c.bold}Flags:${c.r}
  ${c.cyn}--plan${c.r}              Use leader agent to decompose task
  ${c.cyn}--workers${c.r} N         Number of parallel agents (1-5, default: 3)
  ${c.cyn}--model${c.r} <id>        Model override (default: composer-2)
  ${c.cyn}--integrator${c.r}        Run integrator after swarm
  ${c.cyn}--no-cleanup${c.r}        Don't clean up worktrees after swarm

${c.dim}Examples:${c.r}
  ${c.dim}ca3 swarm "build a blog with auth" --plan --workers 3${c.r}
  ${c.dim}ca3 plan "build a blog with auth"${c.r}
  ${c.dim}ca3 fork "add auth" "create payments" "build dashboard"${c.r}
  ${c.dim}ca3 swarm "refactor database" --workers 2 --model claude-sonnet-4.0${c.r}
  ${c.dim}ca3 swarm "fix bugs" --integrator${c.r}
  ${c.dim}ca3 resume${c.r}
  ${c.dim}ca3 review${c.r}
  ${c.dim}ca3 integrate${c.r}
  ${c.dim}ca3 clean${c.r}
`);
}

// ─── Main ──────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);

  if (argv[0] === "--version" || argv[0] === "-v") {
    log(`ca3 v${VERSION}`);
    process.exit(0);
  }

  const cmd = argv[0] || "help";
  const args = argv.slice(1);

  const cmds = {
    swarm: () => cmdSwarm(args),
    fork: () => cmdFork(args),
    plan: () => cmdPlan(args),
    resume: () => cmdResume(args),
    status: cmdStatus,
    kill: cmdKill,
    clean: cmdClean,
    models: cmdModels,
    review: cmdReview,
    merge: cmdMerge,
    integrate: () => cmdIntegrate(args),
    help,
  };

  const fn = cmds[cmd];
  if (!fn) fail(`Unknown: ${cmd}\nRun 'ca3 help' for commands`);

  const result = fn();
  if (result && typeof result.catch === "function") {
    result.catch(err => fail(err.message));
  }
}

main();
