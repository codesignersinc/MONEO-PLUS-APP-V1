'use client';
import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { useDataChanged } from '@/lib/dataSync';
import { awardsMessage } from '@/lib/coronas';
import { coronasService } from '@/lib/supabaseCoronas';
import { publishCoronas } from './coronasStore';

/**
 * Asks the database for the Coronas due (on open, after every change, on navigation and when
 * the app comes back to the foreground) and celebrates the new ones. Failures are silent:
 * Coronas never get in the way of managing money.
 */
export default function CoronasSync() {
  const { showSuccess } = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);

  const sync = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const summary = await coronasService.sync();
      publishCoronas(summary);
      const message = awardsMessage(summary.new);
      if (message) showSuccess(message);
    } catch {
      // Silent on purpose (see above).
    } finally {
      busy.current = false;
    }
  }, [showSuccess]);

  const later = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(sync, 1500);
  }, [sync]);

  useEffect(() => {
    sync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') later();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [sync, later]);

  // Moving to another screen is a cheap moment to check again (e.g. after marking a payment).
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    later();
  }, [pathname, later]);

  useDataChanged(later);
  return null;
}
