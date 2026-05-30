import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import pickupHistoryService from "../services/pickupHistoryService";

// -- SVG Icons (no emoji - encoding-safe) ----------------------------------
const Svg = ({ d, size = 16, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    strokeLinejoin="round" {...p}>{d}</svg>
);
const IconShield  = () => <Svg d={<path d="M8 1L2 4v4c0 3.3 2.6 6.4 6 7 3.4-.6 6-3.7 6-7V4L8 1z"/>} />;
const IconClock   = () => <Svg d={<><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 2"/></>} />;
const IconHistory = () => <Svg d={<><path d="M1 8a7 7 0 107 7"/><path d="M1 4v4h4"/><path d="M8 5v3.5l2.5 1.5"/></>} />;
const IconCalendar= () => <Svg d={<><rect x="1.5" y="2.5" width="13" height="12" rx="2"/><path d="M5 1v3M11 1v3M1.5 7h13"/><path d="M5 10l2 2 4-3"/></>} />;
const IconRefresh = () => <Svg d={<><path d="M13.5 8a5.5 5.5 0 11-1-3.2"/><path d="M13.5 1v4h-4"/></>} />;
const IconSearch  = () => <Svg d={<><circle cx="7" cy="7" r="4.5"/><path d="M11 11l3 3"/></>} />;
const IconCamera  = () => <Svg d={<><path d="M14 12a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1h2l1.5-2h3L11 5h2a1 1 0 011 1v6z"/><circle cx="8" cy="8.5" r="2"/></>} />;
const IconCheck   = () => <Svg d={<path d="M2 8l4 4 8-7"/>} />;
const IconAlert   = () => <Svg d={<><path d="M8 2L1.5 13h13L8 2z"/><path d="M8 7v3M8 12v.5"/></>} />;
const IconBlock   = () => <Svg d={<><circle cx="8" cy="8" r="6.5"/><path d="M4 4l8 8"/></>} />;
const IconPerson  = () => <Svg d={<><circle cx="8" cy="5.5" r="3"/><path d="M2 14c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/></>} />;
const IconCar     = () => <Svg d={<><path d="M3 10l1.5-4.5A1 1 0 015.4 5h5.2a1 1 0 01.9.5L13 10"/><rect x="1" y="10" width="14" height="4" rx="1"/><circle cx="4" cy="14" r="1"/><circle cx="12" cy="14" r="1"/></>} />;

// -- Status config (no emoji) -----------------------------------------------
const STATUS_CONFIG = {
  "Authorized": {
    label: "Authorized", dot: "bg-emerald-400",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    row: "", icon: <IconCheck size={11} />,
  },
  "Emergency_Authorized": {
    label: "Emergency", dot: "bg-amber-400",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    row: "bg-amber-50/30", icon: <IconAlert size={11} />,
  },
  "Unauthorized": {
    label: "Blocked", dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    row: "bg-rose-50/40", icon: <IconBlock size={11} />,
  },
};

function StatusChip({ status }) {
  const c = STATUS_CONFIG[status] || { label: status, dot: "bg-gray-300", chip: "bg-gray-100 text-gray-600 border-gray-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${c.chip}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

// -- Selfie modal -----------------------------------------------------------
function SelfieModal({ entryId, onClose }) {
  const [entry,   setEntry  ] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState(null);

  useEffect(() => {
    pickupHistoryService.getEntry(entryId)
      .then(r => setEntry(r.entry))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [entryId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 text-center"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-black text-gray-900">Pickup Verification</h3>
            {entry && <p className="text-xs text-gray-400 mt-0.5">{entry.date} at {entry.checkoutTime}</p>}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold transition-colors">
            x
          </button>
        </div>

        {loading && (
          <div className="w-10 h-10 border-3 border-gray-200 border-t-yellow-400 rounded-full animate-spin mx-auto my-10" />
        )}
        {error && <p className="text-rose-500 text-sm py-8">{error}</p>}
        {entry && (
          <>
            {entry.selfieImage ? (
              <img src={entry.selfieImage} alt="Pickup verification"
                className="w-44 h-44 object-cover rounded-2xl mx-auto mb-5 border-4 border-gray-100 shadow-lg" />
            ) : (
              <div className="w-44 h-44 rounded-2xl bg-gray-100 mx-auto mb-5 flex flex-col items-center justify-center gap-2 text-gray-400">
                <IconCamera size={32} />
                <span className="text-sm">No photo</span>
              </div>
            )}
            <p className="font-black text-gray-900 text-base">{entry.studentName}</p>
            <p className="text-gray-500 text-sm mt-0.5">
              Picked up by <strong>{entry.pickupName || "Unknown"}</strong>
              {entry.relation ? ` (${entry.relation})` : ""}
            </p>
            <div className="mt-3"><StatusChip status={entry.approvalStatus} /></div>
            {entry.verifiedBy && (
              <p className="text-gray-400 text-xs mt-3">Verified by {entry.verifiedBy}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// -- Mini sidebar -----------------------------------------------------------
function PickupSidebar({ active }) {
  const links = [
    { to: "/pickup-authorization", label: "Authorized Persons", icon: <IconShield />,  key: "auth"    },
    { to: "/pickup-history",       label: "Pickup History",     icon: <IconHistory />, key: "history" },
    { to: "/attendance",           label: "Attendance",         icon: <IconCalendar/>, key: "attend"  },
  ];

  return (
    <div className="w-[220px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-screen">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-gray-100">
        <Link to="/">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-yellow-400 flex items-center justify-center">
              <span className="text-white font-black text-sm">Y</span>
            </div>
            <div>
              <div className="text-sm font-black text-gray-900 leading-none">Yellow Dot</div>
              <div className="text-[10px] text-gray-400 font-medium mt-0.5">Child Safety</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="p-3 border-b border-gray-100 space-y-0.5">
        {links.map(l => (
          <Link key={l.key} to={l.to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              active === l.key
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}>
            <span className={`flex-shrink-0 ${active === l.key ? "opacity-90" : "opacity-50"}`}>{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </div>

      {/* Today quick stats */}
      <div className="p-4 flex-1">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-3">Today</p>
        <div className="space-y-2" id="sidebar-stats">
          {/* Populated from parent */}
        </div>
      </div>
    </div>
  );
}

// -- History event card -----------------------------------------------------
function EventCard({ entry, onViewSelfie }) {
  const cfg = STATUS_CONFIG[entry.approvalStatus] || STATUS_CONFIG["Authorized"];

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-5 hover:shadow-sm transition-all ${
      entry.approvalStatus === "Unauthorized"         ? "border-rose-100"  :
      entry.approvalStatus === "Emergency_Authorized" ? "border-amber-100" : ""
    }`}>
      {/* Status dot */}
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />

      {/* Student */}
      <div className="w-40 flex-shrink-0">
        <p className="text-sm font-black text-gray-900 truncate">{entry.studentName}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{entry.date}</p>
      </div>

      {/* Arrow */}
      <div className="flex-shrink-0 text-gray-300">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 7h10M8 3l4 4-4 4" />
        </svg>
      </div>

      {/* Pickup person */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">
          {entry.pickupName || <span className="text-gray-400 italic font-normal">Unknown person</span>}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">{entry.relation || "—"}</p>
      </div>

      {/* Time */}
      <div className="flex-shrink-0 flex items-center gap-1.5 text-gray-400">
        <IconClock size={12} />
        <span className="text-xs font-mono">{entry.checkoutTime || "—"}</span>
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        <StatusChip status={entry.approvalStatus} />
      </div>

      {/* Selfie button */}
      <div className="flex-shrink-0 w-20 text-right">
        {entry.hasSelfie ? (
          <button onClick={() => onViewSelfie(entry.entryId)}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-600
                       bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-colors">
            <IconCamera size={12} /> Photo
          </button>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </div>
    </div>
  );
}

// -- Main ------------------------------------------------------------------
const STATUSES = ["", "Authorized", "Emergency_Authorized", "Unauthorized"];

export default function PickupHistory() {
  const mountedRef  = useRef(true);
  const fetchingRef = useRef(false);

  const [entries,       setEntries      ] = useState([]);
  const [loading,       setLoading      ] = useState(true);
  const [seeEntryId,    setSeeEntry     ] = useState(null);
  const [date,          setDate         ] = useState(new Date().toISOString().slice(0, 10));
  const [studentSearch, setStudentSearch] = useState("");
  const [statusFilter,  setStatusFilter ] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchHistory = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.approvalStatus = statusFilter;
      const result = await pickupHistoryService.getHistory(params);
      if (!mountedRef.current) return;
      let data = result.entries || [];

      if (date) {
        const [y, m, d] = date.split("-");
        const indiaDate = `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
        data = data.filter(e => e.date === indiaDate);
      }
      if (studentSearch.trim()) {
        const q = studentSearch.trim().toLowerCase();
        data = data.filter(e =>
          (e.studentName || "").toLowerCase().includes(q) ||
          (e.studentId   || "").toLowerCase().includes(q) ||
          (e.pickupName  || "").toLowerCase().includes(q)
        );
      }
      setEntries(data);
    } catch {
      if (mountedRef.current) setEntries([]);
    } finally {
      if (mountedRef.current) setLoading(false);
      fetchingRef.current = false;
    }
  }, [date, studentSearch, statusFilter]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const authorized = entries.filter(e => e.approvalStatus === "Authorized").length;
  const emergency  = entries.filter(e => e.approvalStatus === "Emergency_Authorized").length;
  const blocked    = entries.filter(e => e.approvalStatus === "Unauthorized").length;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {seeEntryId && (
        <SelfieModal entryId={seeEntryId} onClose={() => setSeeEntry(null)} />
      )}

      {/* Sidebar */}
      <div className="w-[220px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-screen">
        {/* Brand */}
        <div className="px-5 py-6 border-b border-gray-100">
          <Link to="/">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-yellow-400 flex items-center justify-center">
                <span className="text-white font-black text-sm">Y</span>
              </div>
              <div>
                <div className="text-sm font-black text-gray-900 leading-none">Yellow Dot</div>
                <div className="text-[10px] text-gray-400 font-medium mt-0.5">Child Safety</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <div className="p-3 border-b border-gray-100 space-y-0.5">
          {[
            { to: "/pickup-authorization", label: "Authorized Persons", icon: <IconShield />  },
            { to: "/pickup-history",       label: "Pickup History",     icon: <IconHistory />, active: true },
            { to: "/attendance",           label: "Attendance",         icon: <IconCalendar/>  },
          ].map(l => (
            <Link key={l.to} to={l.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                l.active
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}>
              <span className={l.active ? "opacity-80" : "opacity-40"}>{l.icon}</span>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Quick stats */}
        <div className="p-4 flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-3">Today</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-emerald-700">Authorized</span>
              </div>
              <span className="text-xl font-black text-emerald-600">{authorized}</span>
            </div>
            <div className="flex items-center justify-between bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs font-bold text-amber-700">Emergency</span>
              </div>
              <span className="text-xl font-black text-amber-600">{emergency}</span>
            </div>
            <div className="flex items-center justify-between bg-rose-50 rounded-xl px-4 py-3 border border-rose-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-xs font-bold text-rose-700">Blocked</span>
              </div>
              <span className="text-xl font-black text-rose-600">{blocked}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-black text-gray-900">Pickup History</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              Verification log for all child pickups
            </p>
          </div>
          <button onClick={fetchHistory}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-gray-600
                       bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            <IconRefresh size={14} /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-gray-100 px-8 py-3 flex items-center gap-5 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-gray-400"><IconCalendar size={14} /></span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700
                         focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700
                       focus:outline-none focus:border-yellow-400 min-w-[140px]">
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <span className="text-gray-400"><IconSearch size={14} /></span>
            <input
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              placeholder="Search student or person..."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700
                         focus:outline-none focus:border-yellow-400" />
          </div>
          <p className="text-xs text-gray-400 ml-auto font-medium">{entries.length} event{entries.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Events */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 rounded-2xl bg-white border border-gray-100 animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mb-5 text-gray-300">
                <IconHistory size={36} />
              </div>
              <h3 className="text-xl font-black text-gray-700 mb-2">No Events Found</h3>
              <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
                No pickup events match your current filters.
                Try a different date or clear the search.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {entries.map((e, i) => (
                <EventCard key={e.entryId || i} entry={e} onViewSelfie={setSeeEntry} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
