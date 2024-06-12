import { fromZonedTime } from 'date-fns-tz';

export function convertToUTC3(date: Date): Date {
  const timeZone = 'America/Sao_Paulo'; // UTC-3
  return fromZonedTime(date, timeZone);
}
