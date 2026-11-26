import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function source(body: string, id = 'example', name = 'Example'): string {
  return `---
id: ${id}
name: ${name}
kind: rule
description: Example rule
scope: All projects
priority: mandatory
---
# Example
${body}
`;
}

async function checkSource(content: string) {
  const root = mkdtempSync(path.join(tmpdir(), 'rules-catalog-'));
  roots.push(root);
  mkdirSync(path.join(root, 'rules'));
  mkdirSync(path.join(root, 'workflows'));
  mkdirSync(path.join(root, 'agent-rules-mcp/generated'), { recursive: true });
  writeFileSync(path.join(root, 'rules/example.md'), content);
  const result = Bun.spawn(['bun', 'scripts/build-catalog.ts', '--check'], {
    cwd: path.join(import.meta.dir, '..'),
    env: { ...process.env, SKILLS_ROOT: root, CLOUDFLARE_API_TOKEN: '' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stderr] = await Promise.all([result.exited, new Response(result.stderr).text()]);
  return { exitCode, stderr };
}

describe('catalog builder CLI', () => {
  test('rejects a rule without catalog metadata', async () => {
    const { exitCode, stderr } = await checkSource('# Example\n\n1. **Example** — Text.\n');
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('rules/example.md');
    expect(stderr.toLowerCase()).toContain('metadata');
  });

  test('discovers metadata without a router and rejects missing cached embeddings offline', async () => {
    const { exitCode, stderr } = await checkSource(
      source('<!-- rule: example -->\n1. **Example** — Text.'),
    );
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain('missing embedding');
    expect(stderr).not.toContain('CONTEXT.md');
  });

  test('rejects a numbered rule over 1,000 OpenAI tokens', async () => {
    const { exitCode, stderr } = await checkSource(
      source(`<!-- rule: oversized -->\n1. **Oversized** —${' test'.repeat(1100)}`),
    );
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('rule:example:oversized');
    expect(stderr).toContain('maximum is 1000');
  });

  test('does not interpret a numbered example in a code fence as a catalog rule', async () => {
    const { exitCode, stderr } = await checkSource(
      source(
        [
          '<!-- rule: example -->',
          '1. **Example** — Follow this pattern:',
          '```md',
          '1. **A sample list item** — Not a team rule.',
          '```',
        ].join('\n'),
      ),
    );
    expect(exitCode).not.toBe(0);
    expect(stderr.toLowerCase()).toContain('missing embedding');
  });

  test('rejects module IDs that the MCP cannot accept', async () => {
    const { exitCode, stderr } = await checkSource(
      source('<!-- rule: example -->\n1. **Example** — Text.', 'a'.repeat(65)),
    );
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('invalid catalog metadata: id');
  });

  test('rejects rule IDs that the MCP cannot accept', async () => {
    const { exitCode, stderr } = await checkSource(
      source(`<!-- rule: ${'a'.repeat(120)} -->\n1. **Example** — Text.`),
    );
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('rule ID exceeds 128 characters');
  });

  test('rejects references to nonexistent numbered rules', async () => {
    const { exitCode, stderr } = await checkSource(
      source('<!-- rule: example -->\n1. **Example** — See `rules/example.md` (#1, #999).'),
    );
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('unknown rule number');
    expect(stderr).toContain('rules/example.md #999');
  });

  test('rejects duplicate display numbers that make references ambiguous', async () => {
    const { exitCode, stderr } = await checkSource(
      source(
        '<!-- rule: first -->\n1. **First** — Text.\n<!-- rule: second -->\n1. **Second** — Text.',
      ),
    );
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('duplicate rule number 1');
  });

  test('rejects metadata that cannot fit in a complete MCP page', async () => {
    const { exitCode, stderr } = await checkSource(
      source('<!-- rule: example -->\n1. **Example** — Text.', 'example', 'a'.repeat(10000)),
    );
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('metadata cannot fit');
  });

  test('rejects a rule whose complete response exceeds the safe client limit', async () => {
    const { exitCode, stderr } = await checkSource(
      source(`<!-- rule: example -->\n1. **Example** — start${' '.repeat(10000)}end.`),
    );
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('rule response cannot fit');
  });
});
