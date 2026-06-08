/**
 * Attendance.jsx — Premium QR + Manual Attendance Module
 * ─────────────────────────────────────────────────────────────────
 *
 * Views (sidebar tabs):
 *   Dashboard  — today's roll + quick-mark (Present / Absent / Late)
 *   QR Scanner — camera-based check-in / check-out
 *   Student QR — print / download QR cards for each student
 *   History    — date-range attendance log
 *
 * Architecture:
 *   • Standalone full-page (own sidebar, like NapTracker)
 *   • All state is local React state — no global store
 *   • mountedRef guards every async callback (no setState after unmount)
 *   • fetchingRef prevents concurrent identical API calls
 *   • Auto-save on status click (no separate Save button)
 *   • QR scanner via html5-qrcode with 3-second debounce
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link }          from "react-router-dom";
import { QRCodeCanvas }  from "qrcode.react";
import { Html5Qrcode }   from "html5-qrcode";
import attendanceService from "../services/attendanceService";
import { api } from "../services/authService";
import { useAuth }       from "../contexts/AuthContext";

// ── Constants ─────────────────────────────────────────────────────
const VIEWS          = ["dashboard", "scanner", "qrcards", "history"];
const STATUS_OPTIONS = ["Present", "Absent", "Late"];
const CLASS_LIST     = ["All", "Playgroup", "Nursery", "LKG", "UKG", "Daycare"];

const STATUS_STYLE = {
  Present: "bg-yd-success-soft  text-yd-success border-yd-success-border",
  Absent:  "bg-yd-danger-soft   text-yd-danger  border-yd-danger-border",
  Late:    "bg-yd-warn-soft     text-yd-warn    border-yd-warn-border",
  "":      "bg-yd-bg            text-yd-text-3  border-yd-border",
};

const STATUS_BTN = {
  Present: "bg-yd-success hover:bg-green-700  text-white shadow-green-200",
  Absent:  "bg-yd-danger  hover:bg-red-700    text-white shadow-red-200",
  Late:    "bg-yd-warn    hover:bg-amber-700  text-white shadow-amber-200",
};

const VIEW_META = {
  dashboard: { icon: "📊", label: "Dashboard"   },
  scanner:   { icon: "📷", label: "QR Scanner"  },
  qrcards:   { icon: "🎫", label: "Student QRs" },
  history:   { icon: "📅", label: "History"     },
};

// ── Date helpers ──────────────────────────────────────────────────
function todayISO()  { return new Date().toISOString().slice(0, 10); }
function todayLabel(){
  return new Date().toLocaleDateString("en-IN", {
    weekday:"long", day:"2-digit", month:"long", year:"numeric",
  });
}

// ── Avatar color from name hash ───────────────────────────────────
const AVATAR_COLORS = [
  "from-violet-500 to-purple-600",  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",   "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",   "from-cyan-500 to-sky-600",
];
function avatarGradient(name) {
  let h = 0;
  for (const c of (name || "")) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════
// useToast
// ═══════════════════════════════════════════════════════════════════
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4_200);
  }, []);
  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  return {
    toasts,
    success: useCallback(m => add("success", m), [add]),
    error:   useCallback(m => add("error",   m), [add]),
    info:    useCallback(m => add("info",    m), [add]),
    dismiss,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ToastStack
// ═══════════════════════════════════════════════════════════════════
function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`yd-toast pointer-events-auto ${
          t.type === "success" ? "yd-toast-success" : t.type === "error" ? "yd-toast-error" : "yd-toast-info"
        }`}>
          <span>{t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}</span>
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onDismiss(t.id)}
            className="w-4 h-4 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 font-bold text-xs">×</button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StatusBadge
// ═══════════════════════════════════════════════════════════════════
function StatusBadge({ status }) {
  if (!status) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold
                     bg-gray-100 text-gray-400 border border-gray-200">Not Marked</span>
  );
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border
                      ${STATUS_STYLE[status] || STATUS_STYLE[""]}`}>{status}</span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sidebar
// ═══════════════════════════════════════════════════════════════════
function Sidebar({ view, setView, date, setDate, cls, setCls, summary, summaryLoading }) {
  const statItems = [
    { label:"Total",   val:summary.total,     bg:"bg-yd-bg            text-yd-text"    },
    { label:"Present", val:summary.present,   bg:"bg-yd-success-soft  text-yd-success" },
    { label:"Absent",  val:summary.absent,    bg:"bg-yd-danger-soft   text-yd-danger"  },
    { label:"Late",    val:summary.late,      bg:"bg-yd-warn-soft     text-yd-warn"    },
    { label:"Inside",  val:summary.inside,    bg:"bg-yd-info-soft     text-yd-info"    },
    { label:"Via QR",  val:summary.qrScanned, bg:"bg-yd-yellow-soft   text-yd-navy"   },
  ];
  return (
    <div className="w-[230px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-screen shadow-lg">

      {/* Brand */}
      <div className="p-5 border-b border-gray-100 flex-shrink-0">
        <Link to="/" className="block">
          <h1 className="text-3xl font-black text-[var(--yd-yellow)] leading-none">Yellow<br/>Dot</h1>
          <p className="text-gray-400 text-[10px] font-medium mt-1 uppercase tracking-wider">Attendance</p>
        </Link>
      </div>

      {/* Nav */}
      <div className="p-3 border-b border-gray-100 flex-shrink-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1.5">Views</p>
        <nav className="space-y-0.5">
          {VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all
                ${view === v ? "bg-yd-navy text-white shadow-yd" : "text-gray-600 hover:bg-gray-50"}`}>
              <span>{VIEW_META[v].icon}</span>{VIEW_META[v].label}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-gray-100 flex-shrink-0 space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Filters</p>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="yd-input text-xs"/>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Class</label>
          <select value={cls} onChange={e => setCls(e.target.value)}
            className="yd-input text-xs">
            {CLASS_LIST.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Child Safety shortcuts */}
      <div className="p-3 border-b border-gray-100 flex-shrink-0 space-y-1.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1">Child Safety</p>
        <Link to="/parent-checkin"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-yd-navy text-white
                     text-sm font-bold hover:bg-yd-navy-2 transition-colors shadow-yd w-full">
          <span>📱</span> Parent Check-In
        </Link>
        <Link to="/pickup-authorization"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-600 hover:bg-gray-50
                     text-sm font-semibold transition-colors w-full border border-gray-100">
          <span>🔐</span> Pickup Auth
        </Link>
        <Link to="/pickup-history"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-600 hover:bg-gray-50
                     text-sm font-semibold transition-colors w-full border border-gray-100">
          <span>📋</span> Pickup History
        </Link>
      </div>

      {/* Live stats */}
      <div className="p-3 flex-1 overflow-y-auto">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Live Stats</p>
        {summaryLoading ? (
          <div className="grid grid-cols-2 gap-1.5">
            {[...Array(6)].map((_,i) => <div key={i} className="h-11 rounded-xl bg-gray-100 animate-pulse"/>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {statItems.map(({ label, val, bg }) => (
              <div key={label} className={`rounded-xl p-2 ${bg}`}>
                <p className="text-[10px] font-bold opacity-60">{label}</p>
                <p className="text-xl font-black leading-none">{val ?? 0}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StudentRow (dashboard table row)
// ═══════════════════════════════════════════════════════════════════
function StudentRow({ student, entry, saving, onMark, onCheckOut, canMark = true }) {
  const status   = entry?.status    || "";
  const checkIn  = entry?.checkIn   || "";
  const checkOut = entry?.checkOut  || "";
  const method   = entry?.attendanceMethod || "";
  const inside   = !!(checkIn && !checkOut && status !== "Absent");

  return (
    <tr className="border-b border-gray-50 hover:bg-yd-yellow-pale transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avatarGradient(student.name)}
                           flex items-center justify-center text-white text-xs font-black flex-shrink-0`}>
            {initials(student.name)}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800 leading-tight">{student.name}</p>
            <p className="text-[10px] text-gray-400">{student.id}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs font-semibold text-gray-500">{student.class}</span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map(s => (
            <button key={s} disabled={saving || !canMark} onClick={() => canMark && onMark(student, s)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all border
                ${status === s
                  ? `${STATUS_BTN[s]} shadow-sm scale-105 border-transparent`
                  : "bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600"}
                ${(saving || !canMark) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
              {s}
            </button>
          ))}
        </div>
      </td>
      <td className="px-3 py-2.5">
        {checkIn
          ? <span className="text-xs font-semibold text-emerald-600">{checkIn}</span>
          : <span className="text-xs text-gray-300">—</span>}
      </td>
      <td className="px-3 py-2.5">
        {checkOut ? (
          <span className="text-xs font-semibold text-rose-600">{checkOut}</span>
        ) : inside ? (
          <button onClick={() => onCheckOut(entry)}
            className="text-[10px] font-bold px-2 py-1 bg-yd-danger-soft text-yd-danger border border-yd-danger-border rounded-yd-sm hover:bg-yd-danger-border transition-colors">
            Check Out
          </button>
        ) : <span className="text-xs text-gray-300">—</span>}
      </td>
      <td className="px-3 py-2.5">
        {method && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
            ${method === "QR" ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"}`}>
            {method}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {inside && (
          <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/>Inside
          </span>
        )}
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DashboardView
// ═══════════════════════════════════════════════════════════════════
function DashboardView({ date, cls, summary, toast, canMark = true, canExport = true }) {
  const mountedRef  = useRef(true);
  const savingRef   = useRef({});
  const [students,  setStudents ] = useState([]);
  const [entries,   setEntries  ] = useState([]);
  const [loading,   setLoading  ] = useState(true);
  const [saving,    setSaving   ] = useState({});
  const [filter,    setFilter   ] = useState("All");
  const [search,    setSearch   ] = useState("");

  // Backend stores & queries attendance dates in ISO (YYYY-MM-DD). Sending
  // DD/MM/YYYY here put slashes into the entryId (ATT-08/06/2026-YD008), which
  // Firestore treated as a nested path — the write "succeeded" (200) but no
  // top-level attendance doc was created. Always send ISO.
  const indiaDate = date;

  const load = useCallback(async () => {
    try {
      const [studRes, attRes] = await Promise.all([
        api.get("/students").then(r => r.data),
        attendanceService.getAttendance({ date: indiaDate, class: cls === "All" ? "" : cls }),
      ]);
      if (!mountedRef.current) return;
      const allStudents = (Array.isArray(studRes) ? studRes : [])
        .filter(s => (s.Status || s.status || "Active") === "Active")
        .filter(s => cls === "All" || (s.Class || s.class) === cls);
      setStudents(allStudents);
      setEntries(attRes.entries || []);
    } catch {
      if (mountedRef.current) toast.error("Failed to load attendance data.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [indiaDate, cls]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const entryMap = useMemo(() => {
    const m = {};
    for (const e of entries) m[e.studentId] = e;
    return m;
  }, [entries]);

  const handleMark = useCallback(async (student, status) => {
    const sid = student.id;
    if (savingRef.current[sid]) return;
    savingRef.current[sid] = true;
    setSaving(s => ({ ...s, [sid]: true }));

    const nowTime = new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});

    // Optimistic update first
    setEntries(prev => {
      const next = prev.filter(e => e.studentId !== sid);
      const existing = prev.find(e => e.studentId === sid);
      next.push({
        ...(existing || {}),
        studentId:        sid,
        studentName:      student.name,
        class:            student.class,
        status,
        date:             indiaDate,
        checkIn:          existing?.checkIn || (status !== "Absent" ? nowTime : ""),
        checkOut:         existing?.checkOut || "",
        attendanceMethod: "Manual",
      });
      return next;
    });

    try {
      await attendanceService.markAttendance({
        studentId: sid, studentName: student.name, class: student.class,
        status, date: indiaDate, attendanceMethod: "Manual",
      });
    } catch (e) {
      // Revert on failure
      if (mountedRef.current) {
        setEntries(prev => prev.filter(e => e.studentId !== sid));
        toast.error(e.message || "Failed to save.");
      }
    } finally {
      savingRef.current[sid] = false;
      if (mountedRef.current) setSaving(s => ({ ...s, [sid]: false }));
    }
  }, [indiaDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckOut = useCallback(async (entry) => {
    if (!entry?.entryId) return;
    const nowTime = new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
    setEntries(prev => prev.map(e => e.entryId === entry.entryId ? { ...e, checkOut: nowTime } : e));
    try {
      await attendanceService.checkOut(entry.entryId);
      if (mountedRef.current) toast.success(`${entry.studentName} checked out.`);
    } catch (e) {
      if (mountedRef.current) {
        setEntries(prev => prev.map(e => e.entryId === entry.entryId ? { ...e, checkOut: "" } : e));
        toast.error(e.message || "Checkout failed.");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const displayStudents = useMemo(() => {
    let list = students;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(s => (s.Student_Name||s.name||"").toLowerCase().includes(q));
    if (filter === "All") return list;
    return list.filter(s => {
      const sid = s.Student_ID || s.id;
      const e   = entryMap[sid];
      if (filter === "Unmarked") return !e?.status;
      if (filter === "Inside")   return e?.checkIn && !e?.checkOut && e?.status !== "Absent";
      return e?.status === filter;
    });
  }, [students, entryMap, filter, search]);

  const insideCount = entries.filter(e => e.checkIn && !e.checkOut && e.status !== "Absent").length;
  const marked      = Object.keys(entryMap).length;

  if (loading) return (
    <div className="flex-1 p-6 space-y-2 animate-pulse">
      <div className="h-8 bg-gray-100 rounded-2xl w-64 mb-4"/>
      {[...Array(10)].map((_,i) => <div key={i} className="h-11 bg-gray-50 rounded-xl"/>)}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Sub-header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-yd-navy">Attendance Dashboard</h2>
          <p className="text-xs text-gray-400">{todayLabel()} · {students.length} students · {marked} marked</p>
        </div>
        {/* Stat chips */}
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { label:"Present", val:summary.present, c:"text-yd-success" },
            { label:"Absent",  val:summary.absent,  c:"text-yd-danger"     },
            { label:"Late",    val:summary.late,     c:"text-yd-warn"   },
            { label:"Inside",  val:insideCount,      c:"text-yd-info"    },
          ].map(({ label, val, c }) => (
            <div key={label} className="flex items-center gap-1">
              <span className={`text-xl font-black ${c}`}>{val ?? 0}</span>
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-2 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…"
            className="yd-input text-xs pl-8"/>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["All","Present","Absent","Late","Inside","Unmarked"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all
                ${filter===f ? "bg-yd-navy text-white border-yd-navy" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
              {f}
            </button>
          ))}
        </div>
        {canMark && filter === "Unmarked" && displayStudents.length > 0 && (
          <button
            onClick={async () => { for (const s of displayStudents) { const sid=s.Student_ID||s.id; await handleMark({id:sid,name:s.Student_Name||s.name,class:s.Class||s.class},"Present"); } }}
            className="btn btn-success btn-sm ml-auto">
            ✓ Mark All Present
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {displayStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-4">{filter==="Unmarked"?"🎉":"🔍"}</div>
            <p className="font-bold text-gray-700">{filter==="Unmarked"?"All students marked!":filter==="All"?"No students found":`No ${filter.toLowerCase()} students`}</p>
            {filter !== "All" && <p className="text-sm text-gray-400 mt-1">Change filter to see more.</p>}
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-yd-navy z-10">
              <tr className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
                {["Student","Class","Status","Check-In","Check-Out","Method","Live"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayStudents.map(s => {
                const sid = s.Student_ID || s.id;
                return (
                  <StudentRow key={sid}
                    student={{ id:sid, name:s.Student_Name||s.name, class:s.Class||s.class }}
                    entry={entryMap[sid]}
                    saving={!!saving[sid]}
                    onMark={handleMark}
                    onCheckOut={handleCheckOut}
                    canMark={canMark}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// QRScannerView
// ═══════════════════════════════════════════════════════════════════
function QRScannerView({ toast }) {
  const [scanning,    setScanning   ] = useState(false);
  const [camError,    setCamError   ] = useState(null);
  const [lastResult,  setLastResult ] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [processing,  setProcessing ] = useState(false);
  const html5QrRef  = useRef(null);
  const lastScanRef = useRef({ text: null, time: 0 });
  const mountedRef  = useRef(true);
  const processingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; stopScanner(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDecodedQR = useCallback(async (decodedText) => {
    const now = Date.now();
    if (decodedText === lastScanRef.current.text && now - lastScanRef.current.time < 3_000) return;
    if (processingRef.current) return;
    lastScanRef.current = { text: decodedText, time: now };
    processingRef.current = true;
    setProcessing(true);
    try {
      const result = await attendanceService.processQRScan(decodedText);
      if (!mountedRef.current) return;
      setLastResult(result);
      const scanTime = new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
      setRecentScans(prev => [{ ...result, scannedAt: scanTime }, ...prev.slice(0, 9)]);
      if (result.action === "check-in")     toast.success(result.message);
      else if (result.action === "check-out") toast.info(result.message);
      else                                    toast.info(result.message);
    } catch (e) {
      if (mountedRef.current) { toast.error(e.message || "QR scan failed."); setLastResult({ action:"error", message:e.message }); }
    } finally {
      processingRef.current = false;
      if (mountedRef.current) setProcessing(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startScanner = async () => {
    setCamError(null);
    try {
      const qr = new Html5Qrcode("qr-camera-viewport");
      html5QrRef.current = qr;
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => handleDecodedQR(text),
        () => {}
      );
      setScanning(true);
    } catch (e) {
      const msg = e?.message || "";
      setCamError(msg.includes("permission") || msg.includes("NotAllowed")
        ? "Camera permission denied. Please allow camera access and try again."
        : `Camera error: ${msg}`);
    }
  };

  const stopScanner = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); } catch {}
      try { html5QrRef.current.clear();      } catch {}
      html5QrRef.current = null;
    }
    if (mountedRef.current) setScanning(false);
  };

  const resultColor = {
    "check-in":  "border-yd-success bg-yd-success-soft",
    "check-out": "border-yd-danger  bg-yd-danger-soft",
    "already-done": "border-gray-300    bg-gray-50",
    "error":        "border-red-400     bg-red-50",
  };
  const actionIcon = { "check-in":"✅","check-out":"👋","already-done":"ℹ️","error":"❌" };

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

      {/* Camera panel */}
      <div className="flex-1 flex flex-col items-center p-6 overflow-y-auto bg-gray-950">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-black text-white mb-1">QR Scanner</h2>
          <p className="text-gray-400 text-sm mb-5">Point camera at student QR to check in or out.</p>

          {/* Camera box */}
          <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-black border-2 border-gray-700 shadow-2xl">
            <div id="qr-camera-viewport" className="w-full h-full"/>

            {/* Scanning frame */}
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-56 h-56">
                  {[["top-0 left-0","border-t-4 border-l-4"],["top-0 right-0","border-t-4 border-r-4"],
                    ["bottom-0 left-0","border-b-4 border-l-4"],["bottom-0 right-0","border-b-4 border-r-4"]
                  ].map(([pos, border], i) => (
                    <div key={i} className={`absolute ${pos} w-8 h-8 ${border} border-[var(--yd-yellow-light)] rounded-sm`}/>
                  ))}
                </div>
              </div>
            )}

            {!scanning && !camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                <div className="text-6xl mb-4">📷</div>
                <p className="text-white font-bold">Camera Off</p>
                <p className="text-gray-400 text-sm mt-1">Press Start Scanner</p>
              </div>
            )}
            {camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 px-6 text-center">
                <div className="text-4xl mb-3">🚫</div>
                <p className="text-white font-bold text-sm">{camError}</p>
              </div>
            )}
            {processing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                <div className="w-10 h-10 border-4 border-[var(--yd-yellow-light)] border-t-transparent rounded-full animate-spin mb-3"/>
                <p className="text-white font-bold text-sm">Processing…</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="mt-4">
            {!scanning ? (
              <button onClick={startScanner}
                className="w-full bg-[var(--yd-yellow-light)] hover:bg-[#f0c000] text-yd-navy font-black py-3.5
                           rounded-2xl text-sm transition-all active:scale-95 shadow-lg shadow-yellow-500/20">
                ▶ Start Scanner
              </button>
            ) : (
              <button onClick={stopScanner}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-3.5
                           rounded-2xl text-sm transition-all active:scale-95">
                ■ Stop Scanner
              </button>
            )}
          </div>

          {/* Last result */}
          {lastResult && (
            <div className={`mt-4 rounded-2xl border-2 p-4 ${resultColor[lastResult.action] || "border-gray-200 bg-gray-50"}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{actionIcon[lastResult.action] || "ℹ️"}</span>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{lastResult.message}</p>
                  {lastResult.student && (
                    <p className="text-xs text-gray-500 mt-0.5">{lastResult.student.name} · {lastResult.student.class}</p>
                  )}
                  {lastResult.entry?.checkIn && (
                    <p className="text-xs text-gray-500">In: {lastResult.entry.checkIn}{lastResult.entry.checkOut ? ` · Out: ${lastResult.entry.checkOut}` : ""}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent scans */}
      <div className="w-full lg:w-[280px] flex-shrink-0 bg-white border-l border-gray-100 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-sm">Recent Scans</h3>
          <p className="text-xs text-gray-400">{recentScans.length} this session</p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {recentScans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-gray-400 text-sm font-medium">No scans yet</p>
              <p className="text-gray-300 text-xs mt-1">Start scanner to begin</p>
            </div>
          ) : recentScans.map((scan, i) => (
            <div key={i} className="px-4 py-3 flex items-start gap-3">
              <span className="text-lg mt-0.5">{actionIcon[scan.action] || "ℹ️"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{scan.student?.name || "Unknown"}</p>
                <p className="text-[11px] text-gray-400">{scan.student?.class} · {
                  scan.action==="check-in" ? "Checked In" : scan.action==="check-out" ? "Checked Out" : "No change"
                }</p>
              </div>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{scan.scannedAt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StudentQRView
// ═══════════════════════════════════════════════════════════════════
function StudentQRView({ cls }) {
  const mountedRef  = useRef(true);
  const [students,  setStudents ] = useState([]);
  const [loading,   setLoading  ] = useState(true);
  const [filterCls, setFilterCls] = useState(cls || "All");
  const [search,    setSearch   ] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    attendanceService.getBatchQR({ class: filterCls === "All" ? "" : filterCls })
      .then(r => { if (mountedRef.current) setStudents(r.students || []); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [filterCls]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? students.filter(s => s.name?.toLowerCase().includes(q)) : students;
  }, [students, search]);

  function downloadQR(sid, name) {
    const canvas = document.getElementById(`qr-canvas-${sid}`);
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `QR-${name}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-yd-navy">Student QR Codes</h2>
          <p className="text-xs text-gray-400">{displayed.length} students · Click to download PNG</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-xs">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-36 focus:outline-none"/>
          </div>
          <select value={filterCls} onChange={e => setFilterCls(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
            {CLASS_LIST.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[...Array(12)].map((_,i) => <div key={i} className="rounded-2xl bg-gray-100 h-52 animate-pulse"/>)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-3">🎫</div>
            <p className="font-bold text-gray-700">No students found</p>
            <p className="text-sm text-gray-400 mt-1">Try a different class or search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {displayed.map(s => (
              <div key={s.id} onClick={() => downloadQR(s.id, s.name)}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm
                           hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer
                           overflow-hidden flex flex-col items-center p-3 gap-2">
                <span className="self-start text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {s.class}
                </span>
                <div className="p-1.5 bg-white rounded-xl border border-gray-100">
                  <QRCodeCanvas
                    id={`qr-canvas-${s.id}`}
                    value={`YD-${s.id}`}
                    size={110}
                    bgColor="#FFFFFF"
                    fgColor="#04114B"
                    level="M"
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-gray-800 leading-tight">{s.name}</p>
                  <p className="text-[10px] text-gray-400">{s.id}</p>
                </div>
                <p className="text-[10px] text-gray-300 group-hover:text-yd-navy font-semibold transition-colors">
                  ⬇ Download
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HistoryView
// ═══════════════════════════════════════════════════════════════════
function HistoryView({ cls }) {
  const mountedRef   = useRef(true);
  const fetchingRef  = useRef(false);
  const [entries,    setEntries  ] = useState([]);
  const [loading,    setLoading  ] = useState(false);
  const [from,       setFrom     ] = useState(todayISO());
  const [to,         setTo       ] = useState(todayISO());
  const [filterCls,  setFilterCls] = useState(cls || "All");
  const [studentId,  setStudentId] = useState("");

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const fetchHistory = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const res = await attendanceService.getHistory({
        from,
        to,
        class:     filterCls === "All" ? "" : filterCls,
        studentId: studentId.trim() || "",
      });
      if (mountedRef.current) setEntries(res.entries || []);
    } catch { /* silent */ } finally {
      fetchingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, [from, to, filterCls, studentId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const stats = useMemo(() => ({
    present: entries.filter(e => e.status==="Present").length,
    absent:  entries.filter(e => e.status==="Absent").length,
    late:    entries.filter(e => e.status==="Late").length,
    total:   entries.length,
  }), [entries]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-yd-navy">Attendance History</h2>
            <p className="text-xs text-gray-400">{stats.total} records</p>
          </div>
          <div className="flex gap-4">
            {[{l:"Present",v:stats.present,c:"text-yd-success"},{l:"Absent",v:stats.absent,c:"text-yd-danger"},{l:"Late",v:stats.late,c:"text-yd-warn"}].map(({ l, v, c }) => (
              <div key={l} className="text-center"><p className={`text-xl font-black ${c}`}>{v}</p><p className="text-[10px] text-gray-400">{l}</p></div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[["From", from, setFrom], ["To", to, setTo]].map(([label, val, setter]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-semibold">{label}</span>
              <input type="date" value={val} onChange={e => setter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-900/20"/>
            </div>
          ))}
          <select value={filterCls} onChange={e => setFilterCls(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
            {CLASS_LIST.map(c => <option key={c}>{c}</option>)}
          </select>
          <input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="Student ID (optional)"
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none w-44"/>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 space-y-2 animate-pulse">
            {[...Array(10)].map((_,i) => <div key={i} className="h-10 bg-gray-50 rounded-xl"/>)}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-5xl mb-3">📭</div>
            <p className="font-bold text-gray-700">No records found</p>
            <p className="text-sm text-gray-400 mt-1">Try a different date range or filter.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-yd-navy z-10">
              <tr className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
                {["Date","Student","Class","Status","Check-In","Check-Out","Method"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.entryId} className="border-b border-gray-50 hover:bg-yd-yellow-pale transition-colors">
                  <td className="px-4 py-2.5 text-xs font-semibold text-gray-600">{e.date}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${avatarGradient(e.studentName)}
                                       flex items-center justify-center text-white text-[10px] font-black`}>
                        {initials(e.studentName)}
                      </div>
                      <span className="text-xs font-semibold text-gray-800">{e.studentName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{e.class}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={e.status}/></td>
                  <td className="px-4 py-2.5 text-xs text-emerald-600 font-semibold">{e.checkIn || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-rose-600 font-semibold">{e.checkOut || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                      ${e.attendanceMethod==="QR" ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"}`}>
                      {e.attendanceMethod || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════
export default function Attendance() {
  const { canDo }    = useAuth();
  const toast        = useToast();
  const perm = {
    mark:   canDo("attendance", "mark"),
    edit:   canDo("attendance", "edit"),
    export: canDo("attendance", "export"),
  };
  const mountedRef   = useRef(true);
  const summaryRef   = useRef(false);
  const [view,       setView    ] = useState("dashboard");
  const [date,       setDate    ] = useState(todayISO());
  const [cls,        setCls     ] = useState("All");
  const [summary,    setSummary ] = useState({ total:0, present:0, absent:0, late:0, inside:0, qrScanned:0 });
  const [sumLoading, setSumLoad ] = useState(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const fetchSummary = useCallback(async () => {
    if (summaryRef.current) return;
    summaryRef.current = true;
    try {
      const [sumRes, insideRes] = await Promise.all([
        attendanceService.getSummary({ date, class: cls==="All"?"":cls }),
        attendanceService.getInsideNow({ date, class: cls==="All"?"":cls }),
      ]);
      if (mountedRef.current) setSummary({ ...(sumRes.summary||{}), inside: insideRes.count||0 });
    } catch { /* silent */ } finally {
      summaryRef.current = false;
      if (mountedRef.current) setSumLoad(false);
    }
  }, [date, cls]);

  useEffect(() => { setSumLoad(true); fetchSummary(); }, [fetchSummary]);

  // Live summary poll every 15 s
  useEffect(() => {
    const t = setInterval(fetchSummary, 15_000);
    return () => clearInterval(t);
  }, [fetchSummary]);

  return (
    <div className="flex h-screen overflow-hidden bg-yd-bg">
      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss}/>

      <Sidebar
        view={view}   setView={setView}
        date={date}   setDate={setDate}
        cls={cls}     setCls={setCls}
        summary={summary} summaryLoading={sumLoading}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
        {view === "dashboard" && <DashboardView date={date} cls={cls} summary={summary} toast={toast} canMark={perm.mark} canExport={perm.export}/>}
        {view === "scanner"   && <QRScannerView toast={toast}/>}
        {view === "qrcards"   && <StudentQRView cls={cls}/>}
        {view === "history"   && <HistoryView cls={cls}/>}
      </div>
    </div>
  );
}

