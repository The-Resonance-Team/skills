import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      remoteBindings: false,
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          MCP_TOKEN: 'testing-rules-token',
          ACCESS_CLIENT_SECRET: 'testing-access-secret',
          GITHUB_TOKEN: 'testing-github-token',
          PUBLIC_URL: 'https://worker.test',
          REVIEWER_EMAILS: 'operator@example.test',
        },
        outboundService() {
          throw new Error('Unexpected outbound request in approval regression test');
        },
      },
    }),
  ],
  test: { include: ['test-worker/**/*.worker.ts'] },
});
