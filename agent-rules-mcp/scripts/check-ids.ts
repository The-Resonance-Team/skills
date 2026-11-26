import { readFileSync } from 'node:fs';
import { z } from 'zod';

const catalogSchema = z.object({
  entries: z.array(
    z.object({
      id: z.string(),
      rules: z.array(z.object({ id: z.string() })).optional(),
    }),
  ),
});
const migrationsSchema = z.record(z.string(), z.string().min(1).nullable());
const [basePath, currentPath, migrationsPath] = process.argv.slice(2);
if (!basePath || !currentPath || !migrationsPath) {
  throw new Error('Usage: check-ids <base catalog> <current catalog> <migrations>');
}
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as unknown;
function readBase(file: string): z.infer<typeof catalogSchema> {
  if (!file.endsWith('.md')) return catalogSchema.parse(readJson(file));
  const text = readFileSync(file, 'utf8');
  const entries = [...text.matchAll(/^\|\s*`(rules|workflows)\/([a-z0-9-]+)\.md`/gm)].map(
    (match) => ({ id: match[1] === 'workflows' ? `wf-${match[2]}` : match[2] }),
  );
  if (entries.length === 0) throw new Error('Legacy catalog base has no entries');
  return { entries };
}
const base = readBase(basePath);
const current = catalogSchema.parse(readJson(currentPath));
const migrations = migrationsSchema.parse(readJson(migrationsPath));
const ids = (catalog: z.infer<typeof catalogSchema>) =>
  catalog.entries.flatMap((entry) => [entry.id, ...(entry.rules ?? []).map((rule) => rule.id)]);
const currentIds = new Set(ids(current));
for (const id of ids(base)) {
  if (currentIds.has(id)) continue;
  if (!Object.hasOwn(migrations, id)) throw new Error(`Missing explicit ID migration for ${id}`);
  const target = migrations[id];
  if (target !== null && !currentIds.has(target)) {
    throw new Error(`ID migration for ${id} points to missing ID ${target}`);
  }
}
