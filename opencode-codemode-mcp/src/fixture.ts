export const fixture = `export default {
  fetch() { return Response.json({ service: "codemode-deployment-fixture", ok: true }); }
};`;

export const fixtureVersion = 'fixture-v1';

export const fixtureMetadata = {
  main_module: 'index.js',
  compatibility_date: '2026-11-25',
};

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function fixtureHash(): Promise<string> {
  return hash(fixture);
}

export function manifestHash(): Promise<string> {
  return hash(JSON.stringify({ fixture, metadata: fixtureMetadata }));
}
