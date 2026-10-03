'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/notifications';
import type { Notification } from '@/types/notifications';
import NotificationPanel from './NotificationPanel';

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [newBadge, setNewBadge] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const hasLoaded = useRef(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications(30);
      setNotifications(data);
    } catch {
      setError('Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    if (user && !hasLoaded.current) {
      hasLoaded.current = true;
      load();
    }
  }, [user, load]);

  // Realtime subscription — build channel fully before subscribing
  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    const supabase = createClient();
    // Unique channel name per effect invocation to avoid reuse conflicts
    const channelName = `notif-${user.id}-${Date.now()}`;

    // Build the channel with all listeners BEFORE calling subscribe()
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (cancelled) return;
          const row = payload.new as Record<string, unknown>;
          const newNotif: Notification = {
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
          setNotifications(prev => [newNotif, ...prev]);
          setNewBadge(true);
          setTimeout(() => setNewBadge(false), 2000);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  async function handleMarkRead(id: string) {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
    );
    await markNotificationRead(id);
  }

  async function handleMarkAllRead() {
    const now = new Date().toISOString();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: now })));
    await markAllNotificationsRead();
  }

  function handleToggle() {
    setOpen(prev => !prev);
  }

  if (!user) return null;

  return (
    <div ref={bellRef} className="relative">
      {/* Bell button */}
      <button
        onClick={handleToggle}
        aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} no leídas` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl border-2 border-black bg-white transition-all duration-200 hover:bg-[#FFD43B] hover:shadow-[2px_2px_0px_#000] active:shadow-none active:translate-y-px focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 ${
          open ? 'bg-[#FFD43B] shadow-[2px_2px_0px_#000]' : 'shadow-[1px_1px_0px_#000]'
        } ${newBadge ? 'animate-bounce' : ''}`}
      >
        {/* Bell icon */}
        <svg
          className="w-4 h-4 text-black"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-black text-[#FFD43B] text-[9px] font-black rounded-full flex items-center justify-center leading-none border border-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <NotificationPanel
          notifications={notifications}
          loading={loading}
          error={error}
          filter={filter}
          onFilterChange={setFilter}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onRetry={load}
          onClose={() => setOpen(false)}
          unreadCount={unreadCount}
        />
      )}
    </div>
  );
}
