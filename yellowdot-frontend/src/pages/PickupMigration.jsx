/**
 * PickupMigration.jsx — Family Safety Setup
 * ──────────────────────────────────────────
 * Operational dashboard to ensure every family has complete
 * authorized pickup records for their children.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link }                                      from "react-router-dom";
import Sidebar                                        from "../components/Sidebar";
import { api }                                        from "../services/authService";

// ── SVG Icons (encoding-safe, zero emoji) ─────────────────────────────────

const Svg = ({ d, size = 16, stroke = "currentColor", fill = "none", strokeWidth = 1.75, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={fill} stroke={stroke}
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {d}
  </svg>
);

const IconShield   = (p) => <Svg {...p} d={<path d="M8 1L2 4v4c0 3.3 2.6 6.4 6 7 3.4-.6 6-3.7 6-7V4L8 1z"/>} />;
const IconCheck    = (p) => <Svg {...p} d={<path d="M2 9l4 4 8-7"/>} />;
const IconWarn     = (p) => <Svg {...p} d={<><path d="M8 3L1.5 14h13L8 3z"/><path d="M8 7v3M8 12v.5"/></>} />;
const IconClock    = (p) => <Svg {...p} d={<><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></>} />;
const IconFamily   = (p) => <Svg {...p} d={<><circle cx="5" cy="5" r="2"/><circle cx="11" cy="5" r="2"/><path d="M1 13c0-2.2 1.8-4 4-4s4 1.8 4 4M9 13c0-1.7 1.3-3 3-3s3 1.3 3 3"/></>} />;
const IconCamera   = (p) => <Svg {...p} d={<><path d="M1 5h2l1-2h8l1 2h2v8H1V5z"/><circle cx="8" cy="9" r="2.5"/></>} />;
const IconPhone    = (p) => <Svg {...p} d={<><rect x="4" y="1" width="8" height="14" rx="1.5"/><circle cx="8" cy="12" r="0.5" fill="currentColor" stroke="none"/></>} />;
const IconSearch   = (p) => <Svg {...p} d={<><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/></>} />;
const IconClose    = (p) => <Svg {...p} d={<><path d="M3 3l10 10M13 3L3 13"/></>} />;
const IconBack     = (p) => <Svg {...p} d={<path d="M10 3L4 8l6 5"/>} />;
const IconBolt     = (p) => <Svg {...p} fill="currentColor" stroke="none" d={<path d="M9 1L3 9h5l-1 6 6-8h-5z"/>} />;
const IconRefresh  = (p) => <Svg {...p} d={<><path d="M2 8a6 6 0 0110.5-4M14 8a6 6 0 01-10.5 4"/><path d="M12 4l.5-2.5 2.5.5M1 11.5l2.5-.5.5 2.5"/></>} />;
const IconChevDown = (p) => <Svg {...p} d={<path d="M4 6l4 4 4-4"/>} />;
const IconChevUp   = (p) => <Svg {...p} d={<path d="M12 10L8 6l-4 4"/>} />;
const IconUsers    = (p) => <Svg {...p} d={<><circle cx="6" cy="5" r="2.5"/><path d="M1 14c0-2.8 2.2-5 5-5s5 2.2 5 5"/><circle cx="12" cy="6" r="2"/><path d="M14 14c0-2.2-1.8-4-4-4"/></>} />;

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(name = "") {
  return (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const W = 150, H = 150;
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(W / img.width, H / img.height);
        const sw = W / scale, sh = H / scale;
        const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getStudentStatus(stu, pickupMap) {
  const sid    = stu.Student_ID || stu.studentId || stu.id;
  const entry  = pickupMap[sid] || {};
  const father = entry.father || null;
  const mother = entry.mother || null;

  const hasFatherName    = !!(stu.Father_Name || "").trim();
  const hasMotherName    = !!(stu.Mother_Name || "").trim();
  const fatherPending    = hasFatherName && !father;
  const motherPending    = hasMotherName && !mother;
  const pending          = fatherPending || motherPending;
  const fatherIncomplete = father?.isIncomplete;
  const motherIncomplete = mother?.isIncomplete;
  const incomplete       = !pending && (fatherIncomplete || motherIncomplete);
  const noParents        = !hasFatherName && !hasMotherName;

  return {
    sid, father, mother,
    hasFatherName, hasMotherName,
    fatherPending, motherPending, pending,
    fatherIncomplete, motherIncomplete, incomplete,
    complete: !pending && !incomplete && !noParents,
    noParents,
    status: pending ? "pending" : incomplete ? "incomplete" : noParents ? "no_parents" : "complete",
  };
}

// ── useCountUp ─────────────────────────────────────────────────────────────

function useCountUp(target, duration = 700) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  useEffect(() => {
    const start = prevRef.current;
    const diff  = target - start;
    if (diff === 0) return;
    const t0 = performance.now();
    let raf;
    function tick(now) {
      const p     = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + diff * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = target;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

// ── AnimatedStat ───────────────────────────────────────────────────────────

function AnimatedStat({ value, label, color, iconBg, icon, loading }) {
  const count = useCountUp(loading ? 0 : value);
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}>
        <span className={color}>{icon}</span>
      </div>
      <p className={`text-3xl font-black ${loading ? "opacity-25" : ""} ${color}`}>
        {loading ? "0" : count}
      </p>
      <p className="text-xs text-gray-400 font-semibold mt-0.5">{label}</p>
    </div>
  );
}

// ── ProgressPanel ──────────────────────────────────────────────────────────

function ProgressPanel({ progress, total, done }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${done ? "bg-emerald-100" : "bg-yellow-100"}`}>
            {done
              ? <span className="text-emerald-500"><IconCheck size={16} strokeWidth={2.5} /></span>
              : <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            }
          </div>
          <div>
            <p className="font-black text-[#0F172A] text-sm">
              {done ? "All families set up" : "Setting up families…"}
            </p>
            {done && total > 0 && (
              <p className="text-xs text-emerald-600 font-semibold">
                {total} {total === 1 ? "record" : "records"} created
              </p>
            )}
          </div>
        </div>
        <span className="text-xl font-black text-[#0F172A]">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${done ? "bg-emerald-400" : "bg-yellow-400"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── SuccessBanner ──────────────────────────────────────────────────────────

function SuccessBanner({ result, onDismiss }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 mb-6 flex items-center gap-4">
      <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
        <span className="text-emerald-600"><IconShield size={18} strokeWidth={2} /></span>
      </div>
      <div className="flex-1">
        <p className="font-black text-emerald-800 text-sm">Families set up successfully</p>
        <p className="text-xs text-emerald-600 mt-0.5">
          {result.totalCreated} {result.totalCreated === 1 ? "record" : "records"} created
          {result.totalIncomplete > 0 && ` · ${result.totalIncomplete} still need a photo or phone number`}
        </p>
      </div>
      <button onClick={onDismiss} className="text-emerald-300 hover:text-emerald-500 transition-colors">
        <IconClose size={16} />
      </button>
    </div>
  );
}

// ── AttentionSection ───────────────────────────────────────────────────────

function AttentionSection({ rows, onFix }) {
  const [expanded, setExpanded] = useState(true);
  if (rows.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 mb-6">
      <button
        onClick={() => setExpanded(x => !x)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-600"><IconWarn size={15} strokeWidth={2} /></span>
          </div>
          <div className="text-left">
            <p className="font-black text-amber-900 text-sm">
              {rows.length} {rows.length === 1 ? "family needs" : "families need"} attention
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Missing photo or phone number — tap to complete</p>
          </div>
        </div>
        <span className="text-amber-400">
          {expanded ? <IconChevUp size={15} /> : <IconChevDown size={15} />}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {rows.map(row => (
            <div key={row.sid} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-xs font-black text-amber-700 flex-shrink-0">
                {initials(row.stu.Student_Name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#0F172A] text-sm truncate">{row.stu.Student_Name}</p>
                <p className="text-xs text-gray-400">{row.stu.Class || "—"}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {row.father?.isIncomplete && (
                  <button
                    onClick={() => onFix({ person: row.father, studentName: row.stu.Student_Name })}
                    className="text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <IconCamera size={10} /> Father
                  </button>
                )}
                {row.mother?.isIncomplete && (
                  <button
                    onClick={() => onFix({ person: row.mother, studentName: row.stu.Student_Name })}
                    className="text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <IconCamera size={10} /> Mother
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── StatusPill ─────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  const map = {
    complete:   { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: <IconCheck size={10} strokeWidth={2.5} />, label: "Ready"       },
    pending:    { cls: "bg-blue-50 text-blue-700 border border-blue-200",          icon: <IconClock  size={10} strokeWidth={2}   />, label: "Needs Setup" },
    incomplete: { cls: "bg-amber-50 text-amber-700 border border-amber-200",       icon: <IconWarn   size={10} strokeWidth={2}   />, label: "Incomplete"  },
    no_parents: { cls: "bg-gray-100 text-gray-400",                                icon: null,                                        label: "No Parents"  },
  };
  const s = map[status] || map.no_parents;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}

// ── ParentBadge ────────────────────────────────────────────────────────────

function ParentBadge({ name, record, onFix }) {
  if (!name) return <span className="text-gray-200 text-xs">—</span>;
  if (!record) return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
      <IconClock size={9} /> Pending
    </span>
  );
  if (record.isIncomplete) return (
    <button
      onClick={onFix}
      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 hover:bg-amber-100 transition-colors"
    >
      <IconCamera size={9} /> Complete
    </button>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
      <IconCheck size={9} strokeWidth={2.5} /> Ready
    </span>
  );
}

// ── StudentRow ─────────────────────────────────────────────────────────────

function StudentRow({ row, busy, failed, onSetup, onFix, onRetry }) {
  const { stu, sid, status, father, mother, hasFatherName, hasMotherName } = row;

  const avatarCls = {
    complete:   "bg-emerald-400 text-white",
    pending:    "bg-blue-400 text-white",
    incomplete: "bg-amber-400 text-white",
    no_parents: "bg-gray-100 text-gray-400",
  }[status] || "bg-gray-100 text-gray-400";

  return (
    <div className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-colors hover:bg-gray-50/80 ${
      status === "incomplete" ? "bg-amber-50/50" :
      status === "pending"    ? "bg-blue-50/30"  : ""
    }`}>
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${avatarCls}`}>
        {status === "no_parents"
          ? <IconFamily size={15} />
          : initials(stu.Student_Name)}
      </div>

      {/* Name + class */}
      <div className="flex-1 min-w-0">
        <p className="font-black text-[#0F172A] text-sm truncate">{stu.Student_Name}</p>
        <p className="text-xs text-gray-400">
          {stu.Class || "—"}{stu.Center ? ` · ${stu.Center}` : ""}
        </p>
      </div>

      {/* Father */}
      <div className="w-28 flex-shrink-0">
        {hasFatherName && (
          <p className="text-[11px] text-gray-500 font-medium truncate mb-0.5">{stu.Father_Name}</p>
        )}
        <ParentBadge
          name={stu.Father_Name}
          record={father}
          onFix={() => onFix({ person: father, studentName: stu.Student_Name })}
        />
      </div>

      {/* Mother */}
      <div className="w-28 flex-shrink-0">
        {hasMotherName && (
          <p className="text-[11px] text-gray-500 font-medium truncate mb-0.5">{stu.Mother_Name}</p>
        )}
        <ParentBadge
          name={stu.Mother_Name}
          record={mother}
          onFix={() => onFix({ person: mother, studentName: stu.Student_Name })}
        />
      </div>

      {/* Status */}
      <div className="w-24 flex-shrink-0">
        <StatusPill status={status} />
      </div>

      {/* Action */}
      <div className="w-20 flex justify-end flex-shrink-0">
        {failed ? (
          <button
            onClick={onRetry}
            disabled={busy}
            className="text-xs font-bold bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <IconRefresh size={11} /> Retry
          </button>
        ) : status === "pending" ? (
          <button
            onClick={onSetup}
            disabled={busy}
            className="text-xs font-bold bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy
              ? <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
              : <IconClock size={11} />
            }
            Set Up
          </button>
        ) : status === "complete" ? (
          <span className="text-emerald-400 flex items-center">
            <IconCheck size={14} strokeWidth={2.5} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── FixProfileModal ────────────────────────────────────────────────────────

function FixProfileModal({ person, studentName, onClose, onSave, loading }) {
  const [mobile,       setMobile]       = useState(person.mobile   || "");
  const [photoPreview, setPhotoPreview] = useState(person.photoUrl || "");
  const [photoData,    setPhotoData]    = useState(person.photoUrl || "");
  const [photoLoading, setPhotoLoading] = useState(false);
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    try {
      const c = await compressPhoto(file);
      setPhotoPreview(c);
      setPhotoData(c);
    } catch { /* ignore */ }
    finally { setPhotoLoading(false); }
  }

  const missing = person.missingFields || [];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-[#0F172A]">Complete Profile</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {person.pickupName} · {studentName}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors">
            <IconClose size={18} />
          </button>
        </div>

        {/* Photo */}
        <div className="mb-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            Photo
            {(missing.includes("photo") || !photoPreview) && (
              <span className="text-amber-500 normal-case font-semibold ml-1">· Missing</span>
            )}
          </p>
          <div className="flex items-center gap-4">
            <div
              onClick={() => fileRef.current?.click()}
              className={`w-[72px] h-[72px] rounded-2xl cursor-pointer overflow-hidden border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                !photoPreview
                  ? "border-dashed border-amber-300 bg-amber-50 hover:border-amber-400"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              {photoLoading
                ? <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                : photoPreview
                  ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                  : <span className="text-amber-300"><IconCamera size={22} strokeWidth={1.5} /></span>
              }
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-sm font-bold text-[#0F172A] bg-gray-50 hover:bg-gray-100 px-4 py-2.5 rounded-xl border border-gray-200 transition-colors"
            >
              {photoPreview ? "Change Photo" : "Upload Photo"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />
          </div>
        </div>

        {/* Mobile */}
        <div className="mb-7">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            Phone Number
            {(missing.includes("mobile") || !mobile) && (
              <span className="text-amber-500 normal-case font-semibold ml-1">· Missing</span>
            )}
          </p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
              <IconPhone size={14} />
            </span>
            <input
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              placeholder="+91 9876543210"
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3.5 font-bold text-sm outline-none focus:border-yellow-400 transition-colors"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3.5 rounded-2xl text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ mobile, photoUrl: photoData })}
            disabled={loading || (!mobile.trim() && !photoData)}
            className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-40 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <IconShield size={14} />
            }
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PickupMigration() {
  const [students,        setStudents       ] = useState([]);
  const [pickupMap,       setPickupMap      ] = useState({});
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingPickup,   setLoadingPickup  ] = useState(true);
  const [filter,          setFilter         ] = useState("all");
  const [search,          setSearch         ] = useState("");
  const [bulkRunning,     setBulkRunning    ] = useState(false);
  const [bulkProgress,    setBulkProgress   ] = useState(0);
  const [bulkDone,        setBulkDone       ] = useState(false);
  const [bulkResult,      setBulkResult     ] = useState(null);
  const [failedStudents,  setFailedStudents ] = useState([]);
  const [perStudentBusy,  setPerStudentBusy ] = useState({});
  const [fixTarget,       setFixTarget      ] = useState(null);
  const [fixLoading,      setFixLoading     ] = useState(false);
  const [toast,           setToast          ] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => { if (mountedRef.current) setToast(""); }, 4000);
  }

  // ── Load students ──────────────────────────────────────────────
  useEffect(() => {
    api.get("/students")
      .then(r => { if (mountedRef.current) setStudents(Array.isArray(r.data) ? r.data : []); })
      .catch(() => showToast("Failed to load student list."))
      .finally(() => { if (mountedRef.current) setLoadingStudents(false); });
  }, []);

  // ── Load pickup status ─────────────────────────────────────────
  const loadPickupData = useCallback(async () => {
    setLoadingPickup(true);
    try {
      const res = await api.get("/api/pickup-authorization/migration-status");
      const arr = res.data?.status || [];
      const map = {};
      for (const s of arr) map[s.studentId] = { father: s.father, mother: s.mother };
      if (mountedRef.current) setPickupMap(map);
    } catch {
      // Fallback: build map from all pickup persons
      try {
        const res2    = await api.get("/api/pickup-authorization");
        const entries = res2.data?.entries || [];
        const map2    = {};
        for (const e of entries) {
          if (!e.isParent) continue;
          if (!map2[e.studentId]) map2[e.studentId] = { father: null, mother: null };
          if (e.relation === "Father") map2[e.studentId].father = e;
          if (e.relation === "Mother") map2[e.studentId].mother = e;
        }
        if (mountedRef.current) setPickupMap(map2);
      } catch { /* ignore */ }
    } finally {
      if (mountedRef.current) setLoadingPickup(false);
    }
  }, []);

  useEffect(() => { loadPickupData(); }, [loadPickupData]);

  // ── Progress animation during bulk run ────────────────────────
  useEffect(() => {
    if (!bulkRunning) return;
    let p = 8;
    setBulkProgress(p);
    setBulkDone(false);
    const iv = setInterval(() => {
      p = Math.min(p + Math.random() * 6 + 2, 88);
      if (mountedRef.current) setBulkProgress(p);
    }, 480);
    return () => clearInterval(iv);
  }, [bulkRunning]);

  // ── Computed ───────────────────────────────────────────────────
  const rows = students.map(stu => ({ stu, ...getStudentStatus(stu, pickupMap) }));

  const stats = {
    total:      rows.length,
    complete:   rows.filter(r => r.status === "complete").length,
    pending:    rows.filter(r => r.status === "pending").length,
    incomplete: rows.filter(r => r.status === "incomplete").length,
    no_parents: rows.filter(r => r.status === "no_parents").length,
  };

  const loading     = loadingStudents || loadingPickup;
  const readyCount  = stats.complete + stats.no_parents;
  const readyPct    = stats.total > 0 ? Math.round((readyCount / stats.total) * 100) : 0;
  const attentionRows = rows.filter(r => r.status === "incomplete");
  const failedSet   = new Set(failedStudents.map(f => f.sid));

  const filtered = rows.filter(row => {
    if (filter !== "all" && row.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (row.stu.Student_Name || "").toLowerCase().includes(q) ||
        (row.sid || "").toLowerCase().includes(q) ||
        (row.stu.Class || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Set up single student ──────────────────────────────────────
  async function setupOne(row) {
    const { stu, sid } = row;
    setPerStudentBusy(b => ({ ...b, [sid]: true }));
    setFailedStudents(f => f.filter(x => x.sid !== sid));
    try {
      await api.post("/api/pickup-authorization/migrate-student", {
        studentId:    sid,
        studentName:  stu.Student_Name   || "",
        fatherName:   stu.Father_Name    || "",
        fatherMobile: stu.Father_Whatsapp || stu.Father_Phone || "",
        fatherPhoto:  stu.father_photo   || "",
        motherName:   stu.Mother_Name    || "",
        motherMobile: stu.Mother_Whatsapp || stu.Mother_Phone || "",
        motherPhoto:  stu.mother_photo   || "",
      });
      showToast(`${stu.Student_Name} — family set up.`);
      await loadPickupData();
    } catch (e) {
      setFailedStudents(f => [...f, { sid, name: stu.Student_Name }]);
      showToast(e?.response?.data?.error || "Setup failed — try again.");
    } finally {
      if (mountedRef.current) setPerStudentBusy(b => ({ ...b, [sid]: false }));
    }
  }

  // ── Bulk set up all pending ────────────────────────────────────
  async function setupAll() {
    const pending = rows.filter(r => r.status === "pending");
    if (!pending.length) { showToast("All families are already set up."); return; }
    setBulkRunning(true);
    setBulkResult(null);
    setFailedStudents([]);
    try {
      const payload = pending.map(r => ({
        studentId:    r.sid,
        studentName:  r.stu.Student_Name   || "",
        fatherName:   r.stu.Father_Name    || "",
        fatherMobile: r.stu.Father_Whatsapp || r.stu.Father_Phone || "",
        fatherPhoto:  r.stu.father_photo   || "",
        motherName:   r.stu.Mother_Name    || "",
        motherMobile: r.stu.Mother_Whatsapp || r.stu.Mother_Phone || "",
        motherPhoto:  r.stu.mother_photo   || "",
      }));
      const res = await api.post("/api/pickup-authorization/migrate-bulk", { students: payload });
      setBulkProgress(100);
      setBulkDone(true);
      setBulkResult(res.data);
      await loadPickupData();
    } catch (e) {
      showToast(e?.response?.data?.error || "Setup failed — check your connection and retry.");
    } finally {
      if (mountedRef.current) setBulkRunning(false);
    }
  }

  // ── Fix incomplete profile ─────────────────────────────────────
  async function handleFix({ mobile, photoUrl }) {
    if (!fixTarget) return;
    setFixLoading(true);
    try {
      await api.put(`/api/pickup-authorization/${fixTarget.person.entryId}`, { mobile, photoUrl });
      showToast(`${fixTarget.person.pickupName}'s profile is now complete.`);
      setFixTarget(null);
      await loadPickupData();
    } catch (e) {
      showToast(e?.response?.data?.error || "Save failed — try again.");
    } finally {
      if (mountedRef.current) setFixLoading(false);
    }
  }

  function dismissBulkResult() {
    setBulkResult(null);
    setBulkDone(false);
    setBulkProgress(0);
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex bg-white min-h-screen">
      <Sidebar />

      <div className="ml-[280px] w-full p-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <Link
              to="/pickup-authorization"
              className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm font-semibold transition-colors mb-3"
            >
              <IconBack size={13} /> Back
            </Link>
            <h1 className="text-4xl font-black text-[#0F172A]">Family Safety Setup</h1>
            <p className="text-gray-400 mt-1 text-sm">
              Authorize parents for pickup across all enrolled children
            </p>
          </div>

          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={loadPickupData}
              disabled={loading}
              className="bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 font-bold px-4 py-3 rounded-2xl text-sm transition-colors flex items-center gap-2 shadow-sm disabled:opacity-40"
            >
              <IconRefresh size={14} /> Refresh
            </button>
            <button
              onClick={setupAll}
              disabled={bulkRunning || stats.pending === 0 || loading}
              className="bg-[#0F172A] hover:bg-gray-800 disabled:opacity-40 text-white font-bold px-6 py-3 rounded-2xl text-sm transition-colors flex items-center gap-2 shadow-sm"
            >
              {bulkRunning
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <IconBolt size={14} />
              }
              {bulkRunning ? "Setting up…" : `Set Up All (${stats.pending})`}
            </button>
          </div>
        </div>

        {/* ── Progress panel ── */}
        {(bulkRunning || bulkDone) && (
          <ProgressPanel
            progress={bulkProgress}
            total={bulkResult?.totalCreated || 0}
            done={bulkDone}
          />
        )}

        {/* ── Success banner ── */}
        {bulkResult && !bulkRunning && (
          <SuccessBanner result={bulkResult} onDismiss={dismissBulkResult} />
        )}

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <AnimatedStat
            value={readyCount}
            label="Families Ready"
            color="text-emerald-600"
            iconBg="bg-emerald-100"
            icon={<IconShield size={17} strokeWidth={1.75} />}
            loading={loading}
          />
          <AnimatedStat
            value={stats.pending}
            label="Needs Setup"
            color="text-blue-600"
            iconBg="bg-blue-100"
            icon={<IconClock size={17} strokeWidth={1.75} />}
            loading={loading}
          />
          <AnimatedStat
            value={stats.incomplete}
            label="Need Attention"
            color="text-amber-600"
            iconBg="bg-amber-100"
            icon={<IconWarn size={17} strokeWidth={1.75} />}
            loading={loading}
          />
          <AnimatedStat
            value={stats.total}
            label="Total Families"
            color="text-[#0F172A]"
            iconBg="bg-gray-100"
            icon={<IconUsers size={17} strokeWidth={1.75} />}
            loading={loading}
          />
        </div>

        {/* ── Overall readiness bar ── */}
        {!loading && stats.total > 0 && (
          <div className="bg-white rounded-3xl p-5 mb-6 shadow-sm flex items-center gap-5">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Overall readiness</p>
                <p className="text-sm font-black text-[#0F172A]">{readyPct}%</p>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${readyPct}%` }}
                />
              </div>
            </div>
            <div className="text-right flex-shrink-0 pl-2">
              <p className="text-2xl font-black text-emerald-600">{readyCount}</p>
              <p className="text-xs text-gray-400 font-semibold">of {stats.total}</p>
            </div>
          </div>
        )}

        {/* ── Attention section (incomplete profiles) ── */}
        {!loading && <AttentionSection rows={attentionRows} onFix={setFixTarget} />}

        {/* ── Failed retries notice ── */}
        {failedStudents.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-3xl p-4 mb-5 flex items-center gap-4">
            <span className="text-red-400 flex-shrink-0"><IconWarn size={16} /></span>
            <p className="text-sm text-red-700 font-semibold flex-1">
              {failedStudents.length} {failedStudents.length === 1 ? "family" : "families"} couldn't be set up — use the Retry button on each row.
            </p>
            <button onClick={() => setFailedStudents([])} className="text-red-300 hover:text-red-500 transition-colors">
              <IconClose size={15} />
            </button>
          </div>
        )}

        {/* ── Filter + Search ── */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex gap-1 bg-white rounded-2xl p-1.5 shadow-sm">
            {[
              { key: "all",        label: "All Families"              },
              { key: "pending",    label: `Needs Setup (${stats.pending})`    },
              { key: "incomplete", label: `Incomplete (${stats.incomplete})`  },
              { key: "complete",   label: `Ready (${stats.complete})`         },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  filter === f.key
                    ? "bg-[#0F172A] text-white shadow-sm"
                    : "text-gray-400 hover:bg-gray-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">
              <IconSearch size={13} />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or class…"
              className="bg-white rounded-2xl pl-9 pr-4 py-2.5 text-sm font-medium border border-gray-200 outline-none focus:border-yellow-400 w-56 shadow-sm transition-colors"
            />
          </div>
        </div>

        {/* ── List ── */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 text-[10px] font-black text-gray-300 uppercase tracking-widest">
            <div className="w-9 flex-shrink-0" />
            <div className="flex-1">Family</div>
            <div className="w-28 flex-shrink-0">Father</div>
            <div className="w-28 flex-shrink-0">Mother</div>
            <div className="w-24 flex-shrink-0">Status</div>
            <div className="w-20 flex-shrink-0 text-right">Action</div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-gray-300">
              <div className="w-7 h-7 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-semibold">Loading families…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-gray-300 font-bold text-sm">No families match</p>
            </div>
          ) : (
            <div className="px-2 py-2 space-y-0.5">
              {filtered.map(row => (
                <StudentRow
                  key={row.sid}
                  row={row}
                  busy={!!perStudentBusy[row.sid]}
                  failed={failedSet.has(row.sid)}
                  onSetup={() => setupOne(row)}
                  onRetry={() => setupOne(row)}
                  onFix={setFixTarget}
                />
              ))}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-50 text-[11px] text-gray-300 font-semibold">
              {filtered.length} of {rows.length} families
            </div>
          )}
        </div>

      </div>

      {/* ── Fix modal ── */}
      {fixTarget && (
        <FixProfileModal
          person={fixTarget.person}
          studentName={fixTarget.studentName}
          onClose={() => setFixTarget(null)}
          onSave={handleFix}
          loading={fixLoading}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white font-bold px-7 py-3.5 rounded-2xl shadow-2xl z-50 text-sm whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}
