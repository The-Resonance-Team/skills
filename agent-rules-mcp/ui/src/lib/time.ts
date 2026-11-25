import { tz } from '@date-fns/tz';
import { format, isValid, parseISO } from 'date-fns';

export function formatTime(value: string): string {
  const date = parseISO(value);
  return isValid(date)
    ? format(date, 'yyyy-MM-dd HH:mm:ss', { in: tz('Asia/Ho_Chi_Minh') })
    : value;
}
