/**
 * PickupApproval.jsx — Parent Module · Unknown Person Pickup Approval
 *
 * Shows pickup requests created by gate staff for unknown persons.
 * Parents approve by completing a device authentication (Face ID /
 * fingerprint / PIN via WebAuthn platform authenticator) — the biometric
 * challenge IS the confirmation step, not a separate "Confirm" tap.
 *
 * Approval record stores:
 *   approvedByParent    = true
 *   approvedAt          = ISO timestamp
 *   authMethod          = "biometric" | "device_auth" | "unsupported"
 *   deviceAuthenticated = true | false
 */

import { useState, useEffect, useCallback } from "react";
import { api } from "../../../services/authService";
import { colors, spacing, radius, shadows, typography } from "../theme";
import { PLATFORM_NAME } from "../../../config/environment";

// ── WebAuthn — platform authenticator challenge ────────────────────
//
// We use navigator.credentials.create() with:
//   • authenticatorAttachment: "platform"  → device's built-in auth only
//   • userVerification:        "required"  → Face ID / fingerprint / PIN mandatory
//   • attestation:             "none"      → no server-side key storage needed;
//     we use the successful resolution as proof of user presence
//
// A unique user.id per request avoids "already registered" conflicts
// on platforms that track resident credentials.

async function triggerDeviceAuth(requestId) {
  if (!window.PublicKeyCredential) {
    throw Object.assign(new Error("WebAuthn not supported"), { code: "UNSUPPORTED" });
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const uid       = new TextEncoder().encode(`yd-approval-${requestId}-${Date.now()}`);

  try {
    await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: PLATFORM_NAME,
          id:   window.location.hostname,
        },
        user: {
          id:          uid,
          name:        `approval-${requestId}`,
          displayName: "Pickup Approval",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7   }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification:        "required",
          requireResidentKey:      false,
        },
        timeout:     60_000,
        attestation: "none",
      },
    });
    return "biometric";
  } catch (err) {
    if (err.name === "NotAllowedError") {
      throw Object.assign(
        new Error("Verification cancelled or timed out. Please try again."),
        { code: "CANCELLED" }
      );
    }
    throw Object.assign(
      new Error("Device authentication failed. Please try again."),
      { code: "FAILED" }
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

// ── Token aliases ──────────────────────────────────────────────────

const T = {
  bg:           colors.surface.background,
  card:         colors.surface.card,
  border:       colors.surface.border,
  text:         colors.text.primary,
  text2:        colors.text.secondary,
  text3:        colors.text.muted,
  text4:        colors.text.faint,
  gold:         colors.yellow500,
  success:      colors.success,
  successSoft:  colors.successSoft,
  successBorder:colors.successBorder,
  successStrong:colors.successStrong,
  danger:       colors.danger,
  dangerSoft:   colors.dangerSoft,
  dangerBorder: colors.dangerBorder,
  dangerStrong: colors.dangerStrong,
};

// ── Main component ─────────────────────────────────────────────────

export default function PickupApproval() {
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await api.get("/api/pickup-requests");
      const data = res.data || res;
      setRequests((data.requests || []).map(r => ({ ...r, id: r.id || r.requestId })));
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function updateRequest(id, patch) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  const pending   = requests.filter(r => r.status === "pending");
  const completed = requests.filter(r => r.status !== "pending");

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: typography.fontFamily.base }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        padding: `${spacing.lg}px ${spacing.lg}px ${spacing.sm}px`,
        position: "sticky", top: 0, zIndex: 10,
        background: colors.surface.backgroundTranslucent,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <span style={{ fontSize: 22 }}>🚨</span>
          <span style={{
            fontSize: typography.size.lg,
            fontWeight: typography.weight.bold,
            color: T.text,
          }}>
            Pickup Approval
          </span>
          {pending.length > 0 && (
            <span style={{
              background: T.danger,
              color: colors.white,
              fontSize: typography.size.xs,
              fontWeight: typography.weight.bold,
              borderRadius: radius.pill,
              padding: "2px 7px",
              minWidth: 20,
              textAlign: "center",
            }}>
              {pending.length}
            </span>
          )}
        </div>
        <div style={{ fontSize: typography.size.xs, color: T.text3, marginTop: spacing.xs }}>
          Review unknown persons requesting to pick up your child
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div style={{ padding: `${spacing.md}px ${spacing.lg}px` }}>

        {loading && (
          <div style={{ textAlign: "center", padding: `${spacing["4xl"]}px 0`, color: T.text3 }}>
            <div style={{ fontSize: 36, marginBottom: spacing.sm }}>⏳</div>
            <div style={{ fontSize: typography.size.sm }}>Loading requests…</div>
          </div>
        )}

        {!loading && error && (
          <div style={{
            margin: `${spacing.lg}px 0`,
            padding: `${spacing.md}px ${spacing.lg}px`,
            borderRadius: radius.card,
            background: T.dangerSoft,
            border: `1px solid ${T.dangerBorder}`,
            color: T.dangerStrong,
          }}>
            <div style={{ fontWeight: typography.weight.bold, marginBottom: spacing.xs, fontSize: typography.size.sm }}>
              ⚠️ Could not load pickup requests
            </div>
            <div style={{ fontSize: typography.size.xs, marginBottom: spacing.sm, opacity: 0.85 }}>
              {error}
            </div>
            <button
              onClick={load}
              style={{
                fontSize: typography.size.xs,
                fontWeight: typography.weight.semibold,
                color: T.dangerStrong,
                background: "none",
                border: `1px solid ${T.dangerBorder}`,
                borderRadius: radius.sm,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && requests.length === 0 && (
          <EmptyState />
        )}

        {!loading && !error && requests.length > 0 && (
          <>
            {pending.length > 0 && (
              <div style={{ marginBottom: spacing["2xl"] }}>
                <SectionHeading label="Pending" />
                <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
                  {pending.map(r => (
                    <RequestCard key={r.id} request={r} onUpdate={updateRequest} />
                  ))}
                </div>
              </div>
            )}

            {completed.length > 0 && (
              <div>
                <SectionHeading label="Completed" />
                <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
                  {completed.map(r => (
                    <RequestCard key={r.id} request={r} onUpdate={updateRequest} readOnly />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── RequestCard ────────────────────────────────────────────────────

function RequestCard({ request: r, onUpdate, readOnly = false }) {
  // "biometric" = device-auth gate shown; "rejected" = reject confirm shown
  const [confirming,   setConfirming]   = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [actionError,  setActionError]  = useState(null);

  const isApproved = r.status === "approved";
  const isRejected = r.status === "rejected";

  // ── Approve — biometric gate ─────────────────────────────────────
  // Tapping "✓ Approve" opens the device-auth step immediately.
  // The WebAuthn challenge IS the confirmation — no extra "Confirm" tap needed.

  async function handleBiometricAndApprove() {
    setSubmitting(true);
    setActionError(null);

    let authMethod        = "unknown";
    let deviceAuthenticated = false;

    try {
      authMethod          = await triggerDeviceAuth(r.id);
      deviceAuthenticated = true;
    } catch (err) {
      if (err.code === "UNSUPPORTED") {
        // Browser / OS doesn't support WebAuthn — block approval and explain
        setActionError(
          "Device authentication is not supported on this browser. " +
          "Please use Safari on iOS 16+ or Chrome on Android to approve pickups."
        );
        setSubmitting(false);
        return;
      }
      // CANCELLED or FAILED — show inline error; let parent retry
      setActionError(err.message || "Verification failed. Please try again.");
      setSubmitting(false);
      return;
    }

    // Biometric passed — call the approve API with auth metadata
    try {
      await api.put(`/api/pickup-requests/${r.id}/approve`, {
        approvedByParent:    true,
        approvedAt:          new Date().toISOString(),
        authMethod,
        deviceAuthenticated,
      });
      onUpdate(r.id, {
        status:              "approved",
        resolvedAt:          new Date().toISOString(),
        approvedByParent:    true,
        authMethod,
        deviceAuthenticated,
      });
      setConfirming(null);
    } catch (e) {
      setActionError(e.response?.data?.error || e.message || "Failed to approve. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Reject ───────────────────────────────────────────────────────
  async function handleReject() {
    setSubmitting(true);
    setActionError(null);
    try {
      await api.put(`/api/pickup-requests/${r.id}/reject`, {
        reason: rejectReason || undefined,
      });
      onUpdate(r.id, {
        status:         "rejected",
        resolvedAt:     new Date().toISOString(),
        rejectedReason: rejectReason,
      });
      setConfirming(null);
      setRejectReason("");
    } catch (e) {
      setActionError(e.response?.data?.error || e.message || "Failed to reject.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Status badge ─────────────────────────────────────────────────
  const statusBadge = isApproved
    ? { bg: T.successSoft, border: T.successBorder, color: T.successStrong,
        label: r.deviceAuthenticated ? "✓ Approved · 🔒 Device Verified" : "✓ Approved" }
    : isRejected
    ? { bg: T.dangerSoft, border: T.dangerBorder, color: T.dangerStrong, label: "✕ Rejected" }
    : null;

  return (
    <div style={{
      borderRadius: radius.card,
      background: T.card,
      border: `1px solid ${T.border}`,
      boxShadow: shadows.card,
      overflow: "hidden",
    }}>
      {/* Card body */}
      <div style={{ padding: `${spacing.lg}px` }}>
        <div style={{ display: "flex", gap: spacing.md }}>
          <PersonPhoto photo={r.personPhoto} name={r.personName} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: "flex", alignItems: "flex-start",
              justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.xs,
            }}>
              <div>
                <div style={{
                  fontSize: typography.size.md,
                  fontWeight: typography.weight.bold,
                  color: T.text,
                }}>
                  {r.personName || "Unknown Person"}
                </div>
                {r.relation && (
                  <div style={{ fontSize: typography.size.xs, color: T.text3 }}>
                    {r.relation}
                  </div>
                )}
              </div>
              {statusBadge && (
                <span style={{
                  flexShrink: 0,
                  fontSize: typography.size.xs,
                  fontWeight: typography.weight.bold,
                  padding: "3px 10px",
                  borderRadius: radius.pill,
                  background: statusBadge.bg,
                  border: `1px solid ${statusBadge.border}`,
                  color: statusBadge.color,
                }}>
                  {statusBadge.label}
                </span>
              )}
            </div>

            <MetaRow icon="🎒" label="Child"      value={r.studentName} />
            <MetaRow icon="👷" label="Staff"      value={r.staffName} />
            <MetaRow icon="🕐" label="Requested"  value={fmtTime(r.createdAt)} />
            {isRejected && r.rejectedReason && (
              <MetaRow icon="💬" label="Reason" value={r.rejectedReason} />
            )}
            {isApproved && r.approvedAt && (
              <MetaRow icon="✅" label="Approved" value={fmtTime(r.approvedAt)} />
            )}
          </div>
        </div>
      </div>

      {/* Action area — pending only */}
      {!readOnly && r.status === "pending" && (
        <div style={{
          borderTop: `1px solid ${T.border}`,
          padding: `${spacing.md}px ${spacing.lg}px`,
          background: colors.surface.backgroundSubtle || "#FAFAF9",
        }}>

          {actionError && (
            <div style={{
              fontSize: typography.size.xs,
              color: T.dangerStrong,
              marginBottom: spacing.sm,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              background: T.dangerSoft,
              borderRadius: radius.sm,
              border: `1px solid ${T.dangerBorder}`,
            }}>
              {actionError}
            </div>
          )}

          {/* ── Reject confirm ── */}
          {confirming === "rejected" && (
            <div style={{ marginBottom: spacing.sm }}>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Optional: reason for rejection"
                rows={2}
                style={{
                  width: "100%",
                  padding: `${spacing.sm}px`,
                  borderRadius: radius.md,
                  border: `1px solid ${T.dangerBorder}`,
                  fontSize: typography.size.sm,
                  fontFamily: typography.fontFamily.base,
                  color: T.text,
                  background: T.card,
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          <div style={{ display: "flex", gap: spacing.sm }}>

            {/* ── BIOMETRIC step ── */}
            {confirming === "biometric" && (
              <>
                <div style={{ flex: 1 }}>
                  {/* Prompt header */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: spacing.xs,
                    marginBottom: spacing.sm,
                  }}>
                    <span style={{ fontSize: 20 }}>🔒</span>
                    <div>
                      <div style={{
                        fontSize: typography.size.sm,
                        fontWeight: typography.weight.bold,
                        color: T.text,
                      }}>
                        Verify your identity
                      </div>
                      <div style={{ fontSize: typography.size.xs, color: T.text3, marginTop: 1 }}>
                        Use Face ID, fingerprint, or device PIN to approve
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: spacing.sm }}>
                    <ActionButton
                      label={submitting ? "Verifying…" : "🔒 Verify & Approve"}
                      onClick={handleBiometricAndApprove}
                      disabled={submitting}
                      style={{
                        flex: 2,
                        background: T.success,
                        color: colors.white,
                        border: "none",
                      }}
                    />
                    <ActionButton
                      label="Cancel"
                      onClick={() => { setConfirming(null); setActionError(null); }}
                      disabled={submitting}
                      style={{
                        flex: 1,
                        background: "none",
                        color: T.text2,
                        border: `1px solid ${T.border}`,
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* ── Reject confirm ── */}
            {confirming === "rejected" && (
              <>
                <ActionButton
                  label={submitting ? "Rejecting…" : "Confirm Reject"}
                  onClick={handleReject}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    background: T.danger,
                    color: colors.white,
                    border: "none",
                  }}
                />
                <ActionButton
                  label="Cancel"
                  onClick={() => { setConfirming(null); setRejectReason(""); setActionError(null); }}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    background: "none",
                    color: T.text2,
                    border: `1px solid ${T.border}`,
                  }}
                />
              </>
            )}

            {/* ── Default: Approve / Reject ── */}
            {!confirming && (
              <>
                <ActionButton
                  label="✓ Approve"
                  onClick={() => { setConfirming("biometric"); setActionError(null); }}
                  style={{
                    flex: 1,
                    background: T.successSoft,
                    color: T.successStrong,
                    border: `1px solid ${T.successBorder}`,
                  }}
                />
                <ActionButton
                  label="✕ Reject"
                  onClick={() => setConfirming("rejected")}
                  style={{
                    flex: 1,
                    background: T.dangerSoft,
                    color: T.dangerStrong,
                    border: `1px solid ${T.dangerBorder}`,
                  }}
                />
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

// ── PersonPhoto ────────────────────────────────────────────────────

function PersonPhoto({ photo, name }) {
  const [imgError, setImgError] = useState(false);
  const initials = (name || "?").trim().split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const size = 80;

  if (photo && !imgError) {
    const src = photo.startsWith("data:") ? photo : `data:image/jpeg;base64,${photo}`;
    return (
      <img
        src={src}
        alt={name || "Unknown person"}
        onError={() => setImgError(true)}
        style={{
          width: size, height: size,
          borderRadius: radius.md,
          objectFit: "cover",
          flexShrink: 0,
          border: `1px solid ${T.border}`,
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size,
      borderRadius: radius.md,
      flexShrink: 0,
      background: colors.gray100 || "#F3F4F6",
      border: `1px solid ${T.border}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 24, fontWeight: typography.weight.bold,
      color: T.text3,
    }}>
      {initials}
    </div>
  );
}

// ── MetaRow ────────────────────────────────────────────────────────

function MetaRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: spacing.xs,
      fontSize: typography.size.xs, color: T.text2,
      marginBottom: 3,
    }}>
      <span style={{ opacity: 0.7 }}>{icon}</span>
      <span style={{ color: T.text3 }}>{label}:</span>
      <span>{value}</span>
    </div>
  );
}

// ── ActionButton ───────────────────────────────────────────────────

function ActionButton({ label, onClick, disabled, style }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: radius.md,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        fontFamily: typography.fontFamily.base,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "transform 0.1s, box-shadow 0.1s",
        transform: pressed ? "scale(0.97)" : "scale(1)",
        WebkitTapHighlightColor: "transparent",
        minHeight: 44,
        ...style,
      }}
    >
      {label}
    </button>
  );
}

// ── SectionHeading ─────────────────────────────────────────────────

function SectionHeading({ label }) {
  return (
    <div style={{
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
      color: T.text3,
      letterSpacing: typography.tracking?.wider || "0.08em",
      textTransform: "uppercase",
      marginBottom: spacing.sm,
      paddingLeft: 2,
    }}>
      {label}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      textAlign: "center",
      padding: `${spacing["5xl"]}px ${spacing.xl}px`,
      color: T.text3,
    }}>
      <div style={{ fontSize: 48, marginBottom: spacing.md }}>✅</div>
      <div style={{
        fontSize: typography.size.sm,
        lineHeight: typography.lineHeight?.relaxed || 1.6,
        maxWidth: 280,
        margin: "0 auto",
      }}>
        No pending pickup requests. You'll be notified when an unknown person arrives to collect your child.
      </div>
    </div>
  );
}
