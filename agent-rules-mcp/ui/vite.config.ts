import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // Approval pages are nested routes; assets always load from the Worker root.
  base: '/',
  // Astryx pages use the automatic JSX runtime; no React import is needed in page files.
  esbuild: { jsx: 'automatic' },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(here, 'index.html'),
        consent: resolve(here, 'consent.html'),
      },
    },
  },
});
