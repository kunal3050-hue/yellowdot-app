/**
 * Memories.jsx — Parent Module · Phase 4
 * ──────────────────────────────────────────────────────────────────
 * A simple, beautiful timeline of photos & videos shared by school for
 * the parent's linked children.
 *
 * V1: timeline feed · filter by child · date per memory · caption ·
 *     photo gallery (tap → fullscreen) · inline video playback ·
 *     empty state.
 * Excluded: likes, comments, downloads, sharing, albums, tags, reactions, AI.
 *
 * Multi-child from day one. Theme tokens only — no hardcoded colours.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import useParentProfile from "../hooks/useParentProfile";
import useMemories from "../hooks/useMemories";
import { colors, spacing, radius, shadows, typography } from "../theme";

function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export default function Memories() {
  const { children } = useParentProfile();
  const [params] = useSearchParams();
  const initialChild = params.get("child") || "all";

  const [filter, setFilter] = useState(initialChild);
  const [lightbox, setLightbox] = useState(null); // memory object (photo) or null

  // Keep filter valid once children load.
  useEffect(() => {
    if (filter !== "all" && children.length && !children.some(c => c.studentId === filter)) {
      setFilter("all");
    }
  }, [children, filter]);

  const { memories, loading, error } = useMemories(filter === "all" ? undefined : filter);

  const nameById = useMemo(() => {
    const m = {};
    children.forEach(c => { m[c.studentId] = (c.studentName || "").split(" ")[0] || c.studentId; });
    return m;
  }, [children]);

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      <header style={{ padding: `${spacing.xs}px ${spacing.xs}px 0` }}>
        <h1 style={{ ...typography.h1, color: colors.text.primary, margin: 0 }}>Memories</h1>
        <p style={{ ...typography.caption, color: colors.text.muted, margin: `${spacing.xs}px 0 0` }}>
          Moments from school 📸
        </p>
      </header>

      {/* Child filter (multi-child only) */}
      {children.length > 1 && (
        <div style={{ display: "flex", gap: spacing.sm, overflowX: "auto", paddingBottom: spacing.xs }}>
          <FilterPill label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          {children.map(c => (
            <FilterPill
              key={c.studentId}
              label={nameById[c.studentId]}
              active={filter === c.studentId}
              onClick={() => setFilter(c.studentId)}
            />
          ))}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <>{[0, 1].map(i => <MemorySkeleton key={i} />)}</>
      ) : error ? (
        <ErrorNote message={error} />
      ) : memories.length === 0 ? (
        <EmptyState />
      ) : (
        memories.map(mem => (
          <MemoryCard
            key={mem.id}
            memory={mem}
            childName={filter === "all" ? nameById[mem.studentId] : null}
            onOpenPhoto={() => setLightbox(mem)}
          />
        ))
      )}

      {/* Photo lightbox (gallery view) */}
      {lightbox && <Lightbox memory={lightbox} childName={nameById[lightbox.studentId]} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// ── Memory card ─────────────────────────────────────────────────────
function MemoryCard({ memory, childName, onOpenPhoto }) {
  const isVideo = memory.type === "video";
  return (
    <article style={{
      background: colors.surface.card,
      borderRadius: radius.card,
      boxShadow: shadows.card,
      overflow: "hidden",
    }}>
      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.md, padding: spacing.lg }}>
        <span style={{ ...typography.caption, color: colors.text.muted }}>{fmtDate(memory.date)}</span>
        {childName && (
          <span style={{
            ...typography.meta, fontWeight: typography.weight.bold,
            color: colors.yellow700, background: colors.yellow100,
            border: `1px solid ${colors.yellow200}`,
            borderRadius: radius.pill, padding: `${spacing.xs}px ${spacing.md}px`,
          }}>{childName}</span>
        )}
      </div>

      {/* Media */}
      {isVideo ? (
        <video
          src={memory.mediaUrl}
          poster={memory.thumbnailUrl || undefined}
          controls
          playsInline
          style={{ width: "100%", maxHeight: 420, background: colors.gray900, display: "block" }}
        />
      ) : (
        <button
          onClick={onOpenPhoto}
          style={{ border: "none", padding: 0, margin: 0, width: "100%", cursor: "pointer", background: colors.gray100, display: "block" }}
        >
          <img
            src={memory.mediaUrl}
            alt={memory.caption || "Memory"}
            style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }}
          />
        </button>
      )}

      {/* Caption */}
      {memory.caption && (
        <p style={{ ...typography.body, color: colors.text.secondary, margin: 0, padding: spacing.lg }}>
          {memory.caption}
        </p>
      )}
    </article>
  );
}

// ── Lightbox (fullscreen photo) ─────────────────────────────────────
function Lightbox({ memory, childName, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: colors.surface.scrim,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: spacing.lg,
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: spacing.lg, right: spacing.lg,
          width: 40, height: 40, borderRadius: radius.pill,
          border: "none", cursor: "pointer",
          background: colors.surface.card, color: colors.text.primary,
          fontSize: typography.size.lg, lineHeight: 1,
        }}
      >✕</button>

      <img
        src={memory.mediaUrl}
        alt={memory.caption || "Memory"}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: "100%", maxHeight: "72vh", borderRadius: radius.md, objectFit: "contain" }}
      />

      <div onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: "100%", marginTop: spacing.lg }}>
        <div style={{ ...typography.caption, color: colors.yellow300 }}>
          {[childName, fmtDate(memory.date)].filter(Boolean).join(" · ")}
        </div>
        {memory.caption && (
          <p style={{ ...typography.body, color: colors.text.onDark, margin: `${spacing.sm}px 0 0` }}>
            {memory.caption}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Bits ────────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...typography.caption,
        flexShrink: 0,
        padding: `${spacing.sm}px ${spacing.lg}px`,
        borderRadius: radius.pill,
        cursor: "pointer",
        fontWeight: typography.weight.bold,
        color: active ? colors.text.onYellow : colors.text.secondary,
        background: active ? colors.brand.gradient : colors.surface.card,
        border: `1px solid ${active ? "transparent" : colors.surface.border}`,
        boxShadow: active ? shadows.primary : "none",
      }}
    >{label}</button>
  );
}

function EmptyState() {
  return (
    <div style={{
      background: colors.surface.card,
      borderRadius: radius.card,
      boxShadow: shadows.card,
      padding: `${spacing["3xl"]}px ${spacing.xl}px`,
      textAlign: "center",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: radius.pill,
        background: colors.brand.gradient,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 30, margin: `0 auto ${spacing.lg}px`,
        boxShadow: shadows.primary,
      }}>📸</div>
      <h2 style={{ ...typography.h2, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>
        No memories yet
      </h2>
      <p style={{ ...typography.body, color: colors.text.muted, margin: 0 }}>
        Photos and videos shared by school will appear here.
      </p>
    </div>
  );
}

function ErrorNote({ message }) {
  return (
    <div style={{
      ...typography.body,
      color: colors.dangerStrong, background: colors.dangerSoft,
      border: `1px solid ${colors.dangerBorder}`, borderRadius: radius.md,
      padding: spacing.lg,
    }}>{message}</div>
  );
}

function MemorySkeleton() {
  return (
    <div style={{
      background: colors.surface.card, borderRadius: radius.card,
      boxShadow: shadows.card, overflow: "hidden",
    }}>
      <div style={{ height: 14, width: "35%", borderRadius: radius.sm, background: colors.gray100, margin: spacing.lg }} />
      <div style={{ height: 220, background: colors.gray100 }} />
      <div style={{ height: 12, width: "80%", borderRadius: radius.sm, background: colors.gray100, margin: spacing.lg }} />
    </div>
  );
}
