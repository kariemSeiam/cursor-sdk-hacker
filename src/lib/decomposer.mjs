/**
 * lib/decomposer.mjs — Leader agent with JSON contract + validation
 *
 * Usage:
 *   import { decompose, validatePlan, buildDag } from "./lib/decomposer.mjs";
 *
 *   const plan = await decompose("build a blog with auth and payments", {
 *     repo: "/path/to/repo",
 *     maxTasks: 5,
 *     model: { id: "claude-opus-4-7" },
 *   });
 *
 *   plan.tasks // [{ description, scope, allowed_paths, dependencies }]
 */

import { Agent } from "@cursor/sdk";
import { getRepoRoot } from "./worktrees.mjs";

const MAX_RETRIES = 3;

const PLAN_PROMPT = (task, maxTasks, repoStructure) => `You are a task decomposition engine for a multi-agent code generation system.

BREAK DOWN this task into parallelizable subtasks for independent coding agents:

TASK: ${task}

${repoStructure ? `REPO STRUCTURE:\n${repoStructure}\n\n` : ''}

OUTPUT FORMAT: Return ONLY a JSON array of objects. Each object must have:
- "description": string (1-2 sentences, what the agent should build)
- "scope": string (1-2 sentences, boundaries of this subtask)
- "allowed_paths": string[] (repo-relative prefixes this agent can touch, e.g. "src/auth/", "package.json")
- "dependencies": number[] (0-based indices of tasks that must complete first, empty array if none)

RULES:
1. Maximum ${maxTasks} subtasks
2. Dependencies must be 0-based indices into the same array
3. No self-dependencies, no cycles — must form a DAG
4. allowed_paths must be repo-relative, no ".." escapes
5. Each subtask must be independently executable given its spec
6. Return ONLY the JSON array — no markdown, no fences, no commentary

Example valid output:
[
  {
    "description": "Create user authentication system with login, register, and session management",
    "scope": "Auth API endpoints, middleware, database models, JWT handling",
    "allowed_paths": ["src/auth/", "src/middleware/auth.js", "package.json"],
    "dependencies": []
  },
  {
    "description": "Set up blog post CRUD API with database integration",
    "scope": "Blog post model, REST endpoints, validation, database schema",
    "allowed_paths": ["src/posts/", "src/models/post.js", "migrations/"],
    "dependencies": []
  },
  {
    "description": "Integrate auth middleware with blog post endpoints",
    "scope": "Protect create/update/delete endpoints, add user attribution to posts",
    "allowed_paths": ["src/posts/", "src/middleware/"],
    "dependencies": [0, 1]
  }
]

Return ONLY the JSON array for this task: ${task}`;

const REPAIR_PROMPT = (task, errors) => `The previous plan had errors. Fix them and return ONLY the corrected JSON array.

ERRORS:
${errors.join('\n')}

Return ONLY the JSON array.`;

export async function decompose(task, options = {}) {
  const {
    repo = getRepoRoot(),
    maxTasks = 5,
    model = { id: "composer-2" },
    retries = MAX_RETRIES,
  } = options;

  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) throw new Error("CURSOR_API_KEY required for decomposer");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const prompt = attempt === 0
      ? PLAN_PROMPT(task, maxTasks, options.repoStructure)
      : REPAIR_PROMPT(task, options.lastErrors || []);

    let agent;
    try {
      agent = await Agent.create({
        apiKey,
        name: "decomposer-leader",
        model: { id: model.id, params: model.params || [] },
        local: { cwd: repo },
      });

      const run = await agent.send(prompt);

      let response = "";
      for await (const event of run.stream()) {
        if (event.type === "assistant") {
          for (const block of event.message?.content || []) {
            if (block.type === "text") response += block.text;
          }
        }
      }

      const result = await run.wait();
      if (result.status !== "finished") {
        throw new Error(`Leader agent failed: ${result.status}`);
      }

      const plan = parsePlan(response);
      const validation = validatePlan(plan, maxTasks);

      if (validation.valid) {
        return {
          tasks: plan,
          dag: buildDag(plan),
          summary: {
            totalTasks: plan.length,
            maxDepth: validation.maxDepth,
            parallelizable: plan.filter(t => t.dependencies.length === 0).length,
            sequential: plan.filter(t => t.dependencies.length > 0).length,
          },
        };
      }

      options.lastErrors = validation.errors;
    } catch (err) {
      if (attempt === retries) throw err;
      options.lastErrors = [err.message];
    } finally {
      if (agent) {
        try { await agent[Symbol.asyncDispose](); } catch {}
      }
    }
  }

  throw new Error("Failed to decompose task after max retries");
}

export function parsePlan(raw) {
  // Extract JSON from response (handle markdown fences if present)
  let jsonStr = raw;

  // Remove markdown code fences
  const fenceMatch = raw.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) jsonStr = fenceMatch[1];

  // Find JSON array in string
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) jsonStr = arrayMatch[0];

  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) {
    throw new Error("Plan is not a JSON array");
  }

  if (parsed.length === 0) {
    throw new Error("Plan is empty");
  }

  return parsed;
}

export function validatePlan(plan, maxTasks = 5) {
  const errors = [];

  if (!Array.isArray(plan)) {
    return { valid: false, errors: ["Plan must be an array"] };
  }

  if (plan.length === 0) {
    return { valid: false, errors: ["Plan must have at least 1 task"] };
  }

  if (plan.length > maxTasks) {
    errors.push(`Too many tasks: ${plan.length} > ${maxTasks}`);
  }

  for (let i = 0; i < plan.length; i++) {
    const task = plan[i];

    // Required fields
    if (!task.description) errors.push(`Task ${i}: missing description`);
    if (!task.scope) errors.push(`Task ${i}: missing scope`);
    if (!Array.isArray(task.allowed_paths)) errors.push(`Task ${i}: allowed_paths must be array`);
    if (!Array.isArray(task.dependencies)) errors.push(`Task ${i}: dependencies must be array`);

    // Path safety
    if (Array.isArray(task.allowed_paths)) {
      for (const p of task.allowed_paths) {
        if (p.includes("..")) errors.push(`Task ${i}: path contains "..": ${p}`);
        if (!p.startsWith("/") && !p.match(/^[\w.-]+/)) errors.push(`Task ${i}: invalid path: ${p}`);
      }
    }

    // Dependency validity
    if (Array.isArray(task.dependencies)) {
      for (const dep of task.dependencies) {
        if (typeof dep !== "number" || dep < 0 || dep >= plan.length) {
          errors.push(`Task ${i}: invalid dependency index: ${dep}`);
        }
        if (dep === i) errors.push(`Task ${i}: self-dependency`);
      }
    }
  }

  // Check for cycles
  if (errors.length === 0) {
    const dag = buildDag(plan);
    if (dag.hasCycle) {
      errors.push(`Dependency cycle detected: ${dag.cycle.join(" → ")}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    maxDepth: errors.length === 0 ? buildDag(plan).maxDepth : 0,
  };
}

export function buildDag(plan) {
  const graph = new Map();
  const inDegree = new Map();

  for (let i = 0; i < plan.length; i++) {
    graph.set(i, []);
    inDegree.set(i, 0);
  }

  for (let i = 0; i < plan.length; i++) {
    for (const dep of (plan[i].dependencies || [])) {
      graph.get(dep).push(i);
      inDegree.set(i, inDegree.get(i) + 1);
    }
  }

  // Topological sort
  const queue = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) queue.push(node);
  }

  const order = [];
  const depths = new Map();
  for (const node of queue) depths.set(node, 0);

  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);

    for (const neighbor of graph.get(node)) {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      depths.set(neighbor, Math.max(depths.get(neighbor) || 0, (depths.get(node) || 0) + 1));
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    }
  }

  const hasCycle = order.length !== plan.length;
  const cycle = hasCycle ? findCycle(plan, graph) : [];
  const maxDepth = Math.max(...Array.from(depths.values()), 0);

  return {
    order,
    depths,
    hasCycle,
    cycle,
    maxDepth,
    parallelLevels: computeParallelLevels(plan, graph, inDegree),
  };
}

function findCycle(plan, graph) {
  const visited = new Set();
  const stack = new Set();
  const cycle = [];

  function dfs(node) {
    if (stack.has(node)) {
      cycle.push(node);
      return true;
    }
    if (visited.has(node)) return false;

    visited.add(node);
    stack.add(node);

    for (const neighbor of graph.get(node) || []) {
      if (dfs(neighbor)) {
        if (cycle[0] !== node) cycle.push(node);
        else return true;
      }
    }

    stack.delete(node);
    return false;
  }

  for (let i = 0; i < plan.length; i++) {
    if (!visited.has(i) && dfs(i)) break;
  }

  return cycle.reverse();
}

function computeParallelLevels(plan, graph, inDegreeMap) {
  const levels = [];
  const remaining = new Map(inDegreeMap);
  const assigned = new Set();

  while (assigned.size < plan.length) {
    const level = [];
    for (const [node, degree] of remaining) {
      if (degree === 0 && !assigned.has(node)) {
        level.push(node);
      }
    }

    if (level.length === 0) break;

    levels.push(level);
    for (const node of level) {
      assigned.add(node);
      for (const neighbor of graph.get(node) || []) {
        remaining.set(neighbor, remaining.get(neighbor) - 1);
      }
    }
  }

  return levels;
}

export function generateWorkerSpec(task, taskIndex, plan, repoPath) {
  const deps = (task.dependencies || []).map(i => plan[i]);
  const depSummary = deps.length > 0
    ? `\nDEPENDENCIES (completed before this task):\n${deps.map((d, i) => `  ${i + 1}. ${d.description}`).join('\n')}`
    : '';

  const pathRestriction = task.allowed_paths?.length > 0
    ? `\nPATH RESTRICTION: Only modify files matching these paths:\n${task.allowed_paths.map(p => `  - ${p}`).join('\n')}`
    : '';

  return `TASK: ${task.description}

SCOPE: ${task.scope}
${depSummary}${pathRestriction}

INSTRUCTIONS:
1. Work only within the scope defined above
2. Do not modify files outside your allowed_paths${pathRestriction ? '' : ' (use your best judgment)'}
3. If you need to modify a file outside your scope, leave a TODO comment instead
4. Make clean, focused changes — don't over-engineer
5. This is one part of a larger task being done in parallel by other agents

Repo root: ${repoPath}`;
}
