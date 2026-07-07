/**
 * ParentCheckIn.jsx â€” Parent Self Check-In with Gate QR + Face Detection
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * 4-step workflow:
 *   Step 1 â€” Scan gate QR  (rear camera, html5-qrcode)
 *   Step 2 â€” Select child  (parent name + relation + student picker)
 *   Step 3 â€” Face selfie   (front camera, face-api.js TinyFaceDetector)
 *   Step 4 â€” Success       (entry summary + restart)
 *
 * Face detection states:
 *   loading        â†’ models or camera loading
 *   no-face        â†’ 0 faces â€” blocks submit
 *   multiple-faces â†’ >1 face  â€” blocks submit
 *   too-small      â†’ face area <5% of frame â€” prompts "Move closer"
 *   ready          â†’ exactly 1 adequate face â€” enables Check-In/Check-Out
 *
 * Architecture:
 *   â€¢ Standalone full-page (no MainLayout)
 *   â€¢ mountedRef guards every async callback
 *   â€¢ Camera streams are stopped before switching steps
 *   â€¢ Selfie compressed to 120Ã—90 JPEG (â‰¤50 000 Google Sheets char limit)
 *   â€¢ GPS requested at Step 3 launch, non-blocking
 *   â€¢ No face RECOGNITION â€” detection only (count + area)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link }                    from "react-router-dom";
import { PLATFORM_NAME }                from "../config/environment";
import { Html5Qrcode }             from "html5-qrcode";
import * as faceapi                from "@vladmandic/face-api";
import parentAttendanceService     from "../services/parentAttendanceService";
import pickupAuthorizationService  from "../services/pickupAuthorizationService";
import pickupHistoryService        from "../services/pickupHistoryService";
import { api }                     from "../services/authService";

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const RELATIONS   = ["Father", "Mother", "Guardian", "Grandparent", "Other"];
const FACE_STATES = {
  loading:        { icon:"â³", text:"Starting cameraâ€¦",          color:"text-gray-400",   bg:"bg-gray-800/60"     },
  models:         { icon:"âš™ï¸",  text:"Loading face detectionâ€¦",  color:"text-yellow-300", bg:"bg-yellow-900/40"   },
  "no-face":      { icon:"ðŸ‘¤",  text:"No face detected",          color:"text-red-300",    bg:"bg-red-900/50"      },
  "multiple-faces":{ icon:"ðŸ‘¥", text:"Multiple faces detected",   color:"text-orange-300", bg:"bg-orange-900/50"   },
  "too-small":    { icon:"ðŸ”",  text:"Move closer to camera",     color:"text-yellow-300", bg:"bg-yellow-900/40"   },
  ready:          { icon:"âœ…",  text:"Face detected â€” ready!",    color:"text-emerald-300",bg:"bg-emerald-900/50"   },
};

// â”€â”€ Gate QR parser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// "YD-SEAWOODS-GATE-1" â†’ { branch:"SEAWOODS", gate:"GATE-1", label:"SEAWOODS / GATE-1" }
function parseGateQR(text) {
  const t = (text || "").trim();
  if (!t.startsWith("YD-")) return null;
  const parts = t.split("-");
  if (parts.length < 4) return null;
  const branch = parts[1].toUpperCase();
  const gate   = parts.slice(2).join("-").toUpperCase();
  return { branch, gate, label: `${branch} / ${gate}`, raw: t };
}

// â”€â”€ Selfie compression â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Draws video frame onto 120Ã—90 canvas, exports as JPEG 0.55 quality
// â†’ ~3-7 KB base64 â†’ well within Google Sheets 50 000 char cell limit
function captureSelfie(videoEl) {
  const W = 120, H = 90;
  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  // mirror the front-camera image horizontally
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, W, H);
  return canvas.toDataURL("image/jpeg", 0.55);
}

// â”€â”€ useToast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, msg) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5_000);
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

function ToastStack({ toasts, onDismiss }) {
  const style = { success:"bg-yd-navy", error:"bg-rose-600", info:"bg-sky-700" };
  const icon  = { success:"âœ…", error:"âŒ", info:"â„¹ï¸" };
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold
                      text-white pointer-events-auto ${style[t.type]}`}>
          <span>{icon[t.type]}</span>
          <span className="flex-1">{t.msg}</span>
          <button onClick={() => onDismiss(t.id)}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 font-bold">Ã—</button>
        </div>
      ))}
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Step 1 â€” Gate QR Scanner
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function Step1GateScan({ onScan, toast }) {
  const [scanning,  setScanning ] = useState(false);
  const [camError,  setCamError ] = useState(null);
  const [manualQR,  setManualQR ] = useState("");
  const html5QrRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Start scanner automatically
    startScanner();
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startScanner = async () => {
    setCamError(null);
    try {
      const qr = new Html5Qrcode("gate-qr-viewport");
      html5QrRef.current = qr;
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (text) => handleScanned(text),
        () => {}
      );
      if (mountedRef.current) setScanning(true);
    } catch (e) {
      const msg = e?.message || "";
      if (mountedRef.current) {
        setCamError(msg.includes("permission") || msg.includes("NotAllowed")
          ? "Camera permission denied. Please allow camera access."
          : `Camera error: ${msg}`);
      }
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

  const handleScanned = useCallback(async (text) => {
    const gate = parseGateQR(text);
    if (!gate) {
      toast.error(`Not a valid ${PLATFORM_NAME} gate QR. Try again.`);
      return;
    }
    await stopScanner();
    onScan(gate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualSubmit = () => {
    const gate = parseGateQR(manualQR.trim());
    if (!gate) { toast.error("Format should be: YD-BRANCHNAME-GATE-N"); return; }
    stopScanner();
    onScan(gate);
  };

  return (
    <div className="flex flex-col items-center px-5 py-8 max-w-sm mx-auto">
      <div className="text-5xl mb-3">ðŸ«</div>
      <h1 className="text-2xl font-black text-white mb-1 text-center">Scan School Gate QR</h1>
      <p className="text-gray-400 text-sm text-center mb-6">
        Point camera at the QR code posted at the school entrance gate.
      </p>

      {/* Camera viewport */}
      <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-black border-2 border-gray-700 shadow-2xl mb-5">
        <div id="gate-qr-viewport" className="w-full h-full"/>

        {/* Scan frame */}
        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-52 h-52">
              {[["top-0 left-0","border-t-4 border-l-4"],["top-0 right-0","border-t-4 border-r-4"],
                ["bottom-0 left-0","border-b-4 border-l-4"],["bottom-0 right-0","border-b-4 border-r-4"]
              ].map(([p,b],i) => <div key={i} className={`absolute ${p} w-8 h-8 ${b} border-[var(--yd-yellow-light)] rounded-sm`}/>)}
            </div>
          </div>
        )}

        {!scanning && !camError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <div className="w-8 h-8 border-4 border-[var(--yd-yellow-light)] border-t-transparent rounded-full animate-spin mb-3"/>
            <p className="text-white text-sm font-semibold">Starting cameraâ€¦</p>
          </div>
        )}
        {camError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 px-6 text-center">
            <div className="text-4xl mb-3">ðŸš«</div>
            <p className="text-white font-bold text-sm leading-relaxed">{camError}</p>
            <button onClick={startScanner}
              className="mt-4 px-5 py-2 bg-[var(--yd-yellow-light)] text-yd-navy font-bold rounded-xl text-sm">
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Manual entry */}
      <p className="text-gray-500 text-xs mb-2 font-semibold">Or enter QR code manually:</p>
      <div className="flex gap-2 w-full">
        <input
          value={manualQR}
          onChange={e => setManualQR(e.target.value)}
          placeholder="YD-SEAWOODS-GATE-1"
          className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-sm
                     text-white placeholder-gray-500 focus:outline-none focus:border-[var(--yd-yellow-light)]"/>
        <button onClick={handleManualSubmit}
          className="px-4 py-2.5 bg-[var(--yd-yellow-light)] text-yd-navy font-bold rounded-xl text-sm
                     hover:bg-yellow-400 transition-colors active:scale-95">
          Go
        </button>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Step 2 â€” Parent + Student Selection
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function Step2StudentSelect({ gate, onNext, onBack, toast }) {
  const mountedRef   = useRef(true);
  const [students,   setStudents  ] = useState([]);
  const [loading,    setLoading   ] = useState(true);
  const [parentName, setParentName] = useState("");
  const [relation,   setRelation  ] = useState("Father");
  const [search,     setSearch    ] = useState("");
  const [selected,   setSelected  ] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    api.get("/students")
      .then(r => r.data)
      .then(d => {
        if (!mountedRef.current) return;
        const list = (Array.isArray(d) ? d : []).filter(s =>
          (s.Status || s.status || "Active") === "Active"
        );
        setStudents(list);
      })
      .catch(() => toast.error("Could not load students."))
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = students.filter(s => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = (s.Student_Name || s.name || "").toLowerCase();
    const id   = (s.Student_ID   || s.id   || "").toLowerCase();
    const cls  = (s.Class        || s.class|| "").toLowerCase();
    return name.includes(q) || id.includes(q) || cls.includes(q);
  });

  const canProceed = parentName.trim().length > 1 && selected;

  function handleNext() {
    if (!canProceed) return;
    onNext({
      parent:  { name: parentName.trim(), relation },
      student: {
        id:    selected.Student_ID || selected.id,
        name:  selected.Student_Name || selected.name,
        class: selected.Class || selected.class,
      },
    });
  }

  return (
    <div className="flex flex-col px-5 py-6 max-w-sm mx-auto w-full">
      {/* Gate info */}
      <button onClick={onBack} className="self-start text-gray-500 text-sm mb-4 flex items-center gap-1.5 hover:text-gray-300">
        â† Back
      </button>
      <div className="bg-gray-800/60 border border-gray-700 rounded-2xl px-4 py-3 mb-5">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Gate</p>
        <p className="text-white font-black text-lg">{gate.label}</p>
      </div>

      {/* Parent info */}
      <h2 className="text-lg font-black text-white mb-4">Your Details</h2>
      <div className="space-y-3 mb-5">
        <input value={parentName} onChange={e => setParentName(e.target.value)}
          placeholder="Your full name *"
          className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-sm
                     text-white placeholder-gray-500 focus:outline-none focus:border-[var(--yd-yellow-light)]"/>
        <div className="flex gap-2 flex-wrap">
          {RELATIONS.map(r => (
            <button key={r} onClick={() => setRelation(r)}
              className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-sm font-bold border transition-all
                ${relation === r
                  ? "bg-[var(--yd-yellow-light)] text-yd-navy border-transparent"
                  : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Student search */}
      <h2 className="text-lg font-black text-white mb-3">Select Your Child</h2>
      <input value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }}
        placeholder="ðŸ” Search by name, class, or IDâ€¦"
        className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-sm
                   text-white placeholder-gray-500 focus:outline-none focus:border-[var(--yd-yellow-light)] mb-3"/>

      <div className="flex-1 overflow-y-auto max-h-[38vh] space-y-2 pr-1 scrollbar-none mb-5">
        {loading ? (
          [...Array(4)].map((_,i) => <div key={i} className="h-14 rounded-xl bg-gray-800 animate-pulse"/>)
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-6">No students found.</p>
        ) : filtered.map(s => {
          const sid  = s.Student_ID || s.id;
          const name = s.Student_Name || s.name;
          const cls  = s.Class || s.class;
          const sel  = selected?.id === sid;
          return (
            <button key={sid} onClick={() => setSelected({ id:sid, name, class:cls })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all
                ${sel ? "bg-[var(--yd-yellow-light)]/10 border-[var(--yd-yellow-light)] text-white" : "bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-500"}`}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600
                              flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                {name.split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{name}</p>
                <p className="text-[11px] text-gray-400">{cls} Â· {sid}</p>
              </div>
              {sel && <span className="text-[var(--yd-yellow-light)] text-lg">âœ“</span>}
            </button>
          );
        })}
      </div>

      <button onClick={handleNext} disabled={!canProceed}
        className={`w-full py-4 rounded-2xl text-base font-black transition-all
          ${canProceed
            ? "bg-[var(--yd-yellow-light)] text-yd-navy hover:bg-yellow-400 active:scale-95 shadow-lg shadow-yellow-500/20"
            : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}>
        {selected ? `Continue with ${selected.name}` : "Select a student to continue"} â†’
      </button>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Checkout Verification Modal (Check_Out only)
// Shows captured selfie + authorized persons list for teacher approval
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function VerificationModal({
  student, selfieDataUrl, authorizedPersons, loadingPersons,
  onApprove, onBlock, onCancel, submitting,
}) {
  const [selectedPerson, setSelectedPerson] = useState(null);

  const activePersons = authorizedPersons.filter(p => p.status === "Active");

  const handleApprove = () => {
    if (!selectedPerson) return;
    onApprove(selectedPerson);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[95vh] overflow-y-auto border border-gray-700 shadow-2xl">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">Pickup Verification</h2>
            <p className="text-gray-400 text-xs mt-0.5">Verify identity before checkout</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-900/50 border border-rose-700 rounded-xl">
            <span className="text-rose-400 text-xs font-black">ðŸ” CHECK-OUT</span>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Student info + selfie */}
          <div className="flex items-center gap-4 bg-gray-800/60 rounded-2xl p-4 border border-gray-700">
            {selfieDataUrl ? (
              <img src={selfieDataUrl} alt="Pickup selfie"
                className="w-20 h-16 rounded-xl object-cover border-2 border-[var(--yd-yellow-light)]/40 shadow-md flex-shrink-0"/>
            ) : (
              <div className="w-20 h-16 rounded-xl bg-gray-700 flex items-center justify-center text-gray-500 flex-shrink-0">ðŸ“·</div>
            )}
            <div>
              <p className="text-white font-black text-base">{student.name}</p>
              <p className="text-gray-400 text-xs">{student.class} Â· {student.id}</p>
              <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Live capture â€” photo proof stored</p>
            </div>
          </div>

          {/* Authorized persons */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
              Select Authorized Pickup Person
            </p>
            {loadingPersons ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-gray-800 animate-pulse"/>)}
              </div>
            ) : activePersons.length === 0 ? (
              <div className="bg-amber-900/30 border border-amber-700 rounded-2xl p-4 text-center">
                <p className="text-amber-300 text-sm font-bold mb-1">âš ï¸ No Authorized Persons Configured</p>
                <p className="text-amber-400 text-xs">
                  No authorized pickup persons are set up for this student.
                  Contact admin to add authorized persons.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {activePersons.map(person => (
                  <button key={person.entryId}
                    onClick={() => setSelectedPerson(prev => prev?.entryId === person.entryId ? null : person)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all
                      ${selectedPerson?.entryId === person.entryId
                        ? "bg-emerald-900/40 border-emerald-500 shadow-lg"
                        : "bg-gray-800/60 border-gray-700 hover:border-gray-600"}`}>
                    {person.photoUrl ? (
                      <img src={person.photoUrl} alt={person.pickupName}
                        className="w-12 h-12 rounded-xl object-cover border-2 border-gray-600 flex-shrink-0"/>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-800
                                      flex items-center justify-center text-white text-sm font-black flex-shrink-0 border-2 border-gray-600">
                        {(person.pickupName || "?").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-bold text-sm truncate">{person.pickupName}</p>
                        {person.emergency && (
                          <span className="text-[10px] font-black text-amber-400 bg-amber-900/40 px-1.5 py-0.5 rounded-full border border-amber-700 flex-shrink-0">
                            ðŸš¨ EMERGENCY
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs">{person.relation}</p>
                      {person.mobile && <p className="text-gray-500 text-[10px] font-mono">ðŸ“ž {person.mobile}</p>}
                    </div>
                    {selectedPerson?.entryId === person.entryId && (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-black flex-shrink-0">âœ“</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            {/* Approve */}
            <button
              onClick={handleApprove}
              disabled={!selectedPerson || submitting}
              className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2
                ${selectedPerson && !submitting
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 shadow-lg shadow-emerald-500/30"
                  : "bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700"}`}>
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
              ) : (
                <>âœ… Authorize Checkout{selectedPerson ? ` â€” ${selectedPerson.pickupName}` : ""}</>
              )}
            </button>

            {/* Emergency auth (if no match but confirmed) */}
            {activePersons.length > 0 && (
              <button
                onClick={() => onApprove({ ...selectedPerson, _emergency: true, pickupName: selectedPerson?.pickupName || "Verified by Staff" })}
                disabled={!selectedPerson || submitting}
                className={`w-full py-3 rounded-2xl font-bold text-sm transition-all border
                  ${selectedPerson && !submitting
                    ? "border-amber-600 text-amber-400 bg-amber-900/20 hover:bg-amber-900/40 active:scale-95"
                    : "border-gray-700 text-gray-700 cursor-not-allowed"}`}>
                ðŸš¨ Emergency Authorization
              </button>
            )}

            {/* Block unauthorized */}
            <button
              onClick={onBlock}
              disabled={submitting}
              className="w-full py-3 rounded-2xl font-bold text-sm border border-rose-700
                         text-rose-400 bg-rose-900/20 hover:bg-rose-900/40 active:scale-95 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed">
              ðŸš« Block â€” Unauthorized Pickup Attempt
            </button>

            <button onClick={onCancel} disabled={submitting}
              className="w-full py-2.5 text-gray-500 text-sm font-semibold hover:text-gray-300 transition-colors">
              â† Back to camera
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Step 3 â€” Front Camera + Face Detection + Submit
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function Step3FaceSubmit({ gate, parent, student, onSuccess, onBack, toast }) {
  const mountedRef     = useRef(true);
  const videoRef       = useRef(null);
  const streamRef      = useRef(null);
  const detectorRef    = useRef(null);
  const detectTimerRef = useRef(null);

  const [faceStatus,  setFaceStatus ] = useState("loading");
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [camError,    setCamError   ] = useState(null);
  const [submitting,  setSubmitting ] = useState(false);
  const [gps,         setGps        ] = useState("unavailable");

  // Checkout verification state
  const [verifyOpen,        setVerifyOpen       ] = useState(false);
  const [capturedSelfie,    setCapturedSelfie   ] = useState(null);
  const [authorizedPersons, setAuthorizedPersons] = useState([]);
  const [loadingPersons,    setLoadingPersons   ] = useState(false);

  // â”€â”€ Load face-api models â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    mountedRef.current = true;

    async function loadModels() {
      try {
        setFaceStatus("models");
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        if (mountedRef.current) {
          setModelsReady(true);
          setFaceStatus("loading");
        }
      } catch (e) {
        console.error("[face-api] model load error:", e);
        if (mountedRef.current) setCamError("Face detection models failed to load. Please refresh.");
      }
    }

    loadModels();

    // Request GPS non-blocking
    navigator.geolocation?.getCurrentPosition(
      pos => setGps(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`),
      ()  => setGps("unavailable"),
      { timeout: 6_000, maximumAge: 60_000 }
    );

    return () => {
      mountedRef.current = false;
      stopDetection();
      stopCamera();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Start camera once models are ready â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (modelsReady) startCamera();
  }, [modelsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      if (mountedRef.current) {
        setCameraReady(true);
        startDetection();
      }
    } catch (e) {
      if (!mountedRef.current) return;
      const msg = e?.message || "";
      setCamError(
        msg.includes("permission") || msg.includes("NotAllowed") || msg.includes("NotFoundError")
          ? "Front camera access denied. Please allow camera permission and refresh."
          : `Camera error: ${msg}`
      );
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // â”€â”€ Face detection loop (~8fps) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const runDetection = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !modelsReady || video.readyState < 2) return;

    try {
      const opts = new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.45,
      });
      const detections = await faceapi.detectAllFaces(video, opts);

      if (!mountedRef.current) return;

      if (detections.length === 0) {
        setFaceStatus("no-face");
      } else if (detections.length > 1) {
        setFaceStatus("multiple-faces");
      } else {
        // Check face is large enough (not too far from camera)
        const box      = detections[0].box;
        const vidW     = video.videoWidth  || 640;
        const vidH     = video.videoHeight || 480;
        const faceArea = box.width * box.height;
        const frameArea= vidW * vidH;
        if (faceArea / frameArea < 0.04) {
          setFaceStatus("too-small");
        } else {
          setFaceStatus("ready");
        }
      }
    } catch {
      // Suppress individual frame errors silently
    }
  }, [modelsReady]);

  const startDetection = useCallback(() => {
    stopDetection();
    detectTimerRef.current = setInterval(runDetection, 125); // ~8fps
  }, [runDetection]);

  const stopDetection = () => {
    if (detectTimerRef.current) {
      clearInterval(detectTimerRef.current);
      detectTimerRef.current = null;
    }
  };

  // â”€â”€ Core submit (saves to ParentAttendance) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const submitAttendance = useCallback(async (action, selfieDataUrl) => {
    const payload = {
      studentId:    student.id,
      studentName:  student.name,
      parentName:   parent.name,
      relation:     parent.relation,
      action,
      gate:         gate.label,
      selfieImage:  selfieDataUrl,
      faceDetected: "true",
      gps,
    };
    return parentAttendanceService.create(payload);
  }, [student, parent, gate, gps]);

  // â”€â”€ Check-In: direct submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleCheckIn = useCallback(async () => {
    if (faceStatus !== "ready" || submitting) return;
    setSubmitting(true);
    stopDetection();
    try {
      const selfieDataUrl = captureSelfie(videoRef.current);
      const result = await submitAttendance("Check_In", selfieDataUrl);
      stopCamera();
      onSuccess({
        ...result.entry,
        action: "Check_In",
        selfieDataUrl,
        studentName:  student.name,
        parentName:   parent.name,
        gate:         gate.label,
      });
    } catch (e) {
      if (!mountedRef.current) return;
      toast.error(e.message || "Failed to save. Please try again.");
      setSubmitting(false);
      startDetection();
    }
  }, [faceStatus, submitting, student, parent, gate, submitAttendance, onSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Check-Out: show verification modal first â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleCheckOut = useCallback(async () => {
    if (faceStatus !== "ready" || submitting) return;
    // Capture selfie & stop detection â€” camera stays live for visual
    stopDetection();
    const selfieDataUrl = captureSelfie(videoRef.current);
    setCapturedSelfie(selfieDataUrl);

    // Fetch authorized persons in parallel
    setLoadingPersons(true);
    setVerifyOpen(true);
    try {
      const result = await pickupAuthorizationService.getPersons({ studentId: student.id, status: "Active" });
      if (mountedRef.current) setAuthorizedPersons(result.entries || []);
    } catch {
      if (mountedRef.current) setAuthorizedPersons([]);
    } finally {
      if (mountedRef.current) setLoadingPersons(false);
    }
  }, [faceStatus, submitting, student]); // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Verification: authorized â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleVerifyApprove = useCallback(async (pickedPerson) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const approvalStatus = pickedPerson?._emergency
        ? "Emergency_Authorized"
        : "Authorized";

      // 1. Save ParentAttendance record
      const result = await submitAttendance("Check_Out", capturedSelfie);

      // 2. Save PickupHistory record
      await pickupHistoryService.addHistory({
        studentId:      student.id,
        studentName:    student.name,
        pickupName:     pickedPerson?.pickupName || "",
        relation:       pickedPerson?.relation   || "",
        selfieImage:    capturedSelfie,
        approvalStatus,
        verifiedBy:     "Staff",
      });

      stopCamera();
      setVerifyOpen(false);
      onSuccess({
        ...result.entry,
        action:       "Check_Out",
        selfieDataUrl: capturedSelfie,
        studentName:   student.name,
        parentName:    parent.name,
        gate:          gate.label,
        approvalStatus,
        verifiedBy:    pickedPerson?.pickupName || "Staff",
      });
    } catch (e) {
      if (!mountedRef.current) return;
      toast.error(e.message || "Failed to save checkout.");
      setSubmitting(false);
    }
  }, [submitting, capturedSelfie, student, parent, gate, submitAttendance, onSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Verification: unauthorized block â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleVerifyBlock = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Log unauthorized attempt to PickupHistory (no ParentAttendance save)
      await pickupHistoryService.addHistory({
        studentId:      student.id,
        studentName:    student.name,
        pickupName:     "",
        relation:       "",
        selfieImage:    capturedSelfie,
        approvalStatus: "Unauthorized",
        verifiedBy:     "Staff",
      });
      stopCamera();
      setVerifyOpen(false);
      onSuccess({
        action:        "Check_Out_Blocked",
        selfieDataUrl:  capturedSelfie,
        studentName:    student.name,
        parentName:     parent.name,
        gate:           gate.label,
        approvalStatus: "Unauthorized",
      });
    } catch (e) {
      if (!mountedRef.current) return;
      toast.error(e.message || "Failed to log unauthorized attempt.");
      setSubmitting(false);
    }
  }, [submitting, capturedSelfie, student, parent, gate, onSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Cancel verification â€” resume camera â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleVerifyCancel = useCallback(() => {
    setVerifyOpen(false);
    setCapturedSelfie(null);
    setAuthorizedPersons([]);
    startDetection();
  }, [startDetection]);

  // â”€â”€ Face status config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const statusCfg = FACE_STATES[faceStatus] || FACE_STATES["loading"];
  const isReady   = faceStatus === "ready";

  return (
    <div className="flex flex-col items-center px-5 py-5 max-w-sm mx-auto w-full">
    {verifyOpen && (
      <VerificationModal
        student={student}
        selfieDataUrl={capturedSelfie}
        authorizedPersons={authorizedPersons}
        loadingPersons={loadingPersons}
        onApprove={handleVerifyApprove}
        onBlock={handleVerifyBlock}
        onCancel={handleVerifyCancel}
        submitting={submitting}
      />
    )}
      <button onClick={onBack} className="self-start text-gray-500 text-sm mb-3 flex items-center gap-1.5 hover:text-gray-300">
        â† Back
      </button>

      {/* Student info strip */}
      <div className="w-full bg-gray-800/60 border border-gray-700 rounded-2xl px-4 py-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-black">{student.name}</p>
            <p className="text-gray-400 text-xs">{student.class} Â· {student.id}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider">{parent.relation}</p>
            <p className="text-white text-sm font-semibold">{parent.name}</p>
          </div>
        </div>
      </div>

      {/* Camera viewport */}
      <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black border-2 border-gray-700 shadow-2xl mb-3">
        <video
          ref={videoRef}
          className="w-full h-full object-cover scale-x-[-1]" // mirror for selfie UX
          autoPlay
          muted
          playsInline
        />

        {/* Loading overlay */}
        {!cameraReady && !camError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <div className="w-10 h-10 border-4 border-[var(--yd-yellow-light)] border-t-transparent rounded-full animate-spin mb-3"/>
            <p className="text-white font-semibold text-sm">
              {faceStatus === "models" ? "Loading face detectionâ€¦" : "Starting front cameraâ€¦"}
            </p>
          </div>
        )}

        {/* Camera error overlay */}
        {camError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 px-6 text-center">
            <div className="text-4xl mb-3">ðŸš«</div>
            <p className="text-white font-bold text-sm leading-relaxed">{camError}</p>
          </div>
        )}

        {/* Submitting overlay */}
        {submitting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <div className="w-10 h-10 border-4 border-[var(--yd-yellow-light)] border-t-transparent rounded-full animate-spin mb-3"/>
            <p className="text-white font-bold text-sm">Saving attendanceâ€¦</p>
          </div>
        )}

        {/* Face oval guide */}
        {cameraReady && !submitting && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-36 h-44 rounded-full border-4 transition-colors duration-300
              ${isReady ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]"
                        : "border-gray-500 border-dashed"}`}/>
          </div>
        )}
      </div>

      {/* Face detection status badge */}
      {cameraReady && !camError && !submitting && (
        <div className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl mb-4 ${statusCfg.bg}`}>
          <span className="text-xl">{statusCfg.icon}</span>
          <span className={`font-bold text-sm ${statusCfg.color}`}>{statusCfg.text}</span>
          {faceStatus === "loading" && (
            <div className="ml-auto w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>
          )}
        </div>
      )}

      {/* Instruction */}
      {cameraReady && !isReady && !camError && !submitting && (
        <p className="text-gray-500 text-xs text-center mb-4 leading-relaxed">
          {faceStatus === "no-face"         && "Look directly at the camera. Make sure your face is well-lit and visible."}
          {faceStatus === "multiple-faces"  && "Only one person should be in frame. Please step aside from others."}
          {faceStatus === "too-small"       && "You are too far away. Move the phone closer to your face."}
        </p>
      )}

      {/* Action buttons */}
      {cameraReady && !camError && !submitting && !verifyOpen && (
        <div className="flex gap-3 w-full mt-1">
          <button
            onClick={handleCheckIn}
            disabled={!isReady}
            className={`flex-1 py-4 rounded-2xl font-black text-base transition-all
              ${isReady
                ? "bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 shadow-lg shadow-emerald-500/30"
                : "bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700"}`}>
            âœ… Check In
          </button>
          <button
            onClick={handleCheckOut}
            disabled={!isReady}
            className={`flex-1 py-4 rounded-2xl font-black text-base transition-all
              ${isReady
                ? "bg-rose-500 hover:bg-rose-600 text-white active:scale-95 shadow-lg shadow-rose-500/30"
                : "bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700"}`}>
            ðŸ” Check Out
          </button>
        </div>
      )}

      {/* Face requirement note */}
      <p className="text-gray-600 text-[10px] text-center mt-3 leading-relaxed">
        ðŸ“¸ A selfie is required for attendance verification. No face = no entry.
      </p>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Step 4 â€” Success (or Blocked)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function Step4Success({ entry, onDone }) {
  const isBlocked  = entry.action === "Check_Out_Blocked" || entry.approvalStatus === "Unauthorized";
  const isCheckIn  = entry.action === "Check_In";
  const isCheckOut = entry.action === "Check_Out" && !isBlocked;
  const time = entry.time || new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});

  if (isBlocked) {
    return (
      <div className="flex flex-col items-center px-6 py-10 max-w-sm mx-auto text-center">
        <div className="w-24 h-24 rounded-full bg-rose-900/40 border-4 border-rose-500 flex items-center justify-center mb-5 text-4xl">ðŸš«</div>
        <h2 className="text-2xl font-black text-rose-400 mb-2">Pickup Blocked</h2>
        <p className="text-gray-300 text-base font-semibold mb-1">{entry.studentName}</p>
        <p className="text-gray-500 text-sm mb-6">Unauthorized pickup attempt logged and reported.</p>
        <div className="w-full bg-rose-900/20 border border-rose-800 rounded-2xl p-4 mb-6 text-left">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Status</span>
            <span className="text-rose-400 font-bold">ðŸš« UNAUTHORIZED</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Gate</span>
            <span className="text-white font-semibold">{entry.gate}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Logged at</span>
            <span className="text-white font-semibold font-mono">{time}</span>
          </div>
        </div>
        <button onClick={onDone}
          className="w-full py-4 bg-rose-600 text-white font-black text-lg rounded-2xl
                     hover:bg-rose-700 active:scale-95 transition-all">
          Done
        </button>
        <p className="text-gray-600 text-xs mt-3">Incident recorded to Pickup History</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-6 py-10 max-w-sm mx-auto text-center">
      {/* Selfie thumbnail */}
      {entry.selfieDataUrl && (
        <div className="mb-5 relative">
          <img src={entry.selfieDataUrl} alt="Selfie"
            className="w-24 h-24 rounded-full object-cover border-4 border-[var(--yd-yellow-light)] shadow-xl shadow-yellow-500/20"/>
          <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-lg
            ${isCheckIn ? "bg-emerald-500" : "bg-rose-500"}`}>
            {isCheckIn ? "âœ…" : "ðŸ‘‹"}
          </div>
        </div>
      )}

      <div className={`text-5xl mb-4 ${isCheckIn ? "" : ""}`}>
        {isCheckIn ? "ðŸŽ‰" : "ðŸ‘‹"}
      </div>

      <h2 className="text-2xl font-black text-white mb-1">
        {isCheckIn ? "Checked In!" : isCheckOut ? "Checkout Authorized! ðŸ”" : "Done!"}
      </h2>

      <p className="text-gray-300 text-base font-semibold mb-1">
        {entry.studentName}
      </p>
      <p className="text-gray-500 text-sm mb-5">{entry.parentName}</p>

      {/* Info grid */}
      <div className="w-full bg-gray-800/60 border border-gray-700 rounded-2xl p-4 mb-6 space-y-2 text-left">
        {[
          { label: "Time",   val: time },
          { label: "Gate",   val: entry.gate },
          { label: "Method", val: "Parent QR" },
          { label: "Face",   val: "âœ… Verified" },
          ...(entry.approvalStatus ? [{ label:"Approval", val: entry.approvalStatus === "Emergency_Authorized" ? "ðŸš¨ Emergency Auth" : entry.approvalStatus === "Authorized" ? "âœ… Authorized" : entry.approvalStatus }] : []),
          ...(entry.verifiedBy ? [{ label:"Verified by", val: entry.verifiedBy }] : []),
          ...(entry.gps && entry.gps !== "unavailable" ? [{ label:"GPS", val: entry.gps }] : []),
        ].map(({ label, val }) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">{label}</span>
            <span className="text-white font-semibold text-right max-w-[60%] truncate">{val}</span>
          </div>
        ))}
      </div>

      <button onClick={onDone}
        className="w-full py-4 bg-[var(--yd-yellow-light)] text-yd-navy font-black text-lg rounded-2xl
                   hover:bg-yellow-400 active:scale-95 transition-all shadow-lg shadow-yellow-500/20">
        Done âœ“
      </button>
      <p className="text-gray-600 text-xs mt-3">Attendance saved to Google Sheets</p>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Main â€” ParentCheckIn Page
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function ParentCheckIn() {
  const toast = useToast();

  const [step,    setStep   ] = useState(1);
  const [gate,    setGate   ] = useState(null);   // { branch, gate, label, raw }
  const [parent,  setParent ] = useState(null);   // { name, relation }
  const [student, setStudent] = useState(null);   // { id, name, class }
  const [lastEntry,setLastEntry] = useState(null);

  const handleGateScan = useCallback((parsedGate) => {
    setGate(parsedGate);
    setStep(2);
  }, []);

  const handleStudentSelect = useCallback(({ parent: p, student: s }) => {
    setParent(p);
    setStudent(s);
    setStep(3);
  }, []);

  const handleSuccess = useCallback((entry) => {
    setLastEntry(entry);
    setStep(4);
  }, []);

  const handleDone = useCallback(() => {
    setStep(1);
    setGate(null);
    setParent(null);
    setStudent(null);
    setLastEntry(null);
  }, []);

  // Step progress indicator labels
  const stepLabels = ["Scan Gate", "Select Child", "Face & Submit", "Done"];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss}/>

      {/* Top bar */}
      <div className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-5 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-black text-[var(--yd-yellow)]">{PLATFORM_NAME.charAt(0)}</span>
          <span className="text-xs text-gray-500 font-semibold hidden sm:block">{PLATFORM_NAME}</span>
        </Link>
        <div className="text-center">
          <p className="text-white font-black text-sm">Parent Check-In</p>
          {gate && <p className="text-[10px] text-gray-500">{gate.label}</p>}
        </div>
        <Link to="/pickup-authorization" className="text-xs text-gray-500 hover:text-[var(--yd-yellow-light)] transition-colors font-semibold">ðŸ” Auth</Link>
      </div>

      {/* Step progress */}
      {step < 4 && (
        <div className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-5 py-2">
          <div className="flex items-center gap-1 max-w-sm mx-auto">
            {stepLabels.slice(0,3).map((label, i) => {
              const n = i + 1;
              const active  = step === n;
              const done    = step > n;
              return (
                <div key={n} className="flex items-center gap-1 flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-colors
                      ${done   ? "bg-[var(--yd-yellow-light)] text-yd-navy"
                               : active ? "bg-yd-navy border-2 border-[var(--yd-yellow-light)] text-[var(--yd-yellow-light)]"
                                        : "bg-gray-800 text-gray-600"}`}>
                      {done ? "âœ“" : n}
                    </div>
                    <p className={`text-[9px] font-bold mt-0.5 whitespace-nowrap
                      ${active ? "text-[var(--yd-yellow-light)]" : done ? "text-gray-400" : "text-gray-600"}`}>
                      {label}
                    </p>
                  </div>
                  {i < 2 && <div className={`h-px flex-1 mb-4 ${done ? "bg-[var(--yd-yellow-light)]" : "bg-gray-800"}`}/>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {step === 1 && (
          <Step1GateScan onScan={handleGateScan} toast={toast}/>
        )}
        {step === 2 && gate && (
          <Step2StudentSelect
            gate={gate}
            onNext={handleStudentSelect}
            onBack={() => setStep(1)}
            toast={toast}
          />
        )}
        {step === 3 && gate && parent && student && (
          <Step3FaceSubmit
            gate={gate}
            parent={parent}
            student={student}
            onSuccess={handleSuccess}
            onBack={() => setStep(2)}
            toast={toast}
          />
        )}
        {step === 4 && lastEntry && (
          <Step4Success entry={lastEntry} onDone={handleDone}/>
        )}
      </div>
    </div>
  );
}

