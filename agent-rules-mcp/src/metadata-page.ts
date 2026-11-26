import { getMetadata } from './search';
import { maxResponseBytes, responseBytes } from './response-limit';

import type { EntryKind, Metadata, Priority } from './types';

type MetadataQuery = {
  id?: string;
  kind?: EntryKind;
  priority?: Priority;
  offset?: number;
  limit?: number;
  itemOffset?: number;
  itemLimit?: number;
};

function indexed(entry: Metadata, offset: number, count: number) {
  const itemCount = entry.rules.length + entry.steps.length;
  const nextItemOffset = offset + count < itemCount ? offset + count : null;
  return {
    ...entry,
    rules: entry.rules.slice(offset, offset + count),
    steps: entry.steps.slice(offset, offset + count),
    itemCount,
    nextItemOffset,
  };
}

export function getMetadataPage(query: MetadataQuery) {
  const all = getMetadata(query.id, { kind: query.kind, priority: query.priority });
  const entries: Metadata[] = Array.isArray(all) ? all : [all];
  if (query.id !== undefined) {
    const entry = entries[0];
    const offset = query.itemOffset ?? 0;
    const itemCount = entry.rules.length + entry.steps.length;
    let count = Math.min(query.itemLimit ?? itemCount, Math.max(0, itemCount - offset));
    while (count >= 0) {
      const page = { metadata: [indexed(entry, offset, count)], total: 1, nextOffset: null };
      if (responseBytes(page) <= maxResponseBytes) return page;
      count -= 1;
    }
    throw new Error('Metadata entry is too large to return safely');
  }

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 2;
  let count = Math.min(limit, Math.max(0, entries.length - offset));
  while (count > 0) {
    const metadata = entries.slice(offset, offset + count).map((entry) => indexed(entry, 0, 0));
    const nextOffset = offset + count < entries.length ? offset + count : null;
    const page = { metadata, total: entries.length, nextOffset };
    if (responseBytes(page) <= maxResponseBytes) return page;
    count -= 1;
  }
  if (offset < entries.length) throw new Error('Metadata entry is too large to return safely');
  return { metadata: [], total: entries.length, nextOffset: null };
}
