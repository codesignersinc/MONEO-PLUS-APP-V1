'use client';
import { useEffect, useState } from 'react';
import type { CoronasSummary } from '@/lib/coronas';

// Last Coronas summary, shared by CoronasSync (writes) and the chip and page (read), so the
// app asks the database once per change instead of once per component.
const EVENT = 'moneo:coronas';
let last: CoronasSummary | null = null;

export function publishCoronas(summary: CoronasSummary): void {
  last = summary;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

export function useCoronas(): CoronasSummary | null {
  const [value, setValue] = useState<CoronasSummary | null>(last);
  useEffect(() => {
    const handler = () => setValue(last);
    handler();
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return value;
}
