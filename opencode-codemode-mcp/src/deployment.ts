import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';
import { fixture, fixtureVersion } from './fixture';

type State = 'pending' | 'approved' | 'complete' | 'failed' | 'unknown';

export class Deployment extends DurableObject<Env> {
  async prepare(): Promise<void> {
    if (await this.ctx.storage.get('state')) throw new Error('Deployment already exists');
    await this.ctx.storage.put({
      state: 'pending',
      target: this.env.TARGET_WORKER_NAME,
      account: this.env.TARGET_ACCOUNT_ID,
      fixture: fixtureVersion,
    });
  }

  async approve(): Promise<void> {
    const state = await this.ctx.storage.get<State>('state');
    if (state !== 'pending' && state !== 'approved')
      throw new Error('Deployment cannot be approved');
    await this.ctx.storage.put('state', 'approved');
  }

  async status(): Promise<{ state: State | 'missing'; target: string; fixture: string }> {
    return {
      state: (await this.ctx.storage.get<State>('state')) ?? 'missing',
      target: (await this.ctx.storage.get<string>('target')) ?? '',
      fixture: (await this.ctx.storage.get<string>('fixture')) ?? '',
    };
  }

  async deploy(): Promise<{ state: State }> {
    const state = await this.ctx.storage.get<State>('state');
    if (state !== 'approved') {
      if (state === 'complete' || state === 'failed' || state === 'unknown') return { state };
      throw new Error('Deployment is not approved');
    }
    const { TARGET_ACCOUNT_ID, TARGET_WORKER_NAME, CLOUDFLARE_API_TOKEN } = this.env;
    if (
      !/^[a-f0-9]{32}$/i.test(TARGET_ACCOUNT_ID) ||
      !/^codemode-test-[a-z0-9-]+$/.test(TARGET_WORKER_NAME) ||
      !CLOUDFLARE_API_TOKEN ||
      (await this.ctx.storage.get('target')) !== TARGET_WORKER_NAME ||
      (await this.ctx.storage.get('account')) !== TARGET_ACCOUNT_ID ||
      (await this.ctx.storage.get('fixture')) !== fixtureVersion
    ) {
      throw new Error('Invalid test target configuration');
    }
    await this.ctx.storage.put('state', 'unknown');
    const form = new FormData();
    form.set(
      'metadata',
      JSON.stringify({
        main_module: 'index.js',
        compatibility_date: '2026-11-25',
      }),
    );
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
      if (response.ok) outcome = 'complete';
      else if (response.status >= 400 && response.status < 500) outcome = 'failed';
    } catch {
      outcome = 'unknown';
    }
    await this.ctx.storage.put('state', outcome);
    return { state: outcome };
  }
}
