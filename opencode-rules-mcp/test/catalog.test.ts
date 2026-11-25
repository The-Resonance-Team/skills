import { describe, expect, test } from 'bun:test';

import { catalog } from '../src/search';

describe('generated catalog', () => {
  test('holds every router entry with a unique stable ID', () => {
    expect(catalog.entries).toHaveLength(29);
    expect(new Set(catalog.entries.map((entry) => entry.id)).size).toBe(29);
    expect(catalog.entries.some((entry) => entry.path === 'CONTEXT.md')).toBe(false);
  });

  test('separates rule IDs from workflow IDs', () => {
    for (const entry of catalog.entries) {
      if (entry.kind === 'workflow') {
        expect(entry.id.startsWith('wf-')).toBe(true);
        expect(entry.path.startsWith('workflows/')).toBe(true);
      } else {
        expect(entry.id.startsWith('wf-')).toBe(false);
        expect(entry.path.startsWith('rules/')).toBe(true);
      }
    }
  });

  test('resolved citation relations and excluded self-links', () => {
    const ids = new Set(catalog.entries.map((entry) => entry.id));
    for (const entry of catalog.entries) {
      expect(entry.references).not.toContain(entry.id);
      for (const target of entry.references) expect(ids.has(target)).toBe(true);
    }
    const general = catalog.entries.find((entry) => entry.id === 'general');
    expect(general?.references).toContain('libraries');
  });

  test('stores vectors at the configured dimension', () => {
    expect(catalog.dimensions).toBe(256);
    for (const entry of catalog.entries) {
      const bytes = Uint8Array.from(atob(entry.vector), (char) => char.charCodeAt(0));
      expect(bytes.byteLength).toBe(256 * 4);
    }
  });

  test('records a stable source digest', () => {
    expect(catalog.sourceDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});
