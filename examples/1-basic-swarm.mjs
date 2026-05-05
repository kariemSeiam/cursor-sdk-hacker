#!/usr/bin/env node
/**
 * Example 1 — Basic parallel swarm (same task, N workers)
 *
 * Demonstrates:
 * - SwarmOrchestrator: multiple Cursor agents in isolated git worktrees
 * - Same natural-language task dispatched to each worker (exploration / redundancy)
 * - Event hooks: swarm_start, status, per-worker tool_call streaming, swarm_end
 *
 * Prerequisites:
 * - Run from inside a git repository (any branch)
 * - CURSOR_API_KEY in the environment, or a key file at ~/.cursor-api-key
 *   (see src/lib/swarm.mjs getKey())
 *
 * Usage (from repository root):
 *   node examples/1-basic-swarm.mjs
 *   node examples/1-basic-swarm.mjs --workers 2
 *
 * The task below is intentionally tiny so the example finishes quickly; replace it
 * with a real coding task for your repo.
 */

import { SwarmOrchestrator } from "../src/lib/swarm.mjs";
import { getRepoRoot } from "../src/lib/worktrees.mjs";

function parseWorkers(argv) {
  const i = argv.indexOf("--workers");
  if (i !== -1 && argv[i + 1]) {
    const n = Math.min(5, Math.max(1, parseInt(argv[i + 1], 10) || 3));
    return n;
  }
  return 3;
}

async function main() {
  const repo = getRepoRoot();
  if (!repo) {
    console.error("Error: not inside a git repository (git rev-parse failed).");
    process.exit(1);
  }

  const workers = parseWorkers(process.argv.slice(2));

  const task =
    "You are in an examples run. Do not modify project files. Reply in your final " +
    "summary with exactly one line: WORKER_DONE";

  const orch = new SwarmOrchestrator({
    repo,
    workers,
    autoCleanup: true,
  });

  orch.on("swarm_start", (e) => {
    console.log("\n[swarm_start]", {
      repo: e.repo,
      branch: e.branch,
      workers: e.workers,
      parallelTasks: e.tasks,
      model: e.model,
    });
  });

  orch.on("status", (e) => {
    console.log(`[status] ${e.phase}: ${e.message}`);
  });

  orch.on("event", (e) => {
    if (e.event?.type === "tool_call") {
      console.log(
        `  tool_call worker-${e.agentIndex + 1}: ${e.event.name} (${e.event.status})`
      );
    }
  });

  orch.on("swarm_end", (e) => {
    console.log("\n[swarm_end]", {
      durationMs: e.duration,
      total: e.total,
      success: e.success,
      failed: e.failed,
    });
  });

  console.log(`Starting basic swarm: ${workers} workers, repo=${repo}`);
  const results = await orch.run(task);

  const summary = orch.getSummary();
  console.log("\nFinal summary:", {
    success: summary.success,
    failed: summary.failed,
    durationMs: summary.duration,
  });

  for (const r of results) {
    const line = r.success
      ? `${r.name}: OK — ${r.result?.summary ?? "(no summary)"}`
      : `${r.name}: FAIL — ${r.error}`;
    console.log(" ", line);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
