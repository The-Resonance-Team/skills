import { maxResponseBytes, responseBytes } from '../src/response-limit';

import type { CatalogEntry } from '../src/types';

type Source = Omit<CatalogEntry, 'vector'>;

export function checkMetadataSize(sources: Source[]): void {
  for (const source of sources) {
    const base = {
      id: source.id,
      kind: source.kind,
      path: source.path,
      name: source.name,
      description: source.description,
      scope: source.scope,
      priority: source.priority,
      related: Array.from({ length: 5 }, () => 'x'.repeat(64)),
      references: source.references,
      rules: [] as Array<{ id: string; number: string; title: string }>,
      steps: [] as Array<{ title: string }>,
      itemCount: Number.MAX_SAFE_INTEGER,
      nextItemOffset: Number.MAX_SAFE_INTEGER,
    };
    const check = (metadata: typeof base) => {
      const page = {
        metadata: [metadata],
        total: Number.MAX_SAFE_INTEGER,
        nextOffset: Number.MAX_SAFE_INTEGER,
      };
      if (responseBytes(page) > maxResponseBytes) {
        throw new Error(`${source.path}: metadata cannot fit in a complete MCP page`);
      }
    };
    check(base);
    for (const rule of source.rules) {
      const { id, number, title } = rule;
      check({ ...base, rules: [{ id, number, title }] });
      const value = {
        rule: { ...rule, path: source.path, scope: source.scope, priority: source.priority },
      };
      if (responseBytes(value) > maxResponseBytes) {
        throw new Error(
          `${source.path}: rule response cannot fit in a complete MCP response: ${id}`,
        );
      }
    }
    for (const { title } of source.steps) check({ ...base, steps: [{ title }] });
  }
}
