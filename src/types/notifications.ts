export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  icon?: string;
  color?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  metadata?: Record<string, unknown>;
}

export type NotificationType =
  | 'expense' |'income' |'transfer' |'budget' |'savings' |'goal' |'debt' |'investment' |'subscription' |'account' |'junta' |'reminder' |'achievement' |'system' |'security'
  | string;

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  icon?: string;
  color?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationDedupeKey {
  userId: string;
  type: NotificationType;
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
}
