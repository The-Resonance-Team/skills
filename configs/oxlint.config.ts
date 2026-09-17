import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';
import nestjs from 'ultracite/oxlint/nestjs';
import react from 'ultracite/oxlint/react';
import vitest from 'ultracite/oxlint/vitest';

// Ultracite's vitest preset carries its rules inside its own override block,
// and extended overrides win over local ones — so the preset object itself is
// adjusted instead of trying to re-override it from this config.
const vitestPreset = {
  ...vitest,
  overrides: vitest.overrides.map((override) => ({
    ...override,
    // `apps/*/e2e` specs are Playwright; the vitest preset's rules (and their
    // autofixes) do not apply there.
    excludeFiles: ['**/e2e/**'],
    rules: {
      ...override.rules,
      // Repo convention is `*.spec.ts`; the rule expects `*.test.ts`.
      'vitest/consistent-test-filename': 'off',
      // Plain `expect`-less helpers and untyped mocks are accepted.
      'vitest/expect-expect': 'off',
      'vitest/no-conditional-expect': 'off',
      'vitest/require-mock-type-parameters': 'off',
      // Autofixes below change test meaning or fail typecheck:
      // `toHaveBeenCalled()` -> `toHaveBeenCalledWith()` asserts zero args;
      // `toBe(a >= b)` -> matchers break on Date operands;
      // `describe('x')` -> `describe(x)` fails on non-callable titles;
      // `vi.mock('x')` -> `vi.mock(import('x'))` breaks factory typing;
      // `mockImplementation(fn)` -> `mockReturnValue(v)` evaluates hoisted
      // mock-factory values early; `toEqual` -> `toStrictEqual` distinguishes
      // `undefined`-valued keys.
      'vitest/prefer-called-with': 'off',
      'vitest/prefer-comparison-matcher': 'off',
      'vitest/prefer-describe-function-title': 'off',
      'vitest/prefer-import-in-mock': 'off',
      'vitest/prefer-mock-return-shorthand': 'off',
      'vitest/prefer-strict-equal': 'off',
      // Not errors yet, but visible.
      'vitest/max-expects': 'warn',
      'vitest/prefer-called-exactly-once-with': 'off',
      'vitest/prefer-hooks-in-order': 'warn',
      'vitest/prefer-spy-on': 'warn',
      'vitest/prefer-to-have-been-called-times': 'warn',
      'vitest/require-top-level-describe': 'warn',
    },
  })),
};

export default defineConfig({
  extends: [core, nestjs, react, vitestPreset],
  rules: {
    // Org opinions layered on the Ultracite preset.
    'sort-keys': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': [
      'error',
      {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'max-lines': ['error', 300],
    // Ultracite rules whose autofix is type-unsafe (verified by `tsc --noEmit`
    // and the test suites after a repo-wide `oxlint --fix`):
    // `import type` for NestJS constructor params erases the DI metadata Nest
    // resolves against; `type X = {...}` -> `interface X` drops the implicit
    // index signature and breaks Prisma input assignability; `replaceAll`
    // exceeds older TS lib targets; dropped `undefined` arguments break
    // required-argument calls; `[...x]` for string receivers turns `.map`
    // into a type error; `Set` literals break typed arrays; merging `.push()`
    // calls breaks non-variadic receivers; arrows break mocked constructors.
    'prefer-arrow-callback': 'off',
    'typescript/consistent-type-definitions': 'off',
    'typescript/consistent-type-imports': 'off',
    'unicorn/no-useless-spread': 'off',
    'unicorn/no-useless-undefined': 'off',
    'unicorn/prefer-set-has': 'off',
    'unicorn/prefer-single-call': 'off',
    'unicorn/prefer-string-replace-all': 'off',
  },
  overrides: [
    {
      files: ['**/*.{test,spec}.{ts,tsx}'],
      rules: {
        'no-explicit-any': 'off',
        'typescript/no-explicit-any': 'off',
        'max-lines': 'off',
      },
    },
  ],
  ignorePatterns: [...core.ignorePatterns],
});
