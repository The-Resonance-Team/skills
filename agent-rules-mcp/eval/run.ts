import { catalog } from '../src/search';

import { cases } from './cases';

const url = process.env.EVAL_URL ?? 'http://127.0.0.1:18790';
const token = process.env.AGENT_RULES_MCP_TOKEN ?? 'testing-agent-rules-token';
const headers = {
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
};

type Response = {
  result?: {
    structuredContent?: { matches?: Array<{ id: string; score: number }> };
    isError?: boolean;
  };
};

function lexical(query: string): string[] {
  const words = query.toLowerCase().match(/[a-z0-9@-]{3,}/g) ?? [];
  return catalog.entries
    .map((entry) => {
      const text = entry.retrievalText.toLowerCase();
      return { id: entry.id, score: words.filter((word) => text.includes(word)).length };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((item) => item.id);
}

function hits(expected: string[], actual: string[]): number {
  return expected.filter((id) => actual.includes(id)).length;
}

async function semantic(query: string): Promise<{
  ids: string[];
  bytes: number;
  wallMs: number;
}> {
  const started = performance.now();
  const response = await fetch(`${url}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'search_ai', arguments: { query } },
    }),
  });
  const body = await response.text();
  const parsed = JSON.parse(body) as Response;
  if (response.status !== 200 || parsed.result?.isError === true) {
    throw new Error(`search_ai failed: ${body.slice(0, 300)}`);
  }
  return {
    ids: (parsed.result?.structuredContent?.matches ?? []).map((match) => match.id),
    bytes: body.length,
    wallMs: performance.now() - started,
  };
}

const rows = [];
for (const item of cases) {
  const result = await semantic(item.query);
  const baseline = lexical(item.query);
  rows.push({
    query: item.query,
    expected: item.expected,
    semanticTop5: result.ids,
    lexicalTop5: baseline,
    semanticHits: hits(item.expected, result.ids),
    lexicalHits: hits(item.expected, baseline),
    responseBytes: result.bytes,
    approxTokens: Math.round(result.bytes / 4),
    wallMs: Math.round(result.wallMs * 100) / 100,
  });
}

const total = rows.reduce(
  (sum, row) => ({
    semanticHits: sum.semanticHits + row.semanticHits,
    lexicalHits: sum.lexicalHits + row.lexicalHits,
    expected: sum.expected + row.expected.length,
    bytes: sum.bytes + row.responseBytes,
    wallMs: sum.wallMs + row.wallMs,
  }),
  { semanticHits: 0, lexicalHits: 0, expected: 0, bytes: 0, wallMs: 0 },
);

console.log(
  JSON.stringify(
    {
      cases: rows.length,
      semanticRecall: Math.round((100 * total.semanticHits) / total.expected) / 100,
      lexicalRecall: Math.round((100 * total.lexicalHits) / total.expected) / 100,
      meanResponseBytes: Math.round(total.bytes / rows.length),
      meanWallMs: Math.round((total.wallMs / rows.length) * 100) / 100,
      rows,
    },
    null,
    2,
  ),
);
