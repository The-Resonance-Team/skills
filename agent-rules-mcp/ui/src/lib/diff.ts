import { createTwoFilesPatch } from 'diff';

export function buildUnifiedDiff(before: string, after: string, path: string): string {
  if (before === after) return '';
  return createTwoFilesPatch(`a/${path}`, `b/${path}`, before, after, undefined, undefined, {
    context: Number.POSITIVE_INFINITY,
    ignoreWhitespace: false,
  });
}
