/**
 * HomeFeed.jsx — Parent Module · Home (Unified Activity Timeline)
 * ──────────────────────────────────────────────────────────────────────
 * Home is now a real, child-specific activity timeline — a quick overview of
 * everything happening with the selected child, so a parent instantly knows:
 * was my child present, what did they eat, did they nap, what was consumed,
 * any new memories, and what's the next holiday — without opening modules.
 *
 *   • One pinned card: the single nearest UPCOMING holiday (never past/multiple).
 *   • Timeline of activity (attendance / food menu / nap / consumption / memory)
 *     newest-first, grouped into Today · Yesterday · Earlier This Week · Older.
 *   • Unseen items are flagged "● New" until the next visit (per child).
 *   • Child switcher — switching child refreshes the whole feed.
 *
 * Data: GET /api/parent/activity (child-scoped). Daily Care modules are
 * unchanged and still reachable from the Daily Care hub. Theme tokens only.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import useParentProfile from "../hooks/useParentProfile";
import useActivityFeed from "../hooks/useActivityFeed";
import { colors, spacing, radius, shadows, typography, layout } from "../theme";

// ── Per-kind presentation ──────────────────────────────────────────
const KIND_META = {
  checkin:     { tint: colors.successSoft, ring: colors.successBorder },
  checkout:    { tint: "#EFF6FF",          ring: "#BFDBFE" },
  absent:      { tint: colors.dangerSoft,  ring: colors.dangerBorder },
  attendance:  { tint: colors.successSoft, ring: colors.successBorder },
  foodMenu:    { tint: colors.yellow100,   ring: colors.yellow200 },
  nap:         { tint: colors.yellow50,    ring: colors.yellow200 },
  consumption: { tint: colors.yellow100,   ring: colors.yellow200 },
  memory:      { tint: colors.yellow200,   ring: colors.yellow300 },
};

const SEEN_PREFIX = "yd_feed_seen_";

// IST-local YYYY-MM-DD (the school/data timezone).
function istToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}
function daysAgo(dateStr, today) {
  if (!dateStr) return Infinity;
  const a = new Date(`${dateStr}T00:00:00Z`), b = new Date(`${today}T00:00:00Z`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return Infinity;
  return Math.round((b - a) / 86400000);
}
function fmtWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(new Date()));
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const SECTIONS = [
  { key: "today",     label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week",      label: "Earlier This Week" },
  { key: "older",     label: "Older" },
];

export default function HomeFeed() {
  const { user } = useAuth();
  const { children } = useParentProfile();
  const [activeId, setActiveId] = useState(null);

  useEffect(() => { if (!activeId && children.length) setActiveId(children[0].studentId); }, [children, activeId]);

  const [detail, setDetail] = useState(null);

  const { data, loading, error } = useActivityFeed(activeId);
  const items = useMemo(() => data?.items || [], [data]);
  const highlights = useMemo(() => data?.highlights || [], [data]);

  // ── Unseen detection (per child, since last visit) ───────────────
  // Capture the previous "last seen" once per child this session, then advance
  // the stored marker so these items read as seen on the next visit.
  const baselineRef = useRef({});
  useEffect(() => {
    if (loading || !activeId || !data) return;
    try {
      const key = SEEN_PREFIX + activeId;
      if (baselineRef.current[activeId] === undefined) {
        baselineRef.current[activeId] = localStorage.getItem(key) || "";
      }
      const newest = items.reduce((mx, it) => (it.timestamp > mx ? it.timestamp : mx), "");
      const nowIso = new Date().toISOString();
      localStorage.setItem(key, newest > nowIso ? newest : nowIso);
    } catch { /* localStorage unavailable — badges simply won't persist */ }
  }, [loading, activeId, data, items]);

  const baseline = baselineRef.current[activeId] || "";
  const isNew = (it) => !!baseline && it.timestamp > baseline;
  const newCount = items.filter(isNew).length;

  // ── Group into time sections ─────────────────────────────────────
  const grouped = useMemo(() => {
    const today = istToday();
    const g = { today: [], yesterday: [], week: [], older: [] };
    for (const it of items) {
      const d = daysAgo(it.date, today);
      if (d <= 0) g.today.push(it);
      else if (d === 1) g.yesterday.push(it);
      else if (d <= 6) g.week.push(it);
      else g.older.push(it);
    }
    return g;
  }, [items]);

  const firstName = (user?.name || "").trim().split(" ")[0];
  const activeChild = children.find(c => c.studentId === activeId);
  const childFirst = (activeChild?.studentName || "").split(" ")[0];

  return (
    <div style={{ padding: spacing.lg, display: "flex", flexDirection: "column", gap: spacing.lg }}>

      {/* ── Greeting ─────────────────────────────────────────────── */}
      <header style={{ padding: `${spacing.xs}px ${spacing.xs}px 0` }}>
        <p style={{ ...typography.caption, color: colors.text.muted, margin: 0 }}>
          {greeting()}{firstName ? `, ${firstName}` : ""} 👋
        </p>
        <h1 style={{ ...typography.h1, color: colors.text.primary, margin: `${spacing.xs}px 0 0` }}>
          {childFirst ? `${childFirst}'s day` : "Your child's day"}
        </h1>
        {newCount > 0 && (
          <p style={{ ...typography.caption, color: colors.yellow700, fontWeight: typography.weight.bold, margin: `${spacing.xs}px 0 0` }}>
            ● {newCount} new update{newCount === 1 ? "" : "s"} since your last visit
          </p>
        )}
      </header>

      {/* ── Child switcher ──────────────────────────────────────────── */}
      {children.length > 1 && (
        <Pills
          items={children.map(c => ({ id: c.studentId, label: (c.studentName || "").split(" ")[0] || c.studentId }))}
          active={activeId} onSelect={setActiveId}
        />
      )}

      {/* ── Smart Highlights carousel ───────────────────────────────── */}
      {!loading && highlights.length > 0 && (
        <HighlightsCarousel highlights={highlights} onOpen={setDetail} />
      )}

      {/* ── Timeline ────────────────────────────────────────────────── */}
      {loading ? (
        <>{[0, 1, 2].map(i => <CardSkeleton key={i} />)}</>
      ) : error ? (
        <ErrorNote message={error} />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        SECTIONS.map(sec => grouped[sec.key].length > 0 && (
          <section key={sec.key} style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <Label>{sec.label}</Label>
            {grouped[sec.key].map(it => <ActivityRow key={it.id} item={it} isNew={isNew(it)} />)}
          </section>
        ))
      )}

      {/* ── Highlight detail (in-place modal — no separate Home screen) ── */}
      {detail && <HighlightDetailModal highlight={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// ── Activity row ───────────────────────────────────────────────────
function ActivityRow({ item, isNew }) {
  const meta = KIND_META[item.kind] || KIND_META.foodMenu;
  return (
    <div style={{
      background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card,
      padding: spacing.lg, display: "flex", alignItems: "center", gap: spacing.md,
      border: isNew ? `1px solid ${colors.yellow300}` : `1px solid transparent`,
    }}>
      <span style={{
        width: 44, height: 44, borderRadius: radius.md, flexShrink: 0,
        background: meta.tint, border: `1px solid ${meta.ring}`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
      }}>{item.emoji}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <span style={{ ...typography.title, color: colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </span>
          {isNew && <NewBadge />}
        </div>
        <div style={{ ...typography.caption, color: colors.text.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.subtitle}
        </div>
      </div>

      {item.image ? (
        <img src={item.image} alt="" style={{ width: 44, height: 44, borderRadius: radius.md, objectFit: "cover", flexShrink: 0 }} />
      ) : null}

      <span style={{ ...typography.meta, color: colors.text.faint, flexShrink: 0 }}>{fmtWhen(item.timestamp)}</span>
    </div>
  );
}

function NewBadge() {
  return (
    <span style={{
      ...typography.meta, fontWeight: typography.weight.bold, flexShrink: 0,
      color: colors.text.onYellow, background: colors.brand.gradient,
      borderRadius: radius.pill, padding: `1px ${spacing.sm}px`, lineHeight: 1.4,
    }}>● New</span>
  );
}

// Build the calendar tile (month + day) from the SAME date the subtitle uses,
// so the icon can never drift from the holiday record. (The old static 📅
// emoji rendered as Apple's fixed "JUL 17" glyph regardless of the real date.)
function holidayTile(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return { mon: "", day: "" };
  return { mon: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(), day: String(d.getDate()).padStart(2, "0") };
}
// "15 Aug 2026"
function fmtDayMonthYear(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
// "38 days remaining" / "Tomorrow" / "Today" / "Happening now"
function holidayCountdown(startDate, endDate) {
  const today = istToday();
  const remaining = -daysAgo(startDate, today); // days until startDate (negative = already started)
  if (remaining > 1)  return `${remaining} days remaining`;
  if (remaining === 1) return "Tomorrow";
  if (remaining === 0) return "Today";
  // Already started but not yet ended (backend only sends upcoming/ongoing).
  if (endDate && endDate !== startDate && daysAgo(endDate, today) <= 0) return "Happening now";
  return "Today";
}

// ── Smart Highlights carousel ───────────────────────────────────────
// Per-kind presentation. Visual priority is decided server-side; here we only
// style each kind within the Yellow Dot language. Emergencies use the danger
// accent so they stand out; dated celebratory items reuse the yellow gradient
// + date tile; announcements/notices are clean white info cards.
const HL_META = {
  emergency:    { label: "Emergency",    emoji: "🚨" },
  event:        { label: "Event",        emoji: "🎉" },
  birthday:     { label: "Birthday",     emoji: "🎂" },
  holiday:      { label: "Holiday",      emoji: "📅" },
  announcement: { label: "Announcement", emoji: "📢", tint: colors.yellow100, ring: colors.yellow200 },
  notice:       { label: "Notice",       emoji: "📋", tint: colors.gray100,   ring: colors.surface.border },
};
function hlStyle(kind) {
  if (kind === "emergency")
    return { bg: colors.danger, fg: colors.white, sub: colors.white, tileBg: colors.white };
  if (kind === "announcement" || kind === "notice")
    return { bg: colors.surface.card, fg: colors.text.primary, sub: colors.text.muted, card: true };
  // holiday / event / birthday — yellow gradient
  return { bg: colors.brand.gradient, fg: colors.text.onYellow, sub: colors.text.onYellow, tileBg: colors.surface.card };
}

function HighlightsCarousel({ highlights, onOpen }) {
  const [idx, setIdx] = useState(0);
  const trackRef = useRef(null);

  useEffect(() => { setIdx(0); }, [highlights.length]); // reset on child switch
  useEffect(() => {
    if (highlights.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % highlights.length), 5000); // auto-rotate 5s
    return () => clearInterval(t);
  }, [highlights.length]);
  useEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
  }, [idx]);

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx) setIdx(i);
  }

  return (
    <div>
      <div ref={trackRef} onScroll={onScroll} style={{
        display: "flex", overflowX: "auto", scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none",
      }}>
        {highlights.map(h => (
          <div key={h.id} style={{ flex: "0 0 100%", minWidth: "100%", scrollSnapAlign: "start", boxSizing: "border-box" }}>
            <HighlightCard h={h} onOpen={onOpen} />
          </div>
        ))}
      </div>
      {highlights.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: spacing.sm }}>
          {highlights.map((_, i) => (
            <button key={i} aria-label={`Go to highlight ${i + 1}`} onClick={() => setIdx(i)} style={{
              width: i === idx ? 18 : 6, height: 6, borderRadius: radius.pill,
              border: "none", padding: 0, cursor: "pointer", transition: "width 0.2s",
              background: i === idx ? colors.yellow500 : colors.gray300,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function HighlightCard({ h, onOpen }) {
  const meta = HL_META[h.kind] || HL_META.notice;
  const st = hlStyle(h.kind);
  const dated = !!h.date;
  const tile = dated ? holidayTile(h.date) : null;
  const subtitle = dated
    ? `${fmtDayMonthYear(h.date)} · ${holidayCountdown(h.date, h.endDate)}`
    : `${meta.label}${h.postedAt ? ` · ${fmtWhen(h.postedAt)}` : ""}`;
  return (
    <div onClick={() => onOpen(h)} style={{
      cursor: "pointer", boxSizing: "border-box", minHeight: 92,
      borderRadius: radius.card, boxShadow: shadows.card, padding: spacing.lg,
      background: st.bg, display: "flex", alignItems: "center", gap: spacing.md,
      border: st.card ? `1px solid ${colors.surface.border}` : "1px solid transparent",
    }}>
      {dated ? (
        <div style={{
          width: 46, height: 46, borderRadius: radius.md, flexShrink: 0, background: st.tileBg,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1,
        }}>
          <span style={{ fontSize: 9, fontWeight: typography.weight.extra, letterSpacing: typography.tracking.wide, color: colors.yellow700 }}>{tile.mon}</span>
          <span style={{ fontSize: 20, fontWeight: typography.weight.extra, color: colors.text.primary, marginTop: 1 }}>{tile.day}</span>
        </div>
      ) : (
        <div style={{
          width: 46, height: 46, borderRadius: radius.md, flexShrink: 0,
          background: st.card ? meta.tint : colors.white,
          border: st.card ? `1px solid ${meta.ring}` : "none",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
        }}>{meta.emoji}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...typography.meta, color: st.fg, fontWeight: typography.weight.bold, opacity: 0.85, textTransform: "uppercase", letterSpacing: typography.tracking.wider }}>
          {meta.label}
        </div>
        <div style={{ ...typography.title, color: st.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</div>
        <div style={{ ...typography.caption, color: st.sub, opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>
      </div>
      <span style={{ ...typography.title, color: st.fg, opacity: 0.5, flexShrink: 0 }}>›</span>
    </div>
  );
}

function HighlightDetailModal({ highlight: h, onClose }) {
  const meta = HL_META[h.kind] || HL_META.notice;
  const dated = !!h.date;
  const dateLine = dated
    ? `${fmtDayMonthYear(h.date)} · ${holidayCountdown(h.date, h.endDate)}`
    : (h.postedAt ? fmtWhen(h.postedAt) : "");
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 60, background: colors.surface.scrim,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: layout.contentMax, background: colors.surface.card,
        borderTopLeftRadius: radius["2xl"], borderTopRightRadius: radius["2xl"],
        padding: spacing.xl, boxShadow: shadows.lg, maxHeight: "80vh", overflowY: "auto",
        paddingBottom: `calc(${spacing.xl}px + ${layout.safeBottom})`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md, marginBottom: spacing.md }}>
          <div style={{
            width: 48, height: 48, borderRadius: radius.md, flexShrink: 0,
            background: h.kind === "emergency" ? colors.dangerSoft : colors.yellow100,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          }}>{meta.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...typography.meta, color: h.kind === "emergency" ? colors.dangerStrong : colors.text.muted, fontWeight: typography.weight.bold, textTransform: "uppercase", letterSpacing: typography.tracking.wider }}>
              {meta.label}
            </div>
            <div style={{ ...typography.h2, color: colors.text.primary }}>{h.title}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            width: 32, height: 32, borderRadius: radius.pill, flexShrink: 0,
            border: `1px solid ${colors.surface.border}`, background: colors.surface.raised,
            color: colors.text.muted, fontSize: 16, lineHeight: 1, cursor: "pointer",
          }}>×</button>
        </div>
        {dateLine && (
          <div style={{ ...typography.caption, color: colors.yellow700, fontWeight: typography.weight.bold, marginBottom: spacing.md }}>{dateLine}</div>
        )}
        {h.image ? (
          <img src={h.image} alt="" style={{ width: "100%", borderRadius: radius.md, marginBottom: spacing.md, display: "block" }} />
        ) : null}
        <p style={{ ...typography.body, color: colors.text.secondary, margin: 0, whiteSpace: "pre-wrap" }}>
          {h.body || "No further details."}
        </p>
      </div>
    </div>
  );
}

// ── bits ────────────────────────────────────────────────────────────
function Pills({ items, active, onSelect }) {
  return (
    <div style={{ display: "flex", gap: spacing.sm, overflowX: "auto", paddingBottom: spacing.xs }}>
      {items.map(it => {
        const sel = it.id === active;
        return (
          <button key={it.id} onClick={() => onSelect(it.id)} style={{
            ...typography.caption, flexShrink: 0,
            padding: `${spacing.sm}px ${spacing.lg}px`, borderRadius: radius.pill, cursor: "pointer",
            fontWeight: typography.weight.bold,
            color: sel ? colors.text.onYellow : colors.text.secondary,
            background: sel ? colors.brand.gradient : colors.surface.card,
            border: `1px solid ${sel ? "transparent" : colors.surface.border}`,
            boxShadow: sel ? shadows.primary : "none",
          }}>{it.label}</button>
        );
      })}
    </div>
  );
}
function Label({ children }) {
  return <span style={{ ...typography.caption, textTransform: "uppercase", letterSpacing: typography.tracking.wider, color: colors.text.muted, fontWeight: typography.weight.bold, paddingLeft: spacing.xs }}>{children}</span>;
}
function EmptyState() {
  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card, padding: `${spacing["3xl"]}px ${spacing.xl}px`, textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: radius.pill, background: colors.brand.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: `0 auto ${spacing.lg}px`, boxShadow: shadows.primary }}>🌼</div>
      <h2 style={{ ...typography.h2, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>Nothing here yet</h2>
      <p style={{ ...typography.body, color: colors.text.muted, margin: 0 }}>
        Attendance, meals, naps and memories will appear here as staff record your child's day.
      </p>
    </div>
  );
}
function ErrorNote({ message }) {
  return <div style={{ ...typography.body, color: colors.dangerStrong, background: colors.dangerSoft, border: `1px solid ${colors.dangerBorder}`, borderRadius: radius.md, padding: spacing.lg }}>{message}</div>;
}
function CardSkeleton() {
  return (
    <div style={{ background: colors.surface.card, borderRadius: radius.card, boxShadow: shadows.card, padding: spacing.lg, display: "flex", gap: spacing.md, alignItems: "center" }}>
      <div style={{ width: 44, height: 44, borderRadius: radius.md, background: colors.gray100, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 13, width: "45%", borderRadius: radius.sm, background: colors.gray100, marginBottom: spacing.sm }} />
        <div style={{ height: 10, width: "70%", borderRadius: radius.sm, background: colors.gray100 }} />
      </div>
    </div>
  );
}
