'use client';
import { useEffect, useRef } from 'react';

// Tells the open page that data changed somewhere else (quick-add sheet, global modal),
// so it reloads instead of showing stale lists until a manual refresh.
const DATA_CHANGED = 'moneo:data-changed';

export function notifyDataChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DATA_CHANGED));
}

// Runs `onChange` (usually the page's `load`) whenever notifyDataChanged() is called.
export function useDataChanged(onChange: () => void): void {
  const ref = useRef(onChange);
  ref.current = onChange;
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener(DATA_CHANGED, handler);
    return () => window.removeEventListener(DATA_CHANGED, handler);
  }, []);
}

// MONEO AUTO: a new suggestion arrived (forwarded email, another device). Fired by
// AutoLiveListener so the inbox refreshes without a manual reload.
const AUTO_NEW = 'moneo:auto-new';

export function notifyAutoSuggestion(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTO_NEW));
}

export function useAutoSuggestion(onNew: () => void): void {
  const ref = useRef(onNew);
  ref.current = onNew;
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener(AUTO_NEW, handler);
    return () => window.removeEventListener(AUTO_NEW, handler);
  }, []);
}
