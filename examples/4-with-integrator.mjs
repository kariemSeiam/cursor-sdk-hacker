#!/usr/bin/env node
/**
 * Example 4 — Two-tier execution with the integrator agent
 *
 * Demonstrates:
 * - options.integrator + options.forceIntegrator on SwarmOrchestrator.run()
 * - After multiple workers succeed, integrateResults() (integrator.mjs) creates a merge workspace
 *   and optionally runs an “integrator” Cursor agent (needs CURSOR_API_KEY on process.env)
 * - forceIntegrator: true forces the integrator agent even when no overlapping-file conflicts exist
 *
 * Important swarm.mjs rule: integration runs only if integrator is true AND success > 1.
 * So this example uses two workers with distinct trivial prompts.
 *
 * Prerequisites:
 * - Git repo
 * - Worker auth: CURSOR_API_KEY or ~/.cursor-api-key (swarm getKey)
 * - Integrator agent: CURSOR_API_KEY must be set (integrator does not read ~/.cursor-api-key)
 *
 * Usage:
 *   export CURSOR_API_KEY=…   # required for integrator path
 *   node examples/4-with-integrator.mjs
 */

import { SwarmOrchestrator } from "../src/lib/swarm.mjs";
import { getRepoRoot } from "../src/lib/worktrees.mjs";

async function main() {
  if (!process.env.CURSOR_API_KEY) {
    console.error(
      "Error: CURSOR_API_KEY must be set — workers may still run via key file, but the " +
        "integrator agent only reads process.env.CURSOR_API_KEY."
    );
    process.exit(1);
  }

  const repo = getRepoRoot();
  if (!repo) {
    console.error("Error: not inside a git repository.");
    process.exit(1);
  }

  const tasks = [
    "Examples run: do not edit files. Final summary one line: INTEGRATION_BRANCH_A",
    "Examples run: do not edit files. Final summary one line: INTEGRATION_BRANCH_B",
  ];

  const orch = new SwarmOrchestrator({
    repo,
    workers: tasks.length,
    autoCleanup: false,
  });

  orch.on("status", (e) => console.log(`[status] ${e.phase}: ${e.message}`));

  console.log("Running fork-style swarm with post-run integrator…");

  await orch.run(tasks, {
    integrator: true,
    forceIntegrator: true,
  });

  const summary = orch.getSummary();
  console.log("\nSwarm summary:", {
    success: summary.success,
    failed: summary.failed,
    durationMs: summary.duration,
  });

  if (summary.integration) {
    console.log("\nIntegration:", {
      success: summary.integration.success,
      integrationPath: summary.integration.integrationPath,
      usedIntegrator: summary.integration.usedIntegrator,
      error: summary.integration.error,
    });
  } else {
    console.log("\nNo integration object on summary (need >=2 successful workers).");
  }

  orch.cleanup();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
