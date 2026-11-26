import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '../..');
const directory = path.join(root, 'rules');
const files = readdirSync(directory)
  .filter((file) => file.endsWith('.md') && file !== 'libraries.md')
  .sort();
if (files.length !== 22) throw new Error(`Expected 22 rule modules, found ${files.length}`);

const changes = files.map((file) => {
  const source = readFileSync(path.join(directory, file), 'utf8');
  const title = [...source.matchAll(/^# .+$/gm)];
  if (title.length !== 1 || source.includes('<!-- rule: module-context -->')) {
    throw new Error(`${file}: expected one title and no module context anchor`);
  }
  const insertion =
    '\n\n<!-- rule: module-context -->\n0. **Module context** — Apply this context when the module applies.';
  const index = title[0].index + title[0][0].length;
  return { file, text: source.slice(0, index) + insertion + source.slice(index) };
});

if (process.argv.includes('--check')) {
  console.error(`Would add module context to ${changes.length} files.`);
} else {
  for (const change of changes) writeFileSync(path.join(directory, change.file), change.text);
  console.error(`Added module context to ${changes.length} files.`);
}
