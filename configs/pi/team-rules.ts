/**
 * Pi stand-in for OpenCode `instructions[]`.
 * Loads the two standing files at session start (5s timeout, last-good cache, local clone).
 * Does not load per-scope `rules/*.md` or `workflows/*.md`.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const RAW = "https://raw.githubusercontent.com/The-Resonance-Team/skills/main";
const FILES = ["profiles/xirothedev.md", "CONTEXT.md"] as const;
const TIMEOUT_MS = 5000;

type Via = "remote" | "cache" | "clone" | "missing";

export type TeamRulesLoad = {
	text: string;
	via: Via;
};

function agentDir(): string {
	return process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
}

function cacheFile(name: string): string {
	return path.join(agentDir(), "cache", "team-rules", name.replaceAll("/", "__"));
}

function cloneFile(name: string): string {
	return path.join(os.homedir(), "workspace", "skills", name);
}

function readText(file: string): string | null {
	try {
		const text = fs.readFileSync(file, "utf8").trim();
		return text.length > 0 ? text : null;
	} catch {
		return null;
	}
}

function usable(text: string): boolean {
	return text.includes("# ") && text.length > 200;
}

async function fetchText(url: string): Promise<string | null> {
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
		if (!res.ok) return null;
		const text = (await res.text()).trim();
		return usable(text) ? text : null;
	} catch {
		return null;
	}
}

export async function loadTeamRules(): Promise<TeamRulesLoad> {
	const parts: string[] = [];
	let remote = 0;
	let cache = 0;
	let clone = 0;

	for (const name of FILES) {
		const live = await fetchText(`${RAW}/${name}`);
		if (live) {
			const file = cacheFile(name);
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(file, live);
			parts.push(live);
			remote += 1;
			continue;
		}
		const cached = readText(cacheFile(name));
		if (cached) {
			parts.push(cached);
			cache += 1;
			continue;
		}
		const offline = readText(cloneFile(name));
		if (offline) {
			parts.push(offline);
			clone += 1;
			continue;
		}
		parts.push(`Missing ${name}. Fetch ${RAW}/${name}`);
	}

	const via: Via =
		remote === FILES.length ? "remote" : cache > 0 ? "cache" : clone > 0 ? "clone" : "missing";
	const text = [
		"Standing team rules are already in this section. Do not fetch these two files again. Fetch only the `rules/*.md` and `workflows/*.md` rows in the router whose scope matches this repository and task.",
		...parts,
	].join("\n\n");
	return { text, via };
}

let standing = "";
let pending: Promise<TeamRulesLoad> | null = null;

function ensureLoaded(): Promise<TeamRulesLoad> {
	if (!pending) {
		pending = loadTeamRules()
			.then((result) => {
				standing = result.text;
				return result;
			})
			.catch((error: unknown) => {
				pending = null;
				throw error;
			});
	}
	return pending;
}

export default function teamRules(pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		standing = "";
		pending = null;
		const result = await ensureLoaded();
		if (result.via === "remote" || ctx?.hasUI === false) return;
		ctx?.ui?.notify?.(`Team rules: remote fetch failed, using ${result.via}`, "warning");
	});

	pi.on("before_agent_start", async (event) => {
		if (!standing) await ensureLoaded();
		event.systemPromptOptions.sections.team_rules = standing;
	});
}
