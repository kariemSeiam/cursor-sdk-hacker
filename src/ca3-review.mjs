#!/usr/bin/env node
/**
 * ca3-review — Cursor Claw · swarm output review / diff
 *
 * Usage:
 *   ca3-review                  — review all active swarm worktrees
 *   ca3-review --json           — output as JSON
 *   ca3-review --conflicts      — show only conflicts
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewWorktrees, reviewToJSON, detectConflicts, mergeAnalysis } from "./lib/reviewer.mjs";
import { getRepoRoot } from "./lib/worktrees.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SWARM_STATE = join(REPO_ROOT, ".tmp-cli", "swarm-state.json");

const c = {
  r: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", grn: "\x1b[32m", yel: "\x1b[33m",
  blu: "\x1b[34m", mag: "\x1b[35m", cyn: "\x1b[36m",
};

const log = m => console.log(m);
const fail = m => { console.error(`${c.red}✖${c.r} ${m}`); process.exit(1); };
const info = m => console.log(`${c.dim}ℹ${c.r} ${m}`);

function loadSwarmState() {
  if (!existsSync(SWARM_STATE)) return null;
  try { return JSON.parse(readFileSync(SWARM_STATE, "utf8")); } catch { return null; }
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = argv.filter(a => a.startsWith("--"));

  const state = loadSwarmState();
  const worktrees = state?.worktrees || [];

  if (worktrees.length === 0) {
    fail("No active swarm worktrees found");
  }

  const review = await reviewWorktrees(worktrees, {
    includeDiff: !flags.includes("--no-diff"),
  });

  if (flags.includes("--json")) {
    console.log(reviewToJSON(review));
    return;
  }

  if (flags.includes("--conflicts")) {
    if (review.conflicts.length === 0) {
      log(`${c.grn}✔ No conflicts detected${c.r}`);
    } else {
      log(`${c.red}✖ ${review.conflicts.length} conflicts:${c.r}`);
      for (const c of review.conflicts) {
        log(`  ${c.red}●${c.r} ${c.file}`);
      }
    }
    return;
  }

  if (flags.includes("--merge")) {
    const analysis = mergeAnalysis(worktrees);
    if (analysis.canAutoMerge) {
      log(`${c.grn}✔ All worktrees can be auto-merged${c.r}`);
    } else {
      log(`${c.red}✖ ${analysis.conflictCount} conflicts:${c.r}`);
      for (const c of analysis.conflicts) {
        log(`  ${c.red}●${c.r} ${c.file}`);
      }
    }
    return;
  }

  // Full review output
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
    if (r.hasConflicts) {
      log(`\n${c.yel}⚠ Conflicts: ${r.conflictingFiles.join(", ")}${c.r}`);
    }
    if (r.diff) {
      const lines = r.diff.split("\n").slice(0, 30);
      log(`\n${c.dim}${lines.join("\n")}${r.diff.split("\n").length > 30 ? "\n  ... (truncated)" : ""}${c.r}`);
    }
  }

  log(`\n${c.bold}Summary:${c.r}`);
  info(`Total files: ${review.summary.totalFiles}`);
  info(`Changes: +${review.summary.totalInsertions} -${review.summary.totalDeletions}`);

  if (review.conflicts.length > 0) {
    log(`\n${c.bold}${c.red}CONFLICTS (${review.conflicts.length})${c.r}`);
    for (const c of review.conflicts) log(`  ${c.red}●${c.r} ${c.file}`);
  } else {
    log(`\n${c.grn}✔ No conflicts detected${c.r}`);
  }
}

main().catch(err => fail(err.message));
