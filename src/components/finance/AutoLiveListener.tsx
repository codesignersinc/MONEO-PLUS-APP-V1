'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { autoService } from '@/lib/supabaseAuto';
import { notifyAutoSuggestion } from '@/lib/dataSync';

// Listens (Supabase Realtime) for new MONEO AUTO suggestions while the user is anywhere in
// /finanzas: the inbox refreshes instantly and, outside it, a toast tells the user that a
// forwarded email was detected. Also refreshes when the app comes back to the foreground,
// in case the socket was asleep (mobile background tabs).
export default function AutoLiveListener() {
  const { user } = useAuth();
  const toast = useToast();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const userId: string | undefined = user?.id;

  useEffect(() => {
    if (!userId) return;
    const stop = autoService.watch(userId, (s) => {
      notifyAutoSuggestion();
      if (
        s.source === 'email' &&
        s.status === 'pendiente' &&
        pathRef.current !== '/finanzas/auto'
      ) {
        toastRef.current.showSuccess(
          'MONEO AUTO detectó un movimiento nuevo. Revísalo en MONEO AUTO.'
        );
      }
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') notifyAutoSuggestion();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [userId]);

  return null;
}
