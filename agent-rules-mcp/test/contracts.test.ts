import { describe, expect, test } from 'bun:test';

import { dashboardSchema, decisionResultSchema } from '../src/contracts';

const patch = {
  id: 'fixture',
  path: 'rules/general.md',
  before: '',
  after: 'new',
  summary: 'fixture',
  digest: 'digest',
  status: 'approved',
  createdAt: '2026-11-25T00:00:00.000Z',
  decidedAt: '2026-11-25T01:00:00.000Z',
  approvalId: 'approval-id',
};

describe('shared dashboard response validation', () => {
  test('preserves legitimate empty file content and the final approval ID', () => {
    const parsed = decisionResultSchema.parse({ ok: true, patch, closed: true });
    expect(parsed.patch.before).toBe('');
    expect(parsed.patch.approvalId).toBe('approval-id');
  });

  test('rejects missing content instead of inventing an empty diff', () => {
    const { before: _before, ...incomplete } = patch;
    expect(dashboardSchema.safeParse({ patches: [incomplete], closed: false }).success).toBe(false);
  });

  test('rejects unknown patch status and malformed timestamps', () => {
    expect(
      dashboardSchema.safeParse({ patches: [{ ...patch, status: 'invented' }], closed: false })
        .success,
    ).toBe(false);
    expect(
      dashboardSchema.safeParse({ patches: [{ ...patch, createdAt: 'yesterday' }], closed: false })
        .success,
    ).toBe(false);
  });
});
