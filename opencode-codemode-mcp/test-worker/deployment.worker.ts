import { introspectWorkflow, runInDurableObject } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import type { Deployment } from '../src/deployment';

const capability = exports.Capabilities({}) as unknown as {
  start(): Promise<{ id: string; fixtureHash: string }>;
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
    const response = await exports.default.fetch('https://worker.test/approve', {
      method: 'POST',
      headers: {
        authorization: 'Bearer testing-approval-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id: pending.id, fixtureHash: pending.fixtureHash }),
    });
    expect(response.status).toBe(409);
    expect((await env.DEPLOYMENTS.getByName(pending.id).status()).state).toBe('pending');
  }, 20000);
});
