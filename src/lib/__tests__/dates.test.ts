import { describe, expect, it } from 'vitest';
import { localDateTimeToISO, nowTimeLocal, todayLocal } from '@/lib/dates';

describe('local dates', () => {
  it('formats the local day and time', () => {
    const d = new Date(2026, 0, 5, 23, 7);
    expect(todayLocal(d)).toBe('2026-01-05');
    expect(nowTimeLocal(d)).toBe('23:07');
  });

  it('round-trips a local day and time through an ISO timestamp', () => {
    const iso = localDateTimeToISO('2026-10-04', '21:30');
    expect(todayLocal(new Date(iso))).toBe('2026-10-04');
    expect(nowTimeLocal(new Date(iso))).toBe('21:30');
    expect(todayLocal(new Date(localDateTimeToISO('2026-10-04', '')))).toBe('2026-10-04');
  });
});
