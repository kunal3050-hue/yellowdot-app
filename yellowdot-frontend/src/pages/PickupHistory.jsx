/**
 * PickupHistory.jsx â€” Pickup Verification History
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Shows all pickup verification events with approval status,
 * selfie thumbnails, student/pickup person details.
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import pickupHistoryService from "../services/pickupHistoryService";

// â”€â”€ Status config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STATUS_CONFIG = {
  "Authorized":           { label:"Authorized",            color:"text-emerald-700", bg:"bg-emerald-100 border-emerald-200", icon:"âœ…" },
  "Emergency_Authorized": { label:"Emergency Auth",         color:"text-amber-700",   bg:"bg-amber-100 border-amber-200",     icon:"ðŸš¨" },
  "Unauthorized":         { label:"Unauthorized â€” BLOCKED", color:"text-rose-700",    bg:"bg-rose-100 border-rose-200",       icon:"ðŸš«" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color:"text-gray-600", bg:"bg-gray-100 border-gray-200", icon:"â“" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// â”€â”€ Selfie modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SelfieModal({ entryId, studentName, onClose }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
         onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-gray-900">Pickup Selfie</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">âœ•</button>
        </div>
        {loading && <div className="w-10 h-10 border-4 border-yd-navy border-t-transparent rounded-full animate-spin mx-auto my-8"/>}
        {error && <p className="text-rose-500 text-sm py-8">{error}</p>}
        {entry && (
          <>
            {entry.selfieImage ? (
              <img src={entry.selfieImage} alt="Pickup selfie"
                className="w-48 h-36 object-cover rounded-2xl mx-auto mb-4 border-4 border-gray-100 shadow-lg"/>
            ) : (
              <div className="w-48 h-36 rounded-2xl bg-gray-100 mx-auto mb-4 flex items-center justify-center text-gray-400 text-sm">
                No photo
              </div>
            )}
            <p className="font-black text-gray-900">{entry.studentName}</p>
            <p className="text-gray-500 text-sm">{entry.pickupName || "â€”"} Â· {entry.relation || "â€”"}</p>
            <div className="mt-3"><StatusBadge status={entry.approvalStatus}/></div>
            <p className="text-gray-400 text-xs mt-2">{entry.checkoutTime} Â· {entry.date}</p>
            {entry.verifiedBy && <p className="text-gray-400 text-xs">Verified by: {entry.verifiedBy}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// â”€â”€ Filters bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STATUSES = ["", "Authorized", "Emergency_Authorized", "Unauthorized"];

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Main â€” PickupHistory Page
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function PickupHistory() {
  const mountedRef   = useRef(true);
  const fetchingRef  = useRef(false);

  const [entries,   setEntries  ] = useState([]);
  const [loading,   setLoading  ] = useState(true);
  const [seeEntryId,setSeeEntry ] = useState(null); // for selfie modal

  // Filters
  const [date,           setDate          ] = useState(new Date().toISOString().slice(0,10));
  const [studentSearch,  setStudentSearch ] = useState("");
  const [statusFilter,   setStatusFilter  ] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchHistory = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      // Convert ISO date to Indian format for backend filter
      const params = {};
      if (statusFilter) params.approvalStatus = statusFilter;
      // We'll filter date and student clientside to be safe
      const result = await pickupHistoryService.getHistory(params);
      if (!mountedRef.current) return;

      let data = result.entries || [];

      // Client-side date filter (compare Indian date string)
      if (date) {
        const [y,m,d] = date.split("-");
        const indiaDate = `${d.padStart(2,"0")}/${m.padStart(2,"0")}/${y}`;
        data = data.filter(e => e.date === indiaDate);
      }

      // Client-side student search
      if (studentSearch.trim()) {
        const q = studentSearch.trim().toLowerCase();
        data = data.filter(e =>
          (e.studentName || "").toLowerCase().includes(q) ||
          (e.studentId   || "").toLowerCase().includes(q) ||
          (e.pickupName  || "").toLowerCase().includes(q)
        );
      }

      setEntries(data);
    } catch (e) {
      if (mountedRef.current) setEntries([]);
    } finally {
      if (mountedRef.current) setLoading(false);
      fetchingRef.current = false;
    }
  }, [date, studentSearch, statusFilter]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const authorized  = entries.filter(e => e.approvalStatus === "Authorized").length;
  const emergency   = entries.filter(e => e.approvalStatus === "Emergency_Authorized").length;
  const blocked     = entries.filter(e => e.approvalStatus === "Unauthorized").length;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {seeEntryId && (
        <SelfieModal
          entryId={seeEntryId}
          onClose={() => setSeeEntry(null)}
        />
      )}

      {/* Sidebar */}
      <div className="w-[220px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-screen shadow-md">
        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <Link to="/" className="block">
            <h1 className="text-3xl font-black text-[var(--yd-yellow)] leading-none">Yellow<br/>Dot</h1>
            <p className="text-gray-400 text-[10px] font-medium mt-1 uppercase tracking-wider">Child Safety</p>
          </Link>
        </div>
        <div className="p-3 border-b border-gray-100 flex-shrink-0 space-y-1">
          <Link to="/pickup-authorization"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            <span>ðŸ”</span> Pickup Auth
          </Link>
          <Link to="/pickup-history"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold bg-yd-navy text-white shadow-md">
            <span>ðŸ“‹</span> Pickup History
          </Link>
          <Link to="/attendance"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            <span>ðŸ“Š</span> Attendance
          </Link>
        </div>

        {/* Stats */}
        <div className="p-4 space-y-3 flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Today's Summary</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-emerald-50 rounded-xl px-3 py-2.5 border border-emerald-100">
              <span className="text-xs font-bold text-emerald-700">âœ… Authorized</span>
              <span className="text-xl font-black text-emerald-600">{authorized}</span>
            </div>
            <div className="flex items-center justify-between bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
              <span className="text-xs font-bold text-amber-700">ðŸš¨ Emergency</span>
              <span className="text-xl font-black text-amber-600">{emergency}</span>
            </div>
            <div className="flex items-center justify-between bg-rose-50 rounded-xl px-3 py-2.5 border border-rose-100">
              <span className="text-xs font-bold text-rose-700">ðŸš« Blocked</span>
              <span className="text-xl font-black text-rose-600">{blocked}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div>
            <h2 className="text-2xl font-black text-gray-900">Pickup History</h2>
            <p className="text-gray-500 text-sm mt-0.5">All pickup verification events with approval status</p>
          </div>
          <button onClick={fetchHistory}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-yd-navy bg-blue-50
                       hover:bg-blue-100 rounded-xl transition-colors border border-blue-100">
            ðŸ”„ Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-gray-100 px-8 py-3 flex items-center gap-4 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-yd-navy"/>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-blue-900/20">
              <option value="">All Statuses</option>
              {STATUSES.filter(Boolean).map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <input
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              placeholder="ðŸ” Search student or pickup personâ€¦"
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-yd-navy"/>
          </div>
          <p className="text-xs text-gray-400 ml-auto">{entries.length} record{entries.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-white border border-gray-100 animate-pulse"/>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="text-6xl mb-4">ðŸ“‹</div>
              <h3 className="text-xl font-black text-gray-700 mb-2">No Records Found</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                No pickup history matches the current filters.
                Try changing the date or clearing the search.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest px-5 py-3">Student</th>
                    <th className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest px-5 py-3">Pickup Person</th>
                    <th className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest px-5 py-3">Status</th>
                    <th className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest px-5 py-3">Time</th>
                    <th className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest px-5 py-3">Verified By</th>
                    <th className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest px-5 py-3">Selfie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {entries.map((e, i) => (
                    <tr key={e.entryId || i}
                      className={`hover:bg-gray-50 transition-colors
                        ${e.approvalStatus === "Unauthorized" ? "bg-rose-50/30" : ""}
                        ${e.approvalStatus === "Emergency_Authorized" ? "bg-amber-50/20" : ""}`}>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-bold text-gray-900">{e.studentName}</p>
                        <p className="text-xs text-gray-400">{e.studentId} Â· {e.date}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-gray-800">{e.pickupName || <span className="text-gray-400 italic text-xs">Unknown</span>}</p>
                        <p className="text-xs text-gray-400">{e.relation || "â€”"}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={e.approvalStatus}/>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-gray-700 font-mono">{e.checkoutTime || "â€”"}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-gray-600">{e.verifiedBy || "â€”"}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        {e.hasSelfie ? (
                          <button
                            onClick={() => setSeeEntry(e.entryId)}
                            className="text-xs font-bold text-yd-navy bg-blue-50 hover:bg-blue-100
                                       px-3 py-1.5 rounded-xl transition-colors border border-blue-100">
                            ðŸ“· View
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">â€”</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

