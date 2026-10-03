'use client';
import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Notification } from '@/types/notifications';
import NotificationItem from './NotificationItem';
import NotificationEmpty from './NotificationEmpty';

interface NotificationPanelProps {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  filter: 'all' | 'unread';
  onFilterChange: (f: 'all' | 'unread') => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onRetry: () => void;
  onClose: () => void;
  unreadCount: number;
}

export default function NotificationPanel({
  notifications,
  loading,
  error,
  filter,
  onFilterChange,
  onMarkRead,
  onMarkAllRead,
  onRetry,
  onClose,
  unreadCount,
}: NotificationPanelProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  const displayed = filter === 'unread'
    ? notifications.filter(n => !n.isRead)
    : notifications;

  function handleNotificationClick(notification: Notification) {
    onMarkRead(notification.id);
    onClose();
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  }

  // Close on outside click (desktop)
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Panel de notificaciones"
        className={`
          fixed z-50 bg-white border-[3px] border-black shadow-[6px_6px_0px_#000] rounded-2xl overflow-hidden
          flex flex-col
          /* Mobile: bottom sheet */
          bottom-0 left-0 right-0 max-h-[80vh]
          /* Desktop: dropdown */
          lg:absolute lg:bottom-auto lg:left-auto lg:right-0 lg:top-full lg:mt-2 lg:w-[400px] lg:max-h-[520px]
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-[3px] border-black bg-[#FFD43B] flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <h2 className="font-black text-black text-sm uppercase tracking-wide">Notificaciones</h2>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 bg-black text-[#FFD43B] text-[10px] font-black rounded-full leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-[10px] font-black text-black uppercase tracking-wide hover:underline"
              >
                Marcar todas
              </button>
            )}
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-lg border-2 border-black bg-white flex items-center justify-center hover:bg-gray-100 transition-colors"
              aria-label="Cerrar notificaciones"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b-2 border-black flex-shrink-0">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-wide transition-colors ${
                filter === f
                  ? 'bg-black text-[#FFD43B]'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'Todas' : 'No leídas'}
              {f === 'unread' && unreadCount > 0 && (
                <span className="ml-1 text-[9px]">({unreadCount})</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-xl bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-2 bg-gray-100 rounded w-full" />
                    <div className="h-2 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-2xl border-[3px] border-black bg-[#FEE2E2] flex items-center justify-center text-2xl mx-auto mb-3 shadow-[3px_3px_0px_#000]">
                ⚠️
              </div>
              <p className="text-xs font-black text-black uppercase mb-1">Error al cargar</p>
              <p className="text-xs text-gray-500 mb-3">No pudimos cargar tus notificaciones.</p>
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-[#FFD43B] border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 transition-all"
              >
                Intentar nuevamente
              </button>
            </div>
          )}

          {!loading && !error && displayed.length === 0 && (
            <NotificationEmpty />
          )}

          {!loading && !error && displayed.length > 0 && (
            <div>
              {displayed.map(n => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
