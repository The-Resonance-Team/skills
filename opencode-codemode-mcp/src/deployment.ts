import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';
import { fixture, fixtureHash, fixtureMetadata, fixtureVersion, manifestHash } from './fixture';

type State = 'pending' | 'approved' | 'complete' | 'failed' | 'unknown';

export class Deployment extends DurableObject<Env> {
  async prepare(): Promise<void> {
    if (await this.ctx.storage.get('state')) throw new Error('Deployment already exists');
    await this.ctx.storage.put({
      state: 'pending',
      target: this.env.TARGET_WORKER_NAME,
      account: this.env.TARGET_ACCOUNT_ID,
      fixture: fixtureVersion,
      fixtureHash: await fixtureHash(),
      manifestHash: await manifestHash(),
    });
  }

  async approve(expectedHash: string): Promise<boolean> {
    return this.ctx.storage.transaction(async (storage) => {
      const state = await storage.get<State>('state');
      if (state !== 'pending' && state !== 'approved') return false;
      if (!expectedHash || expectedHash !== (await storage.get('fixtureHash'))) return false;
      await storage.put('state', 'approved');
      return true;
    });
  }

  async cancelApproval(): Promise<void> {
    await this.ctx.storage.transaction(async (storage) => {
      if ((await storage.get('state')) === 'approved') await storage.put('state', 'pending');
    });
  }

  async status(): Promise<{
    state: State | 'missing';
    target: string;
    account: string;
    fixture: string;
    fixtureHash: string;
    manifestHash: string;
  }> {
    return {
      state: (await this.ctx.storage.get<State>('state')) ?? 'missing',
      target: (await this.ctx.storage.get<string>('target')) ?? '',
      account: (await this.ctx.storage.get<string>('account')) ?? '',
      fixture: (await this.ctx.storage.get<string>('fixture')) ?? '',
      fixtureHash: (await this.ctx.storage.get<string>('fixtureHash')) ?? '',
      manifestHash: (await this.ctx.storage.get<string>('manifestHash')) ?? '',
    };
  }

  async deploy(): Promise<{ state: State }> {
    const { TARGET_ACCOUNT_ID, TARGET_WORKER_NAME, CLOUDFLARE_API_TOKEN } = this.env;
    const currentFixture = await fixtureHash();
    const currentManifest = await manifestHash();
    const claim = await this.ctx.storage.transaction(async (storage) => {
      const state = await storage.get<State>('state');
      if (state !== 'approved') {
        if (state === 'complete' || state === 'failed' || state === 'unknown') return state;
        throw new Error('Deployment is not approved');
      }
      if (
        !/^[a-f0-9]{32}$/i.test(TARGET_ACCOUNT_ID) ||
        !/^codemode-test-[a-z0-9-]+$/.test(TARGET_WORKER_NAME) ||
        !CLOUDFLARE_API_TOKEN ||
        (await storage.get('target')) !== TARGET_WORKER_NAME ||
        (await storage.get('account')) !== TARGET_ACCOUNT_ID ||
        (await storage.get('fixture')) !== fixtureVersion ||
        (await storage.get('fixtureHash')) !== currentFixture ||
        (await storage.get('manifestHash')) !== currentManifest
      ) {
        await storage.put('state', 'failed');
        return 'failed';
      }
      await storage.put('state', 'unknown');
      return 'claimed';
    });
    if (claim !== 'claimed') return { state: claim };
    const form = new FormData();
    form.set('metadata', JSON.stringify(fixtureMetadata));
    form.set(
      'index.js',
      new Blob([fixture], { type: 'application/javascript+module' }),
      'index.js',
    );
    let outcome: State = 'unknown';
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${TARGET_ACCOUNT_ID}/workers/scripts/${TARGET_WORKER_NAME}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
        body: form,
        redirect: 'error',
      });
      if (response.ok) {
        const body: unknown = await response.json();
        if (body && typeof body === 'object' && 'success' in body && body.success === true) {
          outcome = 'complete';
        }
      }
    } catch {
      outcome = 'unknown';
    }
    await this.ctx.storage.put('state', outcome);
    return { state: outcome };
  }
}
