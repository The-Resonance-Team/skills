#!/usr/bin/env node
// One-command install: materializes the resonance MCP stack into client configs
// AND installs the third-party skills into client discovery dirs.
//
//   node scripts/install.mjs                 # install for every client present
//   node scripts/install.mjs --client claude # only Claude Code
//   node scripts/install.mjs --dry-run       # print actions, change nothing
//
// MCP servers come from mcp.json (the portable declaration); skills are fetched
// from their upstream sources. Secrets stay as ${VAR} placeholders — the script
// translates them to each client's env syntax, never to real values.

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const args = process.argv.slice(2);
const clientsArg = args.includes("--client") ? args[args.indexOf("--client") + 1] : "all";
const dryRun = args.includes("--dry-run");

const home = os.homedir();
const clients = {
  opencode: { skillsDir: path.join(home, ".config/opencode/skills"), configFile: path.join(home, ".config/opencode/opencode.json"), present: fs.existsSync(path.join(home, ".config/opencode")) },
  claude: { skillsDir: path.join(home, ".claude/skills"), configFile: path.join(home, ".claude.json"), present: fs.existsSync(path.join(home, ".claude")) },
  antigravity: { skillsDir: path.join(home, ".gemini/config/skills"), configFile: null, present: fs.existsSync(path.join(home, ".gemini")) },
};
const selected = clientsArg === "all" ? Object.keys(clients) : [clientsArg];
const active = selected.filter((c) => clients[c].present);

if (!active.length) { console.log(`no target client present (--client ${clientsArg})`); process.exit(0); }

const log = (msg) => console.log((dryRun ? "[dry-run] " : "") + msg);
const copyDir = (from, to) => { fs.rmSync(to, { recursive: true, force: true }); fs.cpSync(from, to, { recursive: true }); };

// ---------- skills ----------

const skillSources = [
  { url: "https://github.com/mattpocock/skills", sub: "skills/engineering", select: (e) => !e.includes(".") },
  { url: "https://github.com/DietrichGebert/ponytail", sub: "skills/ponytail", select: null },
  { url: "https://github.com/mksglu/context-mode", sub: "skills", select: (e) => !e.includes(".") },
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resonance-install-"));
for (const src of skillSources) {
  const clone = path.join(tmp, src.url.replace(/[^a-z0-9]/gi, "_"));
  execSync(`git clone --depth 1 ${src.url} ${clone}`, { stdio: "pipe" });
  const commit = execSync(`git -C ${clone} rev-parse --short HEAD`, { encoding: "utf8" }).trim();
  const from = path.join(clone, src.sub);
  const entries = src.select ? fs.readdirSync(from).filter(src.select) : [path.basename(from)];
  for (const client of active) {
    for (const entry of entries) {
      const to = path.join(clients[client].skillsDir, entry);
      log(`skill ${entry} -> ${to} (${src.url} @ ${commit})`);
      if (!dryRun) copyDir(path.join(from, entry), to);
    }
  }
}

log("firecrawl skills -> firecrawl init (CLI-managed)");
if (!dryRun) execSync("npx -y firecrawl init", { stdio: "inherit" });

// ---------- MCP servers (from mcp.json) ----------

const mcp = JSON.parse(fs.readFileSync(path.join(root, "mcp.json"), "utf8"));
const toClientShape = (name, srv) => {
  const opencode = srv.type === "stdio"
    ? { type: "stdio", command: [srv.command, ...(srv.args ?? [])] }
    : { type: "http", url: srv.url, headers: srv.headers };
  const claude = srv.type === "stdio"
    ? { type: "stdio", command: srv.command, args: srv.args }
    : { type: "http", url: srv.url, headers: srv.headers };
  return { opencode, claude, antigravity: null };
};
const expand = (obj, syntax) => JSON.parse(JSON.stringify(obj).replace(/\$\{(\w+)\}/g, (_m, v) => syntax === "opencode" ? `{env:${v}}` : `\${${v}}`));

for (const client of active) {
  const cfg = clients[client];
  if (!cfg.configFile) { log(`mcp: ${client} has no config file target (skills only)`); continue; }
  if (!fs.existsSync(cfg.configFile)) { log(`mcp: ${client} config ${cfg.configFile} missing — skipping servers`); continue; }
  const raw = fs.readFileSync(cfg.configFile, "utf8");
  const parsed = JSON.parse(raw);
  const key = client === "claude" ? "mcpServers" : "mcp";
  const target = parsed[key] ?? (parsed[key] = {});
  for (const [name, srv] of Object.entries(mcp.mcpServers)) {
    if (name in target) { log(`mcp ${name}: already configured in ${client} — skipped`); continue; }
    const shape = toClientShape(name, srv)[client];
    target[name] = expand(shape, client);
    log(`mcp ${name} -> ${client} config`);
  }
  if (!dryRun) {
    fs.copyFileSync(cfg.configFile, cfg.configFile + ".resonance.bak");
    fs.writeFileSync(cfg.configFile, JSON.stringify(parsed, null, 2) + "\n");
  }
}

// ---------- state ----------

const stateDir = path.join(home, ".config/team-skills");
const stateFile = path.join(stateDir, "installed.json");
if (!dryRun) {
  fs.mkdirSync(stateDir, { recursive: true });
  const state = { installedAt: new Date().toISOString(), clients: active, mcpServers: Object.keys(mcp.mcpServers) };
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
  console.log(`state -> ${stateFile}`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(dryRun ? "dry-run complete" : `install complete for: ${active.join(", ")}`);
