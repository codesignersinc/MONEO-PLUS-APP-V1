'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const PENDING_INVITE_KEY = 'moneo.hogar.invite';
export const PENDING_PACK_INVITE_KEY = 'moneo.plus.invite';

// Someone opened an invitation (MONEO HOGAR or a Duo / Familiar pack) before signing in:
// once inside MONEO, take them back to it.
export default function PendingInvite() {
  const router = useRouter();
  useEffect(() => {
    try {
      const valid = (t: string | null) => !!t && /^[a-f0-9]{64}$/.test(t);
      const home = localStorage.getItem(PENDING_INVITE_KEY);
      if (valid(home)) return router.replace(`/hogar/unirse/${home}`);
      const pack = localStorage.getItem(PENDING_PACK_INVITE_KEY);
      if (valid(pack)) router.replace(`/plus/unirse/${pack}`);
    } catch {
      // storage unavailable
    }
  }, [router]);
  return null;
}
