/**
 * ChildPresence.jsx — Gate Register / Reception & Security Dashboard
 * Route:   /child-presence  (routeKey: "attendance")
 *
 * Premium reception dashboard: live status cards, activity timeline,
 * student presence cards with ⋮ menus, Speed Dial FAB, and filter chips.
 *
 * All business logic (check-in, check-out, QR scan, pickup approval flow)
 * is identical to the original implementation — only the rendering layer changed.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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

const FILTER_TABS = [
  { key: "ALL",              label: "All"             },
  { key: "CHECKED_IN",       label: "Present"         },
  { key: "NOT_ARRIVED",      label: "Not Arrived"     },
  { key: "CHECKED_OUT",      label: "Picked Up"       },
  { key: "PENDING_APPROVAL", label: "Pending Approval"},
];

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
  return new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}
function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}
function snapVideo(video, w = 480, h = 360) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(video, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.75);
}

function stuId(s)     { return s.Student_ID  || s.id          || ""; }
function stuName(s)   { return s.Student_Name || s.name        || "—"; }
function stuCls(s)    { return s.Class        || s.class       || "—"; }
function stuPhoto(s)  { return s.Photo        || s.photoUrl    || s.photo || ""; }
function stuPhone(s)  { return s.Phone        || s.phone       || s.Parent_Phone || s.Mobile || ""; }
function stuParent(s) { return s.Parent_Name  || s.parentName  || s.Father_Name  || s.Mother_Name || ""; }
function stuAdmNo(s)  { return s.Admission_No || s.admissionNo || stuId(s); }

// Sort by relation priority; emergency contacts go last
function sortPersons(persons) {
  return [...persons].sort((a, b) => {
    if (a.emergency !== b.emergency) return a.emergency ? 1 : -1;
    const pa = RELATION_PRIORITY[a.relation] ?? 5;
    const pb = RELATION_PRIORITY[b.relation] ?? 5;
    if (pa !== pb) return pa - pb;
    return (a.pickupName || "").localeCompare(b.pickupName || "");
  });
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChildPresence() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const mountedRef = useRef(true);

  // ── Core data ──────────────────────────────────────────────────────────────
  const [students,         setStudents]         = useState([]);
  const [records,          setRecords]          = useState([]);   // today's parentAttendance records
  const [approvedRequests, setApprovedRequests] = useState([]);   // pickup requests: approved by parent
  const [pendingRequests,  setPendingRequests]  = useState([]);   // pickup requests: awaiting parent
  const [loading,          setLoading]          = useState(true);
  const [dataError,        setDataError]        = useState(null);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState("");
  const [classFilter,  setClassFilter]  = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const searchRef = useRef(null);

  // ── Per-row busy indicator (by studentId) ──────────────────────────────────
  const [busyIds, setBusyIds] = useState({});

  // ── Authorized-persons cache: Map<studentId, Person[]> ────────────────────
  const [authCache, setAuthCache] = useState(new Map());

  // ── Checkout modal state ───────────────────────────────────────────────────
  const [checkoutStu,      setCheckoutStu]      = useState(null);
  const [authPersons,      setAuthPersons]      = useState([]);
  const [authLoading,      setAuthLoading]      = useState(false);
  const [unknownStep,      setUnknownStep]      = useState("select"); // select|camera|preview|sent|approved|rejected
  const [capturedPhoto,    setCapturedPhoto]    = useState("");
  const [unknownName,      setUnknownName]      = useState("");
  const [unknownRelation,  setUnknownRelation]  = useState("Unknown");
  const [sending,          setSending]          = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState(null);

  const videoRef        = useRef(null);
  const streamRef       = useRef(null);
  const approvalPollRef = useRef(null);

  // ── QR scanner ────────────────────────────────────────────────────────────
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResult,  setScanResult]  = useState(null);
  const [scanErr,     setScanErr]     = useState(null);
  const html5QrRef    = useRef(null);
  const processingRef = useRef(false);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast,    setToast]    = useState(null);
  const toastTimer = useRef(null);

  // ── UI extras (new) ───────────────────────────────────────────────────────
  const [moreMenuId, setMoreMenuId] = useState(null);  // studentId of open ⋮ menu
  const [fabOpen,    setFabOpen]    = useState(false);
  const [feedOpen,   setFeedOpen]   = useState(false); // activity timeline collapsed by default

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
      stopQr();
    };
  }, []);

  // Auto-focus search on mount for rapid sequential morning arrivals
  useEffect(() => { searchRef.current?.focus(); }, []);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setDataError(null);
    try {
      const [stuRes, recRes, reqRes, pendRes] = await Promise.all([
        api.get("/students"),
        parentAttendanceService.getRecords({ date: todayIso() }),
        securityService.getPickupRequests({ status: "approved" }).catch(() => ({ requests: [] })),
        securityService.getPickupRequests({ status: "pending"  }).catch(() => ({ requests: [] })),
      ]);
      if (!mountedRef.current) return;
      const raw    = Array.isArray(stuRes.data) ? stuRes.data : [];
      const active = raw.filter(s => (s.Status || s.status || "Active") === "Active");
      const recs   = Array.isArray(recRes) ? recRes
                   : (recRes.records || recRes.entries || recRes.data || []);
      setStudents(active);
      setRecords(recs);
      setApprovedRequests(reqRes.requests || []);
      setPendingRequests(pendRes.requests || []);
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

  // ── Background preload of authorized persons (opens pickup modal instantly) ─
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
            setAuthCache(prev => { const next = new Map(prev); next.set(sid, list); return next; });
          })
          .catch(() => {})
          .finally(() => { if (!cancelled) { active--; processNext(); } });
      }
    }
    processNext();
    return () => { cancelled = true; };
  }, [students]);

  // ── Status derivation ─────────────────────────────────────────────────────
  const statusMap = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const sid = r.studentId;
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid).push(r);
    }
    return map;
  }, [records]);

  // Map<studentId, approved request>
  const approvedMap = useMemo(() => {
    const map = new Map();
    for (const r of approvedRequests) { if (r.studentId) map.set(r.studentId, r); }
    return map;
  }, [approvedRequests]);

  // Map<studentId, pending request>
  const pendingMap = useMemo(() => {
    const map = new Map();
    for (const r of pendingRequests) { if (r.studentId) map.set(r.studentId, r); }
    return map;
  }, [pendingRequests]);

  function getStatusDetail(sid) {
    const recs = statusMap.get(sid) || [];
    if (!recs.length) return { status: "NOT_ARRIVED", time: null, collector: null };
    const latest = recs.reduce((a, b) =>
      new Date(a.timestamp || a.createdAt || 0) >= new Date(b.timestamp || b.createdAt || 0) ? a : b
    );
    const time = latest.timestamp || latest.createdAt || null;
    if (latest.action === "Check_In") return { status: "CHECKED_IN",  time, collector: null };
    return { status: "CHECKED_OUT", time, collector: latest.parentName || null };
  }

  function getStatus(sid) { return getStatusDetail(sid).status; }

  // ── Counts ────────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    let notArrived = 0, present = 0, pickedUp = 0, pendingApproval = 0;
    for (const s of students) {
      const sid = stuId(s);
      const st  = getStatus(sid);
      if      (st === "NOT_ARRIVED") notArrived++;
      else if (st === "CHECKED_IN")  present++;
      else                           pickedUp++;
      if (approvedMap.has(sid) || pendingMap.has(sid)) pendingApproval++;
    }
    return { notArrived, present, pickedUp, pendingApproval, total: students.length };
  }, [students, statusMap, approvedMap, pendingMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Classes ───────────────────────────────────────────────────────────────
  const classes = useMemo(() => {
    const set = new Set(students.map(s => stuCls(s)).filter(c => c !== "—"));
    return Array.from(set).sort();
  }, [students]);

  // ── Activity feed (derived from today's records, newest first) ────────────
  const activityFeed = useMemo(() => {
    return [...records]
      .sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0))
      .slice(0, 20)
      .map(r => ({
        time:   r.timestamp || r.createdAt || "",
        name:   r.studentName || "Unknown",
        action: r.action === "Check_In"
          ? "checked in"
          : `checked out${r.parentName && r.parentName !== "Staff" ? ` · ${r.parentName}` : ""}`,
        isIn:   r.action === "Check_In",
      }));
  }, [records]);

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const result = students.filter(s => {
      const sid = stuId(s);
      // Status tab filter
      if (statusFilter === "CHECKED_IN"      && getStatus(sid) !== "CHECKED_IN")  return false;
      if (statusFilter === "NOT_ARRIVED"      && getStatus(sid) !== "NOT_ARRIVED") return false;
      if (statusFilter === "CHECKED_OUT"      && getStatus(sid) !== "CHECKED_OUT") return false;
      if (statusFilter === "PENDING_APPROVAL" && !approvedMap.has(sid) && !pendingMap.has(sid)) return false;
      // Class filter
      if (classFilter && stuCls(s) !== classFilter) return false;
      // Search: name, class, ID, parent name, phone, admission number
      if (!q) return true;
      return (
        stuName(s).toLowerCase().includes(q)  ||
        stuCls(s).toLowerCase().includes(q)   ||
        stuId(s).toLowerCase().includes(q)    ||
        stuParent(s).toLowerCase().includes(q)||
        stuPhone(s).toLowerCase().includes(q) ||
        stuAdmNo(s).toLowerCase().includes(q)
      );
    });
    return result.sort((a, b) => {
      const oa = STATUS_ORDER[getStatus(stuId(a))] ?? 99;
      const ob = STATUS_ORDER[getStatus(stuId(b))] ?? 99;
      if (oa !== ob) return oa - ob;
      return stuName(a).localeCompare(stuName(b));
    });
  }, [students, search, classFilter, statusFilter, statusMap, approvedMap, pendingMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg, type = "success") {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // ── Optimistic record push ─────────────────────────────────────────────────
  function pushRecord(sid, sname, action, extra = {}) {
    setRecords(prev => [...prev, {
      studentId: sid, studentName: sname, action,
      timestamp: new Date().toISOString(), ...extra,
    }]);
  }

  // ── Check In ──────────────────────────────────────────────────────────────
  async function handleCheckIn(stu) {
    const sid  = stuId(stu);
    const name = stuName(stu);
    setBusyIds(b => ({ ...b, [sid]: true }));
    try {
      await parentAttendanceService.create({
        studentId: sid, studentName: name,
        parentName: user?.displayName || user?.name || "Staff",
        relation: "Staff", action: "Check_In",
        gate: "", selfieImage: "staff-checkin", faceDetected: true, gps: "unavailable",
      });
      if (!mountedRef.current) return;
      pushRecord(sid, name, "Check_In");
      showToast(`${name} — arrived`);
    } catch {
      showToast("Check-in failed. Try again.", "error");
    } finally {
      if (mountedRef.current) {
        setBusyIds(b => ({ ...b, [sid]: false }));
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    }
  }

  // ── Open checkout modal ────────────────────────────────────────────────────
  async function openCheckout(stu) {
    setCheckoutStu(stu);
    setUnknownStep("select");
    setCapturedPhoto(""); setUnknownName(""); setUnknownRelation("Unknown");
    const sid    = stuId(stu);
    const cached = authCache.get(sid);
    if (cached !== undefined) {
      setAuthPersons(sortPersons(cached));
      setAuthLoading(false);
    } else {
      setAuthPersons([]); setAuthLoading(true);
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
    setCheckoutStu(null); setUnknownStep("select");
    setCapturedPhoto(""); setPendingRequestId(null); stopCamera();
  }

  // ── Checkout — authorized person ───────────────────────────────────────────
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
        studentId: sid, studentName: name,
        parentName: person.pickupName, relation: person.relation,
        action: "Check_Out", gate: "",
        selfieImage: person.photoUrl || "staff-checkout", faceDetected: true, gps: "unavailable",
      });
      await pickupHistoryService.addHistory({
        studentId: sid, studentName: name,
        pickupName: person.pickupName, relation: person.relation,
        selfieImage: person.photoUrl || "", approvalStatus: "Authorized",
        verifiedBy: staff, hasSelfie: false, checkoutTime: now, date: todayIso(),
      });
      if (!mountedRef.current) return;
      pushRecord(sid, name, "Check_Out", { parentName: person.pickupName });
      showToast(`${name} — picked up by ${person.pickupName}`);
    } catch {
      showToast("Checkout failed. Try again.", "error");
    } finally {
      if (mountedRef.current) setBusyIds(b => ({ ...b, [sid]: false }));
    }
  }

  // ── Unknown person — camera ────────────────────────────────────────────────
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

  const videoRefCb = useCallback((el) => {
    videoRef.current = el;
    if (el && streamRef.current) el.srcObject = streamRef.current;
  }, []);

  function capturePhoto() {
    if (!videoRef.current) return;
    setCapturedPhoto(snapVideo(videoRef.current));
    stopCamera(); setUnknownStep("preview");
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  // ── Unknown person — send pickup request ──────────────────────────────────
  async function sendPickupRequest() {
    if (!checkoutStu) return;
    const sid  = stuId(checkoutStu);
    const name = stuName(checkoutStu);
    setSending(true);
    try {
      const res = await securityService.createPickupRequest({
        studentId: sid, studentName: name,
        personName: unknownName || "Unknown",
        personPhoto: capturedPhoto, relation: unknownRelation,
        staffName: user?.displayName || user?.name || "Staff", gate: "",
      });
      if (!mountedRef.current) return;
      setPendingRequestId(res?.request?.requestId || res?.requestId || null);
      setUnknownStep("sent");
    } catch {
      showToast("Could not send request. Try again.", "error");
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }

  // ── Poll for parent approval while step === "sent" ─────────────────────────
  useEffect(() => {
    if (unknownStep !== "sent" || !pendingRequestId || !checkoutStu) return;
    const sid = stuId(checkoutStu);
    async function poll() {
      try {
        const res = await securityService.getPickupRequests({ studentId: sid });
        if (!mountedRef.current) return;
        const req = (res.requests || []).find(r => (r.requestId || r.id) === pendingRequestId);
        if (!req) return;
        if (req.status === "approved") setUnknownStep("approved");
        if (req.status === "rejected") setUnknownStep("rejected");
      } catch { /* keep polling */ }
    }
    const id = setInterval(poll, 4000);
    approvalPollRef.current = id;
    return () => clearInterval(id);
  }, [unknownStep, pendingRequestId, checkoutStu]);

  // ── Release after parent approval (via modal) ──────────────────────────────
  async function handleReleaseApproved() {
    const stu    = checkoutStu;
    const sid    = stuId(stu);
    const name   = stuName(stu);
    const staff  = user?.displayName || user?.name || "Staff";
    const now    = new Date().toISOString();
    const pName  = unknownName || "Unknown";
    const pRel   = unknownRelation;
    const pPhoto = capturedPhoto;
    const pReqId = pendingRequestId;
    setSending(true);
    try {
      await parentAttendanceService.create({
        studentId: sid, studentName: name, parentName: pName, relation: pRel,
        action: "Check_Out", gate: "", selfieImage: pPhoto || "staff-checkout",
        faceDetected: true, gps: "unavailable",
      });
      await pickupHistoryService.addHistory({
        studentId: sid, studentName: name, pickupName: pName, relation: pRel,
        selfieImage: pPhoto || "", approvalStatus: "Parent_Approved",
        verifiedBy: staff, hasSelfie: !!pPhoto, checkoutTime: now, date: todayIso(),
      });
      if (!mountedRef.current) return;
      if (pReqId) setApprovedRequests(prev => prev.filter(r => (r.requestId || r.id) !== pReqId));
      closeCheckout();
      pushRecord(sid, name, "Check_Out", { parentName: pName });
      showToast(`${name} — released (parent approved)`);
    } catch {
      showToast("Checkout failed. Try again.", "error");
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }

  // ── Row-level release for pre-approved requests (no modal needed) ──────────
  async function handleReleaseFromRow(stu, request) {
    const sid   = stuId(stu);
    const name  = stuName(stu);
    const staff = user?.displayName || user?.name || "Staff";
    const now   = new Date().toISOString();
    setBusyIds(b => ({ ...b, [sid]: true }));
    try {
      await parentAttendanceService.create({
        studentId: sid, studentName: name,
        parentName: request.personName || "Unknown", relation: request.relation || "Unknown",
        action: "Check_Out", gate: "", selfieImage: request.personPhoto || "parent-approved",
        faceDetected: true, gps: "unavailable",
      });
      await pickupHistoryService.addHistory({
        studentId: sid, studentName: name,
        pickupName: request.personName || "Unknown", relation: request.relation || "Unknown",
        selfieImage: request.personPhoto || "", approvalStatus: "Parent_Approved",
        verifiedBy: staff, hasSelfie: !!(request.personPhoto), checkoutTime: now, date: todayIso(),
      });
      if (!mountedRef.current) return;
      setApprovedRequests(prev => prev.filter(r => (r.requestId || r.id) !== (request.requestId || request.id)));
      pushRecord(sid, name, "Check_Out", { parentName: request.personName || "Unknown" });
      showToast(`${name} — released (parent approved)`);
    } catch {
      showToast("Checkout failed. Try again.", "error");
    } finally {
      if (mountedRef.current) setBusyIds(b => ({ ...b, [sid]: false }));
    }
  }

  // ── QR Scanner ────────────────────────────────────────────────────────────
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
        onQrDecode, () => {}
      );
    } catch (e) {
      const m = e?.message || "";
      setScanErr(m.includes("permission") || m.includes("NotAllowed")
        ? "Camera permission denied. Allow camera access and try again."
        : `Camera error: ${m}`);
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
      await stopQr(); setScannerOpen(false); setScanResult(null);
    } else {
      setScannerOpen(true); setScanResult(null); setTimeout(startQr, 120);
    }
  }

  // ── ⋮ menu actions ────────────────────────────────────────────────────────
  function handleMoreAction(stu, action) {
    setMoreMenuId(null);
    const sid = stuId(stu);
    if      (action === "view")     navigate(`/student-profile/${sid}`);
    else if (action === "attHist")  navigate(`/attendance?studentId=${sid}`);
    else if (action === "pickHist") navigate(`/pickup-history?studentId=${sid}`);
    else if (action === "emergency" || action === "checkout") openCheckout(stu);
  }

  // Close ⋮ menus and FAB when anything else is clicked
  function handlePageClick() {
    if (moreMenuId) setMoreMenuId(null);
    if (fabOpen)    setFabOpen(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes cp-in  { from { opacity:0; transform:translateY(6px); }   to { opacity:1; transform:translateY(0); } }
        @keyframes cp-spn { to   { transform:rotate(360deg); } }
        @keyframes cp-pop { from { opacity:0; transform:scale(0.92) translateY(4px); } to { opacity:1; transform:scale(1) translateY(0); } }

        .cp-card     { transition:box-shadow 0.15s, transform 0.15s; }
        .cp-card:hover { box-shadow:0 4px 20px rgba(0,0,0,0.09) !important; transform:translateY(-1px); }
        .cp-actbtn:hover { opacity:0.85 !important; }
        .cp-prow:hover   { background:#F1F5F9 !important; }
        .cp-morebtn:hover { background:#F3F4F6 !important; }

        /* Responsive card grid: 1 col → 2 col → 3 col → 4 col */
        @media (min-width:600px)  { .cp-grid { grid-template-columns:repeat(2,1fr) !important; } }
        @media (min-width:900px)  { .cp-grid { grid-template-columns:repeat(3,1fr) !important; } }
        @media (min-width:1200px) { .cp-grid { grid-template-columns:repeat(4,1fr) !important; } }

        /* Dashboard scrolls horizontally on narrow screens */
        @media (max-width:599px) {
          .cp-dash { flex-wrap:nowrap !important; overflow-x:auto; padding-bottom:6px; -webkit-overflow-scrolling:touch; }
          .cp-dash > * { flex-shrink:0; }
        }
        /* Filter chips scroll on mobile */
        @media (max-width:599px) {
          .cp-chips { flex-wrap:nowrap !important; overflow-x:auto; padding-bottom:4px; }
        }
      `}</style>

      <div style={S.page} onClick={handlePageClick}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={S.hdr}>
          <div>
            <h1 style={S.title}>Gate Register</h1>
            <p style={S.dateStr}>{todayLabel()}</p>
          </div>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={loadData}>
            <IcoRefresh /> Refresh
          </button>
        </div>

        {/* ── QR Scanner panel ─────────────────────────────────────────────── */}
        {scannerOpen && (
          <div style={S.scanPanel}>
            <div style={S.scanInner}>
              <p style={S.scanHint}>Point camera at a student QR badge</p>
              <div id="cp-qr-viewport" style={S.scanViewport} />
              {scanErr && <p style={S.scanErrTxt}>{scanErr}</p>}
              {scanResult && (
                <div style={{
                  ...S.scanRes,
                  background: scanResult.action === "check-in"  ? "#D1FAE5"
                            : scanResult.action === "check-out" ? "#FEE2E2" : "#F3F4F6",
                  color: scanResult.action === "check-in"  ? "#065F46"
                       : scanResult.action === "check-out" ? "#991B1B" : "#374151",
                }}>
                  {scanResult.action === "check-in"     ? "✓ Arrived"
                 : scanResult.action === "check-out"    ? "✓ Picked Up"
                 : scanResult.action === "already-done" ? "Already recorded" : "⚠ Error"}
                  {scanResult.student && ` — ${scanResult.student.studentName || scanResult.student.name || ""}`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Live Dashboard ───────────────────────────────────────────────── */}
        <div className="cp-dash" style={S.dash}>
          <DashCard icon="🟢" label="Present"          n={counts.present}        color="#065F46" bg="#D1FAE5" />
          <DashCard icon="🟡" label="Not Arrived"      n={counts.notArrived}     color="#92400E" bg="#FEF3C7" />
          <DashCard icon="🔵" label="Picked Up"        n={counts.pickedUp}       color="#374151" bg="#F3F4F6" />
          <DashCard
            icon="⏳" label="Pending Approval"
            n={counts.pendingApproval}
            color="#5B21B6" bg="#EDE9FE"
            pulse={counts.pendingApproval > 0}
          />
          <DashCard icon="👤" label="Total Students"  n={counts.total}           color="#1E3A5F" bg="#E0F2FE" />
        </div>

        {/* ── Activity Timeline ────────────────────────────────────────────── */}
        {activityFeed.length > 0 && (
          <div style={S.timeline}>
            <button
              style={S.tlToggle}
              onClick={e => { e.stopPropagation(); setFeedOpen(v => !v); }}
            >
              <IcoActivity size={15} />
              <span style={{ flex: 1, textAlign: "left" }}>Activity Feed</span>
              {!feedOpen && activityFeed[0] && (
                <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>
                  {fmtTime(activityFeed[0].time)} · {activityFeed[0].name} {activityFeed[0].action}
                </span>
              )}
              <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 8, flexShrink: 0 }}>
                {feedOpen ? "▲" : "▼"}
              </span>
            </button>
            {feedOpen && (
              <div style={S.tlBody}>
                {activityFeed.map((ev, i) => (
                  <div key={i} style={S.tlRow}>
                    <div style={{ ...S.tlLine, background: i === activityFeed.length - 1 ? "transparent" : "#E5E7EB" }} />
                    <div style={{ ...S.tlDot, background: ev.isIn ? "#10B981" : "#9CA3AF" }} />
                    <span style={S.tlTime}>{fmtTime(ev.time)}</span>
                    <span style={S.tlText}>
                      <strong style={{ color: "#111827" }}>{ev.name}</strong>{" "}
                      <span style={{ color: "#6B7280" }}>{ev.action}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Filter chips ─────────────────────────────────────────────────── */}
        <div className="cp-chips" style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
          {FILTER_TABS.map(tab => {
            const count = tab.key === "CHECKED_IN"       ? counts.present
                        : tab.key === "NOT_ARRIVED"       ? counts.notArrived
                        : tab.key === "CHECKED_OUT"       ? counts.pickedUp
                        : tab.key === "PENDING_APPROVAL"  ? counts.pendingApproval
                        : null;
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={e => { e.stopPropagation(); setStatusFilter(tab.key); }}
                style={{
                  ...S.chipBtn,
                  ...(active ? S.chipBtnActive : {}),
                  ...(tab.key === "PENDING_APPROVAL" && counts.pendingApproval > 0 && !active
                    ? { borderColor: "#A78BFA", color: "#5B21B6" } : {}),
                }}
              >
                {tab.label}
                {count !== null && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, borderRadius: 20,
                    padding: "0 6px", lineHeight: "18px",
                    background: active ? "rgba(255,255,255,0.25)" : "#E5E7EB",
                    color:      active ? "#FFFFFF" : "#374151",
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Search row ───────────────────────────────────────────────────── */}
        <div style={S.filters}>
          <input
            ref={searchRef}
            style={S.searchIn}
            placeholder="Search by name, class, ID, parent or phone…"
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

        {/* Result count line */}
        {!loading && !dataError && (
          <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12, marginTop: -4 }}>
            {filtered.length === students.length
              ? `${students.length} students`
              : `${filtered.length} of ${students.length} students`}
          </p>
        )}

        {/* ── Student cards ─────────────────────────────────────────────────── */}
        {loading ? (
          <div style={S.centered}><Spin /><p style={S.muted}>Loading…</p></div>
        ) : dataError ? (
          <div style={S.centered}>
            <p style={S.muted}>{dataError}</p>
            <button style={{ ...S.btn, ...S.btnGhost }} onClick={loadData}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={S.centered}>
            <p style={S.muted}>
              {search || classFilter || statusFilter !== "ALL"
                ? "No students match your filter." : "No students found."}
            </p>
          </div>
        ) : (
          <div className="cp-grid" style={S.grid}>
            {filtered.map(stu => {
              const sid      = stuId(stu);
              const detail   = getStatusDetail(sid);
              const approved = approvedMap.get(sid) || null;
              const pending  = pendingMap.get(sid)  || null;
              return (
                <StudentCard
                  key={sid}
                  stu={stu}
                  detail={detail}
                  busy={!!busyIds[sid]}
                  approvedRequest={approved}
                  pendingRequest={pending}
                  moreOpen={moreMenuId === sid}
                  onCheckIn={e => { e.stopPropagation(); handleCheckIn(stu); }}
                  onCheckOut={e => { e.stopPropagation(); openCheckout(stu); }}
                  onRelease={e => { e.stopPropagation(); handleReleaseFromRow(stu, approved); }}
                  onMoreToggle={e => { e.stopPropagation(); setMoreMenuId(moreMenuId === sid ? null : sid); }}
                  onMoreAction={action => handleMoreAction(stu, action)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Checkout modal (logic unchanged) ─────────────────────────────── */}
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
          onRelease={handleReleaseApproved}
          capturedPhotoUrl={capturedPhoto}
          onClose={closeCheckout}
        />
      )}

      {/* ── Speed Dial FAB ────────────────────────────────────────────────── */}
      <SpeedDialFAB
        open={fabOpen}
        onToggle={e => { e.stopPropagation(); setFabOpen(v => !v); }}
        onScanBadge={() => { setFabOpen(false); toggleScanner(); }}
        onManualCheckIn={() => {
          setFabOpen(false);
          setStatusFilter("NOT_ARRIVED");
          setTimeout(() => searchRef.current?.focus(), 80);
        }}
        onVisitorEntry={() => { setFabOpen(false); showToast("Visitor log coming soon", "warn"); }}
        onEmergencyPickup={() => { setFabOpen(false); showToast("Select a student card to initiate emergency pickup", "warn"); }}
      />

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          ...S.toast,
          background: toast.type === "error" ? "#EF4444"
                    : toast.type === "warn"  ? "#F59E0B" : "#10B981",
        }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}

// ── DashCard ──────────────────────────────────────────────────────────────────
function DashCard({ icon, label, n, color, bg, pulse }) {
  return (
    <div style={{
      ...S.dashCard,
      background: bg,
      outline: pulse ? `2px solid ${color}` : "none",
      outlineOffset: 2,
    }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{n}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color, opacity: 0.7, marginTop: 1, lineHeight: 1.3, textAlign: "left" }}>
        {label}
      </span>
    </div>
  );
}

// ── StudentCard ───────────────────────────────────────────────────────────────
function StudentCard({ stu, detail, busy, approvedRequest, pendingRequest, moreOpen, onCheckIn, onCheckOut, onRelease, onMoreToggle, onMoreAction }) {
  const { status, time, collector } = detail;
  const cfg         = STATUS_CFG[status];
  const hasApproval = status === "CHECKED_IN" && !!approvedRequest;
  const hasPending  = !!pendingRequest;
  const canIn       = status === "NOT_ARRIVED";
  const canOut      = status === "CHECKED_IN" && !hasApproval;
  const photo       = stuPhoto(stu);

  let subText = null;
  if (status === "CHECKED_IN" && time && !hasApproval) {
    subText = `Arrived ${fmtTime(time)}`;
  } else if (status === "CHECKED_OUT" && time) {
    const parts = [];
    if (collector && collector !== "Staff") parts.push(collector);
    parts.push(fmtTime(time));
    subText = parts.join(" · ");
  }

  const borderColor = hasApproval ? "#6EE7B7" : hasPending ? "#A78BFA" : "#E5E7EB";
  const cardBg      = hasApproval ? "#F0FDF9"  : hasPending ? "#F5F3FF"  : "#FFFFFF";

  return (
    <div className="cp-card" style={{ ...S.card, borderColor, background: cardBg }}>

      {/* Top: avatar + name + ⋮ */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {photo ? (
            <img src={photo} alt="" style={S.cardPhoto} />
          ) : (
            <div style={S.cardAva}>
              <span style={S.avaText}>{initials(stuName(stu))}</span>
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={S.cardName}>{stuName(stu)}</div>
            <div style={S.cardCls}>{stuCls(stu)}</div>
            <div style={S.cardAdm}>#{stuAdmNo(stu)}</div>
          </div>
        </div>

        {/* ⋮ menu trigger */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            className="cp-morebtn"
            style={S.moreBtn}
            onClick={onMoreToggle}
            aria-label="More options"
          >
            ⋮
          </button>
          {moreOpen && (
            <div style={S.moreMenu} onClick={e => e.stopPropagation()}>
              <MoreItem icon="👤" label="View Student"       onClick={() => onMoreAction("view")} />
              <MoreItem icon="📋" label="Attendance History" onClick={() => onMoreAction("attHist")} />
              <MoreItem icon="🚗" label="Pickup History"     onClick={() => onMoreAction("pickHist")} />
              <div style={{ height: 1, background: "#F3F4F6", margin: "4px 0" }} />
              <MoreItem icon="🚨" label="Emergency Pickup"   onClick={() => onMoreAction("emergency")} red />
              {status === "CHECKED_IN" && (
                <MoreItem icon="✓"  label="Manual Checkout"  onClick={() => onMoreAction("checkout")} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status badges */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12, flex: 1 }}>
        {hasApproval ? (
          <>
            <div style={{ ...S.badge, background: "#D1FAE5", color: "#065F46" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", flexShrink: 0 }} />
              Parent Approved
            </div>
            <span style={S.cardSub}>
              {approvedRequest.personName || "Unknown"}
              {approvedRequest.deviceAuthenticated ? " · 🔒 Device Verified" : ""}
            </span>
          </>
        ) : (
          <>
            <div style={{ ...S.badge, background: cfg.bg, color: cfg.text }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
              {cfg.label}
            </div>
            {hasPending && (
              <div style={{ ...S.badge, background: "#EDE9FE", color: "#5B21B6", marginTop: 2 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#7C3AED", flexShrink: 0 }} />
                Waiting Approval
              </div>
            )}
            {subText && <span style={S.cardSub}>{subText}</span>}
          </>
        )}
      </div>

      {/* Action button */}
      {busy ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}><Spin size={20} /></div>
      ) : hasApproval ? (
        <button className="cp-actbtn" style={{ ...S.cardBtn, background: "#10B981", color: "#FFFFFF" }} onClick={onRelease}>
          Release Child
        </button>
      ) : canIn ? (
        <button className="cp-actbtn" style={{ ...S.cardBtn, background: "#D1FAE5", color: "#065F46" }} onClick={onCheckIn}>
          ✓ Check In
        </button>
      ) : canOut ? (
        <button className="cp-actbtn" style={{ ...S.cardBtn, background: "#FEE2E2", color: "#991B1B" }} onClick={onCheckOut}>
          Pick Up
        </button>
      ) : (
        <div style={{ textAlign: "center", color: "#D1D5DB", fontSize: 12, padding: "6px 0" }}>
          Picked up {subText ? `· ${subText}` : ""}
        </div>
      )}
    </div>
  );
}

// ── MoreItem ──────────────────────────────────────────────────────────────────
function MoreItem({ icon, label, onClick, red }) {
  return (
    <button
      className="cp-prow"
      style={{ ...S.moreItem, color: red ? "#DC2626" : "#374151" }}
      onClick={onClick}
    >
      <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ── SpeedDialFAB ──────────────────────────────────────────────────────────────
function SpeedDialFAB({ open, onToggle, onScanBadge, onManualCheckIn, onVisitorEntry, onEmergencyPickup }) {
  const actions = [
    { label: "Scan Badge",       color: "#111827", onClick: onScanBadge,       icon: <IcoQr size={18} /> },
    { label: "Manual Check In",  color: "#059669", onClick: onManualCheckIn,   icon: <span style={{ fontSize: 16 }}>✓</span> },
    { label: "Visitor Entry",    color: "#0284C7", onClick: onVisitorEntry,    icon: <span style={{ fontSize: 16 }}>👤</span> },
    { label: "Emergency Pickup", color: "#DC2626", onClick: onEmergencyPickup, icon: <span style={{ fontSize: 16 }}>🚨</span> },
  ];
  return (
    <div style={S.fabWrap} onClick={e => e.stopPropagation()}>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14, alignItems: "flex-end" }}>
          {actions.map((a, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                animation: `cp-pop 0.2s ${SPRING} both`,
                animationDelay: `${i * 40}ms`,
              }}
            >
              <span style={S.fabLabel}>{a.label}</span>
              <button
                style={{ ...S.fabAction, background: a.color }}
                onClick={a.onClick}
                aria-label={a.label}
              >
                {a.icon}
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        style={{
          ...S.fab,
          background: open ? "#1F2937" : "#F4C400",
          color:      open ? "#FFFFFF"  : "#111827",
        }}
        onClick={onToggle}
        aria-label={open ? "Close menu" : "Quick actions"}
      >
        <span style={{
          fontSize: 24,
          transform: open ? "rotate(45deg)" : "none",
          transition: "transform 0.2s",
          display: "block",
          lineHeight: 1,
        }}>
          +
        </span>
      </button>
    </div>
  );
}

// ── CheckoutModal (unchanged) ─────────────────────────────────────────────────
function CheckoutModal({
  student, persons, authLoading, step, capturedPhoto, capturedPhotoUrl,
  unknownName, unknownRelation, sending, videoRefCb,
  onSelectPerson, onStartCamera, onCapture, onRetake,
  onUnknownName, onUnknownRelation, onSend, onRelease, onClose,
}) {
  const name  = stuName(student);
  const photo = capturedPhotoUrl || capturedPhoto;
  return (
    <div style={S.overlay} onClick={step === "select" ? onClose : undefined}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>

        {!["sent", "approved", "rejected"].includes(step) && (
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
              <button style={{ ...S.btn, ...S.btnDark,  flex: 2 }} onClick={onCapture}>
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
              The parent has been notified. Ask the person to wait.
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "16px 0 4px", color: "#6B7280", fontSize: 13 }}>
              <Spin size={16} />
              <span>Waiting for parent response…</span>
            </div>
            <button style={{ ...S.btn, ...S.btnGhost, width: "100%", marginTop: 12 }} onClick={onClose}>
              Close (check back later)
            </button>
          </div>
        )}

        {/* ── approved ── */}
        {step === "approved" && (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>✅</div>
            <h2 style={{ ...S.mTitle, color: "#065F46" }}>Parent Approved</h2>
            <p style={{ ...S.mSub, maxWidth: 300, margin: "8px auto 16px" }}>
              The parent has approved this pickup. You may release {name}.
            </p>
            {photo && (
              <img src={photo} alt="Approved person" style={{ ...S.capImg, border: "2px solid #10B981" }} />
            )}
            <button
              style={{ ...S.btn, ...S.btnDark, width: "100%", marginTop: 16, background: "#10B981", boxShadow: "0 4px 14px rgba(16,185,129,0.35)", opacity: sending ? 0.6 : 1 }}
              onClick={onRelease}
              disabled={sending}
            >
              {sending ? "Releasing…" : "✓ Release Child"}
            </button>
          </div>
        )}

        {/* ── rejected ── */}
        {step === "rejected" && (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>🚫</div>
            <h2 style={{ ...S.mTitle, color: "#991B1B" }}>Parent Rejected</h2>
            <p style={{ ...S.mSub, maxWidth: 300, margin: "8px auto 16px" }}>
              The parent has rejected this pickup request. Do not release {name}.
            </p>
            {photo && (
              <img src={photo} alt="Rejected person" style={{ ...S.capImg, border: "2px solid #EF4444", opacity: 0.7 }} />
            )}
            <button style={{ ...S.btn, ...S.btnDark, width: "100%", marginTop: 16 }} onClick={onClose}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function IcoQr({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ marginRight: 5, flexShrink: 0 }}>
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <line x1="14" y1="14" x2="14.01" y2="14"/><line x1="18" y1="14" x2="18.01" y2="14"/>
      <line x1="14" y1="18" x2="14" y2="21"/><line x1="21" y1="18" x2="21" y2="21"/>
    </svg>
  );
}

function IcoRefresh() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ marginRight: 5, flexShrink: 0 }}>
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}

function IcoActivity({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ marginRight: 6, flexShrink: 0 }}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
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
  // Page
  page: {
    padding: "24px 20px 100px", maxWidth: 1400, margin: "0 auto",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    animation: `cp-in 0.3s ${SPRING} both`,
  },

  // Header
  hdr:     { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  title:   { fontSize: 26, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.5px" },
  dateStr: { fontSize: 13, color: "#9CA3AF", margin: "4px 0 0" },

  // Dashboard
  dash:     { display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  dashCard: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
    padding: "12px 14px", borderRadius: 12, flex: "1 0 88px", minWidth: 80,
  },

  // Activity timeline
  timeline: { background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: 14, marginBottom: 14, overflow: "hidden" },
  tlToggle: { display: "flex", alignItems: "center", gap: 7, padding: "11px 14px", width: "100%", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#374151" },
  tlBody:   { padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 0 },
  tlRow:    { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", position: "relative", paddingLeft: 22 },
  tlLine:   { position: "absolute", left: 6, top: 0, bottom: 0, width: 2 },
  tlDot:    { position: "absolute", left: 2, width: 10, height: 10, borderRadius: "50%", border: "2px solid #FAFAFA", flexShrink: 0 },
  tlTime:   { fontSize: 12, color: "#9CA3AF", fontWeight: 600, minWidth: 62, flexShrink: 0 },
  tlText:   { fontSize: 13, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  // Filter chips
  chipBtn:       { padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1.5px solid #E5E7EB", background: "#FAFAFA", color: "#374151", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5, transition: "background 0.15s" },
  chipBtnActive: { background: "#111827", color: "#FFFFFF", border: "1.5px solid #111827" },

  // Search / filters row
  filters:  { display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" },
  searchIn: { flex: "1 1 200px", padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, color: "#111827", outline: "none", background: "#FAFAFA", boxSizing: "border-box" },
  classIn:  { padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, color: "#374151", outline: "none", background: "#FAFAFA", cursor: "pointer" },

  // Card grid
  grid: { display: "grid", gridTemplateColumns: "1fr", gap: 12, paddingBottom: 8 },

  // Student card
  card: {
    display: "flex", flexDirection: "column", padding: "14px 14px 12px",
    background: "#FFFFFF", border: "1.5px solid #E5E7EB", borderRadius: 16,
    minHeight: 190,
  },
  cardPhoto: { width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 },
  cardAva:   { width: 44, height: 44, borderRadius: 10, background: "#FEF9C3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avaText:   { fontSize: 13, fontWeight: 800, color: "#92400E" },
  cardName:  { fontSize: 14, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 },
  cardCls:   { fontSize: 12, color: "#6B7280", marginTop: 1 },
  cardAdm:   { fontSize: 11, color: "#9CA3AF" },
  cardSub:   { fontSize: 11, color: "#9CA3AF", paddingLeft: 1 },

  // Badge
  badge: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" },

  // Card action button
  cardBtn: { width: "100%", padding: "9px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", textAlign: "center" },

  // ⋮ menu
  moreBtn:  { background: "transparent", border: "none", cursor: "pointer", padding: "3px 7px", fontSize: 18, color: "#9CA3AF", lineHeight: 1, borderRadius: 6 },
  moreMenu: { position: "absolute", top: "calc(100% + 4px)", right: 0, background: "#FFFFFF", border: "1.5px solid #E5E7EB", borderRadius: 12, padding: "6px 0", minWidth: 188, zIndex: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.13)", animation: `cp-pop 0.15s ${SPRING} both` },
  moreItem: { display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%", border: "none", background: "transparent", textAlign: "left" },

  // Buttons
  btn:        { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", userSelect: "none" },
  btnGhost:   { background: "#F3F4F6", color: "#374151", border: "1.5px solid #E5E7EB" },
  btnDark:    { background: "#111827", color: "#FFFFFF" },

  // QR scanner panel
  scanPanel:   { background: "#111827", borderRadius: 16, marginBottom: 16, overflow: "hidden", animation: `cp-in 0.25s ${SPRING} both` },
  scanInner:   { padding: "18px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  scanHint:    { color: "#6B7280", fontSize: 12 },
  scanViewport:{ width: "100%", maxWidth: 320, minHeight: 200, borderRadius: 10, overflow: "hidden" },
  scanRes:     { padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, width: "100%", maxWidth: 320, boxSizing: "border-box" },
  scanErrTxt:  { color: "#FCA5A5", fontSize: 13 },

  // Speed Dial FAB
  fabWrap: { position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", alignItems: "flex-end", zIndex: 300 },
  fab:     { width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.18)", transition: "background 0.2s" },
  fabAction:{ width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.2)" },
  fabLabel: { background: "rgba(17,24,39,0.82)", color: "#FFFFFF", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", backdropFilter: "blur(4px)" },

  // Checkout modal
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal:   { background: "#FFFFFF", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 14, maxHeight: "88vh", overflowY: "auto", position: "relative", animation: `cp-in 0.25s ${SPRING} both` },
  closeBtn:{ position: "absolute", top: 16, right: 16, background: "#F3F4F6", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 14, color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center" },
  mTitle:  { fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 },
  mSub:    { fontSize: 13, color: "#6B7280", margin: 0, lineHeight: 1.55 },
  pList:   { display: "flex", flexDirection: "column", gap: 8 },
  pRow:    { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: 12, cursor: "pointer", width: "100%", textAlign: "left" },
  pPhoto:  { width: 80, height: 80, borderRadius: 10, objectFit: "cover", flexShrink: 0 },
  pFallback:{ width: 80, height: 80, borderRadius: 10, background: "#FEF9C3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: "#92400E", flexShrink: 0 },
  pInfo:   { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  pName:   { fontSize: 14, fontWeight: 700, color: "#111827" },
  pRel:    { fontSize: 12, color: "#9CA3AF" },
  emerTag: { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#FEF3C7", color: "#92400E" },
  chev:    { fontSize: 22, color: "#D1D5DB", flexShrink: 0, lineHeight: 1 },
  videoBox:{ width: "100%", background: "#000", borderRadius: 12, overflow: "hidden", minHeight: 220 },
  video:   { width: "100%", display: "block" },
  capImg:  { width: "100%", borderRadius: 12, display: "block", maxHeight: 240, objectFit: "cover" },
  label:   { fontSize: 12, fontWeight: 700, color: "#374151" },
  inp:     { width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, color: "#111827", outline: "none", background: "#FAFAFA", boxSizing: "border-box" },

  // States
  centered: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 0" },
  muted:    { fontSize: 13, color: "#9CA3AF", margin: 0, textAlign: "center" },

  // Toast
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", padding: "10px 22px", borderRadius: 30, color: "#FFFFFF", fontSize: 14, fontWeight: 600, zIndex: 2000, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", whiteSpace: "nowrap", animation: `cp-in 0.2s ${SPRING} both` },
};
