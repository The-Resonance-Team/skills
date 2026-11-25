import { spawn } from 'node:child_process';

type CompletedEvent = {
  status: 'completed';
  tool: string;
  result: { content?: Array<{ type?: string; text?: string }> };
};

type PluginContext = {
  tool: {
    hook(
      name: 'execute.after',
      callback: (event: CompletedEvent | { status: 'error' }) => void | Promise<void>,
    ): Promise<{ dispose(): Promise<void> }>;
  };
};

function dashboardUrl(event: CompletedEvent): string | null {
  const blocks = event.result?.content ?? [];
  for (const block of blocks) {
    if (typeof block.text !== 'string') continue;
    try {
      const value = JSON.parse(block.text) as { dashboardUrl?: unknown };
      if (typeof value.dashboardUrl === 'string' && value.dashboardUrl.startsWith('http')) {
        return value.dashboardUrl;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function open(url: string): void {
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, [url], { detached: true, stdio: 'ignore' });
  child.on('error', () => undefined);
  child.unref();
}

export default {
  id: 'rules-dashboard-opener',
  async setup(ctx: PluginContext) {
    await ctx.tool.hook('execute.after', (event) => {
      if (event.status !== 'completed') return;
      if (!event.tool.includes('propose_rule_patch')) return;
      const url = dashboardUrl(event);
      if (url !== null) open(url);
    });
  },
};
