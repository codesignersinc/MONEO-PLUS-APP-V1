'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const PENDING_INVITE_KEY = 'moneo.hogar.invite';

// Someone opened a household invitation before signing in: once inside MONEO, take them
// back to it.
export default function PendingInvite() {
  const router = useRouter();
  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem(PENDING_INVITE_KEY);
    } catch {
      return;
    }
    if (token && /^[a-f0-9]{64}$/.test(token)) router.replace(`/hogar/unirse/${token}`);
  }, [router]);
  return null;
}
