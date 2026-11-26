import { introspectWorkflow, runInDurableObject } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import type { Deployment } from '../src/deployment';
import type { Env } from '../src/env';
import { approve } from '../src/workflow';

const capability = exports.Capabilities({}) as unknown as {
  start(): Promise<{ id: string; fixtureHash: string }>;
  status(id: string): Promise<{ state: string }>;
};

describe('deployment capability', () => {
  it('requires approval for the exact fixture digest', async () => {
    const deployment = env.DEPLOYMENTS.get(env.DEPLOYMENTS.newUniqueId());
    await deployment.prepare();
    const record = await deployment.status();
    expect(record.fixtureHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await deployment.approve('incorrect')).toBe(false);
    expect((await deployment.status()).state).toBe('pending');
    expect(await deployment.approve(record.fixtureHash)).toBe(true);
    expect((await deployment.status()).state).toBe('approved');
  });

  it('keeps an uncertain timeout unknown and consumes approval once', async () => {
    const deployment = env.DEPLOYMENTS.get(env.DEPLOYMENTS.newUniqueId());
    await deployment.prepare();
    await deployment.approve((await deployment.status()).fixtureHash);
    expect(await deployment.deploy()).toEqual({ state: 'unknown' });
    expect(await deployment.deploy()).toEqual({ state: 'unknown' });
    expect(await deployment.approve((await deployment.status()).fixtureHash)).toBe(false);
  });

  it('keeps approval when event delivery is uncertain during concurrent requests', async () => {
    const id = crypto.randomUUID();
    const deployment = env.DEPLOYMENTS.getByName(id);
    await deployment.prepare();
    const fixtureHash = (await deployment.status()).fixtureHash;
    let calls = 0;
    const testEnv = {
      DEPLOYMENTS: env.DEPLOYMENTS,
      WORKFLOWS: {
        get: async () => ({
          status: async () => ({ status: 'running' }),
          sendEvent: async () => {
            calls += 1;
            if (calls === 1) throw new Error('Simulated lost acknowledgement');
          },
        }),
      },
    } as unknown as Env;
    const request = () =>
      new Request('https://worker.test/approve', {
        method: 'POST',
        body: JSON.stringify({ id, fixtureHash }),
      });
    const responses = await Promise.all([approve(request(), testEnv), approve(request(), testEnv)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 503]);
    expect((await deployment.status()).state).toBe('approved');
  });

  it('sends only one write during concurrent deployment calls', async () => {
    const deployment = env.DEPLOYMENTS.get(env.DEPLOYMENTS.newUniqueId());
    await deployment.prepare();
    expect(await deployment.approve((await deployment.status()).fixtureHash)).toBe(true);
    const result = await runInDurableObject(deployment, async (instance: Deployment) => {
      let writes = 0;
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        writes += 1;
        return new Response('simulated timeout', { status: 408 });
      });
      try {
        const outcomes = await Promise.all([instance.deploy(), instance.deploy()]);
        return { outcomes, writes };
      } finally {
        fetchMock.mockRestore();
      }
    });
    expect(result.outcomes).toEqual([{ state: 'unknown' }, { state: 'unknown' }]);
    expect(result.writes).toBe(1);
    expect(await deployment.approve((await deployment.status()).fixtureHash)).toBe(false);
  });

  it('reports a successful upload and only claims that settings are available', async () => {
    const id = crypto.randomUUID();
    const deployment = env.DEPLOYMENTS.getByName(id);
    await deployment.prepare();
    expect(await deployment.approve((await deployment.status()).fixtureHash)).toBe(true);
    const outcome = await runInDurableObject(deployment, async (instance: Deployment) => {
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async () => Response.json({ success: true }));
      try {
        return await instance.deploy();
      } finally {
        fetchMock.mockRestore();
      }
    });
    expect(outcome).toEqual({ state: 'complete' });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => Response.json({ success: true, result: {} }));
    try {
      const service = exports.DeployService({}) as unknown as {
        verify(id: string): Promise<unknown>;
      };
      expect(await service.verify(id)).toEqual({
        state: 'complete',
        check: 'settings_available',
        fixtureVerified: false,
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('requires the human credential and matching digest before the workflow deploys', async () => {
    await using workflows = await introspectWorkflow(env.WORKFLOWS);
    const pending = await capability.start();
    const instances = await workflows.get();
    expect(instances).toHaveLength(1);
    await instances[0].waitForStatus('running');
    const request = (secret: string, fixtureHash: string) =>
      exports.default.fetch('https://worker.test/approve', {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
        body: JSON.stringify({ id: pending.id, fixtureHash }),
      });
    expect((await request('testing-mcp-token', pending.fixtureHash)).status).toBe(401);
    expect((await request('testing-approval-token', '0'.repeat(64))).status).toBe(409);
    expect((await request('testing-approval-token', pending.fixtureHash)).status).toBe(200);
    await instances[0].waitForStatus('complete');
    expect(await instances[0].getOutput()).toEqual({ state: 'unknown' });
    expect((await request('testing-approval-token', pending.fixtureHash)).status).toBe(409);
  }, 20000);

  it('rejects approval after the workflow times out', async () => {
    await using workflows = await introspectWorkflow(env.WORKFLOWS);
    await workflows.modifyAll(async (modifier) => {
      await modifier.forceEventTimeout({ name: 'human approval' });
    });
    const pending = await capability.start();
    const instances = await workflows.get();
    await instances[0].waitForStatus('errored');
    expect((await capability.status(pending.id)).state).toBe('failed');
    const response = await exports.default.fetch('https://worker.test/approve', {
      method: 'POST',
      headers: {
        authorization: 'Bearer testing-approval-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id: pending.id, fixtureHash: pending.fixtureHash }),
    });
    expect(response.status).toBe(409);
    expect((await env.DEPLOYMENTS.getByName(pending.id).status()).state).toBe('failed');
  }, 20000);
});
