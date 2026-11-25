import { rawWorkload, workload, type Result } from './workload';

const url = process.env.TEST_WORKER_URL;
const token = process.env.CODEMODE_MCP_TOKEN ?? 'testing-mcp-token';
const rounds = 5;

type Report = {
  mode: string;
  wallMs: number;
  reportedElapsedMs: number;
  payloadBytes: number;
  approxTokens: number;
  result?: Result;
};

async function local(): Promise<Report> {
  const loaded = await import(`data:text/javascript,${encodeURIComponent(workload)}`);
  const run = loaded.default as () => Promise<Result>;
  const started = performance.now();
  const result = await run();
  const wallMs = performance.now() - started;
  return {
    mode: 'local',
    wallMs,
    reportedElapsedMs: result.elapsedMs,
    payloadBytes: JSON.stringify(result).length,
    approxTokens: Math.round(JSON.stringify(result).length / 4),
    result,
  };
}

async function remote(code: string): Promise<Report> {
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
      params: { name: 'execute', arguments: { code } },
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Remote call failed: ${response.status} ${text}`);
  const payload = JSON.parse(text) as {
    result: { structuredContent?: { result?: Result }; isError?: boolean };
  };
  if (payload.result.isError || !payload.result.structuredContent?.result) {
    throw new Error(text);
  }
  const result = payload.result.structuredContent.result;
  return {
    mode: 'remote',
    wallMs: 0,
    reportedElapsedMs: result.elapsedMs,
    payloadBytes: text.length,
    approxTokens: Math.round(text.length / 4),
    result,
  };
}

function average(values: number[]): number {
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

const localReports = await Promise.all(Array.from({ length: rounds }, () => local()));
const rawLoaded = await import(`data:text/javascript,${encodeURIComponent(rawWorkload)}`);
const rawRun = rawLoaded.default as () => Promise<{ bytes: number }>;
const raw = await rawRun();
const report = {
  rounds,
  local: {
    wallMs: average(localReports.map((item) => item.wallMs)),
    reportedElapsedMs: average(localReports.map((item) => item.reportedElapsedMs)),
    payloadBytes: localReports[0].payloadBytes,
    approxTokens: localReports[0].approxTokens,
    result: localReports[0].result,
  },
  modelContext: {
    rawDataBytes: raw.bytes,
    rawDataApproxTokens: Math.round(raw.bytes / 4),
    note: 'Raw data cost when the model receives records instead of a summary.',
  },
};

if (url) {
  const warm: Report[] = [];
  const cold: Report[] = [];
  for (let index = 0; index < rounds; index += 1) {
    const code = workload.replace('length: 5000', `length: ${5000 + index}`);
    const coldStarted = performance.now();
    cold.push({ ...(await remote(code)), wallMs: 0 });
    cold[index].wallMs = performance.now() - coldStarted;
    const warmStarted = performance.now();
    warm.push({ ...(await remote(workload)), wallMs: 0 });
    warm[index].wallMs = performance.now() - warmStarted;
  }
  Object.assign(report, {
    remoteWarm: {
      wallMs: average(warm.map((item) => item.wallMs)),
      reportedElapsedMs: average(warm.map((item) => item.reportedElapsedMs)),
      payloadBytes: warm[0].payloadBytes,
      approxTokens: warm[0].approxTokens,
    },
    remoteCold: {
      wallMs: average(cold.map((item) => item.wallMs)),
      reportedElapsedMs: average(cold.map((item) => item.reportedElapsedMs)),
      payloadBytes: cold[0].payloadBytes,
      approxTokens: cold[0].approxTokens,
    },
  });
}

console.log(JSON.stringify(report, null, 2));
