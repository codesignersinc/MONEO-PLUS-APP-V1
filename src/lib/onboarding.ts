import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { toDataError } from '@/lib/dataError';

// The welcome modal is shown once per user. The flag lives in the user's auth metadata
// (works across devices, no schema change); localStorage is a per-device fallback in case
// saving the flag fails.

const FLAG = 'welcome_seen';
const localKey = (userId: string) => `moneo:welcome-seen:${userId}`;

export function hasSeenWelcome(user: User | null | undefined): boolean {
  if (!user) return true;
  if (user.user_metadata?.[FLAG]) return true;
  try {
    return window.localStorage.getItem(localKey(user.id)) === '1';
  } catch {
    return false;
  }
}

export async function markWelcomeSeen(userId: string): Promise<void> {
  try {
    window.localStorage.setItem(localKey(userId), '1');
  } catch {
    // Storage blocked: the auth flag below still records it.
  }
  const { error } = await createClient().auth.updateUser({ data: { [FLAG]: true } });
  if (error) throw toDataError(error);
}
