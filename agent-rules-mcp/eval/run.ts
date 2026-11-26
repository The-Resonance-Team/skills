import { searchAi } from '../src/search';
import { assertRecall, evaluate, type Lookup } from './evaluate';
import { fixtureAi } from './fixture-ai';

const url = process.env.EVAL_URL ?? 'http://127.0.0.1:18790';
const token = process.env.AGENT_RULES_MCP_TOKEN ?? 'testing-agent-rules-token';

async function remote(query: string): Promise<Lookup> {
  const started = performance.now();
  const response = await fetch(`${url}/mcp`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'search_ai', arguments: { query } },
    }),
  });
  const body = await response.text();
  const parsed = JSON.parse(body) as {
    result?: { isError?: boolean; structuredContent?: { matches?: Array<{ id: string }> } };
  };
  const matches = parsed.result?.structuredContent?.matches;
  if (!response.ok || parsed.result?.isError === true || !Array.isArray(matches)) {
    throw new Error(`search_ai failed: ${body.slice(0, 300)}`);
  }
  return {
    ids: matches.map((match) => match.id),
    bytes: new TextEncoder().encode(body).byteLength,
    wallMs: performance.now() - started,
  };
}

async function local(query: string): Promise<Lookup> {
  const started = performance.now();
  const { matches } = await searchAi(query, fixtureAi);
  return {
    ids: matches.map((match) => match.id),
    bytes: new TextEncoder().encode(JSON.stringify({ matches })).byteLength,
    wallMs: performance.now() - started,
  };
}

const offline = process.argv.includes('--local');
const report = await evaluate(offline ? local : remote);
console.log(JSON.stringify({ mode: offline ? 'offline-fixtures' : 'http', ...report }, null, 2));
assertRecall(report);
