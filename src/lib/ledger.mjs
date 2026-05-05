/**
 * lib/ledger.mjs — Persistent task state for crash recovery
 *
 * Usage:
 *   import { Ledger, loadLedger, saveLedger } from "./lib/ledger.mjs";
 *
 *   const ledger = new Ledger("/path/to/repo");
 *   ledger.createSwarm("build a blog", tasks);
 *   ledger.markTaskRunning(0, "agent-id-123");
 *   ledger.markTaskDone(0, { status: "finished", files: [...] });
 *   ledger.save();
 *
 *   // After crash:
 *   const recovered = loadLedger("/path/to/repo");
 *   // Resume from where it left off
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const LEDGER_DIR = ".venom-swarm";
const LEDGER_FILE = "ledger.json";

export class Ledger {
  constructor(repoPath) {
    this.repoPath = repoPath;
    this.dir = join(repoPath, LEDGER_DIR);
    this.file = join(this.dir, LEDGER_FILE);
    this.state = this._fresh();
  }

  _fresh() {
    return {
      version: 1,
      id: randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      repo: this.repoPath,
      task: null,
      tasks: [],
      worktrees: {},
      status: "idle",
    };
  }

  createSwarm(taskDescription, taskSpecs, options = {}) {
    this.state = {
      ...this._fresh(),
      task: taskDescription,
      tasks: taskSpecs.map((spec, i) => ({
        index: i,
        description: spec.description,
        scope: spec.scope,
        allowed_paths: spec.allowed_paths || [],
        dependencies: spec.dependencies || [],
        status: spec.dependencies.length === 0 ? "queued" : "blocked",
        attempts: 0,
        startedAt: null,
        finishedAt: null,
        agentId: null,
        runId: null,
        worktreePath: null,
        error: null,
        result: null,
      })),
      worktrees: options.worktrees || {},
      status: "running",
      options: {
        model: options.model,
        maxRetries: options.maxRetries || 3,
        integrator: options.integrator || false,
      },
    };
    return this.state.id;
  }

  markTaskRunning(taskIndex, agentId, runId, worktreePath) {
    const task = this.state.tasks[taskIndex];
    if (!task) return;

    task.status = "running";
    task.agentId = agentId;
    task.runId = runId;
    task.worktreePath = worktreePath;
    task.startedAt = Date.now();
    task.attempts++;

    // Unblock dependent tasks
    this._updateBlockedTasks();
  }

  markTaskDone(taskIndex, result) {
    const task = this.state.tasks[taskIndex];
    if (!task) return;

    task.status = result.success ? "done" : "failed";
    task.finishedAt = Date.now();
    task.result = result;

    if (!result.success) {
      task.error = result.error;
    }

    this._updateBlockedTasks();
  }

  markTaskCancelled(taskIndex) {
    const task = this.state.tasks[taskIndex];
    if (!task) return;

    task.status = "cancelled";
    task.finishedAt = Date.now();
    this._updateBlockedTasks();
  }

  _updateBlockedTasks() {
    for (const task of this.state.tasks) {
      if (task.status !== "blocked") continue;

      const allDepsDone = task.dependencies.every(depIndex => {
        const dep = this.state.tasks[depIndex];
        return dep && (dep.status === "done" || dep.status === "cancelled");
      });

      if (allDepsDone) {
        task.status = "queued";
      }
    }
  }

  getQueuedTasks() {
    return this.state.tasks.filter(t => t.status === "queued");
  }

  getRunningTasks() {
    return this.state.tasks.filter(t => t.status === "running");
  }

  getFailedTasks() {
    return this.state.tasks.filter(t => t.status === "failed");
  }

  getDoneTasks() {
    return this.state.tasks.filter(t => t.status === "done");
  }

  isComplete() {
    return this.state.tasks.every(t =>
      t.status === "done" || t.status === "failed" || t.status === "cancelled"
    );
  }

  getSummary() {
    const tasks = this.state.tasks;
    return {
      id: this.state.id,
      task: this.state.task,
      status: this.state.status,
      total: tasks.length,
      queued: tasks.filter(t => t.status === "queued").length,
      running: tasks.filter(t => t.status === "running").length,
      done: tasks.filter(t => t.status === "done").length,
      failed: tasks.filter(t => t.status === "failed").length,
      blocked: tasks.filter(t => t.status === "blocked").length,
      cancelled: tasks.filter(t => t.status === "cancelled").length,
      duration: this.state.finishedAt
        ? this.state.finishedAt - this.state.createdAt
        : Date.now() - this.state.createdAt,
    };
  }

  save() {
    this.state.updatedAt = Date.now();
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.state, null, 2));
  }

  load() {
    if (!existsSync(this.file)) return false;
    try {
      this.state = JSON.parse(readFileSync(this.file, "utf8"));
      return true;
    } catch {
      return false;
    }
  }

  delete() {
    if (existsSync(this.dir)) {
      rmSync(this.dir, { recursive: true, force: true });
    }
  }

  toJSON() {
    return this.state;
  }
}

export function loadLedger(repoPath) {
  const ledger = new Ledger(repoPath);
  if (ledger.load()) return ledger;
  return null;
}

export function findActiveLedgers(baseDir = process.cwd()) {
  const { execSync } = require("child_process");
  const { readdirSync } = require("fs");
  const { join } = require("path");

  try {
    const repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
    const ledgerPath = join(repoRoot, LEDGER_DIR, LEDGER_FILE);

    if (existsSync(ledgerPath)) {
      const ledger = new Ledger(repoRoot);
      ledger.load();
      if (ledger.state.status === "running") {
        return [ledger];
      }
    }
  } catch {}

  return [];
}
