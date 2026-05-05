#!/usr/bin/env node
/**
 * Example 3 — Plan-driven swarm (leader decomposes, then workers execute)
 *
 * Demonstrates:
 * - swarmWithPlan(task, options) → passes usePlan: true into SwarmOrchestrator.run()
 * - Leader agent (decomposer.mjs) breaks one goal into subtasks with scopes and allowed_paths
 * - Workers receive structured specs from generateWorkerSpec(), not the raw user sentence
 *
 * Prerequisites:
 * - Git repo
 * - CURSOR_API_KEY required for decompose() (see decomposer.mjs — no keyfile fallback)
 *
 * Usage:
 *   node examples/3-plan-decompose.mjs
 *   node examples/3-plan-decompose.mjs --workers 3
 *
 * Note: planning adds one leader agent round-trip before workers start.
 */

import { swarmWithPlan } from "../src/lib/swarm.mjs";
import { getRepoRoot } from "../src/lib/worktrees.mjs";

function parseWorkers(argv) {
  const i = argv.indexOf("--workers");
  if (i !== -1 && argv[i + 1]) {
    return Math.min(5, Math.max(1, parseInt(argv[i + 1], 10) || 3));
  }
  return 3;
}

async function main() {
  if (!process.env.CURSOR_API_KEY) {
    console.error(
      "Error: CURSOR_API_KEY must be set for plan decomposition (leader agent)."
    );
    process.exit(1);
  }

  const repo = getRepoRoot();
  if (!repo) {
    console.error("Error: not inside a git repository.");
    process.exit(1);
  }

  const workers = parseWorkers(process.argv.slice(2));

  const goal =
    "Examples-only exercise: propose three tiny documentation tweaks for README-style files " +
    "(do not apply edits unless trivial); keep changes minimal and avoid unrelated refactors.";

  console.log(`Planning + swarm with up to ${workers} parallel worker slots…`);

  const results = await swarmWithPlan(goal, {
    repo,
    workers,
    autoCleanup: true,
  });

  console.log("\nWorker outcomes:");
  for (const r of results) {
    console.log(
      `  ${r.name}: ${r.success ? "ok" : "fail"}${r.error ? ` (${r.error})` : ""}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
