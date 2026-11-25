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
  ASSETS: Fetcher;
  OAUTH_KV: KVNamespace;
  MCP_TOKEN: string;
  PUBLIC_URL: string;
  ACCESS_AUTHORIZATION_URL: string;
  ACCESS_TOKEN_URL: string;
  ACCESS_USERINFO_URL: string;
  ACCESS_CLIENT_ID: string;
  ACCESS_CLIENT_SECRET: string;
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
};
