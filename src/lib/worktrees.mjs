/**
 * lib/worktrees.mjs — Git worktree lifecycle management
 *
 * Handles:
 * - Creating isolated worktrees per agent
 * - Tracking worktree state
 * - Cleanup on crash/exit
 * - Detecting orphaned worktrees
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const WORKTREE_BASE = join(tmpdir(), "venom-swarm");

export function ensureWorktreeBase() {
  if (!existsSync(WORKTREE_BASE)) {
    mkdirSync(WORKTREE_BASE, { recursive: true });
  }
  return WORKTREE_BASE;
}

export function getRepoRoot(cwd = process.cwd()) {
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf8", cwd }).trim();
  } catch {
    return null;
  }
}

export function getCurrentBranch(repo) {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8", cwd: repo }).trim();
  } catch {
    return "main";
  }
}

export function createWorktrees(repo, branch, count, prefix = "swarm") {
  ensureWorktreeBase();
  const worktrees = [];

  // Get the current commit SHA to use for detached HEAD worktrees
  const commitSha = execSync(`git -C "${repo}" rev-parse HEAD`, { encoding: "utf8" }).trim();

  for (let i = 0; i < count; i++) {
    const name = `${prefix}-${Date.now()}-${i}-${randomUUID().slice(0, 6)}`;
    const path = join(WORKTREE_BASE, name);

    try {
      // Use --detach to avoid branch conflicts with main worktree
      execSync(`git -C "${repo}" worktree add --detach "${path}" ${commitSha}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      worktrees.push({ id: name, path, branch, index: i });
    } catch (err) {
      for (const wt of worktrees) {
        removeWorktree(repo, wt.path);
      }
      const msg = err.stderr?.trim() || err.message;
      throw new Error(`Failed to create worktree: ${msg}`);
    }
  }

  return worktrees;
}

export function removeWorktree(repo, path) {
  try {
    execSync(`git -C "${repo}" worktree remove "${path}" --force 2>/dev/null`);
  } catch {
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
    }
  }
}

export function removeAllWorktrees(repo, paths) {
  for (const p of paths) {
    removeWorktree(repo, p);
  }
}

export function listOrphanedWorktrees(repo) {
  try {
    const output = execSync(`git -C "${repo}" worktree list --porcelain`, { encoding: "utf8" });
    return output
      .split("\n")
      .filter(line => line.startsWith("worktree "))
      .map(line => line.replace("worktree ", "").trim())
      .filter(p => p.startsWith(WORKTREE_BASE));
  } catch {
    return [];
  }
}

export function cleanupOrphanedWorktrees(repo) {
  const orphans = listOrphanedWorktrees(repo);
  for (const p of orphans) {
    removeWorktree(repo, p);
  }
  return orphans;
}

export function getWorktreeDiff(worktreePath) {
  try {
    return execSync(`git -C "${worktreePath}" diff HEAD`, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

export function getChangedFiles(worktreePath) {
  try {
    // Get tracked changes
    const tracked = execSync(`git -C "${worktreePath}" diff --name-only HEAD`, { encoding: "utf8" });
    // Get untracked files
    const untracked = execSync(`git -C "${worktreePath}" ls-files --others --exclude-standard`, { encoding: "utf8" });
    const files = [...tracked.split("\n"), ...untracked.split("\n")].filter(Boolean);
    return files;
  } catch {
    return [];
  }
}

export function getNewFiles(worktreePath) {
  try {
    const output = execSync(`git -C "${worktreePath}" ls-files --others --exclude-standard`, { encoding: "utf8" });
    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function getDeletedFiles(worktreePath) {
  try {
    const output = execSync(`git -C "${worktreePath}" diff --name-only --diff-filter=D HEAD`, { encoding: "utf8" });
    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function getDiffStats(worktreePath) {
  try {
    const trackedOutput = execSync(`git -C "${worktreePath}" diff --stat HEAD`, { encoding: "utf8" });
    const trackedLines = trackedOutput.trim().split("\n");
    const trackedSummary = trackedLines[trackedLines.length - 1] || "";

    const trackedFiles = parseInt((trackedSummary.match(/(\d+) file/) || [])[1] || "0");
    const insertions = parseInt((trackedSummary.match(/(\d+) insertion/) || [])[1] || "0");
    const deletions = parseInt((trackedSummary.match(/(\d+) deletion/) || [])[1] || "0");

    // Add untracked files
    const untracked = execSync(`git -C "${worktreePath}" ls-files --others --exclude-standard`, { encoding: "utf8" });
    const untrackedFiles = untracked.split("\n").filter(Boolean).length;

    return {
      files: trackedFiles + untrackedFiles,
      insertions,
      deletions,
      summary: trackedSummary || (untrackedFiles > 0 ? `${untrackedFiles} untracked file(s)` : ""),
    };
  } catch {
    return { files: 0, insertions: 0, deletions: 0, summary: "" };
  }
}

export { WORKTREE_BASE };
