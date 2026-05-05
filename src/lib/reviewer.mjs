/**
 * lib/reviewer.mjs — Auto-diff, conflict detection, merge analysis
 *
 * Usage:
 *   import { reviewWorktrees, detectConflicts, mergeAnalysis } from "./lib/reviewer.mjs";
 *
 *   const review = await reviewWorktrees(worktreePaths);
 *   console.log(review.conflicts);
 *   console.log(review.summary);
 */

import {
  getChangedFiles,
  getNewFiles,
  getDeletedFiles,
  getDiffStats,
  getWorktreeDiff,
} from "./worktrees.mjs";

export function detectConflicts(worktreePaths) {
  const allFiles = new Map();

  for (let i = 0; i < worktreePaths.length; i++) {
    const files = getChangedFiles(worktreePaths[i]);
    for (const f of files) {
      if (!allFiles.has(f)) allFiles.set(f, []);
      allFiles.get(f).push(i);
    }
  }

  const conflicts = [];
  for (const [file, indices] of allFiles) {
    if (indices.length > 1) {
      conflicts.push({ file, worktrees: indices });
    }
  }

  return conflicts;
}

export async function reviewWorktrees(worktreePaths, options = {}) {
  const reviews = [];
  const conflicts = detectConflicts(worktreePaths);

  for (let i = 0; i < worktreePaths.length; i++) {
    const path = worktreePaths[i];
    const stats = getDiffStats(path);
    const changed = getChangedFiles(path);
    const newFiles = getNewFiles(path);
    const deleted = getDeletedFiles(path);

    let diff = "";
    if (options.includeDiff !== false) {
      diff = getWorktreeDiff(path);
    }

    reviews.push({
      index: i,
      path,
      stats,
      changedFiles: changed,
      newFiles,
      deletedFiles: deleted,
      diff: options.includeDiff === false ? undefined : diff,
      hasConflicts: conflicts.some(c => c.worktrees.includes(i)),
      conflictingFiles: conflicts.filter(c => c.worktrees.includes(i)).map(c => c.file),
    });
  }

  return {
    reviews,
    conflicts,
    summary: {
      totalWorktrees: worktreePaths.length,
      totalFiles: new Set(reviews.flatMap(r => [...r.changedFiles, ...r.newFiles])).size,
      totalInsertions: reviews.reduce((sum, r) => sum + r.stats.insertions, 0),
      totalDeletions: reviews.reduce((sum, r) => sum + r.stats.deletions, 0),
      conflictCount: conflicts.length,
      hasConflicts: conflicts.length > 0,
    },
  };
}

export function mergeAnalysis(worktreePaths) {
  const conflicts = detectConflicts(worktreePaths);
  const reviews = [];

  for (let i = 0; i < worktreePaths.length; i++) {
    const path = worktreePaths[i];
    const stats = getDiffStats(path);
    const changed = getChangedFiles(path);

    reviews.push({
      index: i,
      path,
      stats,
      changedFiles: changed,
      isClean: !conflicts.some(c => c.worktrees.includes(i)),
    });
  }

  const cleanWorktrees = reviews.filter(r => r.isClean);
  const conflictedWorktrees = reviews.filter(r => !r.isClean);

  return {
    canAutoMerge: conflicts.length === 0,
    conflictCount: conflicts.length,
    cleanWorktrees: cleanWorktrees.length,
    conflictedWorktrees: conflictedWorktrees.length,
    conflicts,
    mergeOrder: cleanWorktrees.map(r => r.path),
    needsManualMerge: conflictedWorktrees.map(r => r.path),
  };
}

export function reviewToJSON(review) {
  return JSON.stringify({
    summary: review.summary,
    conflicts: review.conflicts,
    reviews: review.reviews.map(r => ({
      index: r.index,
      path: r.path,
      stats: r.stats,
      changedFiles: r.changedFiles,
      newFiles: r.newFiles,
      deletedFiles: r.deletedFiles,
      hasConflicts: r.hasConflicts,
      conflictingFiles: r.conflictingFiles,
    })),
  }, null, 2);
}
