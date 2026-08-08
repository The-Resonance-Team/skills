#!/usr/bin/env node
// One-command install: installs the third-party skills AND the resonance MCP
// stack in one command.
//
//   node scripts/install.mjs                 # skills (interactive agent choice) + MCP for every client present
//   node scripts/install.mjs --client claude # only Claude Code's config
//   node scripts/install.mjs --dry-run       # print actions, change nothing
//
// Skills: npx skills@latest add <github-url> -g — global scope, symlinked by
// default, the CLI prompts the user to choose the agent(s).
// MCP servers come from mcp.json (the portable declaration) and are merged
// into each client's config. Secrets stay as ${VAR} placeholders — the script
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

const log = (msg) => console.log((dryRun ? "[dry-run] " : "") + msg);

// ---------- skills ----------

const skillSources = [
  "https://github.com/mattpocock/skills",
  "https://github.com/DietrichGebert/ponytail",
  "https://github.com/mksglu/context-mode",
];

for (const url of skillSources) {
  log(`npx skills add ${url} -g (global; agent choice is interactive)`);
  if (!dryRun) execSync(`npx -y skills@latest add ${url} -g`, { stdio: "inherit" });
}

log("firecrawl skills -> firecrawl init (CLI-managed)");
if (!dryRun) execSync("npx -y firecrawl init", { stdio: "inherit" });

// ---------- MCP servers (from mcp.json) ----------

const home = os.homedir();
const clients = {
  opencode: { configFile: path.join(home, ".config/opencode/opencode.json"), present: fs.existsSync(path.join(home, ".config/opencode")) },
  claude: { configFile: path.join(home, ".claude.json"), present: fs.existsSync(path.join(home, ".claude")) },
  antigravity: { configFile: null, present: fs.existsSync(path.join(home, ".gemini")) },
};
const selected = clientsArg === "all" ? Object.keys(clients) : [clientsArg];
const active = selected.filter((c) => clients[c].present);

if (!active.length) {
  log(`mcp: no client config target present (--client ${clientsArg}) — MCP merge skipped`);
} else {
  const mcp = JSON.parse(fs.readFileSync(path.join(root, "mcp.json"), "utf8"));
  const toClientShape = (srv) => ({
    opencode: srv.type === "stdio"
      ? { type: "stdio", command: [srv.command, ...(srv.args ?? [])] }
      : { type: "http", url: srv.url, headers: srv.headers },
    claude: srv.type === "stdio"
      ? { type: "stdio", command: srv.command, args: srv.args }
      : { type: "http", url: srv.url, headers: srv.headers },
    antigravity: null,
  });
  const expand = (obj, syntax) => JSON.parse(JSON.stringify(obj).replace(/\$\{(\w+)\}/g, (_m, v) => syntax === "opencode" ? `{env:${v}}` : `\${${v}}`));

  for (const client of active) {
    const cfg = clients[client];
    if (!cfg.configFile) { log(`mcp: ${client} has no config file target`); continue; }
    if (!fs.existsSync(cfg.configFile)) { log(`mcp: ${client} config ${cfg.configFile} missing — skipping servers`); continue; }
    const parsed = JSON.parse(fs.readFileSync(cfg.configFile, "utf8"));
    const key = client === "claude" ? "mcpServers" : "mcp";
    const target = parsed[key] ?? (parsed[key] = {});
    for (const [name, srv] of Object.entries(mcp.mcpServers)) {
      if (name in target) { log(`mcp ${name}: already configured in ${client} — skipped`); continue; }
      target[name] = expand(toClientShape(srv)[client], client);
      log(`mcp ${name} -> ${client} config`);
    }
    if (!dryRun) {
      fs.copyFileSync(cfg.configFile, cfg.configFile + ".resonance.bak");
      fs.writeFileSync(cfg.configFile, JSON.stringify(parsed, null, 2) + "\n");
    }
  }
}

// ---------- state ----------

const stateDir = path.join(home, ".config/team-skills");
const stateFile = path.join(stateDir, "installed.json");
if (!dryRun) {
  fs.mkdirSync(stateDir, { recursive: true });
  const mcp = JSON.parse(fs.readFileSync(path.join(root, "mcp.json"), "utf8"));
  const state = { installedAt: new Date().toISOString(), skillSources, mcpServers: Object.keys(mcp.mcpServers) };
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
  console.log(`state -> ${stateFile}`);
}

console.log(dryRun ? "dry-run complete" : "install complete");
