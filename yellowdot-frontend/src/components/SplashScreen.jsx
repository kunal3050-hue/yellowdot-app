/**
 * SplashScreen — premium branded launch screen
 *
 * Two modes:
 *   1. <SplashScreen />
 *      Static — stays visible until React unmounts it (Suspense fallback).
 *
 *   2. <SplashScreen authLoading={loading} />
 *      Dynamic — when `authLoading` transitions true → false it plays a
 *      gentle fade-out then removes itself from the DOM.
 *
 * Design: pure white, centred logo + wordmark, Apple-style minimal aesthetic.
 */

import { useEffect, useRef, useState } from "react";
import { PLATFORM_NAME } from "../config/environment";

const LOGO_SRC = "/icons/pwa-512x512.png";

const CSS = `
  @keyframes yd-splash-rise {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes yd-splash-fade-out {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
`;

export default function SplashScreen({ authLoading, unreachable = false, onRetry }) {
  /*
   * phase: "in"  — visible, animating in
   *        "out" — fading out (authLoading just became false)
   *        "gone"— returns null, removed from DOM
   */
  const [phase, setPhase] = useState("in");

  // Remember whether we were ever given authLoading=true on mount.
  // Only those instances should auto-dismiss.
  const hadAuthLoading = useRef(authLoading === true);

  useEffect(() => {
    // Static Suspense mode (authLoading === undefined or always false): never auto-dismiss
    if (!hadAuthLoading.current) return;

    // Hold while the backend is unreachable — the message below is the point.
    if (unreachable) return;

    // Auth resolved (prop flipped true → false)
    if (!authLoading && phase === "in") {
      setPhase("out");
      const t = setTimeout(() => setPhase("gone"), 400);
      return () => clearTimeout(t);
    }
  }, [authLoading, phase, unreachable]);

  if (phase === "gone") return null;

  return (
    <div
      aria-label={`Loading ${PLATFORM_NAME}`}
      role="status"
      style={{
        position:       "fixed",
        inset:          0,
        background:     "#FFFFFF",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        zIndex:         9999,
        animation:      phase === "out"
          ? "yd-splash-fade-out 0.4s cubic-bezier(0.4, 0, 1, 1) both"
          : "none",
        pointerEvents:  phase === "out" ? "none" : "auto",
      }}
    >
      <style>{CSS}</style>

      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <img
        src={LOGO_SRC}
        alt={`${PLATFORM_NAME} logo`}
        draggable={false}
        style={{
          /* 25vw on a 360 dp phone ≈ 90 px; clamp keeps it in 88–130 px range */
          width:      "clamp(88px, 25vw, 130px)",
          height:     "clamp(88px, 25vw, 130px)",
          objectFit:  "contain",
          animation:  "yd-splash-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      />

      {/* ── Wordmark ─────────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop:     20,
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          gap:           5,
          animation:     "yd-splash-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.22s both",
        }}
      >
        <span
          style={{
            fontFamily:    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize:      "clamp(18px, 4.5vw, 22px)",
            fontWeight:    700,
            letterSpacing: "-0.025em",
            color:         "#111111",
            lineHeight:    1.15,
          }}
        >
          {PLATFORM_NAME}
        </span>

        <span
          style={{
            fontFamily:    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize:      "clamp(12px, 3vw, 14px)",
            fontWeight:    400,
            letterSpacing: "0.01em",
            color:         "#9CA3AF",
            lineHeight:    1.4,
          }}
        >
          Preschool Daycare
        </span>
      </div>

      {/* ── Unreachable backend ──────────────────────────────────────────── */}
      {/* Without this the splash is all there is: the boot request never
          settles, so nothing below it ever renders and the person sees a logo
          indefinitely with no hint that anything is wrong. Say so, and give
          them something to press. */}
      {unreachable && (
        <div
          role="alert"
          style={{
            marginTop:     28,
            display:       "flex",
            flexDirection: "column",
            alignItems:    "center",
            gap:           12,
            maxWidth:      320,
            padding:       "0 24px",
            textAlign:     "center",
            animation:     "yd-splash-rise 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
            fontFamily:    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111111", lineHeight: 1.4 }}>
            Can’t reach the server
          </span>
          <span style={{ fontSize: 13, fontWeight: 400, color: "#6B7280", lineHeight: 1.5 }}>
            You’re still signed in — the app just couldn’t load your profile.
            Check your connection and try again.
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                marginTop:    4,
                padding:      "9px 22px",
                borderRadius: 999,
                border:       "none",
                background:   "#F4C430",
                color:        "#3A2A06",
                fontSize:     13,
                fontWeight:   700,
                fontFamily:   "inherit",
                cursor:       "pointer",
              }}
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
