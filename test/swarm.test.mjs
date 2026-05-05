import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert";

import { createMutableGitExec, installExecSync } from "./helpers/git-mock.mjs";
import { createStubAgentFactory } from "./helpers/mock-agent.mjs";
import { makeTmpRepo } from "./helpers/fs-utils.mjs";
import { loadLedger } from "../src/lib/ledger.mjs";
import { bareLedgerState, taskRow } from "./helpers/fixtures.mjs";

/**
 * IMPORTANT: `@cursor/sdk` eagerly loads native/node bindings that pin `execSync`.
 * Patch git before any `@cursor/sdk` import so `src/lib/worktrees.mjs` sees the mock.
 */

describe("Swarm orchestration (mocked git + Cursor Agent)", { concurrency: false }, () => {
  /** @type {ReturnType<typeof createMutableGitExec>} */
  let git;
  let restoreExec;
  /** @type {typeof import("../src/lib/swarm.mjs")} */
  let swarmMod;
  /** @type {typeof import("@cursor/sdk")} */
  let cursorSdk;
  /** @type {typeof cursorSdk.Agent.create} */
  let originalAgentCreate;

  before(async () => {
    git = createMutableGitExec();
    restoreExec = installExecSync(git.impl);
    process.env.CURSOR_API_KEY = "test-key";

    cursorSdk = await import("@cursor/sdk");
    originalAgentCreate = cursorSdk.Agent.create;
    cursorSdk.Agent.create = createStubAgentFactory();

    swarmMod = await import("../src/lib/swarm.mjs");
  });

  after(() => {
    cursorSdk.Agent.create = originalAgentCreate;
    restoreExec();
    delete process.env.CURSOR_API_KEY;
  });

  beforeEach(() => {
    git.prepCase();
    cursorSdk.Agent.create = createStubAgentFactory();
  });

  test("SwarmOrchestrator.run persists ledger updates and merges worktrees", async () => {
    const repo = makeTmpRepo();
    git.cfg.repoRoot = repo.root;

    const orch = new swarmMod.SwarmOrchestrator({ repo: repo.root, workers: 2, concurrency: 2, autoCleanup: false });
    await orch.run("lint project");

    const ledger = loadLedger(repo.root);
    assert.ok(ledger);
    assert.strictEqual(ledger.state.tasks.length, 2);
    assert.strictEqual(ledger.state.tasks.every(t => Boolean(t.worktreePath)), true);
    assert.strictEqual(ledger.state.tasks.every(t => t.status === "done"), true);

    orch.cleanup();
    repo.dispose();
  });

  test("cleanupOrphans surfaces git housekeeping invocations", () => {
    const repo = makeTmpRepo();
    git.cfg.repoRoot = repo.root;
    git.stubOrphanPorcelain(["orphan"]);

    const orch = new swarmMod.SwarmOrchestrator({ repo: repo.root, workers: 1 });
    const removed = orch.cleanupOrphans();

    assert.strictEqual(removed.length, 1);
    assert.strictEqual(git.calls.some(c => c.includes("worktree list")), true);
    repo.dispose();
  });

  test("fork sizes workers according to explicit task list", async () => {
    const repo = makeTmpRepo();
    git.cfg.repoRoot = repo.root;

    const results = await swarmMod.fork(["alpha", "beta"], { repo: repo.root, autoCleanup: true });

    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.success));
    assert.strictEqual(git.calls.some(c => c.includes("worktree remove")), true);
    repo.dispose();
  });

  test("swarm helper wires the same pipeline as the orchestrator class", async () => {
    const repo = makeTmpRepo();
    git.cfg.repoRoot = repo.root;

    const outcomes = await swarmMod.swarm("format code", {
      repo: repo.root,
      workers: 1,
      concurrency: 1,
      autoCleanup: false,
    });

    assert.strictEqual(outcomes.length, 1);
    assert.strictEqual(outcomes[0].success, true);

    repo.dispose();
  });

  test("ledger records failed Cursor runs when Agent reports non-finished status", async () => {
    cursorSdk.Agent.create = createStubAgentFactory({ status: "aborted", summary: "stopped" });

    const repo = makeTmpRepo();
    git.cfg.repoRoot = repo.root;

    const orch = new swarmMod.SwarmOrchestrator({ repo: repo.root, workers: 1 });
    await orch.run("fuzz");

    const ledger = loadLedger(repo.root);
    assert.ok(ledger);
    assert.strictEqual(ledger.state.tasks[0].status, "failed");
    orch.cleanup();
    repo.dispose();
  });

  test("resumeSwarm throws when ledger file is absent", async () => {
    const repo = makeTmpRepo();
    git.cfg.repoRoot = repo.root;

    await assert.rejects(() => swarmMod.resumeSwarm({ repo: repo.root }), /No active swarm/);
    repo.dispose();
  });

  test("resumeSwarm loads persisted ledger objects", async () => {
    const snapshot = bareLedgerState({
      status: "running",
      tasks: [
        taskRow({
          index: 0,
          description: "resume-me",
          worktreePath: "/tmp/resume-wt",
          status: "failed",
        }),
      ],
    });
    const repo = makeTmpRepo(snapshot);
    git.cfg.repoRoot = repo.root;

    const recovered = await swarmMod.resumeSwarm({ repo: repo.root });
    assert.ok(recovered);
    assert.strictEqual(recovered.state.tasks[0].worktreePath, "/tmp/resume-wt");
    assert.strictEqual(Array.isArray(recovered.getFailedTasks()), true);
    repo.dispose();
  });
});
