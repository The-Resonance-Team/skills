import { getMetadata } from './search';
import { maxResponseBytes } from './response-limit';

import type { EntryKind, Metadata, Priority } from './types';

type MetadataQuery = {
  id?: string;
  kind?: EntryKind;
  priority?: Priority;
  offset?: number;
  limit?: number;
};

export function getMetadataPage(query: MetadataQuery) {
  const all = getMetadata(query.id, { kind: query.kind, priority: query.priority });
  const entries: Metadata[] = Array.isArray(all) ? all : [all];
  const offset = query.id === undefined ? (query.offset ?? 0) : 0;
  const limit = query.id === undefined ? (query.limit ?? 2) : 1;
  let count = Math.min(limit, Math.max(0, entries.length - offset));
  while (count > 0) {
    const metadata = entries.slice(offset, offset + count);
    const nextOffset = offset + count < entries.length ? offset + count : null;
    const page = { metadata, total: entries.length, nextOffset };
    if (new TextEncoder().encode(JSON.stringify(page)).byteLength <= maxResponseBytes) return page;
    count -= 1;
  }
  if (offset < entries.length) throw new Error('Metadata entry is too large to return safely');
  return { metadata: [], total: entries.length, nextOffset: null };
}
