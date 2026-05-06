import { createRequire } from "node:module";
import assert from "node:assert";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
export const MOCK_WORKTREE_BASE = join(tmpdir(), "claw-swarm");

/**
 * Replace `execSync` on the underlying CJS facet of node:child_process so ESM importers observe it.
 */
export function installExecSync(impl) {
  const cp = require("node:child_process");
  const original = cp.execSync;
  cp.execSync = impl;
  return () => {
    cp.execSync = original;
  };
}

/** Reconfigurable harness for mocking git via `execSync` (singleton import of worktrees/swarm observes latest impl). */
export function createMutableGitExec() {
  /** @type {string[]} */
  const calls = [];
  const cfg = {
    repoRoot: "/tmp/mock-repo-root",
    headSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    branchName: "main",
    throwAbbrevRef: false,
    /** When true, every command throws (for diff/helper fallbacks). */
    failAllCommands: false,
    /** @type {Set<number>} */
    failWorktreeAddAtIndices: new Set(),
    /** @type {string[]} */
    worktreePorcelainLines: [],
  };

  let addAttempt = -1;

  function resetCounters() {
    addAttempt = -1;
  }

  function impl(cmd, opts) {
    const s = typeof cmd === "string" ? cmd : String(cmd);
    calls.push(s);

    if (cfg.failAllCommands) throw new Error("mock global git failure");

    if (s.includes("rev-parse --show-toplevel")) return `${cfg.repoRoot}\n`;
    if (s.includes("rev-parse --abbrev-ref HEAD")) {
      if (cfg.throwAbbrevRef) throw new Error("mock rev-parse HEAD failed");
      return `${cfg.branchName}\n`;
    }
    if (s.includes("git -C ") && s.includes(" rev-parse HEAD")) return `${cfg.headSha}\n`;

    if (s.includes("worktree add")) {
      addAttempt += 1;
      if (cfg.failWorktreeAddAtIndices.has(addAttempt)) {
        const err = new Error("mock worktree add failure");
        err.stderr = "mock stderr";
        err.status = 128;
        throw err;
      }
      return "";
    }

    if (s.includes("worktree remove")) return "";

    if (s.includes("worktree list --porcelain"))
      return cfg.worktreePorcelainLines.join("\n") + (cfg.worktreePorcelainLines.length ? "\n" : "");

    if (s.includes("diff --stat HEAD")) return "";
    if (s.includes("diff --name-only")) return "";
    if (s.includes("diff HEAD")) return "";
    if (s.includes("ls-files --others")) return "";

    return "";
  }

  return {
    calls,
    cfg,
    impl,
    resetCounters,
    /**
     * @param {string[]} names file basename or absolute path fragments
     */
    stubOrphanPorcelain(names) {
      cfg.worktreePorcelainLines = names.map(n =>
        n.includes("/") ? `worktree ${n}` : `worktree ${join(MOCK_WORKTREE_BASE, basename(n))}`
      );
      return cfg.worktreePorcelainLines;
    },
    clearPorcelain() {
      cfg.worktreePorcelainLines = [];
    },
    prepCase() {
      calls.length = 0;
      resetCounters();
      cfg.failWorktreeAddAtIndices.clear();
      cfg.worktreePorcelainLines = [];
      cfg.repoRoot = "/tmp/mock-repo-root";
      cfg.headSha = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
      cfg.branchName = "main";
      cfg.throwAbbrevRef = false;
      cfg.failAllCommands = false;
    },
  };
}

export function extractWorktreePathFromAddCommand(command) {
  const m = String(command).match(/worktree add[^\n]*"([^"]+)"/);
  assert(m, `expected worktree path in command: ${command}`);
  return m[1];
}
