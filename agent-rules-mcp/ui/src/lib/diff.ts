interface DiffOp {
  kind: ' ' | '+' | '-';
  text: string;
  oldLine: number;
  newLine: number;
}

function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  return lines.at(-1) === '' ? lines.slice(0, -1) : lines;
}

function diffOps(before: string, after: string): DiffOp[] {
  const oldLines = splitLines(before);
  const newLines = splitLines(after);
  const oldCount = oldLines.length;
  const newCount = newLines.length;
  if (oldCount * newCount > 400000) {
    return [
      ...oldLines.map((text, index) => ({
        kind: '-' as const,
        text,
        oldLine: index + 1,
        newLine: 0,
      })),
      ...newLines.map((text, index) => ({
        kind: '+' as const,
        text,
        oldLine: 0,
        newLine: index + 1,
      })),
    ];
  }
  const lengths = Array.from({ length: oldCount + 1 }, () => new Uint32Array(newCount + 1));
  for (let oldIndex = oldCount - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newCount - 1; newIndex >= 0; newIndex -= 1) {
      lengths[oldIndex][newIndex] =
        oldLines[oldIndex] === newLines[newIndex]
          ? lengths[oldIndex + 1][newIndex + 1] + 1
          : Math.max(lengths[oldIndex + 1][newIndex], lengths[oldIndex][newIndex + 1]);
    }
  }
  const ops: DiffOp[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldCount && newIndex < newCount) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      ops.push({
        kind: ' ',
        text: oldLines[oldIndex],
        oldLine: oldIndex + 1,
        newLine: newIndex + 1,
      });
      oldIndex += 1;
      newIndex += 1;
    } else if (lengths[oldIndex + 1][newIndex] >= lengths[oldIndex][newIndex + 1]) {
      ops.push({
        kind: '-',
        text: oldLines[oldIndex],
        oldLine: oldIndex + 1,
        newLine: newIndex + 1,
      });
      oldIndex += 1;
    } else {
      ops.push({
        kind: '+',
        text: newLines[newIndex],
        oldLine: oldIndex + 1,
        newLine: newIndex + 1,
      });
      newIndex += 1;
    }
  }
  while (oldIndex < oldCount) {
    ops.push({ kind: '-', text: oldLines[oldIndex], oldLine: oldIndex + 1, newLine: newIndex + 1 });
    oldIndex += 1;
  }
  while (newIndex < newCount) {
    ops.push({ kind: '+', text: newLines[newIndex], oldLine: oldIndex + 1, newLine: newIndex + 1 });
    newIndex += 1;
  }
  return ops;
}

function range(start: number, count: number): string {
  return count === 1 ? `${start}` : `${start},${count}`;
}

export function buildUnifiedDiff(before: string, after: string, path: string): string {
  const ops = diffOps(before, after);
  if (!ops.some((op) => op.kind !== ' ')) return '';
  const hunks: Array<[number, number]> = [];
  ops.forEach((op, index) => {
    if (op.kind === ' ') return;
    const start = Math.max(0, index - 3);
    const end = Math.min(ops.length, index + 4);
    const previous = hunks.at(-1);
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else hunks.push([start, end]);
  });
  const bodies = hunks.map(([start, end]) => {
    const slice = ops.slice(start, end);
    const oldLines = slice.filter((op) => op.kind !== '+').map((op) => op.oldLine);
    const newLines = slice.filter((op) => op.kind !== '-').map((op) => op.newLine);
    const oldStart = oldLines.length ? oldLines[0] : Math.max(0, (slice[0]?.oldLine ?? 1) - 1);
    const newStart = newLines.length ? newLines[0] : Math.max(0, (slice[0]?.newLine ?? 1) - 1);
    return [
      `@@ -${range(oldStart, oldLines.length)} +${range(newStart, newLines.length)} @@`,
      ...slice.map((op) => `${op.kind}${op.text}`),
    ].join('\n');
  });
  return [`--- a/${path}\n+++ b/${path}`, ...bodies].join('\n');
}
