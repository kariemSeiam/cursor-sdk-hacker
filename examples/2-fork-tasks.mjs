#!/usr/bin/env node
/**
 * Example 2 — Fork: different tasks per worker
 *
 * Demonstrates:
 * - fork(tasks[], options) from src/lib/swarm.mjs
 * - One agent per task string/object; worker count follows tasks.length (capped by MAX_WORKERS in swarm)
 * - Ledger stores mode as task description "fork" when an array is passed to run()
 *
 * Unlike the basic swarm (same prompt N times), each worker receives a distinct instruction.
 * Use this when work splits naturally (e.g. backend vs frontend vs docs).
 *
 * Prerequisites:
 * - Git repo root
 * - CURSOR_API_KEY or ~/.cursor-api-key
 *
 * Usage:
 *   node examples/2-fork-tasks.mjs
 */

import { fork } from "../src/lib/swarm.mjs";
import { getRepoRoot } from "../src/lib/worktrees.mjs";

async function main() {
  const repo = getRepoRoot();
  if (!repo) {
    console.error("Error: not inside a git repository.");
    process.exit(1);
  }

  const specs = [
    "Examples run: do not edit files. Final summary one line: FORK_A",
    "Examples run: do not edit files. Final summary one line: FORK_B",
    "Examples run: do not edit files. Final summary one line: FORK_C",
  ];

  console.log(`Forking ${specs.length} tasks in ${repo}`);

  const results = await fork(specs, {
    repo,
    autoCleanup: true,
  });

  console.log("\nPer-worker results:");
  results.forEach((r, i) => {
    console.log(`  [${i}] ${r.name}: ${r.success ? "success" : "failed"}`);
    if (r.success && r.result?.summary) {
      console.log(`      summary: ${String(r.result.summary).slice(0, 120)}`);
    }
    if (!r.success) console.log(`      error: ${r.error}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
