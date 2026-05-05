import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { Ledger, loadLedger } from "../src/lib/ledger.mjs";
import { sampleTaskSpecs, ledgerWithMixedBlocking, corruptedLedgerBlob } from "./helpers/fixtures.mjs";
import { makeTmpRepo } from "./helpers/fs-utils.mjs";

describe("Ledger", () => {
  /** @type {{ root: string, dispose: () => void }} */
  let sandbox;

  beforeEach(() => {
    sandbox = makeTmpRepo();
  });

  afterEach(() => {
    sandbox.dispose();
  });

  test("createSwarm seeds queued vs blocked tasks from dependencies", () => {
    const ledger = new Ledger(sandbox.root);
    const specs = sampleTaskSpecs();
    const swarmId = ledger.createSwarm("do work", specs, { maxRetries: 5, integrator: true });
    assert.match(swarmId, /^[0-9a-f-]{36}$/i);

    assert.strictEqual(ledger.state.tasks.length, 3);
    assert.strictEqual(ledger.state.tasks[0].status, "queued");
    assert.strictEqual(ledger.state.tasks[1].status, "blocked");
    assert.strictEqual(ledger.state.tasks[2].status, "queued");

    assert.deepStrictEqual(ledger.state.tasks[0].dependencies, []);
    assert.deepStrictEqual(ledger.state.tasks[1].dependencies, [0]);
    assert.strictEqual(ledger.state.options?.maxRetries, 5);
    assert.strictEqual(ledger.state.options?.integrator, true);
  });

  test("createSwarm embeds preset worktrees object", () => {
    const ledger = new Ledger(sandbox.root);
    const presets = { a: "/tmp/a" };
    ledger.createSwarm("t", [{ description: "x", dependencies: [], allowed_paths: [] }], {
      worktrees: presets,
    });
    assert.deepStrictEqual(ledger.state.worktrees, presets);
  });

  test("markTaskRunning advances attempts and sets running metadata", () => {
    const ledger = new Ledger(sandbox.root);
    ledger.createSwarm("t", [{ description: "job", dependencies: [], allowed_paths: [] }]);

    ledger.markTaskRunning(0, "agent-9", "run-88", "/wt/p");
    const t = ledger.state.tasks[0];
    assert.strictEqual(t.status, "running");
    assert.strictEqual(t.agentId, "agent-9");
    assert.strictEqual(t.runId, "run-88");
    assert.strictEqual(t.worktreePath, "/wt/p");
    assert.strictEqual(t.attempts, 1);
    assert.strictEqual(typeof t.startedAt, "number");
  });

  test("markTaskDone sets done and attaches result when success", () => {
    const ledger = new Ledger(sandbox.root);
    ledger.createSwarm("t", [
      { description: "a", dependencies: [], allowed_paths: [] },
      { description: "b", dependencies: [0], allowed_paths: [] },
    ]);
    ledger.markTaskDone(0, { success: true, files: ["a.txt"] });
    assert.strictEqual(ledger.state.tasks[0].status, "done");
    assert.deepStrictEqual(ledger.state.tasks[0].result, { success: true, files: ["a.txt"] });
    assert.strictEqual(ledger.state.tasks[1].status, "queued");
  });

  test("markTaskDone sets failed and error when not success", () => {
    const ledger = new Ledger(sandbox.root);
    ledger.createSwarm("t", [{ description: "a", dependencies: [], allowed_paths: [] }]);
    ledger.markTaskDone(0, { success: false, error: "boom" });
    assert.strictEqual(ledger.state.tasks[0].status, "failed");
    assert.strictEqual(ledger.state.tasks[0].error, "boom");
  });

  test("blocked tasks unblock when dependency finishes cancelled", () => {
    const ledger = new Ledger(sandbox.root);
    ledger.createSwarm("t", [
      { description: "a", dependencies: [], allowed_paths: [] },
      { description: "b", dependencies: [0], allowed_paths: [] },
    ]);
    ledger.markTaskCancelled(0);
    assert.strictEqual(ledger.state.tasks[1].status, "queued");
  });

  test("getQueuedTasks/getSummary/isComplete converge on terminal states", () => {
    const ledger = new Ledger(sandbox.root);
    ledger.createSwarm("t", [
      { description: "a", dependencies: [], allowed_paths: [] },
      { description: "b", dependencies: [], allowed_paths: [] },
    ]);

    ledger.markTaskRunning(0, "ag", null, "/w");
    ledger.markTaskDone(0, { success: true });
    assert.strictEqual(ledger.getQueuedTasks().length, 1);
    assert.strictEqual(ledger.isComplete(), false);
    ledger.markTaskDone(1, { success: true });
    const summary = ledger.getSummary();
    assert.strictEqual(summary.done, 2);
    assert.strictEqual(summary.running, 0);
    assert.strictEqual(ledger.isComplete(), true);
  });

  test("save and loadLedger restore identical state", () => {
    const ledger = new Ledger(sandbox.root);
    const specs = sampleTaskSpecs();
    ledger.createSwarm("persist", specs);
    ledger.save();

    const loaded = loadLedger(sandbox.root);
    assert.ok(loaded);
    assert.strictEqual(loaded.state.task, "persist");
    assert.strictEqual(loaded.state.tasks.length, 3);
    assert.strictEqual(loaded.repoPath, sandbox.root);
  });

  test("loadLedger returns null when ledger file missing", () => {
    assert.strictEqual(loadLedger(sandbox.root), null);
  });

  test("loadLedger returns null when ledger.json is malformed", () => {
    mkdirSync(join(sandbox.root, ".venom-swarm"), { recursive: true });
    writeFileSync(join(sandbox.root, ".venom-swarm", "ledger.json"), corruptedLedgerBlob());

    assert.strictEqual(loadLedger(sandbox.root), null);
  });

  test("Ledger.delete removes ledger dir", () => {
    const ledger = new Ledger(sandbox.root);
    ledger.createSwarm("x", [{ description: "a", dependencies: [], allowed_paths: [] }]);
    ledger.save();
    ledger.delete();

    assert.strictEqual(existsSync(join(sandbox.root, ".venom-swarm")), false);
  });
});

describe("Fixture-driven loadLedger", () => {
  test("restores mixed blocking snapshot from disk", () => {
    const state = ledgerWithMixedBlocking("/recover/repo");
    const inner = makeTmpRepo(state);
    const ledger = loadLedger(inner.root);
    assert.ok(ledger);
    assert.strictEqual(ledger.state.tasks[0].status, "blocked");
    inner.dispose();
  });
});
