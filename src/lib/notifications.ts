import { createClient } from '@/lib/supabase/client';
import type { Notification, CreateNotificationParams } from '@/types/notifications';
import { authRequired, toDataError } from '@/lib/dataError';

// ── Row → camelCase ──────────────────────────────────────────────────────────
function rowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as string,
    title: row.title as string,
    message: row.message as string | undefined,
    icon: row.icon as string | undefined,
    color: row.color as string | undefined,
    actionUrl: row.action_url as string | undefined,
    entityType: row.entity_type as string | undefined,
    entityId: row.entity_id as string | undefined,
    isRead: row.is_read as boolean,
    createdAt: row.created_at as string,
    readAt: row.read_at as string | undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

// ── Fetch notifications ──────────────────────────────────────────────────────
// Throws a DataError when the request fails; [] only means "no notifications".
export async function fetchNotifications(limit = 30): Promise<Notification[]> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw toDataError(authError);
  if (!user) throw authRequired();

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw toDataError(error);
  return (data ?? []).map(rowToNotification);
}

// ── Create notification (centralised, with deduplication) ───────────────────
export async function createNotification(
  params: CreateNotificationParams
): Promise<Notification | null> {
  const supabase = createClient();

  // Deduplication: avoid duplicate notifications for same event
  if (params.entityType && params.entityId && params.metadata?.dedupeKey) {
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', params.userId)
      .eq('type', params.type)
      .eq('entity_type', params.entityType)
      .eq('entity_id', params.entityId)
      .contains('metadata', { dedupeKey: params.metadata.dedupeKey })
      .limit(1);

    if (existing && existing.length > 0) {
      return null; // Already exists
    }
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message ?? null,
      icon: params.icon ?? null,
      color: params.color ?? null,
      action_url: params.actionUrl ?? null,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    console.error('createNotification error:', error.message);
    return null;
  }
  return rowToNotification(data as Record<string, unknown>);
}

// ── Mark single notification as read ────────────────────────────────────────
export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .select('id');

  if (error) {
    console.error('markNotificationRead error:', error.message);
    return false;
  }
  // Zero rows means RLS blocked the update or the notification no longer exists.
  return (data?.length ?? 0) > 0;
}

// ── Mark all notifications as read ──────────────────────────────────────────
export async function markAllNotificationsRead(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) {
    console.error('markAllNotificationsRead error:', error.message);
    return false;
  }
  return true;
}

// ── Relative time helper (SSR-safe, no hydration mismatch) ──────────────────
export function formatNotificationTime(dateStr: string): string {
  // We return a stable string based on the date string itself.
  // The component will call this only on the client inside useEffect.
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHour < 24) return `Hace ${diffHour} h`;
  if (diffDay === 1) return 'Ayer';
  if (diffDay < 7) return `Hace ${diffDay} días`;

  // Older: show date
  const day = date.getDate();
  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];
  const month = months[date.getMonth()];
  return `${day} ${month}`;
}

// ── Notification type config ─────────────────────────────────────────────────
export function getNotificationTypeConfig(type: string): { icon: string; color: string } {
  const configs: Record<string, { icon: string; color: string }> = {
    expense: { icon: '🧾', color: '#FEE2E2' },
    income: { icon: '💰', color: '#DCFCE7' },
    transfer: { icon: '⇄', color: '#DBEAFE' },
    budget: { icon: '📊', color: '#FEF9C3' },
    savings: { icon: '🐷', color: '#DCFCE7' },
    goal: { icon: '🎯', color: '#F3E8FF' },
    debt: { icon: '💳', color: '#FEE2E2' },
    investment: { icon: '📈', color: '#DBEAFE' },
    subscription: { icon: '📺', color: '#EDE9FE' },
    account: { icon: '🏦', color: '#DBEAFE' },
    junta: { icon: '👥', color: '#FEF9C3' },
    reminder: { icon: '⏰', color: '#FEF3C7' },
    achievement: { icon: '🏆', color: '#FEF9C3' },
    system: { icon: '🔔', color: '#F1F5F9' },
    security: { icon: '🔒', color: '#FEE2E2' },
  };
  return configs[type] ?? { icon: '🔔', color: '#F1F5F9' };
}
