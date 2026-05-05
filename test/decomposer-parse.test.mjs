import test from "node:test";
import assert from "node:assert/strict";
import { parsePlan, validatePlan, buildDag } from "../src/lib/decomposer.mjs";

function minimalTask(i = 0) {
  return {
    description: `task ${i}`,
    scope: "scope",
    allowed_paths: ["src/"],
    dependencies: [],
  };
}

test("parsePlan parses raw JSON array", () => {
  const raw = JSON.stringify([minimalTask(0)]);
  const plan = parsePlan(raw);
  assert.equal(plan.length, 1);
});

test("parsePlan strips markdown fence", () => {
  const inner = JSON.stringify([minimalTask(0), minimalTask(1)]);
  const raw = `\`\`\`json\n${inner}\n\`\`\``;
  assert.equal(parsePlan(raw).length, 2);
});

test("validatePlan accepts valid acyclic plan", () => {
  const plan = [minimalTask(0), minimalTask(1)];
  plan[1].dependencies = [0];
  const v = validatePlan(plan, 5);
  assert.equal(v.valid, true);
});

test("buildDag detects cycle", () => {
  const plan = [minimalTask(0), minimalTask(1)];
  plan[0].dependencies = [1];
  plan[1].dependencies = [0];
  const dag = buildDag(plan);
  assert.equal(dag.hasCycle, true);
});

test("validatePlan rejects unsafe path segments", () => {
  const plan = [{
    ...minimalTask(0),
    allowed_paths: ["../evil"],
    dependencies: [],
  }];
  const v = validatePlan(plan, 5);
  assert.equal(v.valid, false);
});
