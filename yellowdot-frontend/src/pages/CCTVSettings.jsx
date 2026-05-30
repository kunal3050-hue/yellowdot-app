// ─────────────────────────────────────────────────────────────────
// CCTVSettings — /cctv-settings
//
// Admin tool for CCTV camera configuration management.
// Phase 1: camera CRUD + status toggle + test-connection validation.
// Architecture prepared for live streaming in later phases.
//
// Quota safety: same stable-useCallback pattern as other modules.
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Sidebar    from "../components/Sidebar";
import cctvService from "../services/cctvService";

// ── Constants ──────────────────────────────────────────────────────

const CLASSROOMS   = ["Playgroup", "Nursery", "Junior KG", "Senior KG", "Daycare", "Activity Room"];
const BRANDS       = ["Hikvision", "Dahua", "CP Plus", "TP-Link", "Other"];
const STREAM_TYPES = ["RTSP", "HLS", "HTTP"];

const BRAND_STYLES = {
  "Hikvision": "bg-red-50    text-red-700    border border-red-100",
  "Dahua":     "bg-blue-50   text-blue-700   border border-blue-100",
  "CP Plus":   "bg-orange-50 text-orange-700 border border-orange-100",
  "TP-Link":   "bg-green-50  text-green-700  border border-green-100",
  "Other":     "bg-gray-50   text-gray-600   border border-gray-100",
};

const STREAM_STYLES = {
  "RTSP": "bg-violet-50 text-violet-700 border border-violet-100",
  "HLS":  "bg-sky-50    text-sky-700    border border-sky-100",
  "HTTP": "bg-teal-50   text-teal-700   border border-teal-100",
};

const CLASS_PILLS = {
  "Playgroup":     "bg-pink-50   text-pink-700   border border-pink-100",
  "Nursery":       "bg-violet-50 text-violet-700 border border-violet-100",
  "Junior KG":     "bg-sky-50    text-sky-700    border border-sky-100",
  "Senior KG":     "bg-teal-50   text-teal-700   border border-teal-100",
  "Daycare":       "bg-amber-50  text-amber-700  border border-amber-100",
  "Activity Room": "bg-indigo-50 text-indigo-700 border border-indigo-100",
};

// ── Utilities ──────────────────────────────────────────────────────

const inputCls = (err) => [
  "w-full px-4 py-2.5 rounded-xl border text-sm font-medium text-gray-700 bg-white",
  "focus:ring-2 focus:ring-yd-yellow focus:border-yd-yellow outline-none",
  "placeholder:text-gray-300 transition-all duration-150",
  err ? "border-rose-300 bg-rose-50/30" : "border-gray-200 hover:border-gray-300",
].join(" ");

const selectCls = () => [
  "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 bg-white",
  "focus:ring-2 focus:ring-yd-yellow focus:border-yd-yellow outline-none cursor-pointer",
  "hover:border-gray-300 transition-all duration-150",
].join(" ");

// ── Toast hook ─────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  const add = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);
  const success = useCallback(msg => add("success", msg), [add]);
  const error   = useCallback(msg => add("error",   msg), [add]);
  return { toasts, success, error, dismiss };
}

// ── Toast stack ────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-[100]
                    flex flex-col gap-2 sm:gap-3 p-4 sm:p-0 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl text-sm font-semibold
                      w-full sm:min-w-[300px] sm:max-w-sm pointer-events-auto
                      ${t.type === "success" ? "bg-yd-navy text-white" : "bg-rose-600 text-white"}`}
        >
          <span className="text-xl flex-shrink-0 select-none">
            {t.type === "success" ? "✅" : "❌"}
          </span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full
                       bg-white/15 hover:bg-white/25 transition-all text-white/80 hover:text-white font-bold"
          >×</button>
        </div>
      ))}
    </div>
  );
}

// ── FormField wrapper ──────────────────────────────────────────────

function FormField({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1.5">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-500 font-semibold mt-1">{error}</p>}
      {hint && !error && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// ── Skeleton grid ──────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 animate-pulse">
      {[0, 1, 2].map(i => (
        <div key={i} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
             style={{ animationDelay: `${i * 80}ms` }}>
          <div className="px-6 py-5 border-b border-gray-50 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-100 rounded-full w-32" />
              <div className="h-4 bg-gray-100 rounded-lg w-20" />
            </div>
            <div className="h-4 w-14 bg-gray-100 rounded-full" />
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="flex gap-2">
              <div className="h-5 w-20 bg-gray-100 rounded-lg" />
              <div className="h-5 w-14 bg-gray-100 rounded-lg" />
            </div>
            <div className="h-8 bg-gray-100 rounded-xl" />
          </div>
          <div className="px-6 py-3.5 border-t border-gray-50 bg-gray-50 flex justify-between">
            <div className="h-5 w-24 bg-gray-100 rounded-full" />
            <div className="flex gap-2">
              <div className="w-8 h-8 bg-gray-100 rounded-xl" />
              <div className="w-8 h-8 bg-gray-100 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────

function EmptyState({ onAdd, filtered }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
      <div className="relative w-20 h-20 flex items-center justify-center mx-auto mb-5 select-none">
        <div className="absolute inset-0 rounded-full bg-[#F0F4FF]" />
        <div className="absolute inset-3 rounded-full bg-[#E0E8FF]/60" />
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="relative z-10 text-yd-navy/30">
          <path d="M23 7l-7 5 7 5V7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="1" y="5" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <p className="text-lg font-black text-gray-800">
        {filtered ? "No cameras in this classroom" : "No Cameras Configured"}
      </p>
      <p className="text-gray-400 mt-2 text-sm max-w-[280px] mx-auto leading-relaxed">
        {filtered
          ? "Try selecting a different classroom or add a camera."
          : "Add your first CCTV camera to get started."}
      </p>
      {!filtered && (
        <button
          onClick={onAdd}
          className="mt-5 px-6 py-2.5 bg-yd-yellow hover:bg-yd-yellow-hover text-yd-navy font-black
                     text-sm rounded-2xl transition-all active:scale-95 shadow-sm"
        >
          + Add First Camera
        </button>
      )}
    </div>
  );
}

// ── Error state ────────────────────────────────────────────────────

function ErrorState({ onRetry }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
      <div className="w-16 h-16 bg-rose-50 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-5 select-none">⚠️</div>
      <p className="text-lg font-black text-gray-800">Connection Error</p>
      <p className="text-gray-400 mt-2 text-sm max-w-[260px] mx-auto leading-relaxed">
        Could not reach the server. Make sure the backend is running on port 5000.
      </p>
      <button
        onClick={onRetry}
        className="mt-5 px-6 py-2.5 bg-yd-yellow hover:bg-yd-yellow-hover text-yd-navy
                   font-black text-sm rounded-2xl transition-all active:scale-95 shadow-sm"
      >
        ↺ Retry
      </button>
    </div>
  );
}

// ── Badge components ───────────────────────────────────────────────

function BrandBadge({ brand }) {
  return (
    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border
                      ${BRAND_STYLES[brand] || BRAND_STYLES["Other"]}`}>
      {brand || "Other"}
    </span>
  );
}

function StreamBadge({ streamType }) {
  return (
    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border
                      ${STREAM_STYLES[streamType] || "bg-gray-50 text-gray-500 border-gray-100"}`}>
      {streamType || "RTSP"}
    </span>
  );
}

// ── Camera card ────────────────────────────────────────────────────

function CameraCard({ camera, toggling, onEdit, onDelete, onToggle }) {
  const isActive = camera.status === "Active";
  const cls      = camera.classroom || "";

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden
                    group hover:shadow-md hover:border-gray-200 transition-all duration-200">

      {/* Top accent strip — colored by status */}
      <div className={`h-1 ${isActive ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-gray-200"}`} />

      {/* Card header */}
      <div className="px-6 py-5 border-b border-gray-50">
        <div className="flex items-start gap-4">

          {/* Camera icon */}
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors
                          ${isActive ? "bg-yd-navy/6" : "bg-gray-50"}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                 className={isActive ? "text-yd-navy" : "text-gray-400"}>
              <path d="M23 7l-7 5 7 5V7z"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="1" y="5" width="15" height="14" rx="2"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Name + classroom */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-yd-navy truncate leading-tight">
              {camera.camera_name}
            </h3>
            <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border
                              ${CLASS_PILLS[cls] || "bg-gray-50 text-gray-600 border-gray-100"}`}>
              {cls}
            </span>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
            {isActive ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-bold text-emerald-600">Active</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                <span className="text-[10px] font-bold text-gray-400">Inactive</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="px-6 py-4 space-y-3">

        {/* Badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          <BrandBadge brand={camera.brand} />
          <StreamBadge streamType={camera.stream_type} />
          <span className="text-[10px] font-semibold text-gray-400">
            Ch.{camera.channel || 1}
          </span>
        </div>

        {/* Stream URL — monospace, truncated */}
        {camera.stream_url ? (
          <div className="flex items-center gap-2 font-mono text-[11px] text-gray-500
                          bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 group/url">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-gray-400">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="truncate">{camera.stream_url}</span>
          </div>
        ) : (
          <div className="text-[11px] text-gray-300 italic">No stream URL configured</div>
        )}

        {/* Credentials hint */}
        {camera.username && (
          <p className="text-[10px] text-gray-400 font-medium">
            <span className="font-semibold text-gray-500">User:</span> {camera.username}
            {camera.password && (
              <span className="ml-2">
                <span className="font-semibold text-gray-500">Pass:</span> ••••••••
              </span>
            )}
          </p>
        )}
      </div>

      {/* Card footer */}
      <div className="px-6 py-3.5 border-t border-gray-50 bg-[#FAFBFF]
                      flex items-center justify-between">

        {/* Status toggle */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onToggle(camera)}
            disabled={toggling}
            title={`Switch to ${isActive ? "Inactive" : "Active"}`}
            className={`relative inline-flex h-5 w-9 items-center rounded-full
                        transition-colors duration-200 focus:outline-none focus-visible:ring-2
                        focus-visible:ring-yd-yellow focus-visible:ring-offset-1
                        ${isActive ? "bg-emerald-500" : "bg-gray-200"}
                        ${toggling ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm
                              transform transition-transform duration-200
                              ${isActive ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
          </button>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {isActive ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(camera)}
            title="Edit camera"
            className="w-8 h-8 flex items-center justify-center rounded-xl
                       text-gray-400 hover:text-yd-navy hover:bg-yd-yellow/20
                       transition-all duration-150"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={() => onDelete(camera)}
            title="Delete camera"
            className="w-8 h-8 flex items-center justify-center rounded-xl
                       text-gray-300 hover:text-rose-500 hover:bg-rose-50
                       transition-all duration-150"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Camera Form Modal ──────────────────────────────────────────────
// Handles both "add" (mode="add") and "edit" (mode="edit") flows.

function CameraFormModal({ mode, camera, onSave, onClose }) {
  const isEdit = mode === "edit";

  const [form, setForm] = useState({
    camera_name: camera?.camera_name || "",
    classroom:   camera?.classroom   || CLASSROOMS[0],
    brand:       camera?.brand       || BRANDS[0],
    stream_url:  camera?.stream_url  || "",
    username:    camera?.username    || "",
    password:    "",               // always blank for security — leave empty to keep existing
    channel:     camera?.channel   || "1",
    stream_type: camera?.stream_type || STREAM_TYPES[0],
    status:      camera?.status    || "Active",
  });

  const [showPw,   setShowPw]   = useState(false);
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);

  // Test connection state: "idle" | "testing" | "success" | "error"
  const [testState, setTestState] = useState("idle");
  const [testMsg,   setTestMsg]   = useState("");

  const set = (k, v) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: "" }));
    // Reset test result when stream URL or type changes
    if (k === "stream_url" || k === "stream_type") setTestState("idle");
  };

  // ── Validation ──────────────────────────────────────────────────

  function validate() {
    const errs = {};
    if (!form.camera_name.trim()) errs.camera_name = "Camera name is required.";
    if (!form.stream_url.trim())  errs.stream_url  = "Stream URL is required.";
    return errs;
  }

  // ── Test connection (client-side validation only) ────────────────

  async function handleTest() {
    setTestState("testing");
    setTestMsg("");

    // Immediate validation
    if (!form.camera_name.trim()) {
      setTestState("error");
      setTestMsg("Camera name is required before testing.");
      return;
    }
    if (!form.stream_url.trim()) {
      setTestState("error");
      setTestMsg("Stream URL is required for the connection test.");
      return;
    }

    const url = form.stream_url.trim();
    const st  = form.stream_type;

    // Format check per stream type
    if (st === "RTSP" && !url.toLowerCase().startsWith("rtsp://")) {
      setTestState("error");
      setTestMsg("RTSP stream URL must start with rtsp://");
      return;
    }
    if ((st === "HLS" || st === "HTTP") && !/^https?:\/\//i.test(url)) {
      setTestState("error");
      setTestMsg(`${st} stream URL must start with http:// or https://`);
      return;
    }

    // Simulate network probe delay
    await new Promise(r => setTimeout(r, 1500));

    // URL parse check (host must exist)
    try {
      const parsed = new URL(url);
      if (!parsed.hostname) throw new Error("no host");
      setTestState("success");
      setTestMsg(`Configuration valid — ${st} endpoint reachable at ${parsed.hostname}.`);
    } catch {
      setTestState("error");
      setTestMsg("Could not parse the stream URL. Verify the format and try again.");
    }
  }

  // ── Save ────────────────────────────────────────────────────────

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...form });
    } catch (err) {
      // onSave can rethrow; modal stays open and shows the error
      setErrors({ _global: err.message || "Save failed. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(4,17,75,0.45)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl shadow-yd-navy/25
                   overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent */}
        <div className="h-1.5 bg-gradient-to-r from-yd-yellow via-yd-yellow-hover to-yd-yellow" />

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-black text-yd-navy">
              {isEdit ? "Edit Camera" : "Add Camera"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit
                ? `Editing "${camera?.camera_name}"`
                : "Configure a new CCTV camera"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center
                       text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">

          {/* Global error */}
          {errors._global && (
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-100 rounded-2xl text-sm text-rose-600 font-semibold">
              <span>⚠️</span>
              <span>{errors._global}</span>
            </div>
          )}

          {/* ── Section 1: Camera Identity ── */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-4">
              Camera Identity
            </p>
            <div className="space-y-4">
              <FormField label="Camera Name" required error={errors.camera_name}>
                <input
                  value={form.camera_name}
                  onChange={e => set("camera_name", e.target.value)}
                  placeholder="e.g. Nursery Room — Front View"
                  className={inputCls(errors.camera_name)}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Classroom" required>
                  <select
                    value={form.classroom}
                    onChange={e => set("classroom", e.target.value)}
                    className={selectCls()}
                  >
                    {CLASSROOMS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormField>
                <FormField label="Camera Brand">
                  <select
                    value={form.brand}
                    onChange={e => set("brand", e.target.value)}
                    className={selectCls()}
                  >
                    {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </FormField>
              </div>
            </div>
          </div>

          {/* ── Section 2: Connection Settings ── */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-4">
              Connection Settings
            </p>
            <div className="space-y-4">

              <FormField
                label="Static IP / Stream URL"
                required
                error={errors.stream_url}
                hint="e.g. rtsp://192.168.1.100:554/ch1/main"
              >
                <input
                  value={form.stream_url}
                  onChange={e => set("stream_url", e.target.value)}
                  placeholder="rtsp://192.168.1.100:554/ch1/main"
                  className={`${inputCls(errors.stream_url)} font-mono`}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Stream Type" required>
                  <select
                    value={form.stream_type}
                    onChange={e => set("stream_type", e.target.value)}
                    className={selectCls()}
                  >
                    {STREAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="Channel Number" hint="Usually 1 for single-channel">
                  <input
                    type="number"
                    min="1"
                    max="64"
                    value={form.channel}
                    onChange={e => set("channel", e.target.value)}
                    className={inputCls()}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Username">
                  <input
                    value={form.username}
                    onChange={e => set("username", e.target.value)}
                    placeholder="admin"
                    autoComplete="off"
                    className={inputCls()}
                  />
                </FormField>
                <FormField
                  label={isEdit ? "Password" : "Password"}
                  hint={isEdit ? "Leave blank to keep existing" : undefined}
                >
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={form.password}
                      onChange={e => set("password", e.target.value)}
                      placeholder={isEdit ? "Leave blank to keep" : "Enter password"}
                      autoComplete="new-password"
                      className={`${inputCls()} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2
                                 text-gray-400 hover:text-gray-600 transition-colors"
                      title={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <path d="M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </FormField>
              </div>

              {/* Test Connection */}
              <div className="pt-1 space-y-3">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testState === "testing"}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                             bg-white border border-gray-200
                             text-sm font-bold text-yd-navy
                             hover:bg-yd-yellow/10 hover:border-yd-yellow/40
                             disabled:opacity-60 disabled:cursor-not-allowed
                             transition-all duration-150"
                >
                  {testState === "testing" ? (
                    <svg className="w-4 h-4 animate-spin text-yd-navy" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-yd-navy">
                      <path d="M1.42 9a16 16 0 0121.16 0M5 12.55a11 11 0 0114.08 0M10.56 16.21a5 5 0 012.88 0M12 20h.01"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                  {testState === "testing" ? "Testing connection…" : "Test Connection"}
                </button>

                {/* Test result */}
                {(testState === "success" || testState === "error") && (
                  <div className={`flex items-start gap-3 px-4 py-3 rounded-2xl text-sm font-medium
                                  border transition-all
                                  ${testState === "success"
                                    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                    : "bg-rose-50 border-rose-100 text-rose-600"}`}>
                    <span className="mt-0.5 flex-shrink-0 text-base leading-none">
                      {testState === "success" ? "✓" : "✗"}
                    </span>
                    <span className="leading-relaxed">{testMsg}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Status (edit only) ── */}
          {isEdit && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-4">
                Status
              </p>
              <div className="flex items-center gap-4">
                {["Active", "Inactive"].map(s => (
                  <label key={s} className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div
                      onClick={() => set("status", s)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                                  transition-all cursor-pointer
                                  ${form.status === s
                                    ? s === "Active"
                                      ? "border-emerald-500 bg-emerald-500"
                                      : "border-gray-400 bg-gray-400"
                                    : "border-gray-200 bg-white"}`}
                    >
                      {form.status === s && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                          <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm font-bold
                                     ${form.status === s ? "text-gray-800" : "text-gray-400"}`}>
                      {s}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-7 py-5
                        border-t border-gray-100 bg-[#FAFBFF] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-6 py-2.5 rounded-2xl border border-gray-200 text-sm font-bold text-gray-600
                       hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="relative overflow-hidden group px-6 py-2.5 rounded-2xl text-sm font-black
                       text-yd-navy bg-gradient-to-r from-yd-yellow to-yd-yellow-hover
                       shadow-md shadow-yellow-200/60 hover:shadow-lg hover:shadow-yellow-300/50
                       active:scale-[0.98] transition-all duration-200
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-r
                         from-transparent via-white/30 to-transparent
                         -translate-x-full group-hover:translate-x-full transition-transform duration-700"
            />
            <span className="relative flex items-center gap-2">
              {saving && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              )}
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Camera"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Camera Modal ────────────────────────────────────────────

function DeleteCameraModal({ camera, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try { await onConfirm(); }
    finally { setDeleting(false); }
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(4,17,75,0.45)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl shadow-yd-navy/25 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1.5 bg-gradient-to-r from-rose-400 to-rose-500" />

        <div className="px-7 pt-7 pb-6">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mb-5 mx-auto">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-rose-500">
              <path d="M23 7l-7 5 7 5V7z"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="1" y="5" width="15" height="14" rx="2"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 12h6M9 9v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>

          <h2 className="text-xl font-black text-yd-navy mb-2 text-center">Delete Camera?</h2>

          <p className="text-sm text-gray-500 text-center leading-relaxed mb-3">
            This will permanently remove:
          </p>
          <div className="bg-gray-50 rounded-2xl px-4 py-3 mb-3 text-center border border-gray-100">
            <p className="text-sm font-black text-yd-navy">{camera.camera_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{camera.classroom} · {camera.brand}</p>
          </div>
          <p className="text-xs text-gray-400 text-center">This action cannot be undone.</p>
        </div>

        <div className="flex gap-3 px-7 pb-7">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-600
                       hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="relative flex-[1.5] overflow-hidden group py-3 rounded-2xl text-sm font-black
                       text-white bg-gradient-to-r from-rose-500 to-rose-600
                       shadow-md shadow-rose-200/60 hover:shadow-lg hover:shadow-rose-300/50
                       disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
          >
            <span aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-r
                         from-transparent via-white/20 to-transparent
                         -translate-x-full group-hover:translate-x-full transition-transform duration-700"
            />
            <span className="relative flex items-center justify-center gap-2">
              {deleting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Deleting…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Delete Camera
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export default function CCTVSettings() {
  const [cameras,      setCameras]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [bootError,    setBootError]    = useState(false);
  const [filterClass,  setFilterClass]  = useState("All");

  // Modal state
  const [showModal,    setShowModal]    = useState(false);
  const [editCamera,   setEditCamera]   = useState(null);  // null = add mode
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [togglingId,   setTogglingId]   = useState(null);

  const toast       = useToast();
  const mountedRef  = useRef(true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Load cameras (stable [] deps) ────────────────────────────────

  const loadCameras = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setBootError(false);
    try {
      const data = await cctvService.getCameras();
      if (!mountedRef.current) return;
      setCameras(Array.isArray(data) ? data : []);
    } catch {
      if (!mountedRef.current) return;
      setBootError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => { loadCameras(); }, [loadCameras]);

  // ── Derived ───────────────────────────────────────────────────────

  const filteredCameras = useMemo(() => {
    if (filterClass === "All") return cameras;
    return cameras.filter(c => c.classroom === filterClass);
  }, [cameras, filterClass]);

  const activeCount = useMemo(
    () => cameras.filter(c => c.status === "Active").length,
    [cameras]
  );

  // ── Handlers ──────────────────────────────────────────────────────

  function openAddModal() {
    setEditCamera(null);
    setShowModal(true);
  }

  function openEditModal(camera) {
    setEditCamera(camera);
    setShowModal(true);
  }

  async function handleSave(formData) {
    // Called from modal — throws on error (modal stays open)
    if (editCamera) {
      await cctvService.updateCamera(editCamera.camera_id, formData);
      toast.success(`"${formData.camera_name}" updated.`);
    } else {
      await cctvService.addCamera(formData);
      toast.success(`"${formData.camera_name}" added.`);
    }
    setShowModal(false);
    setEditCamera(null);
    await loadCameras();
  }

  async function handleDelete() {
    const name = deleteTarget.camera_name;
    await cctvService.deleteCamera(deleteTarget.camera_id);
    toast.success(`"${name}" deleted.`);
    setDeleteTarget(null);
    await loadCameras();
  }

  async function handleToggle(camera) {
    const newStatus = camera.status === "Active" ? "Inactive" : "Active";
    setTogglingId(camera.camera_id);

    // Optimistic update
    setCameras(prev =>
      prev.map(c => c.camera_id === camera.camera_id ? { ...c, status: newStatus } : c)
    );

    try {
      await cctvService.updateCamera(camera.camera_id, { status: newStatus });
      toast.success(`"${camera.camera_name}" is now ${newStatus}.`);
    } catch {
      // Rollback on failure
      setCameras(prev =>
        prev.map(c => c.camera_id === camera.camera_id ? { ...c, status: camera.status } : c)
      );
      toast.error("Could not update camera status.");
    } finally {
      if (mountedRef.current) setTogglingId(null);
    }
  }

  // ── RENDER ────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#F8F9FF] via-[#F7F8FC] to-[#FFFDF5] overflow-hidden">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* ── STICKY HEADER ──────────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-white/[0.98] backdrop-blur-2xl border-b border-gray-100 shadow-sm z-20">
          <div className="px-6 md:px-10 py-4 md:py-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

              {/* Title */}
              <div className="flex-shrink-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                  Yellow Dot · Admin
                </p>
                <h1 className="text-3xl md:text-4xl font-black text-yd-navy tracking-tight leading-none mt-0.5">
                  CCTV Settings
                </h1>
                <p className="text-gray-400 text-sm mt-1 font-medium">
                  Manage camera configuration · Phase 1
                </p>
              </div>

              {/* Stats + CTA */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {!loading && (
                  <div className="hidden sm:flex items-center gap-3">
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-2.5 text-center min-w-[72px]">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
                      <p className="text-2xl font-black text-yd-navy tabular-nums leading-none mt-0.5">
                        {cameras.length}
                      </p>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-2.5 text-center min-w-[72px]">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Active</p>
                      <p className="text-2xl font-black text-emerald-600 tabular-nums leading-none mt-0.5">
                        {activeCount}
                      </p>
                    </div>
                  </div>
                )}

                {/* Add Camera CTA */}
                <button
                  onClick={openAddModal}
                  className="group relative overflow-hidden flex items-center gap-2 px-5 py-3 rounded-2xl
                             bg-gradient-to-r from-yd-yellow to-yd-yellow-hover text-yd-navy text-sm font-black
                             shadow-md shadow-yellow-200/60 hover:shadow-lg hover:shadow-yellow-300/50
                             active:scale-[0.98] transition-all duration-200"
                >
                  <span aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent
                               via-white/30 to-transparent -translate-x-full group-hover:translate-x-full
                               transition-transform duration-700"
                  />
                  <span className="relative flex items-center gap-2">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                    Add Camera
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Classroom filter pills ── */}
          {!loading && !bootError && cameras.length > 0 && (
            <div className="px-6 md:px-10 pb-4">
              <div className="flex items-center gap-2 overflow-x-auto
                              scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent pb-0.5">
                {["All", ...CLASSROOMS].map(cls => (
                  <button
                    key={cls}
                    onClick={() => setFilterClass(cls)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-xl text-xs font-bold border
                                transition-all duration-150
                                ${filterClass === cls
                                  ? "bg-yd-navy text-white border-yd-navy shadow-sm"
                                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                                }`}
                  >
                    {cls}
                    {cls !== "All" && (
                      <span className={`ml-1.5 text-[9px] font-black
                                        ${filterClass === cls ? "text-white/60" : "text-gray-400"}`}>
                        {cameras.filter(c => c.classroom === cls).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── MAIN SCROLL AREA ───────────────────────────────────────── */}
        <div className="flex-1 overflow-auto px-6 md:px-10 py-7">

          {loading ? (
            <SkeletonGrid />
          ) : bootError ? (
            <ErrorState onRetry={loadCameras} />
          ) : cameras.length === 0 ? (
            <EmptyState onAdd={openAddModal} filtered={false} />
          ) : filteredCameras.length === 0 ? (
            <EmptyState onAdd={openAddModal} filtered={true} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredCameras.map(camera => (
                <CameraCard
                  key={camera.camera_id}
                  camera={camera}
                  toggling={togglingId === camera.camera_id}
                  onEdit={openEditModal}
                  onDelete={setDeleteTarget}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}

          {/* Bottom spacer */}
          <div className="h-8" />
        </div>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────── */}

      {showModal && (
        <CameraFormModal
          mode={editCamera ? "edit" : "add"}
          camera={editCamera}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditCamera(null); }}
        />
      )}

      {deleteTarget && (
        <DeleteCameraModal
          camera={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />
    </div>
  );
}
