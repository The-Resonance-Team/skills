import { expect, test } from 'bun:test';

import { buildUnifiedDiff } from '../ui/src/lib/diff';

test('keeps whitespace and final-newline changes visible in the unified text view', () => {
  const patch = buildUnifiedDiff('line\n', 'line', 'rules/general.md');
  expect(patch).toContain('\\ No newline at end of file');
  expect(patch).toContain('-line');

  const spaces = buildUnifiedDiff('line\n', 'line \n', 'rules/general.md');
  expect(spaces).toContain('+line ');

  expect(buildUnifiedDiff('same\n', 'same\n', 'rules/general.md')).toBe('');
});
