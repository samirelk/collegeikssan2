/**
 * Centralized Date & Time utility for GMT (UTC) enforcement.
 * Enforces GMT standard time across the entire application (not GMT+1).
 */

const pad = (n: number) => (n < 10 ? '0' + n : '' + n);

/**
 * Returns current or given date formatted as DD/MM/YYYY in GMT (UTC).
 */
export function getGmtDate(date: Date | string | number = new Date()): string {
  const d = typeof date === 'object' && date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = pad(d.getUTCDate());
  const month = pad(d.getUTCMonth() + 1);
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Returns current or given time formatted as HH:MM in GMT (UTC).
 */
export function getGmtTime(date: Date | string | number = new Date()): string {
  const d = typeof date === 'object' && date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const hours = pad(d.getUTCHours());
  const minutes = pad(d.getUTCMinutes());
  return `${hours}:${minutes}`;
}

/**
 * Returns combined date and time in GMT: { date: 'DD/MM/YYYY', time: 'HH:MM', isoDate: 'YYYY-MM-DD' }
 */
export function getGmtDateTime(date: Date | string | number = new Date()) {
  const d = typeof date === 'object' && date instanceof Date ? date : new Date(date);
  const day = pad(d.getUTCDate());
  const month = pad(d.getUTCMonth() + 1);
  const year = d.getUTCFullYear();
  const hours = pad(d.getUTCHours());
  const minutes = pad(d.getUTCMinutes());
  return {
    date: `${day}/${month}/${year}`,
    time: `${hours}:${minutes}`,
    isoDate: `${year}-${month}-${day}`
  };
}

/**
 * Returns ISO date YYYY-MM-DD in GMT.
 */
export function getGmtIsoDate(date: Date | string | number = new Date()): string {
  const d = typeof date === 'object' && date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Format date string or Date object in GMT with Arabic locale.
 */
export function formatGmtDateLocale(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'object' && date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ar-MA', {
    timeZone: 'UTC',
    ...options
  }).format(d);
}

/**
 * Format datetime string or Date object in GMT with Arabic locale.
 */
export function formatGmtDateTimeLocale(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'object' && date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ar-MA', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options
  }).format(d);
}
