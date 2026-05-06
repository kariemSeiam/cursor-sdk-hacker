#!/usr/bin/env node
/**
 * lib/swarm.mjs — Core orchestration engine v4
 *
 * Features:
 * - Leader agent decomposes tasks into subtasks
 * - Persistent ledger for crash recovery
 * - Two-tier execution: workers + integrator
 * - Smart retry with rate limit awareness
 * - Git worktree isolation per worker
 *
 * Usage:
 *   import { SwarmOrchestrator } from "./lib/swarm.mjs";
 *
 *   // Simple: same task, N workers
 *   const results = await swarm("refactor auth module", {
 *     workers: 3,
 *     repo: "/path/to/repo",
 *   });
 *
 *   // With decomposer: leader breaks task into subtasks
 *   const results = await swarmWithPlan("build a blog with auth and payments", {
 *     workers: 3,
 *     repo: "/path/to/repo",
 *   });
 *
 *   // Resume from crash
 *   const results = await swarmResume({
 *     repo: "/path/to/repo",
 *   });
 */

import { Agent, CursorSdkError } from "@cursor/sdk";
import { withRetry, batchWithStagger } from "./rate-limiter.mjs";
import {
  createWorktrees,
  removeAllWorktrees,
  getRepoRoot,
  getCurrentBranch,
  getChangedFiles,
  getWorktreeDiff,
  getDiffStats,
  cleanupOrphanedWorktrees,
} from "./worktrees.mjs";
import { decompose, generateWorkerSpec } from "./decomposer.mjs";
import { Ledger, loadLedger } from "./ledger.mjs";
import { integrateResults } from "./integrator.mjs";

const DEFAULT_MODEL = { id: "composer-2", params: [] };
const LEADER_MODEL = { id: "composer-2", params: [] };
const INTEGRATOR_MODEL = { id: "composer-2", params: [] };
const DEFAULT_WORKERS = 3;
const MAX_WORKERS = 5;
const BATCH_STAGGER = 2000;

function getKey() {
  if (process.env.CURSOR_API_KEY) return process.env.CURSOR_API_KEY;
  const keyfile = process.env.CURSOR_KEY_FILE || (process.env.HOME || "/home/pigo") + "/.cursor-api-key";
  try {
    return require("fs").readFileSync(keyfile, "utf8").trim();
  } catch {
    throw new Error("No API key — set CURSOR_API_KEY or save your subscriber key to ~/.cursor-api-key");
  }
}

// ─── Agent Runner ──────────────────────────────────────────

async function runAgent(worktree, task, model, index, total, onEvent) {
  const apiKey = getKey();
  const agentName = `worker-${index + 1}/${total}`;

  let agent;
  try {
    agent = await withRetry(
      () => Agent.create({
        apiKey,
        name: agentName,
        model: { id: model.id, params: model.params || [] },
        local: { cwd: worktree.path },
      }),
      { label: `create agent ${agentName}` }
    );

    const run = await agent.send(task);

    const events = [];
    const toolCalls = [];

    for await (const event of run.stream()) {
      events.push(event);

      if (event.type === "tool_call") {
        toolCalls.push({ name: event.name, status: event.status });
      }

      if (onEvent) {
        onEvent({
          type: "agent_event",
          agentIndex: index,
          agentName,
          event,
        });
      }
    }

    const result = await run.wait();
    const changedFiles = getChangedFiles(worktree.path);
    const stats = getDiffStats(worktree.path);

    return {
      index,
      name: agentName,
      worktree: { id: worktree.id, path: worktree.path, branch: worktree.branch },
      task,
      model: model.id,
      result: {
        id: result.id,
        status: result.status,
        summary: result.result,
        durationMs: result.durationMs,
      },
      stats,
      changedFiles,
      toolCalls: toolCalls.length,
      success: result.status === "finished",
    };
  } catch (err) {
    return {
      index,
      name: agentName,
      worktree: { id: worktree.id, path: worktree.path, branch: worktree.branch },
      task,
      model: model.id,
      error: err.message,
      errorCode: err.code,
      isRetryable: err.isRetryable,
      success: false,
    };
  } finally {
    if (agent) {
      try { await agent[Symbol.asyncDispose](); } catch {}
    }
  }
}

// ─── Swarm Orchestrator ────────────────────────────────────

export class SwarmOrchestrator {
  constructor(options = {}) {
    this.repo = options.repo || getRepoRoot();
    this.branch = options.branch || getCurrentBranch(this.repo);
    this.model = options.model || DEFAULT_MODEL;
    this.workers = Math.min(MAX_WORKERS, Math.max(1, options.workers || DEFAULT_WORKERS));
    this.concurrency = options.concurrency || this.workers;
    this.autoCleanup = options.autoCleanup !== false;
    this.ledger = new Ledger(this.repo);
    this.listeners = new Map();
    this.worktrees = [];
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event) || [];
    for (const h of handlers) {
      try { h(data); } catch {}
    }
  }

  async run(taskOrSpecs, options = {}) {
    this.startTime = Date.now();
    this.results = [];

    // Determine if we're using a plan or simple mode
    let tasks;
    if (typeof taskOrSpecs === "string") {
      if (options.usePlan) {
        // Decompose the task with a leader agent
        this.emit("status", { phase: "plan", message: "Leader agent decomposing task..." });
        const plan = await decompose(taskOrSpecs, {
          repo: this.repo,
          maxTasks: this.workers,
          model: options.leaderModel || LEADER_MODEL,
          repoStructure: options.repoStructure,
        });

        this.emit("status", { phase: "plan", message: `Plan created: ${plan.summary.totalTasks} tasks` });
        tasks = plan.tasks.map((t, i) => generateWorkerSpec(t, i, plan.tasks, this.repo));
      } else {
        tasks = Array(this.workers).fill(taskOrSpecs);
      }
    } else {
      tasks = taskOrSpecs;
    }

    const count = tasks.length;
    const workers = Math.min(this.workers, count);

    this.emit("swarm_start", {
      repo: this.repo,
      branch: this.branch,
      workers,
      tasks: count,
      model: this.model.id,
    });

    // Create ledger
    const isPlan = typeof taskOrSpecs === "string" && options.usePlan;
    const taskSpecsForLedger = isPlan
      ? []
      : tasks.map((t, i) => ({
          description: typeof t === "string" ? t : t.description || `Task ${i + 1}`,
          scope: typeof t === "string" ? t : t.scope || "",
          allowed_paths: t.allowed_paths || [],
          dependencies: t.dependencies || [],
        }));

    const swarmId = this.ledger.createSwarm(
      typeof taskOrSpecs === "string" ? taskOrSpecs : "fork",
      taskSpecsForLedger,
      { model: this.model.id }
    );
    this.ledger.save();

    this.emit("status", { phase: "worktrees", message: `Creating ${count} worktrees...` });
    this.worktrees = createWorktrees(this.repo, this.branch, count);
    this.emit("status", { phase: "worktrees", message: `Created ${count} worktrees` });

    // Update ledger with worktrees
    this.worktrees.forEach((wt, i) => {
      this.ledger.state.tasks[i] = {
        ...this.ledger.state.tasks[i],
        worktreePath: wt.path,
      };
    });
    this.ledger.save();

    this.emit("status", { phase: "dispatch", message: `Dispatching ${count} agents...` });

    const results = await batchWithStagger(
      this.worktrees.map((wt, i) => ({ ...wt, task: tasks[i] })),
      ({ task: taskObj, ...wt }, i) => {
        const taskText = typeof taskObj === "string" ? taskObj : taskObj.description || taskObj.scope || JSON.stringify(taskObj);
        return runAgent(wt, taskText, this.model, i, count, (e) => this.emit("event", e));
      },
      { concurrency: this.concurrency, staggerMs: BATCH_STAGGER }
    );

    // Update ledger with results
    results.forEach((r, i) => {
      this.ledger.markTaskDone(i, r);
    });
    this.ledger.save();

    this.results = results;
    this.endTime = Date.now();

    const duration = this.endTime - this.startTime;
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    this.emit("swarm_end", {
      duration,
      total: count,
      success,
      failed,
      results,
    });

    // Run integrator if enabled
    if (options.integrator && success > 1) {
      this.emit("status", { phase: "integrate", message: "Running integrator agent..." });
      const integrationResult = await integrateResults({
        repo: this.repo,
        worktrees: this.worktrees,
        tasks: tasks,
        model: options.integratorModel || INTEGRATOR_MODEL,
        taskDescription: typeof taskOrSpecs === "string" ? taskOrSpecs : "fork",
        forceIntegrator: options.forceIntegrator,
      });

      this.emit("status", { phase: "integrate", message: `Integration ${integrationResult.success ? "complete" : "failed"}` });
      this.integrationResult = integrationResult;
    }

    if (this.autoCleanup) {
      this.emit("status", { phase: "cleanup", message: "Cleaning up worktrees..." });
      this.cleanup();
    }

    return results;
  }

  cleanup() {
    if (this.worktrees.length > 0) {
      removeAllWorktrees(this.repo, this.worktrees.map(w => w.path));
      this.worktrees = [];
    }
  }

  cleanupOrphans() {
    return cleanupOrphanedWorktrees(this.repo);
  }

  getSummary() {
    const success = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const totalChanges = success.reduce((sum, r) => sum + (r.changedFiles?.length || 0), 0);

    return {
      duration: this.endTime ? this.endTime - this.startTime : null,
      total: this.results.length,
      success: success.length,
      failed: failed.length,
      totalChanges,
      results: this.results,
      integration: this.integrationResult,
    };
  }
}

// ─── Convenience Functions ─────────────────────────────────

export async function swarm(task, options = {}) {
  const orch = new SwarmOrchestrator(options);
  return orch.run(task, options);
}

export async function swarmWithPlan(task, options = {}) {
  return swarm(task, { ...options, usePlan: true });
}

export async function fork(tasks, options = {}) {
  const orch = new SwarmOrchestrator({ ...options, workers: tasks.length });
  return orch.run(tasks);
}

export async function resumeSwarm(options = {}) {
  const repo = options.repo || getRepoRoot();
  const ledger = loadLedger(repo);

  if (!ledger) {
    throw new Error("No active swarm to resume");
  }

  const orch = new SwarmOrchestrator({
    repo,
    model: options.model || DEFAULT_MODEL,
    autoCleanup: false,
  });

  // Restore state from ledger
  orch.worktrees = ledger.state.tasks
    .filter(t => t.worktreePath)
    .map(t => ({ path: t.worktreePath, id: `resumed-${t.index}`, branch: orch.branch }));

  // Resume failed/queued tasks
  const failedTasks = ledger.getFailedTasks();
  const queuedTasks = ledger.getQueuedTasks();

  for (const task of [...queuedTasks, ...failedTasks]) {
    // TODO: Actually resume the task
  }

  return ledger;
}

// Module exports: SwarmOrchestrator, swarm, swarmWithPlan, fork, resumeSwarm
