import { tz } from '@date-fns/tz';
import { format, isValid, parseISO } from 'date-fns';

function formatDate(date: Date): string {
  return isValid(date)
    ? format(date, 'yyyy-MM-dd HH:mm:ss', { in: tz('Asia/Ho_Chi_Minh') })
    : String(date);
}

export function formatEpoch(value: number): string {
  return formatDate(new Date(value));
}

export function formatTime(value: string): string {
  return formatDate(parseISO(value));
}
