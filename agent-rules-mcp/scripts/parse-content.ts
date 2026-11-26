import { get_encoding } from 'tiktoken';

import type { RuleItem, WorkflowStep } from '../src/types';

const tokenizer = get_encoding('o200k_base');

function tokens(content: string): number {
  return tokenizer.encode_ordinary(content).length;
}

export function parseRules(file: string, moduleId: string, body: string): RuleItem[] {
  const pattern = /^<!-- rule: ([a-z0-9-]+) -->\r?\n(\d+[a-z]?)\.\s+\*\*(.+?)\*\*/gm;
  const matches = [...body.matchAll(pattern)];
  const headings = [...body.matchAll(/^\d+[a-z]?\.\s+\*\*(.+?)\*\*/gm)];
  if (matches.length === 0 || matches.length !== headings.length) {
    throw new Error(`${file}: each numbered rule needs a rule ID anchor`);
  }
  const seen = new Set<string>();
  return matches.map((match, index) => {
    const id = `rule:${moduleId}:${match[1]}`;
    if (seen.has(id)) throw new Error(`${file}: duplicate rule ID ${id}`);
    seen.add(id);
    const start = match.index + match[0].indexOf('\n') + 1;
    const content = body.slice(start, matches[index + 1]?.index).trimEnd();
    const count = tokens(content);
    if (count > 1000) {
      throw new Error(`${file}: rule ${id} has ${count} tokens; maximum is 1000`);
    }
    return { id, number: match[2], title: match[3], content, references: [] };
  });
}

export function parseWorkflow(file: string, body: string): WorkflowStep[] {
  const count = tokens(body);
  if (count > 10000) throw new Error(`${file}: workflow has ${count} tokens; maximum is 10000`);

  const steps: WorkflowStep[] = [];
  let title = 'Overview';
  let lines: string[] = [];
  let fence: string | undefined;
  const flush = () => {
    const content = lines.join('\n');
    if (content.trim()) steps.push({ title, content });
  };
  for (const line of body.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (marker !== undefined) {
      if (fence === undefined) fence = marker[0];
      else if (marker[0] === fence) fence = undefined;
    }
    const heading = fence === undefined ? line.match(/^#{2,3}\s+(.+)$/) : null;
    if (heading !== null) {
      flush();
      title = heading[1];
      lines = [line];
    } else {
      lines.push(line);
    }
  }
  flush();
  return steps;
}
