'use client';

import { createClient } from '@/lib/supabase/client';
import { DataError, toDataError } from '@/lib/dataError';

// Deletes the signed-in user's account and all their data through the
// `delete-account` Edge Function (service role). It refuses while the user
// organizes an active Junta. Resolves on success or throws a DataError whose
// message can be shown to the user.
export async function deleteMyAccount(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.functions.invoke('delete-account', {
    body: { confirm: 'ELIMINAR' },
  });
  if (!error) return;

  const response = (error as { context?: unknown }).context;
  if (response instanceof Response) {
    let message = '';
    try {
      const body = await response.json();
      message = typeof body?.error === 'string' ? body.error : '';
    } catch {
      // Non-JSON error body: fall back to the generic message below.
    }
    const kind =
      response.status === 401 ? 'auth' : response.status === 409 ? 'conflict' : 'unknown';
    throw new DataError(kind, error, message || undefined);
  }
  throw toDataError(error);
}
