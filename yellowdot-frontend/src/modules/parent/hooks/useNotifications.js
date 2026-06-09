/**
 * useNotifications.js — Parent Module · Notification state hook
 * ──────────────────────────────────────────────────────────────
 * Provides:
 *   notifications[]   — full list (filtered by childId/type if set)
 *   unreadCount       — live count of unread notifications
 *   loading           — initial load in progress
 *   refresh()         — manual refetch
 *   markRead(id)      — mark one as read
 *   markAllRead()     — mark all as read
 *   setFilter(obj)    — set { childId, type } filters
 *
 * Polling: refetches unread count every 60 seconds while the tab is visible.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import * as notifSvc from "../services/notificationService";

const POLL_INTERVAL_MS = 60_000;

export default function useNotifications({ autoLoad = true } = {}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [filter,        setFilter]        = useState({ childId: null, type: null });

  const pollRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await notifSvc.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // silent — unread count failure must not break the app
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notifSvc.getNotifications({
        childId: filter.childId || undefined,
        type:    filter.type    || undefined,
        limit:   60,
      });
      console.info("[useNotifications] API response:", data);
      const list = data?.notifications;
      if (!Array.isArray(list)) {
        console.warn("[useNotifications] Unexpected response shape:", data);
        setError("Unexpected response from server.");
        setNotifications([]);
        return;
      }
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.read).length);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "Failed to load notifications.";
      const status = e?.response?.status;
      console.error("[useNotifications] fetchNotifications failed:", status, msg, e);
      setError(`${status ? `[${status}] ` : ""}${msg}`);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const refresh = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markRead = useCallback(async (id) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await notifSvc.markRead(id);
    } catch {
      // Revert on failure by refreshing
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const markAllRead = useCallback(async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await notifSvc.markAllRead();
    } catch {
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // Initial load
  useEffect(() => {
    if (autoLoad) fetchNotifications();
  }, [autoLoad, fetchNotifications]);

  // Poll unread count
  useEffect(() => {
    if (!autoLoad) return;
    pollRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [autoLoad, fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    filter,
    setFilter,
    refresh,
    markRead,
    markAllRead,
  };
}

/**
 * Lightweight hook — only fetches unread count (for the bell badge).
 * Does not load the full list. Used in ParentLayout.
 */
export function useUnreadCount() {
  const [count, setCount]   = useState(0);
  const [ready, setReady]   = useState(false);
  const pollRef = useRef(null);

  const fetch = useCallback(async () => {
    try {
      const n = await notifSvc.getUnreadCount();
      setCount(n);
    } catch {
      // silent
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    fetch();
    pollRef.current = setInterval(fetch, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetch]);

  return { count, ready };
}
