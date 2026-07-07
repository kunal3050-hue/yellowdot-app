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

export default function SplashScreen({ authLoading }) {
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

    // Auth resolved (prop flipped true → false)
    if (!authLoading && phase === "in") {
      setPhase("out");
      const t = setTimeout(() => setPhase("gone"), 400);
      return () => clearTimeout(t);
    }
  }, [authLoading, phase]);

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
    </div>
  );
}
