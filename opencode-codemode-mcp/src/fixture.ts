import { sha256 } from './digest';

export const fixture = `export default {
  fetch() { return Response.json({ service: "codemode-deployment-fixture", ok: true }); }
};`;

export const fixtureVersion = 'fixture-v1';

export const fixtureMetadata = {
  main_module: 'index.js',
  compatibility_date: '2026-11-25',
};

export function fixtureHash(): Promise<string> {
  return sha256(fixture);
}

export function manifestHash(): Promise<string> {
  return sha256(JSON.stringify({ fixture, metadata: fixtureMetadata }));
}
