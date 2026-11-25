export type EntryKind = 'rule' | 'workflow';

export type CatalogEntry = {
  id: string;
  kind: EntryKind;
  path: string;
  title: string;
  scope: string;
  retrievalText: string;
  digest: string;
  references: string[];
  vector: string;
  content: string;
};

export type Catalog = {
  sourceDigest: string;
  model: string;
  dimensions: number;
  entries: CatalogEntry[];
};

export type Metadata = {
  id: string;
  kind: EntryKind;
  path: string;
  scope: string;
  related: string[];
  references: string[];
};

export type Match = {
  id: string;
  kind: EntryKind;
  scope: string;
  score: number;
};

export type Env = {
  AI: Ai;
  MCP_TOKEN: string;
};
