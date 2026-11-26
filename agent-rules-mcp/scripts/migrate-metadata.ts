import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import slugify from 'slugify';

const root = path.resolve(import.meta.dir, '../..');
const counts: Record<string, number> = {
  'rules/github-vps-deploy.md': 11,
  'rules/i18n.md': 22,
  'rules/miniapp.md': 9,
  'rules/linting.md': 18,
  'rules/e2e-testing.md': 23,
  'rules/qa.md': 16,
  'rules/prisma.md': 18,
  'rules/mobile-store-submission.md': 4,
  'rules/fixtures.md': 8,
  'rules/general.md': 25,
  'rules/dependabot.md': 7,
  'rules/audit.md': 18,
  'rules/test-audit.md': 31,
  'rules/upload.md': 13,
  'rules/issues.md': 9,
  'rules/nestjs-ai.md': 11,
  'rules/github-supply-chain.md': 4,
  'rules/real-user-qa.md': 5,
  'rules/frontend.md': 37,
  'rules/github-actions.md': 11,
  'rules/github-releases.md': 4,
  'rules/nestjs.md': 25,
  'rules/libraries.md': 16,
};
const router = readFileSync(path.join(root, 'CONTEXT.md'), 'utf8');
const rows = [
  ...router.matchAll(/^\|\s*`((?:rules|workflows)\/[^`]+\.md)`\s*\|\s*([^|]+)\|/gm),
];
if (rows.length !== 29) throw new Error(`Expected 29 router rows, found ${rows.length}`);
const changes: Array<{ file: string; content: string }> = [];

for (const row of rows) {
  const file = row[1];
  const scope = row[2].trim();
  const kind = file.startsWith('rules/') ? 'rule' : 'workflow';
  const basename = path.basename(file, '.md');
  const original = readFileSync(path.join(root, file), 'utf8');
  const existing = original.match(/^---\n([\s\S]*?)\n---\n/);
  if (kind === 'rule' && existing !== null) throw new Error(`${file} already has metadata`);
  if (kind === 'workflow' && existing === null) throw new Error(`${file} has no frontmatter`);
  const body = existing ? original.slice(existing[0].length) : original;
  const name = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (!name) throw new Error(`${file} has no title`);
  const old = existing ? Bun.YAML.parse(existing[1]) : {};
  if (typeof old !== 'object' || old === null) throw new Error(`${file} has invalid frontmatter`);
  const description =
    kind === 'workflow'
      ? Reflect.get(old, 'description')
      : body.split('\n').find((line) => line.trim() && !line.startsWith('#'))?.trim();
  if (typeof description !== 'string' || !description) throw new Error(`${file} has no description`);
  let updatedBody = body;
  if (kind === 'rule') {
    const headings = [...body.matchAll(/^(\d+[a-z]?)\.\s+\*\*(.+?)\*\*/gm)];
    if (headings.length !== counts[file]) throw new Error(`${file}: unexpected rule count`);
    const slugs = new Set<string>();
    updatedBody = body.replace(
      /^(\d+[a-z]?)\.\s+\*\*(.+?)\*\*/gm,
      (match: string, _number: string, heading: string) => {
        const stem = slugify(heading.replaceAll('`', ''), {
          lower: true,
          strict: true,
          locale: 'vi',
        })
          .slice(0, 28)
          .replace(/-+$/, '');
        if (!stem) throw new Error(`${file}: empty rule slug`);
        let slug = stem;
        let suffix = 2;
        while (slugs.has(slug)) slug = `${stem.slice(0, 25)}-${suffix++}`;
        slugs.add(slug);
        return `<!-- rule: ${slug} -->\n${match}`;
      },
    );
  }
  const values = {
    id: kind === 'workflow' ? `wf-${basename}` : basename,
    name,
    kind,
    description,
    scope,
    priority: 'mandatory',
  };
  const frontmatter = Object.entries(values)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');
  changes.push({ file, content: `---\n${frontmatter}\n---\n${updatedBody}` });
}

if (process.argv.includes('--check')) {
  console.error(`Would migrate ${changes.length} files with rule ID anchors.`);
} else {
  for (const change of changes) writeFileSync(path.join(root, change.file), change.content);
  console.error(`Migrated ${changes.length} files.`);
}
