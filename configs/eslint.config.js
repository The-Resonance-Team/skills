import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Root ESLint v9 flat config for non-Next.js roots.
 * Next.js apps use the app-level config (see linting.md rule 11).
 * Apps/packages extend this via packages/config/eslint.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/www/**',
      '**/*.config.js',
      '**/*.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // Honor the `_`-prefix convention for intentionally-unused bindings
      // (e.g. destructuring a prop only to strip it from `...props`).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
);
