import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('rejects removal of a stable rule ID without an explicit migration', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'catalog-ids-'));
  roots.push(root);
  const base = path.join(root, 'base.json');
  const current = path.join(root, 'current.json');
  const migrations = path.join(root, 'migrations.json');
  writeFileSync(
    base,
    JSON.stringify({ entries: [{ id: 'general', rules: [{ id: 'rule:general:stable' }] }] }),
  );
  writeFileSync(current, JSON.stringify({ entries: [{ id: 'general', rules: [] }] }));
  writeFileSync(migrations, '{}');
  const result = Bun.spawn(['bun', 'scripts/check-ids.ts', base, current, migrations], {
    cwd: path.join(import.meta.dir, '..'),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stderr] = await Promise.all([result.exited, new Response(result.stderr).text()]);
  expect(exitCode).not.toBe(0);
  expect(stderr).toContain('rule:general:stable');
  writeFileSync(migrations, JSON.stringify({ 'rule:general:stable': null }));
  const approved = Bun.spawn(['bun', 'scripts/check-ids.ts', base, current, migrations], {
    cwd: path.join(import.meta.dir, '..'),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  expect(await approved.exited).toBe(0);
});

test('checks IDs against a legacy router when the base has no catalog', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'catalog-ids-'));
  roots.push(root);
  const base = path.join(root, 'base.md');
  const current = path.join(root, 'current.json');
  const migrations = path.join(root, 'migrations.json');
  writeFileSync(base, '| `rules/general.md` | All projects | URL |\n');
  writeFileSync(current, JSON.stringify({ entries: [] }));
  writeFileSync(migrations, '{}');
  const result = Bun.spawn(['bun', 'scripts/check-ids.ts', base, current, migrations], {
    cwd: path.join(import.meta.dir, '..'),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stderr] = await Promise.all([result.exited, new Response(result.stderr).text()]);
  expect(exitCode).not.toBe(0);
  expect(stderr).toContain('Missing explicit ID migration for general');
});
