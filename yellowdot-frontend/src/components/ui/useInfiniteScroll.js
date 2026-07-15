/**
 * useInfiniteScroll.js — shared lazy-loading sentinel hook
 * ──────────────────────────────────────────────────────────
 * Used by Timeline and ActivityFeed (and any future feed-style list).
 * Attaches an IntersectionObserver to a sentinel ref; calls onLoadMore
 * once when the sentinel scrolls into view, guarded against duplicate
 * calls while a load is already in flight.
 */
import { useRef, useEffect, useCallback } from "react";

export default function useInfiniteScroll({ hasMore, loading, onLoadMore, rootMargin = "200px" }) {
  const sentinelRef = useRef(null);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const observerCallback = useCallback((entries) => {
    if (entries[0]?.isIntersecting && hasMore && !loadingRef.current) {
      onLoadMore?.();
    }
  }, [hasMore, onLoadMore]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(observerCallback, { rootMargin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [observerCallback, hasMore, rootMargin]);

  return sentinelRef;
}
