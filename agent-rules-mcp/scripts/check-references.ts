type Source = {
  path: string;
  content: string;
  rules: Array<{ number: string }>;
};

export function checkRuleReferences(sources: Source[]): void {
  const byPath = new Map(sources.map((source) => [source.path, source]));
  const pattern =
    /(rules\/[a-z0-9-]+\.md)`?\s*\(?\s*(?:(rules?)\s+)?(#?\d+[a-z]?(?:\s*(?:,|\/|–|-|&|and)\s*#?\d+[a-z]?)*)/gi;
  for (const source of sources) {
    for (const match of source.content.matchAll(pattern)) {
      if (!match[2] && !match[3].startsWith('#')) continue;
      const target = byPath.get(match[1]);
      if (target === undefined) throw new Error(`${source.path}: unknown rule module ${match[1]}`);
      for (const number of match[3].matchAll(/#?(\d+[a-z]?)/gi)) {
        if (!target.rules.some((rule) => rule.number === number[1])) {
          throw new Error(`${source.path}: unknown rule number ${match[1]} #${number[1]}`);
        }
      }
    }
  }
}
