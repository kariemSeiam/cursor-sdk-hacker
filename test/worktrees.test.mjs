import { mkdirSync } from "node:fs";
import { describe, test, before, after, afterEach, beforeEach } from "node:test";
import assert from "node:assert";

import { createMutableGitExec, installExecSync, extractWorktreePathFromAddCommand } from "./helpers/git-mock.mjs";

describe("worktrees (mocked git)", { concurrency: false }, () => {
  /** @type {Awaited<ReturnType<typeof import("../src/lib/worktrees.mjs")>>} */
  let mod;
  let restoreExec;
  /** @type {ReturnType<typeof createMutableGitExec>} */
  let git;

  before(async () => {
    git = createMutableGitExec();
    restoreExec = installExecSync(git.impl);
    mod = await import("../src/lib/worktrees.mjs");
  });

  after(() => {
    restoreExec();
  });

  beforeEach(() => {
    git.prepCase();
  });

  test("ensureWorktreeBase creates the shared directory", () => {
    const base = mod.ensureWorktreeBase();
    mkdirSync(base, { recursive: true });
    assert.strictEqual(typeof base, "string");
    assert.ok(base.length > 0);
  });

  test("getRepoRoot maps rev-parse output", () => {
    git.cfg.repoRoot = "/tmp/my-root";
    assert.strictEqual(mod.getRepoRoot(), "/tmp/my-root");
    assert.ok(git.calls.some(c => c.includes("rev-parse --show-toplevel")));
  });

  test("getCurrentBranch falls back to main on failure", () => {
    git.cfg.throwAbbrevRef = true;
    assert.strictEqual(mod.getCurrentBranch("/any"), "main");
    git.cfg.throwAbbrevRef = false;
  });

  test("createWorktrees issues rev-parse HEAD and detached worktree add per slot", () => {
    git.cfg.repoRoot = "/repo/wt";
    const list = mod.createWorktrees("/repo/wt", "main", 2, "unit");
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[0].index, 0);
    assert.strictEqual(list[1].index, 1);
    const adds = git.calls.filter(c => c.includes("worktree add"));
    assert.strictEqual(adds.length, 2);
    assert.ok(adds.every(a => a.includes("--detach")));
    assert.ok(list[0].path.startsWith(mod.WORKTREE_BASE));
  });

  test("createWorktrees rolls back earlier worktrees when a later add fails", () => {
    git.cfg.failWorktreeAddAtIndices.add(1);
    assert.throws(() => mod.createWorktrees("/repo/a", "main", 3, "boom"), /Failed to create worktree/);

    const adds = git.calls.filter(c => c.includes("worktree add"));
    const removes = git.calls.filter(c => c.includes("worktree remove"));

    assert.strictEqual(adds.length, 2);
    const firstPath = extractWorktreePathFromAddCommand(adds[0]);
    assert.ok(removes.some(r => r.includes(firstPath)), "expected rollback remove for first successful add");
  });

  test("listOrphanedWorktrees selects venom swarm tmp paths only", () => {
    git.stubOrphanPorcelain(["orphan-z"]);
    const rows = mod.listOrphanedWorktrees("/repo/x");
    assert.strictEqual(rows.length, 1);
    assert.ok(rows[0].includes("venom-swarm"));
    assert.strictEqual(git.calls.some(c => c.includes("worktree list")), true);
  });

  test("cleanupOrphanedWorktrees removes orphaned entries and returns their paths", () => {
    git.stubOrphanPorcelain(["cleanup-a"]);
    const removed = mod.cleanupOrphanedWorktrees("/repo/y");
    assert.strictEqual(removed.length, 1);
    assert.ok(git.calls.some(c => c.includes("worktree remove")));
  });

  test("helpers return empty payloads when exec fails inside try/catch", () => {
    git.cfg.failAllCommands = true;
    assert.strictEqual(mod.getWorktreeDiff("/wt"), "");
    assert.deepStrictEqual(mod.getChangedFiles("/wt"), []);
    assert.deepStrictEqual(mod.getNewFiles("/wt"), []);
    assert.deepStrictEqual(mod.getDeletedFiles("/wt"), []);
    assert.deepStrictEqual(mod.getDiffStats("/wt"), { files: 0, insertions: 0, deletions: 0, summary: "" });
    git.cfg.failAllCommands = false;
  });
});
