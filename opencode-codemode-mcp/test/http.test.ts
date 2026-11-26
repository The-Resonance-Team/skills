import { describe, expect, test } from 'bun:test';
import { route } from '../src/http';

const handlers = {
  mcp: async () => new Response('mcp'),
  approve: async () => new Response('approved'),
};

describe('HTTP authorization', () => {
  test('rejects absent and incorrect credentials', async () => {
    const request = new Request('https://example.test/mcp', {
      headers: { authorization: 'Bearer wrong' },
    });
    const response = await route(request, 'a-secret-value', 'other-secret', handlers);
    expect(response.status).toBe(401);
  });

  test('accepts the MCP credential for the MCP endpoint', async () => {
    const request = new Request('https://example.test/mcp', {
      headers: { authorization: 'Bearer a-secret-value' },
    });
    const response = await route(request, 'a-secret-value', 'other-secret', handlers);
    expect(await response.text()).toBe('mcp');
  });

  test('the MCP credential cannot approve a deployment', async () => {
    const request = new Request('https://example.test/approve', {
      method: 'POST',
      headers: { authorization: 'Bearer a-secret-value' },
    });
    const response = await route(request, 'a-secret-value', 'other-secret', handlers);
    expect(response.status).toBe(401);
  });

  test('the separate approval credential can access the approval endpoint', async () => {
    const request = new Request('https://example.test/approve', {
      method: 'POST',
      headers: { authorization: 'Bearer other-secret' },
    });
    const response = await route(request, 'a-secret-value', 'other-secret', handlers);
    expect(await response.text()).toBe('approved');
  });

  test('rejects an oversized request body without reaching the MCP handler', async () => {
    const request = new Request('https://example.test/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer a-secret-value' },
      body: 'a'.repeat(65537),
    });
    const response = await route(request, 'a-secret-value', 'other-secret', handlers);
    expect(response.status).toBe(413);
  });
});
