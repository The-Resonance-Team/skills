import { addMilliseconds, parseISO } from 'date-fns';

export const dayMs = 86_400_000;
export const reviewDays = 30;
export const historyDays = 90;

export function deadline(iso: string, days: number): number {
  return addMilliseconds(parseISO(iso), days * dayMs).getTime();
}
