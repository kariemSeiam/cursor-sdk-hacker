/**
 * lib/integrator.mjs — Two-tier execution with semantic merge
 *
 * Usage:
 *   import { integrateResults, mergeWorktrees } from "./lib/integrator.mjs";
 *
 *   // After workers finish:
 *   const result = await integrateResults({
 *     repo: "/path/to/repo",
 *     worktrees: [wt1, wt2, wt3],
 *     tasks: [task1, task2, task3],
 *     model: { id: "claude-opus-4-7" },
 *   });
 */

import { Agent } from "@cursor/sdk";
import { execSync } from "node:child_process";
import { join } from "node:path";

const INTEGRATOR_PROMPT = (taskDescription, workerResults, conflicts) => `You are an integration specialist. Multiple agents have worked on different parts of a codebase. Your job is to review and merge their changes.

ORIGINAL TASK: ${taskDescription}

WORKER RESULTS:
${workerResults.map((r, i) => `
--- Worker ${i + 1} ---
Task: ${r.task ? (typeof r.task === "string" ? r.task : r.task.description || `Task ${i + 1}`) : `Task ${i + 1}`}
Scope: ${r.task && typeof r.task !== "string" ? r.task.scope || "" : ""}
Status: ${r.success ? "SUCCESS" : "FAILED"}
Files changed: ${r.changedFiles?.join(", ") || "none"}
${r.diff ? `Diff:\n${r.diff.slice(0, 500)}${r.diff.length > 500 ? "\n...(truncated)" : ""}` : "No diff"}
`).join("\n")}

${conflicts.length > 0 ? `CONFLICTS DETECTED:\n${conflicts.map(c => `  - ${c.file} (modified by workers: ${c.worktrees.map(i => i + 1).join(", ")})`).join("\n")}` : "No conflicts detected."}

INSTRUCTIONS:
1. Review all worker changes for consistency
2. Fix any integration issues (conflicts, API mismatches, duplicate code)
3. Ensure the final codebase is coherent and functional
4. Run any existing tests if available
5. Make any necessary adjustments to make everything work together

Work in: ${workerResults[0]?.worktreePath || "current directory"}
`;

export async function integrateResults(options) {
  const {
    repo,
    worktrees,
    tasks,
    model = { id: "claude-opus-4-7" },
    baseBranch = "main",
  } = options;

  // Get the current commit SHA for detached HEAD worktrees
  const commitSha = execSync(`git -C "${repo}" rev-parse HEAD`, { encoding: "utf8" }).trim();

  // Collect all worker diffs
  const workerResults = [];
  for (let i = 0; i < worktrees.length; i++) {
    const wt = worktrees[i];
    let diff = "";
    let changedFiles = [];

    try {
      diff = execSync(`git -C "${wt.path}" diff HEAD`, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    } catch {}
    try {
      const tracked = execSync(`git -C "${wt.path}" diff --name-only HEAD`, { encoding: "utf8" });
      const untracked = execSync(`git -C "${wt.path}" ls-files --others --exclude-standard`, { encoding: "utf8" });
      changedFiles = [...tracked.split("\n"), ...untracked.split("\n")].filter(Boolean);
    } catch {}

    workerResults.push({
      task: tasks[i],
      worktreePath: wt.path,
      diff,
      changedFiles,
      success: true,
    });
  }

  // Detect conflicts
  const conflicts = detectConflicts(worktrees.map(w => w.path));

  // Create integration worktree (detached HEAD to avoid conflicts)
  const integrationPath = join(repo, `.claw-swarm/integration-${Date.now()}`);
  execSync(`git -C "${repo}" worktree add --detach "${integrationPath}" ${commitSha}`, { stdio: "pipe" });

  // Apply all non-conflicting changes
  for (let i = 0; i < worktrees.length; i++) {
    const wt = worktrees[i];
    const conflictingFiles = conflicts
      .filter(c => c.worktrees.includes(i))
      .map(c => c.file);

    // Apply changes excluding conflicts
    try {
      const diff = execSync(`git -C "${wt.path}" diff HEAD`, { encoding: "utf8" });
      if (conflictingFiles.length === 0) {
        execSync(`cd "${integrationPath}" && git apply -`, { input: diff, encoding: "utf8" });
      }
    } catch {}
  }

  // Run integrator agent if there are conflicts or for semantic review
  const apiKey = process.env.CURSOR_API_KEY;
  if (apiKey && (conflicts.length > 0 || options.forceIntegrator)) {
    let agent;
    try {
      agent = await Agent.create({
        apiKey,
        name: "integrator",
        model: { id: model.id, params: model.params || [] },
        local: { cwd: integrationPath },
      });

      const prompt = INTEGRATOR_PROMPT(options.taskDescription, workerResults, conflicts);
      const run = await agent.send(prompt);

      for await (const event of run.stream()) {
        if (event.type === "tool_call") {
          console.log(`  Integrator: ${event.name} (${event.status})`);
        }
      }

      const result = await run.wait();

      // Get final diff
      let finalDiff = "";
      try {
        finalDiff = execSync(`git -C "${integrationPath}" diff HEAD`, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
      } catch {}

      return {
        success: result.status === "finished",
        integrationPath,
        diff: finalDiff,
        result,
        conflicts,
        workerResults,
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        integrationPath,
        conflicts,
        workerResults,
      };
    } finally {
      if (agent) {
        try { await agent[Symbol.asyncDispose](); } catch {}
      }
    }
  }

  // No integrator needed — just return the merged state
  let finalDiff = "";
  try {
    finalDiff = execSync(`git -C "${integrationPath}" diff HEAD`, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  } catch {}

  return {
    success: true,
    integrationPath,
    diff: finalDiff,
    conflicts,
    workerResults,
    usedIntegrator: false,
  };
}

function detectConflicts(worktreePaths) {
  const allFiles = new Map();

  for (let i = 0; i < worktreePaths.length; i++) {
    try {
      const output = execSync(`git -C "${worktreePaths[i]}" diff --name-only HEAD`, { encoding: "utf8" });
      for (const f of output.split("\n").filter(Boolean)) {
        if (!allFiles.has(f)) allFiles.set(f, []);
        allFiles.get(f).push(i);
      }
    } catch {}
  }

  const conflicts = [];
  for (const [file, indices] of allFiles) {
    if (indices.length > 1) {
      conflicts.push({ file, worktrees: indices });
    }
  }

  return conflicts;
}

export async function applyIntegration(repo, integrationPath, branch = "main") {
  try {
    // Create a commit in the integration worktree
    execSync(`git -C "${integrationPath}" add -A`, { stdio: "pipe" });
    execSync(`git -C "${integrationPath}" commit -m "chore: integrate swarm results"`, { stdio: "pipe" });

    // Merge into the target branch
    execSync(`git -C "${repo}" merge --no-ff "${integrationPath}" -m "chore: merge swarm integration"`, { stdio: "pipe" });

    // Clean up the integration worktree
    execSync(`git -C "${repo}" worktree remove "${integrationPath}" --force`, { stdio: "pipe" });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function removeIntegrationWorktree(repo, integrationPath) {
  try {
    execSync(`git -C "${repo}" worktree remove "${integrationPath}" --force`, { stdio: "pipe" });
  } catch {
    // Ignore errors
  }
}
