import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TARGET_ACCOUNT_ID: '00000000000000000000000000000000',
          TARGET_WORKER_NAME: 'codemode-test-fixture',
          MCP_TOKEN: 'testing-mcp-token',
          APPROVAL_TOKEN: 'testing-approval-token',
          CLOUDFLARE_API_TOKEN: 'testing-cloudflare-token',
        },
        outboundService(request) {
          if (new URL(request.url).hostname !== 'api.cloudflare.com') {
            throw new Error('Unexpected outbound request');
          }
          return new Response('simulated timeout', { status: 408 });
        },
      },
    }),
  ],
  test: { include: ['test-worker/**/*.worker.ts'] },
});
