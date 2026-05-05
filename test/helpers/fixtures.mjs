/**
 * Pure data fixtures for ledgers and task specs (no I/O).
 */

export function bareLedgerState(overrides = {}) {
  return {
    version: 1,
    id: "00000000-0000-4000-8000-000000000001",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_100,
    repo: "/mock/repo",
    task: "Example swarm task",
    tasks: [],
    worktrees: {},
    status: "running",
    ...overrides,
  };
}

export function sampleTaskSpecs() {
  return [
    { description: "A", scope: "src/a", allowed_paths: ["src/a"], dependencies: [] },
    { description: "B", scope: "src/b", allowed_paths: ["src/b"], dependencies: [0] },
    { description: "C", scope: "src/c", allowed_paths: ["src/c"], dependencies: [] },
  ];
}

/** Minimal task row copied from Ledger.createSwarm shape for resume / load tests */
export function taskRow(partial = {}) {
  return {
    index: 0,
    description: "Task",
    scope: "",
    allowed_paths: [],
    dependencies: [],
    status: "queued",
    attempts: 0,
    startedAt: null,
    finishedAt: null,
    agentId: null,
    runId: null,
    worktreePath: null,
    error: null,
    result: null,
    ...partial,
  };
}

/** Ledger snapshot for loadLedger / dependency behavior */
export function ledgerWithMixedBlocking(repo = "/recover/repo") {
  return bareLedgerState({
    repo,
    task: "chain",
    tasks: [
      taskRow({ index: 0, description: "t0", status: "blocked", dependencies: [2] }),
      taskRow({ index: 1, description: "t1", status: "queued", dependencies: [] }),
      taskRow({ index: 2, description: "t2", status: "queued", dependencies: [] }),
    ],
  });
}

export function corruptedLedgerBlob() {
  return "{{ not json";
}
