import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

export default defineConfig({
  ...ultracite,
  // Org formatting baseline where the Ultracite preset disagrees.
  singleQuote: true,
  printWidth: 100,
  trailingComma: 'all',
  sortPackageJson: false,
  // By default the formatter does not rewrap prose — keep that, docs are
  // hand-maintained.
  proseWrap: 'preserve',
  // Import ordering and Tailwind class sorting are Ultracite opinions outside
  // the org baseline; enabling either is a repo-wide reorder, so it belongs in
  // its own follow-up rather than an adoption PR.
  sortImports: false,
  sortTailwindcss: false,
  ignorePatterns: [
    ...ultracite.ignorePatterns,
    // Docs are never formatted: markdown documents (rules, ADRs, specs,
    // tickets, READMEs) are hand-maintained prose, not code.
    '**/*.md',
    'docs/**',
    'openspec/**',
    '.venv/**',
    '**/.env',
    '**/.claude/settings.local.json',
  ],
});
