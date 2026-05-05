#!/usr/bin/env node
/**
 * Example 5 — Crash recovery: persistent ledger + resume entry point
 *
 * Demonstrates:
 * - Ledger (ledger.mjs): swarm state persisted under <repo>/.venom-swarm/ledger.json
 * - loadLedger(repo): reload state after a crash or new process
 * - resumeSwarm(options): loads ledger, reconstructs orchestrator metadata (see swarm.mjs — full
 *   agent replay for failed tasks is marked TODO in upstream code)
 *
 * This script has two parts:
 *   1) Creates a minimal ledger on disk, reads it back with loadLedger, prints getSummary(),
 *      then deletes the demo ledger so your repo is left clean.
 *   2) If a ledger already exists from a real swarm run, prints its summary again and calls
 *      resumeSwarm() so you can see the CLI-facing resume path.
 *
 * No Cursor API calls are required for part 1.
 *
 * Usage:
 *   node examples/5-crash-recovery.mjs
 *   node examples/5-crash-recovery.mjs --keep-ledger   # skip Ledger.delete() after demo
 */

import { Ledger, loadLedger } from "../src/lib/ledger.mjs";
import { resumeSwarm } from "../src/lib/swarm.mjs";
import { getRepoRoot } from "../src/lib/worktrees.mjs";

const keepLedger = process.argv.includes("--keep-ledger");

async function demoSyntheticLedger(repo) {
  console.log("\n--- Part 1: synthetic ledger write/read ---\n");

  const ledger = new Ledger(repo);
  ledger.createSwarm(
    "demo: crash recovery illustration",
    [
      {
        description: "Worker task A",
        scope: "Illustrative scope A",
        allowed_paths: ["examples/"],
        dependencies: [],
      },
      {
        description: "Worker task B",
        scope: "Illustrative scope B",
        allowed_paths: ["src/"],
        dependencies: [],
      },
    ],
    { model: "composer-2" }
  );

  ledger.markTaskDone(0, {
    success: true,
    result: { status: "finished" },
    changedFiles: [],
  });
  ledger.markTaskDone(1, {
    success: false,
    error: "simulated worker failure",
    changedFiles: [],
  });

  ledger.state.status = "running";
  ledger.save();

  const loaded = loadLedger(repo);
  if (!loaded) {
    throw new Error("loadLedger returned null after save");
  }

  console.log("Loaded ledger summary:", loaded.getSummary());
  console.log("Failed tasks:", loaded.getFailedTasks().map((t) => t.description));
  console.log("Queued tasks:", loaded.getQueuedTasks().length);

  if (!keepLedger) {
    loaded.delete();
    console.log(
      "\nRemoved demo .venom-swarm/ ledger (pass --keep-ledger to leave it on disk for inspection)."
    );
  } else {
    console.log("\nKept ledger on disk (--keep-ledger). Path:", loaded.file);
  }
}

async function demoResumeIfPresent(repo) {
  console.log("\n--- Part 2: resumeSwarm if ledger exists ---\n");

  const existing = loadLedger(repo);
  if (!existing) {
    console.log(
      "No ledger.json present (expected after Part 1 cleanup). " +
        "Run a real ca3 swarm/fork or keep Part 1 with --keep-ledger to inspect resume."
    );
    return;
  }

  console.log("Found ledger:", existing.getSummary());

  try {
    const after = await resumeSwarm({ repo });
    console.log("resumeSwarm() returned ledger summary:", after.getSummary?.() ?? after);
  } catch (e) {
    console.error("resumeSwarm error:", e.message);
  }
}

async function main() {
  const repo = getRepoRoot();
  if (!repo) {
    console.error("Error: not inside a git repository.");
    process.exit(1);
  }

  await demoSyntheticLedger(repo);

  if (!keepLedger) {
    await demoResumeIfPresent(repo);
  } else {
    console.log("\nSkipping Part 2 while --keep-ledger is set (Part 1 left ledger in place).");
    try {
      const after = await resumeSwarm({ repo });
      console.log("resumeSwarm():", after.getSummary?.() ?? after);
    } catch (e) {
      console.log("resumeSwarm:", e.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
