import { timingSafeEqual } from 'node:crypto';

type Handlers = {
  mcp: (request: Request) => Promise<Response>;
  approve: (request: Request) => Promise<Response>;
};

async function authorized(header: string | null, secret: string): Promise<boolean> {
  if (!secret || !header?.startsWith('Bearer ')) return false;
  const encoder = new TextEncoder();
  const expected = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  const actual = await crypto.subtle.digest('SHA-256', encoder.encode(header.slice(7)));
  return timingSafeEqual(new Uint8Array(expected), new Uint8Array(actual));
}

export async function route(
  request: Request,
  mcpSecret: string,
  approvalSecret: string,
  handlers: Handlers,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path !== '/mcp' && path !== '/approve') return new Response('Not found', { status: 404 });
  const isApproval = path === '/approve';
  const secret = isApproval ? approvalSecret : mcpSecret;
  if (!(await authorized(request.headers.get('authorization'), secret))) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        return new Response('Request too large', { status: 413 });
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    request = new Request(request, { body });
  }
  return isApproval ? handlers.approve(request) : handlers.mcp(request);
}
