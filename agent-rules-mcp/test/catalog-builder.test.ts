import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('catalog builder CLI', () => {
  test('rejects a rule without catalog metadata', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rules-catalog-'));
    roots.push(root);
    mkdirSync(path.join(root, 'rules'));
    mkdirSync(path.join(root, 'workflows'));
    writeFileSync(path.join(root, 'rules/example.md'), '# Example\n\n1. **Example** — Text.\n');
    const result = Bun.spawn(['bun', 'scripts/build-catalog.ts', '--check'], {
      cwd: path.join(import.meta.dir, '..'),
      env: { ...process.env, SKILLS_ROOT: root },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [exitCode, stderr] = await Promise.all([
      result.exited,
      new Response(result.stderr).text(),
    ]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('rules/example.md');
    expect(stderr.toLowerCase()).toContain('metadata');
  });

  test('discovers metadata without a router and rejects missing cached embeddings offline', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rules-catalog-'));
    roots.push(root);
    mkdirSync(path.join(root, 'rules'));
    mkdirSync(path.join(root, 'workflows'));
    mkdirSync(path.join(root, 'agent-rules-mcp/generated'), { recursive: true });
    writeFileSync(
      path.join(root, 'rules/example.md'),
      [
        '---',
        'id: example',
        'name: Example',
        'kind: rule',
        'description: Example rule',
        'scope: All projects',
        'priority: mandatory',
        '---',
        '',
        '# Example',
        '',
        '<!-- rule: example -->',
        '1. **Example** — Text.',
        '',
      ].join('\n'),
    );
    const result = Bun.spawn(['bun', 'scripts/build-catalog.ts', '--check'], {
      cwd: path.join(import.meta.dir, '..'),
      env: { ...process.env, SKILLS_ROOT: root, CLOUDFLARE_API_TOKEN: '' },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [exitCode, stderr] = await Promise.all([
      result.exited,
      new Response(result.stderr).text(),
    ]);
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain('missing embedding');
    expect(stderr).not.toContain('CONTEXT.md');
  });

  test('rejects a numbered rule over 1,000 OpenAI tokens', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rules-catalog-'));
    roots.push(root);
    mkdirSync(path.join(root, 'rules'));
    mkdirSync(path.join(root, 'workflows'));
    writeFileSync(
      path.join(root, 'rules/example.md'),
      `---
id: example
name: Example
kind: rule
description: Example rule
scope: All projects
priority: mandatory
---
# Example

<!-- rule: oversized -->
1. **Oversized** —${' test'.repeat(1100)}
`,
    );
    const result = Bun.spawn(['bun', 'scripts/build-catalog.ts', '--check'], {
      cwd: path.join(import.meta.dir, '..'),
      env: { ...process.env, SKILLS_ROOT: root, CLOUDFLARE_API_TOKEN: '' },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [exitCode, stderr] = await Promise.all([
      result.exited,
      new Response(result.stderr).text(),
    ]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('rule:example:oversized');
    expect(stderr).toContain('maximum is 1000');
  });

  test('does not interpret a numbered example in a code fence as a catalog rule', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rules-catalog-'));
    roots.push(root);
    mkdirSync(path.join(root, 'rules'));
    mkdirSync(path.join(root, 'workflows'));
    mkdirSync(path.join(root, 'agent-rules-mcp/generated'), { recursive: true });
    writeFileSync(
      path.join(root, 'rules/example.md'),
      [
        '---',
        'id: example',
        'name: Example',
        'kind: rule',
        'description: Example rule',
        'scope: All projects',
        'priority: mandatory',
        '---',
        '# Example',
        '<!-- rule: example -->',
        '1. **Example** — Follow this pattern:',
        '```md',
        '1. **A sample list item** — Not a team rule.',
        '```',
        '',
      ].join('\n'),
    );
    const result = Bun.spawn(['bun', 'scripts/build-catalog.ts', '--check'], {
      cwd: path.join(import.meta.dir, '..'),
      env: { ...process.env, SKILLS_ROOT: root, CLOUDFLARE_API_TOKEN: '' },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [exitCode, stderr] = await Promise.all([
      result.exited,
      new Response(result.stderr).text(),
    ]);
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain('missing embedding');
  });
});
