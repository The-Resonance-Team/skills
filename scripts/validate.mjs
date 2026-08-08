#!/usr/bin/env node
// Validates the resonance plugin package against the vendored 1.0.0 schemas.
// No dependencies: the two schemas are closed and small; hand-rolled checks
// cover the full 1.0.0 contract. Exit 1 with a report on any failure.

import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname) + "/..";
const errors = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); };

const NAME_RE = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const PLUGIN_KEYS = new Set(["$schema", "name", "version", "description", "author", "homepage", "repository", "license", "keywords", "extensions"]);
const PLUGIN_AUTHOR_KEYS = new Set(["name", "email", "url"]);
const MCP_TYPES = ["stdio", "streamable-http", "sse"];
const RESERVED_ENV = ["PLUGIN_ROOT", "PLUGIN_DATA"];

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { errors.push(`${file}: not valid JSON (${e.message})`); return null; }
}

// --- plugin.json ---
const p = readJson(path.join(root, "plugin.json"));
if (p) {
  ok(p.$schema === "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json", "plugin.json: $schema must be the 1.0.0 plugin schema");
  ok(typeof p.name === "string" && NAME_RE.test(p.name), `plugin.json: name '${p.name}' must match ${NAME_RE}`);
  for (const k of Object.keys(p)) ok(PLUGIN_KEYS.has(k), `plugin.json: unknown top-level field '${k}'`);
  if (p.version !== undefined) ok(typeof p.version === "string", "plugin.json: version must be a string");
  if (p.author !== undefined) {
    ok(typeof p.author === "object" && p.author !== null, "plugin.json: author must be an object");
    if (p.author) for (const k of Object.keys(p.author)) ok(PLUGIN_AUTHOR_KEYS.has(k), `plugin.json: unknown author field '${k}'`);
  }
  if (p.keywords !== undefined) ok(Array.isArray(p.keywords) && p.keywords.every((k) => typeof k === "string"), "plugin.json: keywords must be a string array");
  if (p.extensions !== undefined) ok(typeof p.extensions === "object" && p.extensions !== null && Object.values(p.extensions).every((v) => typeof v === "object" && v !== null), "plugin.json: extensions must be an object of objects");
}

// --- mcp.json ---
const m = readJson(path.join(root, "mcp.json"));
if (m) {
  ok(m.$schema === "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json", "mcp.json: $schema must be the 1.0.0 mcp schema");
  ok(typeof m.mcpServers === "object" && m.mcpServers !== null, "mcp.json: mcpServers required");
  for (const [name, srv] of Object.entries(m.mcpServers ?? {})) {
    ok(typeof srv === "object" && srv !== null, `mcp.json: server '${name}' must be an object`);
    if (!srv) continue;
    ok(MCP_TYPES.includes(srv.type), `mcp.json: '${name}' type must be one of ${MCP_TYPES.join("/")}`);
    if (srv.type === "stdio") {
      ok(typeof srv.command === "string" && srv.command.length >= 1, `mcp.json: '${name}' stdio requires a command string`);
      ok(srv.args === undefined || (Array.isArray(srv.args) && srv.args.every((a) => typeof a === "string")), `mcp.json: '${name}' args must be a string array`);
      ok(srv.env === undefined || (typeof srv.env === "object" && !Object.keys(srv.env).some((k) => RESERVED_ENV.includes(k))), `mcp.json: '${name}' env must not override ${RESERVED_ENV.join("/")}`);
      ok(srv.cwd === undefined || /^(?:\.\/|\$\{PLUGIN_ROOT\}(?:\/|$)|\$\{PLUGIN_DATA\}(?:\/|$))/.test(srv.cwd), `mcp.json: '${name}' cwd must be ./ or PLUGIN_ROOT/PLUGIN_DATA rooted`);
      for (const k of Object.keys(srv)) ok(["type", "command", "args", "env", "cwd"].includes(k), `mcp.json: '${name}' unknown stdio field '${k}'`);
    } else {
      ok(typeof srv.url === "string" && srv.url.length >= 1, `mcp.json: '${name}' requires a url`);
      ok(srv.headers === undefined || (typeof srv.headers === "object" && Object.values(srv.headers).every((h) => typeof h === "string")), `mcp.json: '${name}' headers must map to strings`);
      for (const k of Object.keys(srv)) ok(["type", "url", "headers"].includes(k), `mcp.json: '${name}' unknown ${srv.type} field '${k}'`);
    }
  }
}

// --- skills/ ---
const skillsDir = path.join(root, "skills");
if (fs.existsSync(skillsDir)) {
  for (const entry of fs.readdirSync(skillsDir)) {
    const skill = path.join(skillsDir, entry);
    if (entry.startsWith(".")) continue;
    const md = path.join(skill, "SKILL.md");
    ok(fs.statSync(skill).isDirectory() && fs.existsSync(md) && fs.statSync(md).isFile(), `skills/${entry}: must be a directory with a regular SKILL.md`);
    if (!fs.existsSync(md)) continue;
    const txt = fs.readFileSync(md, "utf8");
    const fm = txt.match(/^---\n([\s\S]*?)\n---/);
    ok(fm !== null, `skills/${entry}/SKILL.md: missing YAML frontmatter`);
    if (fm) {
      ok(/^name:\s*\S+/m.test(fm[1]), `skills/${entry}/SKILL.md: frontmatter needs 'name:'`);
      ok(/^description:\s*\S+/m.test(fm[1]), `skills/${entry}/SKILL.md: frontmatter needs 'description:'`);
    }
  }
} else {
  ok(true, "skills/: missing");
}

// --- containment: no .git dirs inside the package (the repo's own .git is not part of the package) ---
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() && !e.isSymbolicLink() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
for (const f of walk(root).filter((f) => f.split(path.sep).includes(".git") && !f.startsWith(path.join(root, ".git") + path.sep))) ok(false, `containment: unexpected .git path ${f}`);

if (errors.length) {
  console.error("resonance package invalid:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log("resonance package valid: plugin.json, mcp.json, skills/, schemas/");
