/**
 * StaffCheckout.jsx — Staff-only child checkout flow
 * ──────────────────────────────────────────────────────────────────
 *
 * Flow:
 *   1. Search / select student to checkout
 *   2. Confirm child is present (check status)
 *   3a. Authorized person → select from list → confirm → record Check_Out
 *   3b. Unknown person → capture photo → create pickup request → wait for parent
 *
 * Permissions: staff, teacher, center_admin, super_admin, developer
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";
import securityService from "../services/securityService";
import pickupAuthorizationService from "../services/pickupAuthorizationService";

// ── Image capture utility ─────────────────────────────────────────
function dataUrlFromVideo(videoEl, w = 480, h = 360) {
  const canvas = document.createElement("canvas");
  canvas.width  = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(videoEl, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.75);
}

// ── Helpers ────────────────────────────────────────────────────────
function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

const STATUS_COLORS = {
  PRESENT:     { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  CHECKED_OUT: { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  NOT_ARRIVED: { bg: "#F3F4F6", text: "#374151", dot: "#9CA3AF" },
};

// ══════════════════════════════════════════════════════════════════
export default function StaffCheckout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState("search"); // search|status|person|photo|sent|done

  // Student
  const [students,      setStudents     ] = useState([]);
  const [stuLoading,    setStuLoading   ] = useState(true);
  const [stuSearch,     setStuSearch    ] = useState("");
  const [selectedStu,   setSelectedStu  ] = useState(null);
  const [childStatus,   setChildStatus  ] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Authorized persons
  const [authPersons,   setAuthPersons  ] = useState([]);
  const [persLoading,   setPersLoading  ] = useState(false);
  const [personMode,    setPersonMode   ] = useState("authorized"); // authorized|unknown

  // Checkout
  const [checkingOut,   setCheckingOut  ] = useState(false);
  const [selectedPerson,setSelectedPerson] = useState(null);

  // Photo capture for unknown person
  const [cameraOpen,    setCameraOpen   ] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState("");
  const [personName,    setPersonName   ] = useState("");
  const [personRelation,setPersonRelation] = useState("Unknown");
  const [sending,       setSending      ] = useState(false);

  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; stopCamera(); };
  }, []);

  // ── Load students ───────────────────────────────────────────────
  useEffect(() => {
    setStuLoading(true);
    api.get("/students")
      .then(r => (Array.isArray(r.data) ? r.data : []).filter(s =>
        (s.Status || s.status || "Active") === "Active"
      ))
      .then(list => { if (mountedRef.current) setStudents(list); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setStuLoading(false); });
  }, []);

  // ── Select student → check status ──────────────────────────────
  const selectStudent = useCallback(async (stu) => {
    const id   = stu.Student_ID || stu.id;
    const name = stu.Student_Name || stu.name;
    const cls  = stu.Class || stu.class;
    setSelectedStu({ id, name, cls });
    setStep("status");
    setStatusLoading(true);
    setChildStatus(null);
    setAuthPersons([]);
    setSelectedPerson(null);
    setCapturedPhoto("");
    setPersonName("");

    try {
      const [statusRes, persRes] = await Promise.all([
        securityService.getChildStatus(id),
        pickupAuthorizationService.getPersons({ studentId: id }),
      ]);
      if (!mountedRef.current) return;
      setChildStatus(statusRes);
      setAuthPersons((persRes.entries || []).filter(p => p.status === "Active"));
    } catch (e) {
      if (mountedRef.current) setChildStatus({ status: "NOT_ARRIVED" });
    } finally {
      if (mountedRef.current) setStatusLoading(false);
    }
  }, []);

  // ── Record Check_Out (authorized person) ────────────────────────
  const handleCheckout = useCallback(async (person) => {
    if (!selectedStu || checkingOut) return;
    setCheckingOut(true);
    try {
      await api.post("/api/parent-attendance", {
        studentId:    selectedStu.id,
        studentName:  selectedStu.name,
        parentName:   person.pickupName,
        relation:     person.relation,
        action:       "Check_Out",
        gate:         "",
        selfieImage:  person.photoUrl || "staff-checkout",
        faceDetected: true,
        gps:          "unavailable",
      });
      setStep("done");
    } catch (e) {
      alert(e?.response?.data?.error || "Checkout failed. Please try again.");
    } finally {
      if (mountedRef.current) setCheckingOut(false);
    }
  }, [selectedStu, checkingOut]);

  // ── Camera for unknown person ───────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 480, height: 360 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      alert("Camera access denied. Please allow camera and try again.");
      setCameraOpen(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const dataUrl = dataUrlFromVideo(videoRef.current);
    setCapturedPhoto(dataUrl);
    stopCamera();
  }, [stopCamera]);

  // ── Send pickup request ─────────────────────────────────────────
  const sendPickupRequest = useCallback(async () => {
    if (!capturedPhoto || !selectedStu || sending) return;
    setSending(true);
    try {
      await securityService.createPickupRequest({
        studentId:   selectedStu.id,
        studentName: selectedStu.name,
        personName:  personName.trim() || "Unknown Person",
        personPhoto: capturedPhoto,
        relation:    personRelation,
        staffName:   user?.displayName || user?.name || "Staff",
        gate:        "",
      });
      setStep("sent");
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to send request. Please try again.");
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }, [capturedPhoto, selectedStu, personName, personRelation, sending, user]);

  // ── Filtered students ────────────────────────────────────────────
  const filtered = students.filter(s => {
    const q = stuSearch.trim().toLowerCase();
    if (!q) return true;
    const name = (s.Student_Name || s.name || "").toLowerCase();
    const id   = (s.Student_ID   || s.id   || "").toLowerCase();
    const cls  = (s.Class        || s.class|| "").toLowerCase();
    return name.includes(q) || id.includes(q) || cls.includes(q);
  });

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{
      minHeight: "100vh", background: "#F9FAFB",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
      WebkitFontSmoothing: "antialiased",
    }}>
      {/* Header */}
      <div style={{
        background: "#FFF", borderBottom: "1px solid #E5E7EB",
        padding: "14px 20px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={() => {
            if (step === "search") navigate(-1);
            else { setStep("search"); setSelectedStu(null); setChildStatus(null); }
          }}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: "#F3F4F6", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: "#374151", cursor: "pointer", flexShrink: 0,
          }}
        >
          ←
        </button>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: "#111", margin: 0 }}>
            🚪 Staff Checkout
          </h1>
          {selectedStu && (
            <p style={{ fontSize: 11, color: "#6B7280", margin: "2px 0 0" }}>
              {selectedStu.name} · {selectedStu.cls}
            </p>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* ── STEP: SEARCH ───────────────────────────────────────── */}
        {step === "search" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              value={stuSearch}
              onChange={e => setStuSearch(e.target.value)}
              placeholder="🔍 Search students by name or class…"
              autoFocus
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "12px 16px", fontSize: 14,
                border: "1.5px solid #E5E7EB", borderRadius: 14,
                background: "#FFF", outline: "none",
                fontFamily: "inherit",
              }}
            />

            {stuLoading ? (
              <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", fontSize: 13 }}>
                Loading students…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", fontSize: 13 }}>
                No students found.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {filtered.slice(0, 30).map(s => {
                  const id   = s.Student_ID || s.id;
                  const name = s.Student_Name || s.name;
                  const cls  = s.Class || s.class;
                  return (
                    <button
                      key={id}
                      onClick={() => selectStudent(s)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 16px", borderRadius: 14,
                        background: "#FFF", border: "1.5px solid #E5E7EB",
                        cursor: "pointer", textAlign: "left", transition: "border-color 0.12s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "#0F4C75"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "#E5E7EB"}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: "#DBEAFE",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800, color: "#1E40AF",
                        flexShrink: 0,
                      }}>
                        {initials(name)}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>{name}</p>
                        <p style={{ fontSize: 11, color: "#6B7280", margin: "2px 0 0" }}>
                          {cls} · {id}
                        </p>
                      </div>
                      <span style={{ marginLeft: "auto", fontSize: 16, color: "#9CA3AF" }}>→</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: STATUS ───────────────────────────────────────── */}
        {step === "status" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Student card */}
            <div style={{
              background: "#FFF", borderRadius: 18,
              border: "1.5px solid #E5E7EB", padding: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: "#DBEAFE",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 800, color: "#1E40AF",
                }}>
                  {initials(selectedStu?.name)}
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "#111", margin: 0 }}>
                    {selectedStu?.name}
                  </h2>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0" }}>
                    {selectedStu?.cls} · {selectedStu?.id}
                  </p>
                </div>
              </div>
            </div>

            {/* Status */}
            {statusLoading ? (
              <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", fontSize: 13 }}>
                Checking status…
              </div>
            ) : childStatus ? (
              <>
                {/* Status badge */}
                {(() => {
                  const s = childStatus.status || "NOT_ARRIVED";
                  const c = STATUS_COLORS[s] || STATUS_COLORS.NOT_ARRIVED;
                  return (
                    <div style={{
                      padding: "14px 18px", borderRadius: 14,
                      background: c.bg,
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: c.dot, flexShrink: 0,
                      }}/>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: c.text, margin: 0 }}>
                          {s === "PRESENT" ? "Child is Present" : s === "CHECKED_OUT" ? "Already Checked Out" : "Child Not Yet Arrived"}
                        </p>
                        {childStatus.checkinTime && (
                          <p style={{ fontSize: 11, color: c.text, margin: "2px 0 0", opacity: 0.75 }}>
                            Checked in {childStatus.checkinTime ? new Date(childStatus.checkinTime).toLocaleTimeString() : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {childStatus.status === "PRESENT" && (
                  <>
                    {/* Authorized persons */}
                    <div style={{
                      background: "#FFF", borderRadius: 18,
                      border: "1.5px solid #E5E7EB", padding: 18,
                    }}>
                      <p style={{
                        fontSize: 11, fontWeight: 700, color: "#9CA3AF",
                        textTransform: "uppercase", letterSpacing: "0.07em",
                        margin: "0 0 12px",
                      }}>
                        Who is picking up?
                      </p>

                      {persLoading ? (
                        <p style={{ fontSize: 12, color: "#9CA3AF" }}>Loading…</p>
                      ) : authPersons.length === 0 ? (
                        <div style={{
                          padding: "16px", background: "#FFF7ED", borderRadius: 12,
                          border: "1.5px solid #FED7AA", marginBottom: 12,
                        }}>
                          <p style={{ fontSize: 12, color: "#92400E", fontWeight: 600, margin: 0 }}>
                            ⚠️ No authorized pickup persons registered for this student.
                          </p>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                          {authPersons.map(p => (
                            <button
                              key={p.entryId}
                              onClick={() => { setSelectedPerson(p); handleCheckout(p); }}
                              disabled={checkingOut}
                              style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "12px 14px", borderRadius: 12,
                                background: "#F0FDF4",
                                border: "1.5px solid #A7F3D0",
                                cursor: "pointer", textAlign: "left",
                                opacity: checkingOut ? 0.6 : 1,
                              }}
                            >
                              {p.photoUrl ? (
                                <img src={p.photoUrl} alt={p.pickupName}
                                  style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}/>
                              ) : (
                                <div style={{
                                  width: 40, height: 40, borderRadius: 10,
                                  background: "#D1FAE5",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 13, fontWeight: 800, color: "#065F46", flexShrink: 0,
                                }}>
                                  {initials(p.pickupName)}
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>
                                  {p.pickupName}
                                </p>
                                <p style={{ fontSize: 11, color: "#6B7280", margin: "2px 0 0" }}>
                                  {p.relation}{p.mobile ? ` · ${p.mobile}` : ""}
                                </p>
                              </div>
                              <span style={{
                                background: p.isParent ? "#1D4ED8" : "#059669",
                                color: "#FFF",
                                fontSize: 10, fontWeight: 700,
                                padding: "3px 9px", borderRadius: 999,
                                flexShrink: 0,
                              }}>
                                {p.isParent ? "👨‍👩‍👧 Parent" : "✓ Authorized Guardian"}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Unknown person option */}
                      <button
                        onClick={() => { setPersonMode("unknown"); setStep("photo"); startCamera(); }}
                        style={{
                          width: "100%", padding: "12px 14px", borderRadius: 12,
                          background: "#FFF7ED", border: "1.5px solid #FED7AA",
                          cursor: "pointer", textAlign: "left",
                          display: "flex", alignItems: "center", gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 20 }}>📷</span>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#92400E", margin: 0 }}>
                            Unknown Person
                          </p>
                          <p style={{ fontSize: 11, color: "#B45309", margin: "2px 0 0" }}>
                            Take a photo → send to parent for approval
                          </p>
                        </div>
                      </button>
                    </div>
                  </>
                )}

                {childStatus.status !== "PRESENT" && (
                  <button
                    onClick={() => { setStep("search"); setSelectedStu(null); }}
                    style={{
                      padding: "14px", borderRadius: 14,
                      background: "#F3F4F6", border: "none",
                      fontWeight: 700, fontSize: 14, color: "#374151",
                      cursor: "pointer", width: "100%",
                    }}
                  >
                    ← Search Another Student
                  </button>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ── STEP: PHOTO (unknown person) ────────────────────────── */}
        {step === "photo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
              background: "#FFF", borderRadius: 18,
              border: "1.5px solid #E5E7EB", padding: 20,
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#111", margin: "0 0 4px" }}>
                📷 Photo Verification
              </h2>
              <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 16px" }}>
                This photo will be sent to the parent for approval.
              </p>

              {/* Camera view */}
              {cameraOpen && !capturedPhoto && (
                <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
                  <video
                    ref={videoRef}
                    autoPlay playsInline
                    style={{ width: "100%", borderRadius: 14, display: "block" }}
                  />
                  <button
                    onClick={capturePhoto}
                    style={{
                      position: "absolute", bottom: 16, left: "50%",
                      transform: "translateX(-50%)",
                      width: 60, height: 60, borderRadius: "50%",
                      background: "#FFF", border: "4px solid rgba(255,255,255,0.6)",
                      cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                    }}
                  />
                </div>
              )}

              {/* Captured photo */}
              {capturedPhoto && (
                <div style={{ position: "relative", display: "inline-block", marginBottom: 12 }}>
                  <img
                    src={capturedPhoto}
                    alt="Captured"
                    style={{ width: "100%", borderRadius: 14, display: "block" }}
                  />
                  <button
                    onClick={() => { setCapturedPhoto(""); startCamera(); }}
                    style={{
                      position: "absolute", top: 8, right: 8,
                      padding: "5px 12px", borderRadius: 8,
                      background: "rgba(0,0,0,0.6)", border: "none",
                      color: "#FFF", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    Retake
                  </button>
                </div>
              )}

              {!cameraOpen && !capturedPhoto && (
                <button
                  onClick={startCamera}
                  style={{
                    width: "100%", padding: 14, borderRadius: 12,
                    background: "#F3F4F6", border: "1.5px dashed #D1D5DB",
                    fontSize: 13, color: "#374151", fontWeight: 600, cursor: "pointer",
                    marginBottom: 12,
                  }}
                >
                  📷 Open Camera
                </button>
              )}

              {/* Name + relation */}
              <input
                value={personName}
                onChange={e => setPersonName(e.target.value)}
                placeholder="Person's name (optional)"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "10px 14px", borderRadius: 10, fontSize: 13,
                  border: "1.5px solid #E5E7EB", outline: "none",
                  fontFamily: "inherit", marginBottom: 10,
                }}
              />

              <select
                value={personRelation}
                onChange={e => setPersonRelation(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 13,
                  border: "1.5px solid #E5E7EB", outline: "none",
                  fontFamily: "inherit", background: "#FFF", marginBottom: 16,
                }}
              >
                {["Unknown","Father","Mother","Grandmother","Grandfather","Uncle","Aunt","Driver","Guardian","Other"]
                  .map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              <button
                onClick={sendPickupRequest}
                disabled={!capturedPhoto || sending}
                style={{
                  width: "100%", padding: "14px", borderRadius: 14,
                  background: capturedPhoto && !sending ? "#F4C400" : "#E5E7EB",
                  border: "none",
                  fontWeight: 800, fontSize: 14,
                  color: capturedPhoto && !sending ? "#111" : "#9CA3AF",
                  cursor: capturedPhoto && !sending ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {sending ? (
                  <>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%",
                      border: "2.5px solid #888", borderTopColor: "transparent",
                      animation: "spin 0.75s linear infinite",
                    }}/>
                    Sending…
                  </>
                ) : (
                  "📤 Send to Parent for Approval"
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: SENT ─────────────────────────────────────────── */}
        {step === "sent" && (
          <div style={{
            background: "#FFF", borderRadius: 20,
            border: "1.5px solid #E5E7EB",
            padding: "40px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📲</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111", margin: "0 0 10px" }}>
              Request Sent!
            </h2>
            <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, margin: "0 0 28px", maxWidth: 300, marginLeft: "auto", marginRight: "auto" }}>
              The parent has been notified and needs to approve or reject this pickup.
              Ask the person to wait.
            </p>
            <button
              onClick={() => { setStep("search"); setSelectedStu(null); setCapturedPhoto(""); setPersonName(""); }}
              style={{
                padding: "12px 28px", borderRadius: 14,
                background: "#F4C400", border: "none",
                fontWeight: 700, fontSize: 14, color: "#111", cursor: "pointer",
              }}
            >
              Checkout Another Child
            </button>
          </div>
        )}

        {/* ── STEP: DONE ─────────────────────────────────────────── */}
        {step === "done" && (
          <div style={{
            background: "#FFF", borderRadius: 20,
            border: "1.5px solid #A7F3D0",
            padding: "40px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111", margin: "0 0 10px" }}>
              Checked Out!
            </h2>
            <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, margin: "0 0 4px" }}>
              <strong>{selectedStu?.name}</strong> has been checked out
            </p>
            {selectedPerson && (
              <p style={{ fontSize: 13, color: "#6B7280" }}>
                Released to: <strong>{selectedPerson.pickupName}</strong> ({selectedPerson.relation}) ·{" "}
                <span style={{
                  color: selectedPerson.isParent ? "#1D4ED8" : "#059669",
                  fontWeight: 700,
                }}>
                  {selectedPerson.isParent ? "Parent" : "Authorized Guardian"}
                </span>
              </p>
            )}
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: "4px 0 28px" }}>
              {new Date().toLocaleTimeString()}
            </p>
            <button
              onClick={() => { setStep("search"); setSelectedStu(null); setSelectedPerson(null); }}
              style={{
                padding: "12px 28px", borderRadius: 14,
                background: "#0F4C75", border: "none",
                fontWeight: 700, fontSize: 14, color: "#FFF", cursor: "pointer",
              }}
            >
              Checkout Another Child
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
