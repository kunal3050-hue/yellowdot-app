/**
 * ParentDashboard.jsx — Social-feed parent experience
 * ──────────────────────────────────────────────────────
 * Feels like: Instagram Stories + Threads feed + Apple Family
 * NOT a school ERP or dashboard.
 *
 * Structure:
 *   1. Compact sticky hero (child + live status)
 *   2. Live activity strip (pulsing current moment)
 *   3. Stories row (horizontal circles — photo, nap, meals, activity, notices)
 *   4. Social feed (teacher posts with notes, images, reactions)
 *   5. Story fullscreen modal
 *   6. Floating quick-actions FAB
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/authService";
import { INR } from "../utils/currency";

// ── Palette — warm luxury, strictly no blue / navy / purple / green ──────────
const C = {
  bg:       "#fffcf5",
  surface:  "#ffffff",
  border:   "rgba(218,195,145,0.35)",
  gold:     "#f0c930",
  goldDeep: "#c8a318",
  goldPale: "#fef8d8",
  goldSoft: "rgba(240,201,48,0.10)",
  cream:    "#fdf6e8",
  text:     "#261808",
  text2:    "#7a5c32",
  text3:    "#b89a68",
  amber:    "#a86818",
  liveGold: "#c8a030",
  red:      "#b04030",
  warm:     "#886028",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const safe = url => api.get(url).then(r => r.data).catch(() => null);

function todayISO() { return new Date().toISOString().slice(0, 10); }

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return fmtTime(iso);
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return h < 8 ? `${h}h ago` : fmtTime(iso);
}

function napDuration(nap) {
  if (!nap?.startTime) return null;
  const s = new Date(nap.startTime), e = nap.wakeTime ? new Date(nap.wakeTime) : new Date();
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const m = Math.round((e - s) / 60000);
  if (m <= 0) return null;
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim();
}

function eatLabel(qty) {
  if (qty === 0)  return "Didn't eat";
  if (qty <= 0.5) return "Had a little";
  if (qty <= 1)   return "Ate half serving";
  if (qty <= 2)   return "Ate well 😊";
  return "Finished fully 😋";
}

// ── Story gradient backgrounds — all warm, no blue ────────────────────────────
const STORY_GRADIENTS = {
  photo:    "linear-gradient(145deg,#fde9a0,#f5c844)",
  nap:      "linear-gradient(145deg,#fde8c0,#f5c890)",
  meals:    "linear-gradient(145deg,#fdf0c0,#f0d060)",
  activity: "linear-gradient(145deg,#fce8c0,#f0c880)",
  music:    "linear-gradient(145deg,#fde0c8,#f0b888)",
  notice:   "linear-gradient(145deg,#faecc0,#e8c858)",
  pickup:   "linear-gradient(145deg,#fde8d0,#f0c898)",
};

// ── Demo data (DEV only) ──────────────────────────────────────────────────────
const _t = new Date();
const _d = (hh, mm = 0) => { const d = new Date(_t); d.setHours(hh, mm, 0, 0); return d.toISOString(); };

const DEMO_FEED = [
  {
    id: "f1", sortKey: _d(8,42), type: "checkin", orb: "🏫",
    teacher: "Ms. Anita", time: _d(8,42),
    title: "Arrived at school",
    note: "Came in happy and settled right in. Already chatting with friends! 😊",
    image: null,
  },
  {
    id: "f2", sortKey: _d(9,30), type: "activity", orb: "🎨",
    teacher: "Ms. Kavya", time: _d(9,30),
    title: "Art & Craft",
    note: "Made a beautiful butterfly today. Very focused and creative — a little artist in the making! 🦋",
    image: "art",
  },
  {
    id: "f3", sortKey: _d(10,0), type: "snack", orb: "🍪",
    teacher: "Ms. Anita", time: _d(10,0),
    title: "Morning snack",
    note: "Had biscuits and milk. Ate well and asked for more!",
    image: null,
  },
  {
    id: "f4", sortKey: _d(11,5), type: "nap", orb: "😴",
    teacher: "Ms. Kavya", time: _d(11,5),
    title: "Nap time began",
    note: "Fell asleep peacefully after a short story. Out in minutes 💤",
    image: null,
  },
  {
    id: "f5", sortKey: _d(12,38), type: "wake", orb: "☀️",
    teacher: "Ms. Kavya", time: _d(12,38),
    title: "Woke up · slept 1h 33m",
    note: "Woke up refreshed and in a great mood. Ready for lunch! 😄",
    image: null,
  },
  {
    id: "f6", sortKey: _d(12,50), type: "lunch", orb: "🍛",
    teacher: "Ms. Anita", time: _d(12,50),
    title: "Lunch time",
    note: "Finished dal rice completely — even asked for seconds! One of his favourites 😋",
    image: "lunch",
  },
  {
    id: "f7", sortKey: _d(14,15), type: "activity", orb: "🎵",
    teacher: "Ms. Preethi", time: _d(14,15),
    title: "Music & Movement",
    note: "Danced his heart out today 💃 Was the most energetic in the group!",
    image: null,
  },
];

const DEMO_STORIES = [
  { id: "s1", type: "photo",    label: "Today",    emoji: "📸", viewed: false,
    content: { title: "Photos from today", note: "Art butterfly 🦋 + lunch smiles" } },
  { id: "s2", type: "nap",     label: "Nap",      emoji: "😴", viewed: false,
    content: { title: "Nap · 1h 33m", note: "Fell asleep after story time. Happy after waking!" } },
  { id: "s3", type: "meals",   label: "Meals",    emoji: "🍛", viewed: false,
    content: { title: "Meals today", note: "Breakfast ✓ · Lunch ✓✓ (seconds!) · Snack ✓" } },
  { id: "s4", type: "activity",label: "Art",      emoji: "🎨", viewed: true,
    content: { title: "Art & Craft", note: "Made a butterfly. So creative today!" } },
  { id: "s5", type: "music",   label: "Music",    emoji: "🎵", viewed: true,
    content: { title: "Music & Movement", note: "Danced all session. Full of energy!" } },
  { id: "s6", type: "notice",  label: "Notice",   emoji: "📢", viewed: false,
    content: { title: "Sports Day — 15 June", note: "Wear sports uniform. Bring water bottle." } },
];

const DEMO = {
  student:    { studentName: "Hetansh Patel", studentId: "demo-001", class: "Nursery A", Class: "Nursery A" },
  parentName: "Priya",
  attendance: { studentId: "demo-001", checkIn: _d(8,42), guardianName: "Priya Patel" },
  naps:       [{ studentId: "demo-001", startTime: _d(11,5), wakeTime: _d(12,38), mood: "Happy 😊" }],
  foodRecord: { breakfast: 2, lunch: 2.5, snack: 1, milk: 1 },
  notices:    [
    { id: "n1", status: "published", type: "Event", title: "Annual Sports Day — 15 June",
      body: "Children should wear sports uniform and bring water bottles." },
    { id: "n2", status: "published", type: "Fees",  title: "Summer Fee Reminder",
      body: "Please clear dues before 1st June to avoid late charges." },
  ],
  announcements: [
    { id: "a1", title: "School closed Monday", pinned: true,
      content: "Yellow Dot remains closed Monday 26th May due to local elections." },
  ],
  dues: [],
  feed:    DEMO_FEED,
  stories: DEMO_STORIES,
};

// ── Meal slots ────────────────────────────────────────────────────────────────
const MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch",     label: "Lunch"     },
  { key: "snack",     label: "Snack"     },
  { key: "milk",      label: "Milk"      },
];

const REACTIONS = ["❤️","🥹","👏","😍"];

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function ParentDashboard() {
  const { user } = useAuth();

  const isDemoMode  = import.meta.env.DEV && !user;
  const child       = isDemoMode ? DEMO.student    : user?.student;
  const parentName  = isDemoMode ? DEMO.parentName : (user?.name || "").split(" ")[0];
  const childFirst  = (child?.studentName || "").split(" ")[0] || "your child";

  // ── Data state ─────────────────────────────────────────────────────────────
  const [attendance,    setAttendance]    = useState(isDemoMode ? DEMO.attendance    : null);
  const [naps,          setNaps]          = useState(isDemoMode ? DEMO.naps          : []);
  const [foodRecord,    setFoodRecord]    = useState(isDemoMode ? DEMO.foodRecord    : null);
  const [notices,       setNotices]       = useState(isDemoMode ? DEMO.notices       : []);
  const [announcements, setAnnouncements] = useState(isDemoMode ? DEMO.announcements : []);
  const [dues,          setDues]          = useState(isDemoMode ? DEMO.dues          : []);
  const [feedPosts,     setFeedPosts]     = useState(isDemoMode ? DEMO.feed          : []);
  const [stories,       setStories]       = useState(isDemoMode ? DEMO.stories       : []);
  const [loading,       setLoading]       = useState(!isDemoMode);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [reactions,    setReactions]    = useState({});  // { postId: emoji }
  const [activeStory,  setActiveStory]  = useState(null);  // story object or null
  const [fabOpen,      setFabOpen]      = useState(false);

  // ── API fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isDemoMode) return;
    const sid = child?.studentId, today = todayISO();
    Promise.allSettled([
      safe(`/api/attendance?date=${today}`),
      safe("/naps/history"),
      safe(`/api/food-consumption?date=${today}`),
      safe("/api/notices"),
      safe("/api/announcements"),
      safe("/api/invoices"),
    ]).then(([attR, napR, foodR, noticeR, annR, invR]) => {
      if (attR.status === "fulfilled" && attR.value) {
        const all = Array.isArray(attR.value) ? attR.value : (attR.value.records || []);
        setAttendance(all.find(r => r.studentId === sid || r.id === sid) || null);
      }
      if (napR.status === "fulfilled" && napR.value) {
        const all = Array.isArray(napR.value) ? napR.value : (napR.value.naps || []);
        setNaps(all.filter(n => (n.studentId === sid || !sid) && (n.startTime?.slice(0,10) === today || n.date === today)));
      }
      if (foodR.status === "fulfilled" && foodR.value) {
        const raw = foodR.value;
        setFoodRecord(Array.isArray(raw) ? raw.find(r => r.studentId === sid) : (raw[today] || raw) || null);
      }
      if (noticeR.status === "fulfilled" && noticeR.value) {
        const all = Array.isArray(noticeR.value) ? noticeR.value : (noticeR.value.notices || []);
        setNotices(all.filter(n => n.status === "published").slice(0,4));
        // Build stories from live data
        const storyList = [];
        if (all.length) storyList.push({ id: "sn", type: "notice", label: "Notice", emoji: "📢", viewed: false, content: { title: all[0].title, note: all[0].body || "" } });
        setStories(storyList);
      }
      if (annR.status === "fulfilled" && annR.value) {
        const all = Array.isArray(annR.value) ? annR.value : (annR.value.announcements || []);
        setAnnouncements(all.slice(0,3));
      }
      if (invR.status === "fulfilled" && invR.value) {
        const all = Array.isArray(invR.value) ? invR.value : (invR.value.invoices || []);
        setDues(all.filter(i => ["Pending","Overdue","Partial"].includes(i.status)));
      }
    }).finally(() => setLoading(false));
  }, [isDemoMode, child?.studentId]); // eslint-disable-line

  // ── Build feed from real data (non-demo) ──────────────────────────────────
  useEffect(() => {
    if (isDemoMode || loading) return;
    const posts = [];
    if (attendance?.checkIn) posts.push({
      id: "p-checkin", sortKey: attendance.checkIn, type: "checkin", orb: "🏫",
      teacher: "School", time: attendance.checkIn,
      title: "Arrived at school",
      note: attendance.guardianName ? `Dropped by ${attendance.guardianName}` : "Checked in for the day.",
      image: null,
    });
    naps.forEach((nap, i) => {
      if (nap.startTime) posts.push({
        id: `p-nap-${i}`, sortKey: nap.startTime, type: "nap", orb: "😴",
        teacher: "Teacher", time: nap.startTime, title: "Nap started",
        note: "Resting now.", image: null,
      });
      if (nap.wakeTime) posts.push({
        id: `p-wake-${i}`, sortKey: nap.wakeTime, type: "wake", orb: "☀️",
        teacher: "Teacher", time: nap.wakeTime,
        title: `Woke up${napDuration(nap) ? ` · slept ${napDuration(nap)}` : ""}`,
        note: nap.mood ? `Mood: ${nap.mood}` : "Back to activities.", image: null,
      });
    });
    if (foodRecord) {
      const mealTimes = { breakfast: "T08:30:00", lunch: "T12:30:00", snack: "T16:00:00", milk: "T18:00:00" };
      MEALS.forEach(({ key, label }) => {
        const qty = foodRecord[key] ?? foodRecord[`${key}Qty`] ?? null;
        if (qty !== null) posts.push({
          id: `p-${key}`, sortKey: `${todayISO()}${mealTimes[key]}`, type: key, orb: key === "breakfast" ? "🌅" : key === "lunch" ? "🍛" : key === "snack" ? "🍎" : "🥛",
          teacher: "Teacher", time: `${todayISO()}${mealTimes[key]}`,
          title: label, note: eatLabel(qty), image: null,
        });
      });
    }
    [...notices.slice(0,2), ...announcements.slice(0,2)].forEach((item, i) => {
      posts.push({
        id: `p-notice-${i}`, sortKey: item.createdAt || todayISO(), type: "notice", orb: "📢",
        teacher: "School", time: item.createdAt || null,
        title: item.title, note: item.body || item.content || "", image: null,
      });
    });
    setFeedPosts(posts.sort((a, b) => (a.sortKey || "").localeCompare(b.sortKey || "")));
  }, [isDemoMode, loading, attendance, naps, foodRecord, notices, announcements]); // eslint-disable-line

  // ── Derived ────────────────────────────────────────────────────────────────
  const currentStatus = useMemo(() => {
    const active = naps.find(n => !n.wakeTime);
    if (active)               return { label: "Sleeping peacefully 😴",    pulse: "#c8a020" };
    if (attendance?.checkOut) return { label: "On the way home 🏠",         pulse: C.liveGold };
    if (attendance?.checkIn)  return { label: "Having a wonderful day ✨",  pulse: C.liveGold };
    return                           { label: "Not yet arrived today",       pulse: C.text3   };
  }, [attendance, naps]);

  const latestNap = naps[naps.length - 1] || null;
  const totalDue  = dues.reduce((s, i) => s + (parseFloat(i.balance) || 0), 0);

  // ── Reactions ──────────────────────────────────────────────────────────────
  const toggleReaction = useCallback((postId, emoji) => {
    setReactions(r => ({ ...r, [postId]: r[postId] === emoji ? null : emoji }));
  }, []);

  // ── Mark story viewed ──────────────────────────────────────────────────────
  const openStory = useCallback(story => {
    setActiveStory(story);
    setStories(ss => ss.map(s => s.id === story.id ? { ...s, viewed: true } : s));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 24 }}>

      {/* Global keyframes */}
      <style>{`
        @keyframes yd-p        { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
        @keyframes yd-progress { from{width:0} to{width:100%} }
        @keyframes yd-shimmer  { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
        @keyframes yd-fadeup   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes yd-glow     { 0%,100%{box-shadow:0 0 10px rgba(240,194,40,0.25)} 50%{box-shadow:0 0 22px rgba(240,194,40,0.5)} }
      `}</style>

      {/* Ambient warm radials — multi-layer depth */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: [
          "radial-gradient(ellipse 80% 45% at 75% -5%, rgba(249,220,90,0.13) 0%, transparent 60%)",
          "radial-gradient(ellipse 60% 40% at 10% 100%, rgba(240,185,80,0.09) 0%, transparent 55%)",
          "radial-gradient(ellipse 50% 30% at 90% 70%, rgba(255,235,140,0.06) 0%, transparent 50%)",
        ].join(","),
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ── DEV banner ─────────────────────────────────────────────────── */}
        {isDemoMode && (
          <div style={{
            margin: "0 14px 10px",
            padding: "7px 12px",
            background: "rgba(249,220,90,0.12)",
            border: "1px dashed rgba(240,194,40,0.5)",
            borderRadius: 10,
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <span style={{ fontSize: 11 }}>🎭</span>
            <span style={{ fontSize: 10.5, fontWeight: 500, color: "#7a6520" }}>
              Demo preview · mock data · sign in as parent for live feed
            </span>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* COMPACT HERO                                                    */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <CompactHero
          child={child}
          parentName={parentName}
          childFirst={childFirst}
          status={currentStatus}
          attendance={attendance}
          loading={loading}
        />

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* LIVE ACTIVITY STRIP                                             */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {!loading && (attendance?.checkIn || naps.length > 0) && (
          <LiveStrip status={currentStatus} nap={latestNap} />
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* STORIES ROW                                                     */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <StoriesRow
          stories={stories}
          child={child}
          onOpen={openStory}
        />

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* SOCIAL FEED                                                     */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section style={{ padding: "0 14px" }}>
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
            marginBottom: 14, padding: "0 2px",
          }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.3px" }}>
                Today's story
              </span>
              <span style={{ fontSize: 11, color: C.text3, marginLeft: 6, fontWeight: 400 }}>
                from school ✨
              </span>
            </div>
            <span style={{ fontSize: 10.5, color: C.text3 }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          </div>

          {loading ? (
            <>{[0,1,2].map(i => <FeedSkeleton key={i} />)}</>
          ) : feedPosts.length === 0 ? (
            <div style={{
              background: C.surface, borderRadius: 24, padding: "36px 24px",
              textAlign: "center",
              boxShadow: "0 2px 16px rgba(140,110,40,0.07), 0 0 0 1px rgba(236,229,208,0.8)",
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🌱</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                Today's story is just beginning
              </div>
              <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6 }}>
                Updates from school will appear here throughout the day.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {feedPosts.map((post, i) => (
                <div key={post.id} style={{
                  animation: "yd-fadeup 0.38s ease both",
                  animationDelay: `${i * 60}ms`,
                }}>
                  <FeedPost
                    post={post}
                    reaction={reactions[post.id] || null}
                    onReact={emoji => toggleReaction(post.id, emoji)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {/* FEES — minimal, always last                                     */}
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {!loading && totalDue > 0 && (
          <div style={{ padding: "20px 14px 0" }}>
            <div style={{
              background: C.surface,
              borderRadius: 20,
              boxShadow: "0 2px 16px rgba(140,110,40,0.07), 0 0 0 1px rgba(236,229,208,0.8)",
              padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{INR(totalDue)} pending</div>
                <div style={{ fontSize: 11, color: C.text3 }}>{dues.length} unpaid invoice{dues.length > 1 ? "s" : ""}</div>
              </div>
              <Link to="/fees" style={{
                background: "linear-gradient(135deg,#f9dc5a,#f0c228)",
                color: "#3d2800", fontWeight: 700, fontSize: 11.5,
                padding: "7px 14px", borderRadius: 10, textDecoration: "none",
                boxShadow: "0 2px 8px rgba(240,194,40,0.3)",
              }}>Pay →</Link>
            </div>
          </div>
        )}

      </div>{/* /z1 wrapper */}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* STORY MODAL — fullscreen overlay                                 */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeStory && (
        <StoryModal
          story={activeStory}
          childFirst={childFirst}
          onClose={() => setActiveStory(null)}
        />
      )}

    </div>
  );
}

// =============================================================================
// COMPACT HERO
// =============================================================================
function CompactHero({ child, parentName, childFirst, status, attendance, loading }) {
  const initial = (child?.studentName || "C")[0].toUpperCase();
  const isLive  = !!attendance?.checkIn && !attendance?.checkOut;

  return (
    <div style={{
      margin: "0 14px 14px",
      background: "linear-gradient(150deg, #fef2b0 0%, #fffdf2 45%, #fff9e8 100%)",
      borderRadius: 28,
      boxShadow: "0 10px 48px rgba(200,155,30,0.14), 0 2px 8px rgba(220,185,60,0.08)",
      padding: "20px 18px 18px",
      position: "relative", overflow: "hidden",
    }}>

      {/* Gradient mesh — multi-point warm depth */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: [
          "radial-gradient(circle at 85% 15%, rgba(255,240,140,0.55) 0%, transparent 38%)",
          "radial-gradient(circle at 15% 90%, rgba(255,225,100,0.30) 0%, transparent 40%)",
          "radial-gradient(circle at 50% 50%, rgba(255,252,230,0.20) 0%, transparent 60%)",
        ].join(","),
      }} />

      {/* Ambient glow behind avatar */}
      <div style={{
        position: "absolute", top: -10, left: -10,
        width: 130, height: 130, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(249,220,90,0.38) 0%, transparent 68%)",
        filter: "blur(6px)",
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
        {/* Avatar with live ring */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {isLive && (
            <div style={{
              position: "absolute", inset: -4, borderRadius: 24,
              background: "linear-gradient(135deg,#f9e060,#f0c228,#e8a820)",
              zIndex: 0,
              animation: "yd-glow 3s ease-in-out infinite",
            }} />
          )}
          <div style={{
            width: 60, height: 60, borderRadius: 20,
            background: "linear-gradient(140deg,#fce880,#f5c828,#eab020)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 25, fontWeight: 800, color: "#3a2000",
            boxShadow: "0 6px 20px rgba(240,185,30,0.40), inset 0 1px 0 rgba(255,255,255,0.4)",
            position: "relative", zIndex: 1,
          }}>
            {initial}
          </div>
          {isLive && (
            <div style={{
              position: "absolute", bottom: -2, right: -2, zIndex: 2,
              width: 14, height: 14, borderRadius: "50%",
              background: "#d4a820",
              border: "2.5px solid #fffcf0",
              animation: "yd-p 2.5s ease-in-out infinite",
            }} />
          )}
        </div>

        {/* Identity */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 3px", fontSize: 11, color: "#9a7848", fontWeight: 400, letterSpacing: "0.01em" }}>
            {greeting()}, {parentName} 👋
          </p>
          <h1 style={{
            margin: 0, fontSize: 24, fontWeight: 750, color: "#1e1206",
            letterSpacing: "-0.6px", lineHeight: 1.05,
          }}>
            {child?.studentName || "Your Child"}
          </h1>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#a08050", fontWeight: 400 }}>
            {child?.class || child?.Class || "Nursery"} · Yellow Dot
          </p>
        </div>
      </div>

      {/* Emotional status pill */}
      <div style={{
        marginTop: 14,
        padding: "9px 14px",
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderRadius: 13,
        border: "1px solid rgba(240,220,150,0.4)",
        fontSize: 13, color: "#4a3010", fontStyle: "italic", fontWeight: 400,
        lineHeight: 1.45, position: "relative",
      }}>
        {loading ? `Checking on ${childFirst}…` : status.label}
      </div>
    </div>
  );
}

// =============================================================================
// LIVE ACTIVITY STRIP — all warm gold, no green
// =============================================================================
function LiveStrip({ status, nap }) {
  const sleeping = nap && !nap.wakeTime;
  return (
    <div style={{
      margin: "0 14px 16px",
      padding: "11px 16px",
      background: sleeping
        ? "linear-gradient(135deg,#fef4d8,#feeaaa)"
        : "linear-gradient(135deg,#fef2c8,#fde9a8)",
      borderRadius: 16,
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 3px 16px rgba(200,155,30,0.12), inset 0 1px 0 rgba(255,255,255,0.6)",
    }}>
      {/* Gold pulse dot */}
      <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%",
          background: "#c89818",
          boxShadow: "0 0 6px rgba(200,152,24,0.5)",
        }} />
        <div style={{
          position: "absolute", inset: -4, borderRadius: "50%",
          background: "rgba(200,152,24,0.22)",
          animation: "yd-p 2.2s ease-in-out infinite",
        }} />
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "#6a4808", letterSpacing: "0.01em" }}>
        Live · {status.label}
      </span>
    </div>
  );
}

// =============================================================================
// STORIES ROW
// =============================================================================
function StoriesRow({ stories, child, onOpen }) {
  const initial = (child?.studentName || "C")[0].toUpperCase();
  if (stories.length === 0) return null;

  return (
    <div style={{
      display: "flex", gap: 10, overflowX: "auto",
      padding: "2px 14px 20px", scrollbarWidth: "none",
      WebkitOverflowScrolling: "touch",
      msOverflowStyle: "none",
    }}>
      {/* Child's "Your Story" always first */}
      <StoryCircle
        label="Your Story"
        emoji={initial}
        isText
        gradient={STORY_GRADIENTS.photo}
        viewed={false}
        onTap={() => onOpen({ id: "child", type: "child",
          content: { title: child?.studentName || "Your Child", note: "Tap stories below to see today's updates!" },
          viewed: false, emoji: initial })}
      />
      {stories.map(s => (
        <StoryCircle
          key={s.id}
          label={s.label}
          emoji={s.emoji}
          gradient={STORY_GRADIENTS[s.type] || STORY_GRADIENTS.photo}
          viewed={s.viewed}
          onTap={() => onOpen(s)}
        />
      ))}
    </div>
  );
}

function StoryCircle({ label, emoji, isText, gradient, viewed, onTap }) {
  return (
    <button onClick={onTap} style={{
      flexShrink: 0, background: "none", border: "none", cursor: "pointer",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      padding: 0,
      WebkitTapHighlightColor: "transparent",
    }}>
      {/* Premium ring */}
      <div style={{
        width: 76, height: 76, borderRadius: "50%", padding: viewed ? 3 : 2.5,
        background: viewed
          ? "linear-gradient(135deg, rgba(195,180,148,0.4), rgba(175,160,128,0.3))"
          : "linear-gradient(145deg, #fae860 0%, #f5c228 40%, #e8a010 75%, #f5c830 100%)",
        boxShadow: viewed
          ? "none"
          : "0 4px 18px rgba(240,185,30,0.45), 0 1px 4px rgba(240,185,30,0.2)",
        transition: "transform 0.12s ease, box-shadow 0.12s ease",
      }}>
        {/* Inner circle */}
        <div style={{
          width: "100%", height: "100%", borderRadius: "50%",
          background: gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: isText ? 22 : 26,
          fontWeight: isText ? 800 : 400,
          color: isText ? "#3a2000" : undefined,
          border: "2.5px solid rgba(255,255,255,0.80)",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
        }}>
          {emoji}
        </div>
      </div>
      <span style={{ fontSize: 10.5, fontWeight: viewed ? 400 : 550, color: viewed ? C.text3 : C.text2, maxWidth: 68, textAlign: "center", lineHeight: 1.2 }}>
        {label}
      </span>
    </button>
  );
}

// =============================================================================
// STORY MODAL — fullscreen warm overlay
// =============================================================================
function StoryModal({ story, childFirst, onClose }) {
  const grad = STORY_GRADIENTS[story.type] || STORY_GRADIENTS.photo;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(30,22,10,0.85)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        width: "min(380px, 92vw)",
        background: "linear-gradient(160deg,#fef8e0,#fff9f0,#fef4d8)",
        borderRadius: 32,
        padding: "32px 28px 28px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        position: "relative",
        textAlign: "center",
      }} onClick={e => e.stopPropagation()}>

        {/* Story type orb */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: grad, margin: "0 auto 20px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36,
          boxShadow: "0 6px 24px rgba(240,194,40,0.35)",
          border: "3px solid rgba(255,255,255,0.8)",
        }}>
          {story.emoji}
        </div>

        {/* Progress bar */}
        <div style={{
          height: 3, borderRadius: 2, background: "rgba(180,150,80,0.2)",
          marginBottom: 24, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 2,
            background: "linear-gradient(90deg,#f9dc5a,#f0c228)",
            animation: "yd-progress 4s linear forwards",
          }} />
        </div>

        <h2 style={{
          fontSize: 20, fontWeight: 700, color: "#2a1f0e",
          margin: "0 0 10px", letterSpacing: "-0.3px",
        }}>
          {story.content?.title || story.label}
        </h2>
        <p style={{
          fontSize: 14, color: "#7a6848", lineHeight: 1.6,
          margin: "0 0 24px", fontWeight: 400,
        }}>
          {story.content?.note || `${childFirst}'s update from today.`}
        </p>

        <button onClick={onClose} style={{
          background: "linear-gradient(135deg,#f9dc5a,#f0c228)",
          color: "#3a2400", fontWeight: 700, fontSize: 13,
          padding: "10px 28px", borderRadius: 14, border: "none", cursor: "pointer",
          boxShadow: "0 4px 14px rgba(240,194,40,0.35)",
        }}>
          Done ✓
        </button>
      </div>
    </div>
  );
}

// ── Teacher avatar color — warm palette, no blue/green ───────────────────────
function teacherColor(name) {
  const warm = ["#d4a07a","#c89878","#d4b070","#c8a060","#d8b888","#c49870"];
  return warm[(name || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0) % warm.length];
}

// ── Per-type card tints ───────────────────────────────────────────────────────
const TYPE_BG = {
  nap:      "linear-gradient(160deg,#fefaf0 0%,#fef5e0 100%)",
  snack:    "linear-gradient(160deg,#fffcf0 0%,#fdf5e0 100%)",
  lunch:    "linear-gradient(160deg,#fffbec 0%,#fdf3d8 100%)",
  wake:     "linear-gradient(160deg,#fffdf2 0%,#fdf9e8 100%)",
  notice:   "linear-gradient(160deg,#ffffe8 0%,#fffad0 100%)",
  activity: "linear-gradient(160deg,#fffcf0 0%,#fef6e0 100%)",
  checkin:  "linear-gradient(160deg,#fffef5 0%,#fefce8 100%)",
};

// =============================================================================
// FEED POST — social card (Threads/Twitter polish)
// =============================================================================
function FeedPost({ post, reaction, onReact }) {
  const [reactOpen, setReactOpen] = useState(false);

  const bg = TYPE_BG[post.type] || C.surface;
  const color = teacherColor(post.teacher);
  const teacherInitial = (post.teacher || "T").split(" ").map(w => w[0]).join("").slice(0, 2);
  const imgGrad = post.image === "art"
    ? "linear-gradient(145deg,#fde8a0,#f5c050,#e8a030)"
    : "linear-gradient(145deg,#fce8b0,#f5d060,#e8b840)";

  return (
    <div style={{
      background: bg,
      borderRadius: 26,
      boxShadow: [
        "0 2px 24px rgba(140,110,40,0.08)",
        "0 0 0 1px rgba(215,190,135,0.28)",
        "inset 0 1px 0 rgba(255,255,255,0.85)",
      ].join(","),
      overflow: "hidden",
    }}>

      {/* ── Header — Threads style ── */}
      <div style={{ display: "flex", gap: 12, padding: "16px 16px 0", alignItems: "flex-start" }}>
        {/* Teacher avatar with emoji badge */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 15, flexShrink: 0,
            background: color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 750, color: "rgba(255,255,255,0.95)",
            boxShadow: "0 3px 10px rgba(0,0,0,0.11), inset 0 1px 0 rgba(255,255,255,0.25)",
          }}>
            {teacherInitial}
          </div>
          {/* Emoji orb badge */}
          <div style={{
            position: "absolute", bottom: -3, right: -6,
            width: 20, height: 20, borderRadius: 7,
            background: "rgba(255,253,242,0.96)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, lineHeight: 1,
            boxShadow: "0 1px 5px rgba(0,0,0,0.13)",
          }}>
            {post.orb}
          </div>
        </div>

        {/* Name + title column */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 650, color: C.text, letterSpacing: "-0.1px" }}>
              {post.teacher}
            </span>
            <span style={{ fontSize: 11, color: C.text3, fontWeight: 400 }}>
              {post.time && timeAgo(post.time) ? `· ${timeAgo(post.time)}` : ""}
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 2, fontWeight: 500 }}>
            {post.title}
          </div>
        </div>
      </div>

      {/* ── Teacher note — indented under avatar ── */}
      {post.note && (
        <p style={{
          margin: "9px 16px 0",
          paddingLeft: 54,
          fontSize: 14, color: "#5e4222", lineHeight: 1.7, fontWeight: 400,
          fontStyle: "italic",
        }}>
          {post.note}
        </p>
      )}

      {/* ── Image block ── */}
      {post.image && (
        <div style={{
          margin: "13px 16px 0",
          height: 172, borderRadius: 20, overflow: "hidden",
          background: imgGrad, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
        }}>
          <span style={{ position: "relative", zIndex: 1, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.15))" }}>
            {post.orb}
          </span>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, transparent 40%, rgba(160,120,20,0.10))",
          }} />
        </div>
      )}

      {/* ── Reactions row ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px 15px", marginTop: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {reaction ? (
            <button onClick={() => onReact(reaction)} style={{
              background: C.goldPale,
              border: "1px solid rgba(240,194,40,0.30)",
              cursor: "pointer", borderRadius: 12, padding: "5px 12px",
              display: "flex", alignItems: "center", gap: 5, fontSize: 15,
            }}>
              {reaction}
              <span style={{ fontSize: 10.5, color: C.amber, fontWeight: 650 }}>You reacted</span>
            </button>
          ) : (
            <div style={{ position: "relative" }}>
              <button onClick={() => setReactOpen(o => !o)} style={{
                background: "rgba(255,255,255,0.7)",
                border: "1px solid " + C.border,
                cursor: "pointer", borderRadius: 12, padding: "5px 12px",
                display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                color: C.text3, fontWeight: 500,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <span style={{ fontSize: 15 }}>❤️</span> React
              </button>
              {reactOpen && (
                <div style={{
                  position: "absolute", bottom: "calc(100% + 8px)", left: 0,
                  background: "#fff",
                  borderRadius: 20, padding: "10px 12px",
                  boxShadow: "0 8px 36px rgba(0,0,0,0.13), 0 0 0 1px " + C.border,
                  display: "flex", gap: 4, zIndex: 10,
                }}>
                  {REACTIONS.map(e => (
                    <button key={e} onClick={() => { onReact(e); setReactOpen(false); }} style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 25, padding: "4px 6px", borderRadius: 12,
                      transition: "transform 0.12s",
                    }}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <button style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 16, color: C.text3, padding: "4px 6px", opacity: 0.6,
        }}>🔖</button>
      </div>
    </div>
  );
}

// =============================================================================
// FEED SKELETON
// =============================================================================
function FeedSkeleton() {
  return (
    <div style={{
      background: C.surface, borderRadius: 24, padding: "16px",
      boxShadow: "0 2px 16px rgba(140,110,40,0.06), 0 0 0 1px rgba(236,229,208,0.7)",
    }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, background: "#f0e8d0", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, borderRadius: 6, background: "#f0e8d0", width: "60%", marginBottom: 6 }} />
          <div style={{ height: 9,  borderRadius: 6, background: "#f5edd8", width: "35%" }} />
        </div>
      </div>
      <div style={{ height: 11, borderRadius: 6, background: "#f0e8d0", width: "90%", marginBottom: 6 }} />
      <div style={{ height: 11, borderRadius: 6, background: "#f5edd8", width: "75%", marginBottom: 6 }} />
      <div style={{ height: 11, borderRadius: 6, background: "#f5edd8", width: "55%" }} />
    </div>
  );
}
