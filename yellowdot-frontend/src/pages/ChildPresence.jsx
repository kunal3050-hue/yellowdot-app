/**
 * ChildPresence.jsx — Unified child presence tracking
 * Route:   /child-presence  (routeKey: "attendance")
 * Screen:  Gate Register
 *
 * Single question: "Is the child currently inside the school?"
 * Three states:    Not Arrived · Present · Picked Up
 *
 * Sort order:   Present → Not Arrived → Picked Up (alphabetical within each group)
 * Check-in:     one-click, search stays focused for rapid sequential arrivals
 * Check-out:    authorized-person modal; persons preloaded in background
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/authService";
import parentAttendanceService    from "../services/parentAttendanceService";
import pickupAuthorizationService from "../services/pickupAuthorizationService";
import pickupHistoryService       from "../services/pickupHistoryService";
import securityService            from "../services/securityService";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  NOT_ARRIVED: { label: "Not Arrived", dot: "#D97706", bg: "#FEF3C7", text: "#92400E" },
  CHECKED_IN:  { label: "Present",     dot: "#10B981", bg: "#D1FAE5", text: "#065F46" },
  CHECKED_OUT: { label: "Picked Up",   dot: "#9CA3AF", bg: "#F3F4F6", text: "#4B5563" },
};

// Present first — they're inside and need monitoring
const STATUS_ORDER = { CHECKED_IN: 0, NOT_ARRIVED: 1, CHECKED_OUT: 2 };

const RELATION_OPTS = [
  "Unknown", "Father", "Mother", "Grandmother", "Grandfather",
  "Uncle", "Aunt", "Driver", "Guardian", "Other",
];

// Parents pick up most often; drivers/unknowns least
const RELATION_PRIORITY = {
  Father: 0, Mother: 0, Parent: 0,
  Grandmother: 1, Grandfather: 1, Aunt: 1, Uncle: 1, Guardian: 1,
  Driver: 2, Other: 3, Unknown: 4,
};

const SPRING = "cubic-bezier(0.22,1,0.36,1)";

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name = "") {
  return (name || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function snapVideo(video, w = 480, h = 360) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(video, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.75);
}

function stuId(s)   { return s.Student_ID || s.id || ""; }
function stuName(s) { return s.Student_Name || s.name || "—"; }
function stuCls(s)  { return s.Class || s.class || "—"; }

// Sort by relation priority; emergency contacts go last (not for daily pickup)
function sortPersons(persons) {
  return [...persons].sort((a, b) => {
    if (a.emergency !== b.emergency) return a.emergency ? 1 : -1;
    const pa = RELATION_PRIORITY[a.relation] ?? 5;
    const pb = RELATION_PRIORITY[b.relation] ?? 5;
    if (pa !== pb) return pa - pb;
    return (a.pickupName || "").localeCompare(b.pickupName || "");
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ChildPresence() {
  const { user } = useAuth();
  const mountedRef = useRef(true);

  // Core data
  const [students,  setStudents]  = useState([]);
  const [records,   setRecords]   = useState([]);   // today's parentAttendance records
  const [loading,   setLoading]   = useState(true);
  const [dataError, setDataError] = useState(null);

  // Filters
  const [search,      setSearch]      = useState("");
  const [classFilter, setClassFilter] = useState("");
  const searchRef = useRef(null);

  // Per-row busy (by studentId)
  const [busyIds, setBusyIds] = useState({});

  // Authorized-persons cache: Map<studentId, Person[]> — preloaded in background
  const [authCache, setAuthCache] = useState(new Map());

  // Checkout modal
  const [checkoutStu, setCheckoutStu] = useState(null);
  const [authPersons, setAuthPersons] = useState([]);
  const [authLoading, setAuthLoading] = useState(false);

  // Unknown-person sub-flow inside checkout modal
  const [unknownStep,     setUnknownStep]     = useState("select"); // select|camera|preview|sent
  const [capturedPhoto,   setCapturedPhoto]   = useState("");
  const [unknownName,     setUnknownName]     = useState("");
  const [unknownRelation, setUnknownRelation] = useState("Unknown");
  const [sending,         setSending]         = useState(false);

  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  // QR scanner
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResult,  setScanResult]  = useState(null);
  const [scanErr,     setScanErr]     = useState(null);
  const html5QrRef    = useRef(null);
  const processingRef = useRef(false);

  // Toast
  const [toast,    setToast]    = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
      stopQr();
    };
  }, []);

  // Auto-focus search on mount so receptionist can type immediately
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setDataError(null);
    try {
      const [stuRes, recRes] = await Promise.all([
        api.get("/students"),
        parentAttendanceService.getRecords({ date: todayIso() }),
      ]);
      if (!mountedRef.current) return;
      const raw    = Array.isArray(stuRes.data) ? stuRes.data : [];
      const active = raw.filter(s => (s.Status || s.status || "Active") === "Active");
      const recs   = Array.isArray(recRes) ? recRes
                   : (recRes.records || recRes.entries || recRes.data || []);
      setStudents(active);
      setRecords(recs);
    } catch {
      if (mountedRef.current) setDataError("Could not load data. Check your connection and retry.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Background preload of authorized persons ──────────────────────────────
  // Runs after the student list loads so the pickup modal opens instantly.
  useEffect(() => {
    if (students.length === 0) return;

    let cancelled = false;
    const CONCURRENCY = 4;
    const queue = [...students];
    let active = 0;

    function processNext() {
      while (active < CONCURRENCY && queue.length > 0) {
        const stu = queue.shift();
        const sid = stuId(stu);
        active++;
        pickupAuthorizationService.getPersons({ studentId: sid, status: "Active" })
          .then(res => {
            if (cancelled) return;
            const list = Array.isArray(res) ? res : (res.entries || res.data || []);
            setAuthCache(prev => {
              const next = new Map(prev);
              next.set(sid, list);
              return next;
            });
          })
          .catch(() => {})
          .finally(() => {
            if (!cancelled) { active--; processNext(); }
          });
      }
    }

    processNext();
    return () => { cancelled = true; };
  }, [students]);

  // ── Status derivation ────────────────────────────────────────────────────────
  const statusMap = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const sid = r.studentId;
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid).push(r);
    }
    return map;
  }, [records]);

  function getStatusDetail(sid) {
    const recs = statusMap.get(sid) || [];
    if (!recs.length) return { status: "NOT_ARRIVED", time: null, collector: null };
    const latest = recs.reduce((a, b) =>
      new Date(a.timestamp || a.createdAt || 0) >=
      new Date(b.timestamp || b.createdAt || 0) ? a : b
    );
    const time = latest.timestamp || latest.createdAt || null;
    if (latest.action === "Check_In") {
      return { status: "CHECKED_IN", time, collector: null };
    }
    return { status: "CHECKED_OUT", time, collector: latest.parentName || null };
  }

  function getStatus(sid) {
    return getStatusDetail(sid).status;
  }

  // ── Counts ──────────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    let notArrived = 0, present = 0, pickedUp = 0;
    for (const s of students) {
      const st = getStatus(stuId(s));
      if      (st === "NOT_ARRIVED") notArrived++;
      else if (st === "CHECKED_IN")  present++;
      else                           pickedUp++;
    }
    return { notArrived, present, pickedUp, total: students.length };
  }, [students, statusMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Classes ─────────────────────────────────────────────────────────────────
  const classes = useMemo(() => {
    const set = new Set(students.map(s => stuCls(s)).filter(c => c !== "—"));
    return Array.from(set).sort();
  }, [students]);

  // ── Filtered + sorted list ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const result = students.filter(s => {
      const n  = stuName(s).toLowerCase();
      const c  = stuCls(s).toLowerCase();
      const id = stuId(s).toLowerCase();
      return (!q || n.includes(q) || c.includes(q) || id.includes(q))
          && (!classFilter || stuCls(s) === classFilter);
    });
    return result.sort((a, b) => {
      const oa = STATUS_ORDER[getStatus(stuId(a))] ?? 99;
      const ob = STATUS_ORDER[getStatus(stuId(b))] ?? 99;
      if (oa !== ob) return oa - ob;
      return stuName(a).localeCompare(stuName(b));
    });
  }, [students, search, classFilter, statusMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toast ───────────────────────────────────────────────────────────────────
  function showToast(msg, type = "success") {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // ── Optimistic record push ───────────────────────────────────────────────────
  function pushRecord(sid, sname, action, extra = {}) {
    setRecords(prev => [...prev, {
      studentId:   sid,
      studentName: sname,
      action,
      timestamp:   new Date().toISOString(),
      ...extra,
    }]);
  }

  // ── Check In ────────────────────────────────────────────────────────────────
  async function handleCheckIn(stu) {
    const sid  = stuId(stu);
    const name = stuName(stu);
    setBusyIds(b => ({ ...b, [sid]: true }));
    try {
      await parentAttendanceService.create({
        studentId:    sid,
        studentName:  name,
        parentName:   user?.displayName || user?.name || "Staff",
        relation:     "Staff",
        action:       "Check_In",
        gate:         "",
        selfieImage:  "staff-checkin",
        faceDetected: true,
        gps:          "unavailable",
      });
      if (!mountedRef.current) return;
      pushRecord(sid, name, "Check_In");
      showToast(`${name} — arrived`);
    } catch {
      showToast("Check-in failed. Try again.", "error");
    } finally {
      if (mountedRef.current) {
        setBusyIds(b => ({ ...b, [sid]: false }));
        // Keep focus on search for rapid sequential morning arrivals
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    }
  }

  // ── Open checkout modal ─────────────────────────────────────────────────────
  async function openCheckout(stu) {
    setCheckoutStu(stu);
    setUnknownStep("select");
    setCapturedPhoto("");
    setUnknownName("");
    setUnknownRelation("Unknown");

    const sid    = stuId(stu);
    const cached = authCache.get(sid);

    if (cached !== undefined) {
      // Preloaded — open instantly, no spinner
      setAuthPersons(sortPersons(cached));
      setAuthLoading(false);
    } else {
      setAuthPersons([]);
      setAuthLoading(true);
      try {
        const res = await pickupAuthorizationService.getPersons({ studentId: sid, status: "Active" });
        if (!mountedRef.current) return;
        const list = Array.isArray(res) ? res : (res.entries || res.data || []);
        setAuthPersons(sortPersons(list));
      } catch {
        if (mountedRef.current) setAuthPersons([]);
      } finally {
        if (mountedRef.current) setAuthLoading(false);
      }
    }
  }

  function closeCheckout() {
    setCheckoutStu(null);
    setUnknownStep("select");
    setCapturedPhoto("");
    stopCamera();
  }

  // ── Checkout — authorized person ────────────────────────────────────────────
  async function handleCheckoutPerson(person) {
    const stu   = checkoutStu;
    const sid   = stuId(stu);
    const name  = stuName(stu);
    const staff = user?.displayName || user?.name || "Staff";
    const now   = new Date().toISOString();
    closeCheckout();
    setBusyIds(b => ({ ...b, [sid]: true }));
    try {
      await parentAttendanceService.create({
        studentId:    sid,
        studentName:  name,
        parentName:   person.pickupName,
        relation:     person.relation,
        action:       "Check_Out",
        gate:         "",
        selfieImage:  person.photoUrl || "staff-checkout",
        faceDetected: true,
        gps:          "unavailable",
      });
      await pickupHistoryService.addHistory({
        studentId:      sid,
        studentName:    name,
        pickupName:     person.pickupName,
        relation:       person.relation,
        selfieImage:    person.photoUrl || "",
        approvalStatus: "Authorized",
        verifiedBy:     staff,
        hasSelfie:      false,
        checkoutTime:   now,
        date:           todayIso(),
      });
      if (!mountedRef.current) return;
      // Include parentName so the row shows "Picked Up · [name] · [time]" immediately
      pushRecord(sid, name, "Check_Out", { parentName: person.pickupName });
      showToast(`${name} — picked up by ${person.pickupName}`);
    } catch {
      showToast("Checkout failed. Try again.", "error");
    } finally {
      if (mountedRef.current) setBusyIds(b => ({ ...b, [sid]: false }));
    }
  }

  // ── Unknown person — camera ─────────────────────────────────────────────────
  async function startCamera() {
    setUnknownStep("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 480, height: 360 },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      showToast("Camera access denied.", "error");
      setUnknownStep("select");
    }
  }

  // callback ref so srcObject is set as soon as the video element mounts
  const videoRefCb = useCallback((el) => {
    videoRef.current = el;
    if (el && streamRef.current) el.srcObject = streamRef.current;
  }, []);

  function capturePhoto() {
    if (!videoRef.current) return;
    setCapturedPhoto(snapVideo(videoRef.current));
    stopCamera();
    setUnknownStep("preview");
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  // ── Unknown person — send request ───────────────────────────────────────────
  async function sendPickupRequest() {
    if (!checkoutStu) return;
    const sid  = stuId(checkoutStu);
    const name = stuName(checkoutStu);
    setSending(true);
    try {
      await securityService.createPickupRequest({
        studentId:   sid,
        studentName: name,
        personName:  unknownName || "Unknown",
        personPhoto: capturedPhoto,
        relation:    unknownRelation,
        staffName:   user?.displayName || user?.name || "Staff",
        gate:        "",
      });
      if (!mountedRef.current) return;
      setUnknownStep("sent");
    } catch {
      showToast("Could not send request. Try again.", "error");
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }

  // ── QR Scanner ──────────────────────────────────────────────────────────────
  const onQrDecode = useCallback(async (text) => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      const res = await api.post("/api/attendance/qr-scan", { qrData: text });
      const { action, message, student } = res.data || {};
      if (!mountedRef.current) return;
      setScanResult({ action, message, student });
      if (student?.studentId) {
        if      (action === "check-in")  pushRecord(student.studentId, student.studentName || student.name || "", "Check_In");
        else if (action === "check-out") pushRecord(student.studentId, student.studentName || student.name || "", "Check_Out");
      }
    } catch {
      if (mountedRef.current) setScanResult({ action: "error", message: "Invalid QR code." });
    } finally {
      setTimeout(() => { processingRef.current = false; }, 2000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startQr() {
    setScanErr(null);
    try {
      const qr = new Html5Qrcode("cp-qr-viewport");
      html5QrRef.current = qr;
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onQrDecode,
        () => {}
      );
    } catch (e) {
      const m = e?.message || "";
      setScanErr(m.includes("permission") || m.includes("NotAllowed")
        ? "Camera permission denied. Allow camera access and try again."
        : `Camera error: ${m}`
      );
    }
  }

  async function stopQr() {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); } catch {}
      try { html5QrRef.current.clear(); }     catch {}
      html5QrRef.current = null;
    }
  }

  async function toggleScanner() {
    if (scannerOpen) {
      await stopQr();
      setScannerOpen(false);
      setScanResult(null);
    } else {
      setScannerOpen(true);
      setScanResult(null);
      setTimeout(startQr, 120);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes cp-in  { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        @keyframes cp-spn { to   { transform:rotate(360deg); } }
      `}</style>

      <div style={S.page}>

        {/* Header */}
        <div style={S.hdr}>
          <div>
            <h1 style={S.title}>Gate Register</h1>
            <p style={S.dateStr}>{todayLabel()}</p>
          </div>
          <button
            onClick={toggleScanner}
            style={{ ...S.btn, ...(scannerOpen ? S.btnWarm : S.btnPrimary) }}
          >
            <IcoQr /> {scannerOpen ? "Close Scanner" : "Scan Badge"}
          </button>
        </div>

        {/* QR Scanner panel */}
        {scannerOpen && (
          <div style={S.scanPanel}>
            <div style={S.scanInner}>
              <p style={S.scanHint}>Point camera at a student QR badge</p>
              <div id="cp-qr-viewport" style={S.scanViewport} />
              {scanErr && <p style={S.scanErrTxt}>{scanErr}</p>}
              {scanResult && (
                <div style={{
                  ...S.scanRes,
                  background:
                    scanResult.action === "check-in"  ? "#D1FAE5" :
                    scanResult.action === "check-out" ? "#FEE2E2" : "#F3F4F6",
                  color:
                    scanResult.action === "check-in"  ? "#065F46" :
                    scanResult.action === "check-out" ? "#991B1B" : "#374151",
                }}>
                  {scanResult.action === "check-in"     ? "✓ Arrived" :
                   scanResult.action === "check-out"    ? "✓ Picked Up" :
                   scanResult.action === "already-done" ? "Already recorded" : "⚠ Error"}
                  {scanResult.student && ` — ${scanResult.student.studentName || scanResult.student.name || ""}`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary bar */}
        <div style={S.sumBar}>
          <Chip label="Not Arrived" n={counts.notArrived} dot="#D97706" bg="#FEF3C7" text="#92400E" />
          <Chip label="Present"     n={counts.present}    dot="#10B981" bg="#D1FAE5" text="#065F46" />
          <Chip label="Picked Up"   n={counts.pickedUp}   dot="#9CA3AF" bg="#F3F4F6" text="#4B5563" />
          <Chip label="Total"       n={counts.total}      dot="#6B7280" bg="#FAFAFA" text="#111827" bold />
        </div>

        {/* Filters */}
        <div style={S.filters}>
          <input
            ref={searchRef}
            style={S.searchIn}
            placeholder="Search by name or class…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            style={S.classIn}
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Student list */}
        {loading ? (
          <div style={S.centered}>
            <Spin />
            <p style={S.muted}>Loading…</p>
          </div>
        ) : dataError ? (
          <div style={S.centered}>
            <p style={S.muted}>{dataError}</p>
            <button style={{ ...S.btn, ...S.btnGhost }} onClick={loadData}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={S.centered}>
            <p style={S.muted}>
              {search || classFilter ? "No students match your filter." : "No students found."}
            </p>
          </div>
        ) : (
          <div style={S.list}>
            {filtered.map(stu => {
              const sid    = stuId(stu);
              const detail = getStatusDetail(sid);
              return (
                <Row
                  key={sid}
                  name={stuName(stu)}
                  cls={stuCls(stu)}
                  detail={detail}
                  busy={!!busyIds[sid]}
                  onCheckIn={() => handleCheckIn(stu)}
                  onCheckOut={() => openCheckout(stu)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Checkout modal */}
      {checkoutStu && (
        <CheckoutModal
          student={checkoutStu}
          persons={authPersons}
          authLoading={authLoading}
          step={unknownStep}
          capturedPhoto={capturedPhoto}
          unknownName={unknownName}
          unknownRelation={unknownRelation}
          sending={sending}
          videoRefCb={videoRefCb}
          onSelectPerson={handleCheckoutPerson}
          onStartCamera={startCamera}
          onCapture={capturePhoto}
          onRetake={() => { setCapturedPhoto(""); startCamera(); }}
          onUnknownName={setUnknownName}
          onUnknownRelation={setUnknownRelation}
          onSend={sendPickupRequest}
          onClose={closeCheckout}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          ...S.toast,
          background:
            toast.type === "error" ? "#EF4444" :
            toast.type === "warn"  ? "#F59E0B" : "#10B981",
        }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}

// ── Chip (summary bar) ────────────────────────────────────────────────────────
function Chip({ label, n, dot, bg, text, bold }) {
  return (
    <div style={{ ...S.chip, background: bg }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      <span style={{ fontSize: 24, fontWeight: bold ? 900 : 700, color: text, lineHeight: 1 }}>{n}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: text, opacity: 0.75, marginTop: 1 }}>{label}</span>
    </div>
  );
}

// ── Student row ───────────────────────────────────────────────────────────────
function Row({ name, cls, detail, busy, onCheckIn, onCheckOut }) {
  const { status, time, collector } = detail;
  const cfg    = STATUS_CFG[status];
  const canIn  = status === "NOT_ARRIVED";
  const canOut = status === "CHECKED_IN";

  // Inline context: "Arrived 8:32 AM" or "Mom · 3:15 PM"
  let subText = null;
  if (status === "CHECKED_IN" && time) {
    subText = `Arrived ${fmtTime(time)}`;
  } else if (status === "CHECKED_OUT" && time) {
    const parts = [];
    if (collector && collector !== "Staff") parts.push(collector);
    parts.push(fmtTime(time));
    subText = parts.join(" · ");
  }

  return (
    <div style={S.row}>
      <div style={S.ava}><span style={S.avaText}>{initials(name)}</span></div>
      <div style={S.rowInfo}>
        <span style={S.rowName}>{name}</span>
        <span style={S.rowCls}>{cls}</span>
      </div>
      <div style={S.statusCol}>
        <div style={{ ...S.badge, background: cfg.bg, color: cfg.text }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
          {cfg.label}
        </div>
        {subText && <span style={S.subText}>{subText}</span>}
      </div>
      <div style={S.rowAct}>
        {busy ? (
          <span style={{ display: "flex", justifyContent: "center", width: 96 }}><Spin size={18} /></span>
        ) : canIn ? (
          <button style={{ ...S.actBtn, background: "#D1FAE5", color: "#065F46" }} onClick={onCheckIn}>
            Check In
          </button>
        ) : canOut ? (
          <button style={{ ...S.actBtn, background: "#FEE2E2", color: "#991B1B" }} onClick={onCheckOut}>
            Pick Up
          </button>
        ) : (
          <span style={{ color: "#D1D5DB", fontSize: 18, paddingRight: 8 }}>—</span>
        )}
      </div>
    </div>
  );
}

// ── Checkout modal ────────────────────────────────────────────────────────────
function CheckoutModal({
  student, persons, authLoading, step, capturedPhoto,
  unknownName, unknownRelation, sending, videoRefCb,
  onSelectPerson, onStartCamera, onCapture, onRetake,
  onUnknownName, onUnknownRelation, onSend, onClose,
}) {
  const name = stuName(student);
  return (
    <div style={S.overlay} onClick={step === "select" ? onClose : undefined}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>

        {step !== "sent" && (
          <button style={S.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        )}

        {/* ── select ── */}
        {step === "select" && (
          <>
            <h2 style={S.mTitle}>Who is collecting {name}?</h2>
            {authLoading ? (
              <div style={S.centered}><Spin /></div>
            ) : (
              <div style={S.pList}>
                {persons.length === 0 && (
                  <p style={{ ...S.muted, textAlign: "center", padding: "12px 0" }}>
                    No authorized persons on file.
                  </p>
                )}
                {persons.map(p => (
                  <button key={p.entryId || p.id} style={S.pRow} onClick={() => onSelectPerson(p)}>
                    {p.photoUrl
                      ? <img src={p.photoUrl} alt="" style={S.pPhoto} />
                      : <div style={S.pFallback}>{initials(p.pickupName)}</div>
                    }
                    <div style={S.pInfo}>
                      <span style={S.pName}>{p.pickupName}</span>
                      <span style={S.pRel}>{p.relation}</span>
                    </div>
                    {p.emergency && <span style={S.emerTag}>Emergency</span>}
                    <span style={S.chev}>›</span>
                  </button>
                ))}
                {/* Unknown person */}
                <button style={{ ...S.pRow, background: "#FFF7ED", borderColor: "#FED7AA" }} onClick={onStartCamera}>
                  <div style={{ ...S.pFallback, background: "#FED7AA", color: "#C2410C", fontSize: 20 }}>?</div>
                  <div style={S.pInfo}>
                    <span style={S.pName}>Unknown Person</span>
                    <span style={S.pRel}>Photograph &amp; send to parent for approval</span>
                  </div>
                  <span style={S.chev}>›</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* ── camera ── */}
        {step === "camera" && (
          <>
            <h2 style={S.mTitle}>Photograph the person</h2>
            <p style={S.mSub}>Point the rear camera at the person&rsquo;s face</p>
            <div style={S.videoBox}>
              <video ref={videoRefCb} autoPlay playsInline muted style={S.video} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button style={{ ...S.btn, ...S.btnGhost, flex: 1 }} onClick={onClose}>Cancel</button>
              <button style={{ ...S.btn, ...S.btnDark, flex: 2 }} onClick={onCapture}>
                Capture Photo
              </button>
            </div>
          </>
        )}

        {/* ── preview ── */}
        {step === "preview" && (
          <>
            <h2 style={S.mTitle}>Confirm &amp; send</h2>
            <img src={capturedPhoto} alt="captured" style={S.capImg} />
            <label style={S.label}>Name (optional)</label>
            <input
              style={S.inp}
              value={unknownName}
              onChange={e => onUnknownName(e.target.value)}
              placeholder="Person's name"
            />
            <label style={S.label}>Relation</label>
            <select style={S.inp} value={unknownRelation} onChange={e => onUnknownRelation(e.target.value)}>
              {RELATION_OPTS.map(r => <option key={r}>{r}</option>)}
            </select>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...S.btn, ...S.btnGhost, flex: 1 }} onClick={onRetake}>Retake</button>
              <button
                style={{ ...S.btn, ...S.btnDark, flex: 2, opacity: sending ? 0.6 : 1 }}
                onClick={onSend}
                disabled={sending}
              >
                {sending ? "Sending…" : "Send to Parent for Approval"}
              </button>
            </div>
          </>
        )}

        {/* ── sent ── */}
        {step === "sent" && (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>📲</div>
            <h2 style={S.mTitle}>Request Sent</h2>
            <p style={{ ...S.mSub, maxWidth: 320, margin: "8px auto 0" }}>
              The parent has been notified with a photo of the person.
              The child remains checked in until the parent approves.
            </p>
            <button style={{ ...S.btn, ...S.btnDark, width: "100%", marginTop: 16 }} onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function IcoQr() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ marginRight: 6, flexShrink: 0 }}>
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <line x1="14" y1="14" x2="14.01" y2="14"/><line x1="18" y1="14" x2="18.01" y2="14"/>
      <line x1="14" y1="18" x2="14" y2="21"/><line x1="21" y1="18" x2="21" y2="21"/>
    </svg>
  );
}

function Spin({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      style={{ animation: "cp-spn 0.8s linear infinite", flexShrink: 0 }}>
      <circle cx="16" cy="16" r="12" stroke="#E5E7EB" strokeWidth="3"/>
      <path d="M16 4a12 12 0 0 1 12 12" stroke="#F4C400" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    padding: "24px 20px 56px", maxWidth: 900, margin: "0 auto",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    animation: `cp-in 0.3s ${SPRING} both`,
  },

  hdr:     { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  title:   { fontSize: 26, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.5px" },
  dateStr: { fontSize: 13, color: "#9CA3AF", margin: "4px 0 0" },

  // Summary
  sumBar: { display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  chip:   { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, padding: "12px 16px", borderRadius: 12, flex: "1 1 90px", minWidth: 80 },

  // Filters
  filters:  { display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" },
  searchIn: { flex: "1 1 200px", padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, color: "#111827", outline: "none", background: "#FAFAFA", boxSizing: "border-box" },
  classIn:  { padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, color: "#374151", outline: "none", background: "#FAFAFA", cursor: "pointer" },

  // List
  list:     { display: "flex", flexDirection: "column", gap: 3 },
  row:      { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "#FFFFFF", border: "1px solid #F3F4F6", borderRadius: 12 },
  ava:      { width: 38, height: 38, borderRadius: 10, background: "#FEF9C3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avaText:  { fontSize: 12, fontWeight: 800, color: "#92400E" },
  rowInfo:  { flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 },
  rowName:  { fontSize: 14, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  rowCls:   { fontSize: 12, color: "#9CA3AF" },
  statusCol:{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start", flexShrink: 0 },
  badge:    { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" },
  subText:  { fontSize: 11, color: "#9CA3AF", whiteSpace: "nowrap", paddingLeft: 2 },
  rowAct:   { flexShrink: 0, minWidth: 96, display: "flex", justifyContent: "flex-end" },
  actBtn:   { padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", whiteSpace: "nowrap" },

  // Buttons
  btn:        { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", userSelect: "none" },
  btnGhost:   { background: "#F3F4F6", color: "#374151", border: "1.5px solid #E5E7EB" },
  btnWarm:    { background: "#FEF3C7", color: "#92400E", border: "1.5px solid #FDE68A" },
  btnDark:    { background: "#111827", color: "#FFFFFF" },
  btnPrimary: { background: "#F4C400", color: "#111827", border: "none" },

  // Scanner
  scanPanel:   { background: "#111827", borderRadius: 16, marginBottom: 16, overflow: "hidden", animation: `cp-in 0.25s ${SPRING} both` },
  scanInner:   { padding: "18px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  scanHint:    { color: "#6B7280", fontSize: 12 },
  scanViewport:{ width: "100%", maxWidth: 320, minHeight: 200, borderRadius: 10, overflow: "hidden" },
  scanRes:     { padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, width: "100%", maxWidth: 320, boxSizing: "border-box" },
  scanErrTxt:  { color: "#FCA5A5", fontSize: 13 },

  // Modal
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal:   { background: "#FFFFFF", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 14, maxHeight: "88vh", overflowY: "auto", position: "relative", animation: `cp-in 0.25s ${SPRING} both` },
  closeBtn:{ position: "absolute", top: 16, right: 16, background: "#F3F4F6", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 14, color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center" },
  mTitle:  { fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 },
  mSub:    { fontSize: 13, color: "#6B7280", margin: 0, lineHeight: 1.55 },

  // Person list — 80×80 photos for face-matching at the gate
  pList:    { display: "flex", flexDirection: "column", gap: 8 },
  pRow:     { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: 12, cursor: "pointer", width: "100%", textAlign: "left" },
  pPhoto:   { width: 80, height: 80, borderRadius: 10, objectFit: "cover", flexShrink: 0 },
  pFallback:{ width: 80, height: 80, borderRadius: 10, background: "#FEF9C3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: "#92400E", flexShrink: 0 },
  pInfo:    { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  pName:    { fontSize: 14, fontWeight: 700, color: "#111827" },
  pRel:     { fontSize: 12, color: "#9CA3AF" },
  emerTag:  { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#FEF3C7", color: "#92400E" },
  chev:     { fontSize: 22, color: "#D1D5DB", flexShrink: 0, lineHeight: 1 },

  // Camera / capture
  videoBox: { width: "100%", background: "#000", borderRadius: 12, overflow: "hidden", minHeight: 220 },
  video:    { width: "100%", display: "block" },
  capImg:   { width: "100%", borderRadius: 12, display: "block", maxHeight: 240, objectFit: "cover" },
  label:    { fontSize: 12, fontWeight: 700, color: "#374151" },
  inp:      { width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, color: "#111827", outline: "none", background: "#FAFAFA", boxSizing: "border-box" },

  // States
  centered: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 0" },
  muted:    { fontSize: 13, color: "#9CA3AF", margin: 0, textAlign: "center" },

  // Toast
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", padding: "10px 22px", borderRadius: 30, color: "#FFFFFF", fontSize: 14, fontWeight: 600, zIndex: 2000, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", whiteSpace: "nowrap", animation: `cp-in 0.2s ${SPRING} both` },
};
