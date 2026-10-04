// Local-date helpers. Never derive the day with toISOString(): it is UTC and in Lima
// (UTC−5) shifts evening movements to the next day.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Today's date in the device's time zone, as YYYY-MM-DD.
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Current local time as HH:MM.
export function nowTimeLocal(now: Date = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// A local day (YYYY-MM-DD) and time (HH:MM) as an ISO timestamp for timestamptz columns.
export function localDateTimeToISO(date: string, time = '12:00'): string {
  return new Date(`${date}T${time || '12:00'}:00`).toISOString();
}
