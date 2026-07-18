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

// Present first — they're inside and need monitoring
const STATUS_ORDER = { CHECKED_IN: 0, NOT_ARRIVED: 1, CHECKED_OUT: 2 };

const FILTER_TABS = [
  { key: "ALL",              label: "All"             },
  { key: "CHECKED_IN",       label: "Present"         },
  { key: "NOT_ARRIVED",      label: "Not Arrived"     },
  { key: "CHECKED_OUT",      label: "Picked Up"       },
  { key: "PENDING_APPROVAL", label: "Pending Approval"},
];

// Presentational only — maps each filter tab to a small leading icon.
const FILTER_ICONS = {
  ALL:              IcoUsers,
  CHECKED_IN:       IcoCheckCircle,
  NOT_ARRIVED:      IcoClock,
  CHECKED_OUT:      IcoLogOut,
  PENDING_APPROVAL: IcoHourglass,
};

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

// Curated soft gradient pairs for photo-less avatars — a child always gets
// the same one (deterministic hash of their name), so colors stay
// consistent across visits rather than looking random.
const AVATAR_GRADIENTS = [
  ["#FDE68A", "#FBBF24"], // warm yellow
  ["#BFDBFE", "#60A5FA"], // sky blue
  ["#FBCFE8", "#F472B6"], // pink
  ["#C7D2FE", "#818CF8"], // indigo
  ["#BBF7D0", "#34D399"], // mint
  ["#FED7AA", "#FB923C"], // peach
  ["#DDD6FE", "#A78BFA"], // lavender
  ["#99F6E4", "#2DD4BF"], // teal
];
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}
function avatarGradient(name) {
  const [from, to] = AVATAR_GRADIENTS[hashStr(name || "?") % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

// Contextual "nothing to show" copy per active filter, so an empty grid
// reads as good news ("everyone's arrived!") rather than a dead end.
function emptyStateFor(statusFilter, search, classFilter) {
  if (search || classFilter) return { icon: "🔍", text: "No students match your search." };
  switch (statusFilter) {
    case "NOT_ARRIVED":      return { icon: "🎉", text: "Everyone has checked in!" };
    case "CHECKED_IN":       return { icon: "🌙", text: "No one has arrived yet." };
    case "CHECKED_OUT":      return { icon: "🏡", text: "No pickups yet today." };
    case "PENDING_APPROVAL": return { icon: "✨", text: "No pending approvals — all clear!" };
    default:                 return { icon: "📋", text: "No students found." };
  }
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function todayLabel() {
  return new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}
function firstName(user) {
  const n = user?.displayName || user?.name || "";
  return n.trim().split(" ")[0] || "there";
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

  // "/" focuses search from anywhere on the page (skip while typing elsewhere)
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "/") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        @keyframes cp-pop { from { opacity:0; transform:scale(0.94) translateY(3px); } to { opacity:1; transform:scale(1) translateY(0); } }

        @keyframes cp-fade { from { opacity:0; } to { opacity:1; } }

        .cp-card      { animation:cp-in 0.28s ${SPRING} both; transition:box-shadow 0.16s ease, transform 0.16s ease, border-color 0.16s ease; }
        .cp-card:hover  { box-shadow:0 10px 28px rgba(17,24,39,0.09) !important; transform:translateY(-3px); border-color:#E2E4E7; }

        .cp-gridfade  { animation:cp-fade 0.18s ease both; }
        .cp-emptystate{ animation:cp-pop 0.22s ${SPRING} both; }
        .cp-heropop   { animation:cp-pop 0.22s ${SPRING} both; }

        .cp-hero:hover:not(:disabled) { transform:translateY(-2px) !important; }

        .cp-kpi       { transition:box-shadow 0.16s ease, transform 0.16s ease; cursor:default; }
        .cp-kpi:hover   { box-shadow:0 2px 4px rgba(17,24,39,0.05), 0 10px 22px rgba(17,24,39,0.08) !important; transform:translateY(-2px); }

        .cp-actbtn    { transition:filter 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease; }
        .cp-actbtn:hover:not(:disabled) { filter:brightness(0.96); transform:translateY(-1px); box-shadow:0 3px 10px rgba(17,24,39,0.12); }
        .cp-actbtn:active:not(:disabled) { transform:translateY(0); filter:brightness(0.92); }
        .cp-actbtn:disabled { opacity:0.55; cursor:not-allowed; }

        .cp-headbtn   { transition:background 0.15s ease, transform 0.15s ease; }
        .cp-headbtn:hover { background:#E5E7EB !important; }
        .cp-headbtn:active { transform:translateY(1px); }

        .cp-btn       { transition:filter 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease; }
        .cp-btn:hover:not(:disabled) { filter:brightness(0.94); box-shadow:0 3px 10px rgba(17,24,39,0.12); }
        .cp-btn:active:not(:disabled) { transform:translateY(1px); }
        .cp-btn:disabled { cursor:not-allowed; }

        .cp-closebtn  { transition:background 0.15s ease, color 0.15s ease; }
        .cp-closebtn:hover { background:#E5E7EB !important; color:#111827 !important; }

        .cp-searchclear { transition:background 0.15s ease; }
        .cp-searchclear:hover { background:#D1D5DB !important; }

        .cp-fab, .cp-fabaction { transition:transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease; }
        .cp-fab:hover     { filter:brightness(0.96); box-shadow:0 6px 24px rgba(0,0,0,0.22); }
        .cp-fabaction:hover { transform:scale(1.08); }
        .cp-fab:focus-visible, .cp-fabaction:focus-visible { outline:2px solid #F4C400; outline-offset:3px; }

        .cp-prow      { transition:background 0.15s ease; }
        .cp-prow:hover   { background:#F1F5F9 !important; }
        .cp-morebtn   { transition:background 0.15s ease, color 0.15s ease; }
        .cp-morebtn:hover { background:#F3F4F6 !important; color:#374151 !important; }

        .cp-chip:hover:not([aria-pressed="true"]) { border-color:#D1D5DB; background:#F3F4F6 !important; }
        .cp-chip:active { transform:translateY(1px); }

        .cp-search    { transition:border-color 0.15s ease, box-shadow 0.15s ease; }
        .cp-search:focus { border-color:#F4C400 !important; box-shadow:0 0 0 3px rgba(244,196,0,0.18); background:#FFFFFF !important; }
        .cp-select    { transition:border-color 0.15s ease; }
        .cp-select:focus { border-color:#F4C400 !important; box-shadow:0 0 0 3px rgba(244,196,0,0.18); }

        /* Focus-visible rings for keyboard navigation across all interactive elements */
        .cp-actbtn:focus-visible,
        .cp-headbtn:focus-visible,
        .cp-chip:focus-visible,
        .cp-morebtn:focus-visible,
        .cp-search:focus-visible,
        .cp-select:focus-visible,
        .cp-btn:focus-visible,
        .cp-closebtn:focus-visible,
        .cp-searchclear:focus-visible {
          outline:2px solid #F4C400 !important;
          outline-offset:2px;
        }

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

        @media (prefers-reduced-motion: reduce) {
          .cp-card, .cp-kpi, .cp-actbtn, .cp-headbtn, .cp-chip, .cp-search, .cp-select, .cp-hero { transition:none !important; animation:none !important; }
          .cp-card:hover, .cp-kpi:hover, .cp-hero:hover { transform:none !important; }
          .cp-gridfade, .cp-emptystate, .cp-heropop { animation:none !important; }
        }
      `}</style>

      <div style={S.page} onClick={handlePageClick}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={S.hdr}>
          <div style={{ minWidth: 0 }}>
            <p style={S.greeting}>{getGreeting()}, {firstName(user)} 👋</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h1 style={S.title}>Gate Register</h1>
              <span style={S.dateStr}>{todayLabel()}</span>
            </div>
            <p style={S.subtitle}>Monitor student arrivals, pickups and live attendance throughout the day.</p>
          </div>
          <button className="cp-headbtn" style={{ ...S.btn, ...S.btnGhost }} onClick={loadData} aria-label="Refresh gate register data">
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
          <DashCard
            icon="🟢" label="Present" n={counts.present} color="#065F46" bg="#D1FAE5"
            sub={counts.total ? `${Math.round((counts.present / counts.total) * 100)}% attendance today` : "No students yet"}
          />
          <DashCard icon="🟡" label="Not Arrived" n={counts.notArrived} color="#92400E" bg="#FEF3C7" sub="Awaiting arrival" />
          <DashCard icon="🔵" label="Picked Up"   n={counts.pickedUp}   color="#374151" bg="#F3F4F6" sub="Already home" />
          <DashCard
            icon="⏳" label="Pending Approval"
            n={counts.pendingApproval}
            color="#5B21B6" bg="#EDE9FE"
            sub={counts.pendingApproval > 0 ? `${counts.pendingApproval} awaiting pickup` : "All caught up"}
            pulse={counts.pendingApproval > 0}
          />
          <DashCard icon="👥" label="Total Students" n={counts.total} color="#1E3A5F" bg="#E0F2FE" sub="Enrolled today" />
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
                    <div style={S.tlIconCol}>
                      <div style={{ ...S.tlDot, background: ev.isIn ? "#10B981" : "#9CA3AF" }} aria-hidden="true">
                        {ev.isIn ? <IcoArrowIn /> : <IcoArrowOut />}
                      </div>
                      {i !== activityFeed.length - 1 && <div style={S.tlLine} />}
                    </div>
                    <div style={S.tlBodyCol}>
                      <span style={S.tlText}>
                        <strong style={{ color: "#111827" }}>{ev.name}</strong>{" "}
                        <span style={{ color: "#6B7280" }}>{ev.action}</span>
                      </span>
                      <span style={S.tlTime}>{fmtTime(ev.time)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Filter chips ─────────────────────────────────────────────────── */}
        <div className="cp-chips" style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
          {FILTER_TABS.map(tab => {
            const count = tab.key === "ALL"               ? counts.total
                        : tab.key === "CHECKED_IN"         ? counts.present
                        : tab.key === "NOT_ARRIVED"        ? counts.notArrived
                        : tab.key === "CHECKED_OUT"        ? counts.pickedUp
                        : tab.key === "PENDING_APPROVAL"   ? counts.pendingApproval
                        : null;
            const active = statusFilter === tab.key;
            const Icon = FILTER_ICONS[tab.key];
            return (
              <button
                key={tab.key}
                className="cp-chip"
                onClick={e => { e.stopPropagation(); setStatusFilter(tab.key); }}
                aria-pressed={active}
                style={{
                  ...S.chipBtn,
                  ...(active ? S.chipBtnActive : {}),
                  ...(tab.key === "PENDING_APPROVAL" && counts.pendingApproval > 0 && !active
                    ? { borderColor: "#A78BFA", color: "#5B21B6" } : {}),
                }}
              >
                {Icon && <Icon size={12} />}
                {tab.label}{count !== null ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>

        {/* ── Search row ───────────────────────────────────────────────────── */}
        <div style={S.filters}>
          <div style={S.searchWrap}>
            <span style={S.searchIcon} aria-hidden="true"><IcoSearch /></span>
            <input
              ref={searchRef}
              className="cp-search"
              style={S.searchIn}
              placeholder="Search students, parents, or phone number…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search students"
            />
            {search ? (
              <button
                type="button"
                className="cp-searchclear"
                style={S.searchClear}
                onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                aria-label="Clear search"
              >
                <IcoX size={11} />
              </button>
            ) : (
              <span style={S.searchHint} aria-hidden="true">/</span>
            )}
          </div>
          <select
            className="cp-select"
            style={S.classIn}
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            aria-label="Filter by class"
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
            <button className="cp-btn" style={{ ...S.btn, ...S.btnGhost }} onClick={loadData}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          (() => {
            const empty = emptyStateFor(statusFilter, search, classFilter);
            return (
              <div key={`${statusFilter}-${search}-${classFilter}`} className="cp-emptystate" style={S.emptyState}>
                <div style={S.emptyIcon} aria-hidden="true">{empty.icon}</div>
                <p style={S.emptyText}>{empty.text}</p>
              </div>
            );
          })()
        ) : (
          <div key={`${statusFilter}-${search}-${classFilter}`} className="cp-grid cp-gridfade" style={S.grid}>
            {filtered.map((stu, i) => {
              const sid      = stuId(stu);
              const detail   = getStatusDetail(sid);
              const approved = approvedMap.get(sid) || null;
              const pending  = pendingMap.get(sid)  || null;
              return (
                <StudentCard
                  key={sid}
                  index={i}
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
function DashCard({ icon, label, n, color, bg, sub, pulse }) {
  return (
    <div
      className="cp-kpi"
      role="group"
      aria-label={`${label}: ${n}${sub ? `, ${sub}` : ""}`}
      style={{
        ...S.dashCard,
        background: `linear-gradient(155deg, ${bg} 0%, #FFFFFF 145%)`,
        outline: pulse ? `2px solid ${color}` : "none",
        outlineOffset: 2,
      }}
    >
      <span style={{ fontSize: 38, lineHeight: 1 }} aria-hidden="true">{icon}</span>
      <span style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.02em" }}>{n}</span>
      <span style={{ fontSize: 10.5, fontWeight: 600, color, opacity: 0.6, lineHeight: 1.3, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      {sub && (
        <span style={{ fontSize: 10.5, fontWeight: 500, color, opacity: 0.55, lineHeight: 1.3, textAlign: "left" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ── StudentCard ───────────────────────────────────────────────────────────────
function StudentCard({ stu, detail, busy, approvedRequest, pendingRequest, moreOpen, onCheckIn, onCheckOut, onRelease, onMoreToggle, onMoreAction, index = 0 }) {
  const { status, time, collector } = detail;
  const hasApproval = status === "CHECKED_IN" && !!approvedRequest;
  const hasPending  = !!pendingRequest;
  const canIn       = status === "NOT_ARRIVED";
  const canOut      = status === "CHECKED_IN" && !hasApproval;
  const photo       = stuPhoto(stu);
  const name        = stuName(stu);

  // Arrival/pickup time only shown when it's actually relevant (present or
  // already picked up) -- not shown for "not arrived", nothing to say yet.
  let subText = null;
  if (status === "CHECKED_IN" && time && !hasApproval) {
    subText = `Arrived ${fmtTime(time)}`;
  } else if (status === "CHECKED_OUT" && time) {
    const parts = [];
    if (collector && collector !== "Staff") parts.push(collector);
    parts.push(fmtTime(time));
    subText = parts.join(" · ");
  }

  return (
    <div
      className="cp-card"
      style={{ ...S.card, animationDelay: `${Math.min(index, 10) * 25}ms` }}
    >

      {/* Top: large avatar (the hero of the card) + name/class + ⋮ */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          {photo ? (
            <img src={photo} alt="" style={S.cardPhoto} />
          ) : (
            <div style={{ ...S.cardAva, background: avatarGradient(name) }}>
              <span style={S.avaText}>{initials(name)}</span>
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={S.cardName}>{name}</div>
            <div style={S.cardMeta}>{stuCls(stu)}</div>
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

      {/* No status pill here on purpose -- the filter chips above already
          communicate Present/Not Arrived/Picked Up. Only a quiet caption
          line for information the filter *can't* express: exact time, or
          an in-progress approval hand-off. */}
      <div style={{ flex: 1, marginBottom: 14 }}>
        {hasApproval && (
          <span style={S.cardNote}>
            <IcoCheckCircle size={13} color="#10B981" />
            Approved — {approvedRequest.personName || "Unknown"}{approvedRequest.deviceAuthenticated ? " · 🔒" : ""}
          </span>
        )}
        {hasPending && !hasApproval && (
          <span style={S.cardNote}><IcoHourglass size={13} color="#8B5CF6" /> Waiting on parent</span>
        )}
        {subText && !hasApproval && (
          <span style={S.cardNote}>
            {status === "CHECKED_IN" ? <IcoClock size={13} /> : <IcoLogOut size={13} />}
            {subText}
          </span>
        )}
      </div>

      {/* Hero action — the one thing this card asks of you */}
      <div key={hasApproval ? "release" : status} className="cp-heropop">
        {busy ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "14px 0" }}><Spin size={22} /></div>
        ) : hasApproval ? (
          <button className="cp-actbtn cp-hero" style={{ ...S.heroBtn, background: "#059669", boxShadow: "0 4px 14px rgba(5,150,105,0.3)" }} onClick={onRelease} aria-label={`Release ${name}`}>
            <IcoCheckCircle size={19} /> Release Child
          </button>
        ) : canIn ? (
          <button className="cp-actbtn cp-hero" style={{ ...S.heroBtn, background: "#059669", boxShadow: "0 4px 14px rgba(5,150,105,0.3)" }} onClick={onCheckIn} aria-label={`Check in ${name}`}>
            <IcoCheckCircle size={19} /> Check In
          </button>
        ) : canOut ? (
          <button className="cp-actbtn cp-hero" style={{ ...S.heroBtn, background: "#B45309", boxShadow: "0 4px 14px rgba(180,83,9,0.28)" }} onClick={onCheckOut} aria-label={`Start pickup for ${name}`}>
            <IcoLogOut size={19} /> Pick Up
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#D1D5DB", fontSize: 12.5, padding: "16px 0" }} aria-disabled="true">
            Picked up{subText ? ` · ${subText}` : ""}
          </div>
        )}
      </div>
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
// Design decision (polish pass): kept as a floating Speed Dial rather than
// folded into the header. Its four actions (Scan Badge, Manual Check-In,
// Visitor Entry, Emergency Pickup) aren't tied to a specific student card,
// so they don't belong inline in the grid -- and the header is intentionally
// kept to a single Refresh action for clarity. A persistent, thumb-reachable
// FAB is the right pattern for a high-frequency reception/gate screen.
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
                className="cp-fabaction"
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
        className="cp-fab"
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
          <button className="cp-closebtn" style={S.closeBtn} onClick={onClose} aria-label="Close">✕</button>
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
              <button className="cp-btn" style={{ ...S.btn, ...S.btnGhost, flex: 1 }} onClick={onClose}>Cancel</button>
              <button className="cp-btn" style={{ ...S.btn, ...S.btnDark,  flex: 2 }} onClick={onCapture}>
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
              <button className="cp-btn" style={{ ...S.btn, ...S.btnGhost, flex: 1 }} onClick={onRetake}>Retake</button>
              <button
                className="cp-btn"
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
            <button className="cp-btn" style={{ ...S.btn, ...S.btnGhost, width: "100%", marginTop: 12 }} onClick={onClose}>
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
              className="cp-btn"
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
            <button className="cp-btn" style={{ ...S.btn, ...S.btnDark, width: "100%", marginTop: 16 }} onClick={onClose}>
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

function IcoArrowIn() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none"
      stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="19 12 12 19 5 12"/><line x1="12" y1="19" x2="12" y2="5"/>
    </svg>
  );
}

function IcoArrowOut() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none"
      stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 12 12 5 19 12"/><line x1="12" y1="5" x2="12" y2="19"/>
    </svg>
  );
}

function IcoSearch() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function IcoX({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function IcoClock({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>
    </svg>
  );
}

function IcoCheckCircle({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}

function IcoLogOut({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

function IcoHourglass({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22h14M5 2h14M5 2v5a7 7 0 0 0 7 5 7 7 0 0 0 7-5V2M5 22v-5a7 7 0 0 1 7-5 7 7 0 0 1 7 5v5"/>
    </svg>
  );
}

function IcoUsers({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
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
  hdr:      { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  greeting: { fontSize: 13, fontWeight: 700, color: "#B45309", margin: 0, letterSpacing: "0.01em" },
  title:    { fontSize: 28, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.5px", lineHeight: 1.15 },
  subtitle: { fontSize: 13.5, color: "#6B7280", margin: "6px 0 0", maxWidth: 440, lineHeight: 1.5 },
  dateStr:  { fontSize: 12.5, color: "#9CA3AF", fontWeight: 600 },

  // Dashboard
  dash:     { display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" },
  dashCard: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 7,
    padding: "20px 18px 17px", borderRadius: 18, flex: "1 1 150px", minWidth: 140, minHeight: 124,
    border: "1px solid rgba(17,24,39,0.05)",
    boxShadow: "0 1px 2px rgba(17,24,39,0.03), 0 6px 16px rgba(17,24,39,0.055)",
    position: "relative", overflow: "hidden",
  },

  // Activity timeline
  timeline:   { background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: 14, marginBottom: 14, overflow: "hidden" },
  tlToggle:   { display: "flex", alignItems: "center", gap: 7, padding: "12px 14px", width: "100%", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#374151" },
  tlBody:     { padding: "2px 14px 14px", display: "flex", flexDirection: "column", gap: 0, maxHeight: 320, overflowY: "auto" },
  tlRow:      { display: "flex", alignItems: "flex-start", gap: 12, padding: "7px 0" },
  tlIconCol:  { display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 },
  tlLine:     { width: 2, flex: 1, minHeight: 10, background: "#E5E7EB", marginTop: 2 },
  tlDot:      { width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 0 3px #FAFAFA" },
  tlBodyCol:  { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flex: 1, minWidth: 0, paddingTop: 1 },
  tlTime:     { fontSize: 11.5, color: "#9CA3AF", fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" },
  tlText:     { fontSize: 13, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 },

  // Filter chips — fixed height so every chip lines up regardless of label/count
  chipBtn:       { height: 32, padding: "0 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1.5px solid #E5E7EB", background: "#FAFAFA", color: "#374151", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 7, transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease" },
  chipBtnActive: { background: "#111827", color: "#FFFFFF", border: "1.5px solid #111827", boxShadow: "0 2px 8px rgba(17,24,39,0.22)" },

  // Search / filters row — inputs share one height token (42px) with the KPI/button scale
  filters:     { display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  searchWrap:  { position: "relative", flex: "1 1 240px", display: "flex", alignItems: "center" },
  searchIcon:  { position: "absolute", left: 13, display: "flex", color: "#9CA3AF", pointerEvents: "none" },
  searchIn:    { width: "100%", height: 42, padding: "0 40px 0 36px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, color: "#111827", outline: "none", background: "#FAFAFA", boxSizing: "border-box" },
  searchClear: { position: "absolute", right: 9, display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", border: "none", background: "#E5E7EB", color: "#6B7280", cursor: "pointer" },
  searchHint:  { position: "absolute", right: 12, fontSize: 11, fontWeight: 700, color: "#9CA3AF", background: "#EEF0F2", border: "1px solid #E5E7EB", borderRadius: 5, padding: "1px 6px", pointerEvents: "none" },
  classIn:     { height: 42, padding: "0 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, color: "#374151", outline: "none", background: "#FAFAFA", cursor: "pointer", boxSizing: "border-box" },

  // Card grid
  grid: { display: "grid", gridTemplateColumns: "1fr", gap: 14, paddingBottom: 8 },

  // Student card — profile-card feel: soft float, minimal chrome, avatar-led
  card: {
    display: "flex", flexDirection: "column", padding: "20px 20px 18px",
    background: "#FFFFFF", border: "1px solid #F1F2F4", borderRadius: 20,
    minHeight: 216,
    boxShadow: "0 2px 10px rgba(17,24,39,0.045)",
  },
  cardPhoto: { width: 64, height: 64, borderRadius: "50%", objectFit: "cover", flexShrink: 0, boxShadow: "0 0 0 1px rgba(17,24,39,0.04)" },
  cardAva:   { width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 0 1px rgba(17,24,39,0.04)" },
  avaText:   { fontSize: 20, fontWeight: 800, color: "#FFFFFF", textShadow: "0 1px 2px rgba(0,0,0,0.12)" },
  cardName:  { fontSize: 16.5, fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 175, letterSpacing: "-0.01em" },
  cardMeta:  { fontSize: 12.5, color: "#9CA3AF", marginTop: 3, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cardMetaDot: { color: "#D1D5DB" },
  cardSub:   { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#9CA3AF", fontWeight: 500 },

  // Small caption line inside a card (e.g. "Arrived 8:14am", "Waiting on parent") —
  // deliberately NOT a colored pill; the filter chips own status communication now
  cardNote: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#8B93A1", fontWeight: 600 },

  // Badge — fixed height (22px) so every status pill matches regardless of icon/label
  badge: { display: "inline-flex", alignItems: "center", gap: 6, height: 22, padding: "0 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.01em" },

  // Card action button — the primary action on every card; radius matches the
  // page's one button-radius token (10px, shared with search/select/header btn)
  cardBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", height: 44, borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", border: "none", textAlign: "center" },

  // Hero action — the strongest visual element on the card (Check In / Release / Pick Up)
  heroBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 52, borderRadius: 14, fontSize: 14.5, fontWeight: 800, cursor: "pointer", border: "none", color: "#FFFFFF", textAlign: "center", letterSpacing: "-0.01em" },

  // Empty state — replaces a blank grid when a filter matches nothing
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "64px 20px", gap: 10 },
  emptyIcon:  { fontSize: 40, lineHeight: 1 },
  emptyText:  { fontSize: 14.5, fontWeight: 600, color: "#8B93A1", margin: 0 },

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
