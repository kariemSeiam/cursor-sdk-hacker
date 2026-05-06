#!/usr/bin/env node
/**
 * ca — Cursor Claw · local SDK + REST
 * Local SDK execution (composer-2) + REST API (api.cursor.com)
 *
 * Model system (SDK v1.0.9+):
 *   Models use parameters, not separate IDs.
 *   composer-2-fast is now composer-2 with { fast: "true" }
 *   Default variant for composer-2 is fast=true.
 */

import { readFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const BASE_URL = process.env.CURSOR_BACKEND_URL || "https://api.cursor.com";
const KEYFILE = process.env.CURSOR_KEY_FILE || join(homedir(), ".cursor-api-key");
const VERSION = "1.1.0";

// Default model + params. composer-2 defaults to fast=true when no params given.
const DEFAULT_MODEL = "composer-2";
const DEFAULT_PARAMS = {};  // empty = use SDK defaults (fast=true for composer-2)

const c = {
  r: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", grn: "\x1b[32m", yel: "\x1b[33m",
  blu: "\x1b[34m", mag: "\x1b[35m", cyn: "\x1b[36m",
};

const log = m => console.log(m);
const ok = m => console.log(`${c.grn}✔${c.r} ${m}`);
const fail = m => { console.log(`${c.red}✖${c.r} ${m}`); process.exit(1); };
const clawMsg = m => console.log(`${c.mag}🦀${c.r} ${m}`);

function getKey() {
  if (process.env.CURSOR_API_KEY) return process.env.CURSOR_API_KEY;
  if (existsSync(KEYFILE)) return readFileSync(KEYFILE, "utf8").trim();
  fail("No API key — set CURSOR_API_KEY or save your subscriber key to " + KEYFILE);
}

function enc(s) { return encodeURIComponent(s); }

function parseModelArg(str) {
  if (!str) return { id: DEFAULT_MODEL, parameters: DEFAULT_PARAMS };
  // Support "model-id" or "model-id:param1=val1,param2=val2"
  const [id, paramsStr] = str.split(":");
  const parameters = {};
  if (paramsStr) {
    for (const pair of paramsStr.split(",")) {
      const [k, v] = pair.split("=");
      if (k && v) parameters[k] = v;
    }
  }
  return { id, parameters };
}

function modelLabel(m) {
  const parts = [m.id];
  if (m.parameters && Object.keys(m.parameters).length > 0) {
    parts.push(Object.entries(m.parameters).map(([k,v]) => `${k}=${v}`).join(","));
  }
  return parts.join(" ");
}

// ─── REST API (cloud) ──────────────

async function restApi(method, path, body = null) {
  const key = getKey();
  const h = { Authorization: `Bearer ${key}`, "x-cursor-streaming": "true" };
  if (body) h["Content-Type"] = "application/json";
  const opts = { method, headers: h };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  if (!res.ok) fail(`API ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// ─── Local SDK (composer) ─────────

function localAsk(prompt, cwd, model) {
  const tmpDir = join(REPO_ROOT, ".tmp-cli");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  // Escape for embedding in template literal: backslash, backtick, ${, "
  const safeCwd = (cwd || process.cwd())
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$")
    .replace(/"/g, '\\"');

  const apiKey = getKey();
  const modelJson = JSON.stringify(model);
  const script = `import { Agent } from "@cursor/sdk";
async function main() {
  const agent = await Agent.create({
    apiKey: "${apiKey}",
    name: "Cursor Claw CLI",
    model: ${modelJson},
    local: { cwd: "${safeCwd}" }
  });
  const run = await agent.send(${JSON.stringify(prompt)});
  for await (const event of run.stream()) {
    if (event.type === "assistant") {
      for (const block of event.message.content) {
        if (block.type === "text") process.stdout.write(JSON.stringify({t:"d",d:block.text})+"\\n");
      }
    } else if (event.type === "thinking") {
      const text = event.message?.content?.[0]?.text || "";
      if (text) process.stdout.write(JSON.stringify({t:"think",d:text})+"\\n");
    } else if (event.type === "tool_use") {
      process.stdout.write(JSON.stringify({t:"tool",n:event.name||"?",s:"start"})+"\\n");
    } else if (event.type === "tool_result") {
      process.stdout.write(JSON.stringify({t:"tool",n:event.name||"?",s:"done"})+"\\n");
    }
  }
  await run.wait();
  process.stdout.write(JSON.stringify({t:"end"})+"\\n");
}
main().catch(e => { process.stdout.write(JSON.stringify({t:"err",m:e.message})+"\\n"); process.exit(1); });`;

  const scriptPath = join(tmpDir, `ask-${Date.now()}.mts`);
  writeFileSync(scriptPath, script);

  return new Promise((resolve, reject) => {
    const env = { ...process.env, CURSOR_API_KEY: getKey() };
    const child = execFile("npx", ["tsx", scriptPath], {
      cwd: REPO_ROOT, env, timeout: 180000, maxBuffer: 10 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      try { unlinkSync(scriptPath); } catch {};
      if (error && !stdout) { reject(error); return; }
      let text = "";
      for (const line of (stdout || "").split("\n").filter(Boolean)) {
        try { const e = JSON.parse(line); if (e.t === "d") text += e.d; } catch {}
      }
      resolve({ text, raw: stdout, stderr });
    });

    // Graceful Ctrl+C: kill child, clean up temp file
    const cleanup = () => {
      try { child.kill("SIGTERM"); } catch {}
      try { unlinkSync(scriptPath); } catch {}
      process.exit(130);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    child.on("exit", () => {
      process.removeListener("SIGINT", cleanup);
      process.removeListener("SIGTERM", cleanup);
    });

    let buffer = "";
    child.stdout?.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n"); buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const evt = JSON.parse(line);
          if (evt.t === "d") process.stdout.write(evt.d);
          else if (evt.t === "think") process.stdout.write(`${c.dim}${evt.d}${c.r}`);
          else if (evt.t === "tool" && evt.s === "start") log(`\n  ${c.yel}⟳${c.r} ${c.bold}${evt.n}${c.r}`);
          else if (evt.t === "tool" && evt.s === "done") log(`  ${c.grn}✔${c.r} ${evt.n}`);
          else if (evt.t === "end") log("");
          else if (evt.t === "err") fail(evt.m);
        } catch { process.stdout.write(line); }
      }
    });

    child.stderr?.on("data", (chunk) => {
      const s = chunk.toString();
      if (!s.includes("Ripgrep") && !s.includes("ignore") && !s.includes("node_modules")) {
        process.stderr.write(s);
      }
    });
  });
}

// ─── Commands ──────────────────────

async function cmdAsk(args, model) {
  const text = args.join(" ");
  if (!text) fail("Usage: ca ask <your question>");
  clawMsg(`Model: ${c.bold}${modelLabel(model)}${c.r} | CWD: ${process.cwd()}`);
  clawMsg(`Asking: "${text.slice(0, 80)}${text.length > 80 ? "..." : ""}"\n`);
  await localAsk(text, undefined, model);
}

async function cmdCode(args, model) {
  const text = args.join(" ");
  if (!text) fail("Usage: ca code <task description>");
  const cwd = process.cwd();
  clawMsg(`Model: ${c.bold}${modelLabel(model)}${c.r} | CWD: ${cwd}`);
  clawMsg(`Task: "${text.slice(0, 80)}${text.length > 80 ? "..." : ""}"\n`);
  await localAsk(text, cwd, model);
}

async function cmdMe() {
  clawMsg("Account info...");
  const d = await restApi("GET", "/v1/me");
  console.log(JSON.stringify(d, null, 2));
}

async function cmdModels() {
  clawMsg("Fetching models...");
  const d = await restApi("GET", "/v1/models");
  if (d.items?.length) {
    log(`\n${c.bold}Cloud Models (REST API):${c.r}`);
    for (const m of d.items) {
      log(`  ${c.grn}●${c.r} ${c.bold}${m.id}${c.r} ${c.dim}${m.name || ""}${c.r}`);
    }
    log(`\n  Total: ${d.items.length}`);
  }
  log(`\n${c.bold}Local Models (SDK):${c.r}`);
  log(`  ${c.grn}●${c.r} ${c.bold}composer-2${c.r} ${c.dim}(default, fast=true)${c.r}`);
  log(`  ${c.grn}●${c.r} ${c.bold}composer-2:fast=false${c.r} ${c.dim}(more thorough)${c.r}`);
  log(`  ${c.grn}●${c.r} ${c.bold}composer-1.5${c.r} ${c.dim}(legacy)${c.r}`);
  log(`\n${c.dim}Tip: use --model composer-2:fast=false for thorough mode${c.r}`);
}

async function cmdRepos() {
  clawMsg("Fetching repos...");
  const d = await restApi("GET", "/v1/repositories");
  console.log(JSON.stringify(d, null, 2));
}

async function cmdAgents(args) {
  const limit = args[0] || "20";
  clawMsg("Fetching agents...");
  const d = await restApi("GET", `/v1/agents?limit=${limit}&includeArchived=true`);
  if (d.items?.length) {
    log(`\n${c.bold}Agents:${c.r}`);
    for (const a of d.items) {
      const st = a.archived ? `${c.red}archived${c.r}` : `${c.grn}${a.status || "?"}${c.r}`;
      log(`  ${c.blu}●${c.r} ${c.bold}${a.agentId}${c.r}`);
      log(`    ${a.name || "unnamed"} | ${st} | ${a.runtime}`);
    }
  } else log("  No agents found.");
}

async function cmdPrompt(args, model) {
  const text = args.join(" ");
  if (!text) fail("Usage: ca prompt <text>");
  clawMsg(`Cloud prompt [${modelLabel(model)}]...`);
  const res = await restApi("POST", "/v1/agents", {
    prompt: { text }, model: { id: model.id },
  });
  const agentId = res.agent?.id, runId = res.run?.id;
  if (!agentId || !runId) fail("Failed: " + JSON.stringify(res));
  ok(`Agent: ${agentId} | Run: ${runId}\n`);
  await streamRun(agentId, runId);
  try { await restApi("DELETE", `/v1/agents/${enc(agentId)}`); } catch {}
}

async function cmdRuns(args) {
  const agentId = args[0];
  if (!agentId) fail("Usage: ca runs <agentId>");
  clawMsg(`Runs for ${agentId}`);
  const d = await restApi("GET", `/v1/agents/${enc(agentId)}/runs?limit=20`);
  if (d.items?.length) {
    for (const r of d.items) {
      const s = r.status === "FINISHED" ? `${c.grn}✓${c.r}` :
                r.status === "RUNNING" ? `${c.yel}⟳${c.r}` :
                `${c.red}✖${c.r}`;
      log(`  ${s} ${r.id} | ${r.status} | ${c.dim}${r.createdAt}${c.r}`);
    }
  } else log("  No runs.");
}

async function streamRun(agentId, runId) {
  const key = getKey();
  const h = { Authorization: `Bearer ${key}`, Accept: "text/event-stream", "x-cursor-streaming": "true" };
  const res = await fetch(`${BASE_URL}/v1/agents/${enc(agentId)}/runs/${enc(runId)}/stream`, { headers: h });
  if (!res.ok || !res.body) fail(`Stream ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n"); buf = parts.pop();
    for (const part of parts) {
      const lines = part.split("\n");
      let evt = "", data = "";
      for (const l of lines) {
        if (l.startsWith("event: ")) evt = l.slice(7).trim();
        else if (l.startsWith("data: ")) data += l.slice(6);
      }
      if (!data) continue;
      let p; try { p = JSON.parse(data); } catch { continue; }
      if (evt === "assistant" && p.text) process.stdout.write(p.text);
      else if (evt === "thinking" && p.text) process.stdout.write(`${c.dim}${p.text}${c.r}`);
      else if (evt === "tool_call") {
        const icon = p.status === "completed" ? "✔" : "⟳";
        log(`\n  ${c.yel}${icon}${c.r} ${c.bold}${p.name || "?"}${c.r}`);
      }
      else if (evt === "result" && p.durationMs) log(`\n${c.dim}⏱ ${(p.durationMs / 1000).toFixed(1)}s${c.r}`);
    }
  }
  log("");
}

async function cmdStream(args) {
  const [agentId, runId] = args;
  if (!agentId || !runId) fail("Usage: ca stream <agentId> <runId>");
  clawMsg(`Streaming ${runId}...\n`);
  await streamRun(agentId, runId);
}

async function cmdDelete(args) {
  const id = args[0]; if (!id) fail("Usage: ca delete <agentId>");
  clawMsg(`Deleting ${id}...`);
  await restApi("DELETE", `/v1/agents/${enc(id)}`);
  ok("Deleted!");
}

async function cmdRaw(args) {
  const method = (args[0] || "GET").toUpperCase();
  const path = args[1]; const body = args[2] ? JSON.parse(args[2]) : null;
  if (!path) fail("Usage: ca raw <METHOD> <path> [json]");
  clawMsg(`${method} ${path}`);
  const d = await restApi(method, path, body);
  console.log(JSON.stringify(d, null, 2));
}

// ─── Help ──────────────────────────

function help() {
  log(`
${c.mag}🦀 Cursor Claw · ca${c.r} ${c.dim}v${VERSION}${c.r}

${c.bold}Local (SDK — runs on your machine):${c.r}
  ${c.cyn}ask${c.r} <question>              Ask composer a question
  ${c.cyn}code${c.r} <task>                 Give composer a coding task

${c.bold}Cloud (REST API — runs in Cursor's VMs):${c.r}
  ${c.cyn}me${c.r}                          Account info
  ${c.cyn}models${c.r}                      List all models
  ${c.cyn}repos${c.r}                       List repos
  ${c.cyn}agents${c.r} [limit]              List agents
  ${c.cyn}prompt${c.r} <text>               Cloud prompt (needs repo+pricing)
  ${c.cyn}runs${c.r} <agentId>              List runs
  ${c.cyn}stream${c.r} <ag> <run>           Stream output
  ${c.cyn}delete${c.r} <agentId>            Delete agent
  ${c.cyn}raw${c.r} <M> <path> [body]       Raw API call

${c.bold}Flags:${c.r}
  ${c.cyn}--model${c.r} <id[:params]>       Override model (default: ${DEFAULT_MODEL})
                                   Examples: composer-2:fast=false
                                             claude-opus-4-7:reasoning=high
  ${c.cyn}--version${c.r}                   Show version
  ${c.cyn}--help${c.r}, ${c.cyn}-h${c.r}                    This help

${c.bold}Config:${c.r}
  CURSOR_API_KEY       API key (or saved in ${KEYFILE})
  CURSOR_MODEL         Model override (same as --model)
  CURSOR_KEY_FILE      Custom key file path
  CURSOR_BACKEND_URL   Custom REST API base URL

${c.dim}Examples:${c.r}
  ${c.dim}ca ask "what is 2+2?"${c.r}
  ${c.dim}ca code "create a hello.py file"${c.r}
  ${c.dim}ca code "refactor auth" --model composer-2:fast=false${c.r}
  ${c.dim}ca models${c.r}
  ${c.dim}ca raw GET /v1/models${c.r}
  ${c.dim}ca --version${c.r}
`);
}

// ─── Main ──────────────────────────

function main() {
  const argv = process.argv.slice(2);

  // --version
  if (argv[0] === "--version" || argv[0] === "-v") {
    log(`ca v${VERSION}`);
    process.exit(0);
  }

  // --help
  if (!argv[0] || argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
    help();
    process.exit(0);
  }

  // Parse --model flag (can appear before or after command)
  let modelOverride = null;
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--model" && argv[i + 1]) {
      modelOverride = argv[++i];
    } else {
      args.push(argv[i]);
    }
  }

  const model = parseModelArg(modelOverride || process.env.CURSOR_MODEL || null);
  const cmd = args[0];
  const rest = args.slice(1);

  const cmds = {
    ask: () => cmdAsk(rest, model),
    code: () => cmdCode(rest, model),
    me: cmdMe,
    models: cmdModels,
    repos: cmdRepos,
    agents: () => cmdAgents(rest),
    prompt: () => cmdPrompt(rest, model),
    runs: () => cmdRuns(rest),
    stream: () => cmdStream(rest),
    delete: () => cmdDelete(rest),
    raw: () => cmdRaw(rest),
  };

  const fn = cmds[cmd];
  if (!fn) fail(`Unknown: ${cmd}\nRun 'ca help' for commands`);

  (async () => {
    try { await fn(); } catch (e) { fail(e.message); }
  })();
}

main();
