import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // Relative URLs keep the assets servable from any static-asset path on the Worker.
  base: './',
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
