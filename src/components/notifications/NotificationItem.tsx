'use client';
import React from 'react';
import { formatNotificationTime, getNotificationTypeConfig } from '@/lib/notifications';
import type { Notification } from '@/types/notifications';

interface NotificationItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}

export default function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const config = getNotificationTypeConfig(notification.type);
  const icon = notification.icon || config.icon;
  const bgColor = notification.color || config.color;

  return (
    <button
      onClick={() => onClick(notification)}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-all duration-150 hover:brightness-95 active:scale-[0.99] border-b-2 border-black last:border-b-0 ${
        notification.isRead ? 'bg-white' : 'bg-[#FFFBEB]'
      }`}
      aria-label={`Notificación: ${notification.title}`}
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 w-9 h-9 rounded-xl border-2 border-black flex items-center justify-center text-base shadow-[2px_2px_0px_#000]"
        style={{ backgroundColor: bgColor }}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-sm leading-tight ${notification.isRead ? 'font-medium text-gray-700' : 'font-black text-black'}`}
          >
            {notification.title}
          </p>
          {/* Unread dot */}
          {!notification.isRead && (
            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-black mt-1" aria-hidden="true" />
          )}
        </div>
        {notification.message && (
          <p
            className={`text-xs mt-0.5 leading-snug ${notification.isRead ? 'text-gray-400' : 'text-gray-600'}`}
          >
            {notification.message}
          </p>
        )}
        <NotificationTime dateStr={notification.createdAt} isRead={notification.isRead} />
      </div>
    </button>
  );
}

// Separate client component for time to avoid hydration mismatch
function NotificationTime({ dateStr, isRead }: { dateStr: string; isRead: boolean }) {
  const [timeStr, setTimeStr] = React.useState<string>('');

  React.useEffect(() => {
    setTimeStr(formatNotificationTime(dateStr));
    // Refresh every minute
    const interval = setInterval(() => {
      setTimeStr(formatNotificationTime(dateStr));
    }, 60_000);
    return () => clearInterval(interval);
  }, [dateStr]);

  if (!timeStr) return null;

  return (
    <p
      className={`text-[10px] mt-1 font-bold uppercase tracking-wide ${isRead ? 'text-gray-300' : 'text-gray-400'}`}
    >
      {timeStr}
    </p>
  );
}
