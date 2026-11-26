import { get_encoding } from 'tiktoken';

import type { RuleItem, WorkflowStep } from '../src/types';

const tokenizer = get_encoding('o200k_base');

function tokens(content: string): number {
  return tokenizer.encode_ordinary(content).length;
}

function maskFences(body: string): string {
  let fence: { marker: string; length: number } | undefined;
  return body
    .split(/(?<=\n)/)
    .map((line) => {
      const marker = line.match(/^[ \t]*(`{3,}|~{3,})/)?.[1];
      const masked = fence !== undefined || marker !== undefined;
      if (marker !== undefined) {
        if (fence === undefined) fence = { marker: marker[0], length: marker.length };
        else if (marker[0] === fence.marker && marker.length >= fence.length) fence = undefined;
      }
      return masked ? line.replace(/[^\r\n]/g, ' ') : line;
    })
    .join('');
}

export function parseRules(file: string, moduleId: string, body: string): RuleItem[] {
  const pattern = /^<!-- rule: ([a-z0-9-]+) -->\r?\n(\d+[a-z]?)\.\s+\*\*(.+?)\*\*/gm;
  const visible = maskFences(body);
  const matches = [...visible.matchAll(pattern)];
  const headings = [...visible.matchAll(/^\d+[a-z]?\.\s+\*\*(.+?)\*\*/gm)];
  if (matches.length === 0 || matches.length !== headings.length) {
    throw new Error(`${file}: each numbered rule needs a rule ID anchor`);
  }
  const seen = new Set<string>();
  const numbers = new Set<string>();
  return matches.map((match, index) => {
    const id = `rule:${moduleId}:${match[1]}`;
    if (id.length > 128) throw new Error(`${file}: rule ID exceeds 128 characters: ${id}`);
    if (seen.has(id)) throw new Error(`${file}: duplicate rule ID ${id}`);
    seen.add(id);
    if (numbers.has(match[2])) throw new Error(`${file}: duplicate rule number ${match[2]}`);
    numbers.add(match[2]);
    const start = match.index + match[0].indexOf('\n') + 1;
    const next = matches[index + 1];
    const section = body.slice(start, next?.index).trimEnd();
    const content =
      next === undefined ? section : section.replace(/\n(?:[ \t]*\n)*#{2,3}\s+[^\n]+\s*$/, '');
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
  const visible = maskFences(body).split('\n');
  const flush = () => {
    const content = lines.join('\n');
    if (content.trim()) steps.push({ title, content });
  };
  for (const [index, line] of body.split('\n').entries()) {
    const heading = visible[index].match(/^#{2,3}\s+(.+)$/);
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
