import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { api } from "../services/authService";
import ParentLedger from "../components/finance/ParentLedger";
import familyService from "../services/familyService";

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(name = "") {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
}

const RELATION_OPTIONS = [
  "Grandparent", "Uncle", "Aunt", "Driver", "Nanny", "Family Friend", "Other",
];

// Photo → 150×150 JPEG base64 (~12 KB)
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

// ── Sub-components ─────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="mb-8 overflow-x-auto">
      <div className="flex gap-1.5 bg-white rounded-[20px] p-2 shadow-sm w-fit min-w-full sm:min-w-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`px-4 py-2.5 rounded-[12px] font-bold text-xs whitespace-nowrap transition-all duration-200 relative flex-shrink-0 ${
              active === t.key
                ? "bg-yellow-400 text-white shadow-md"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoField({ label, value, editMode, name, formData, onChange }) {
  return (
    <div>
      <p className="text-gray-400 mb-3 text-sm font-medium">{label}</p>
      {editMode ? (
        <input
          type="text"
          name={name}
          value={formData[name] || ""}
          onChange={onChange}
          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-xl font-bold outline-none focus:border-yellow-400"
        />
      ) : (
        <h3 className="text-2xl font-black text-[#0F172A]">{value || "—"}</h3>
      )}
    </div>
  );
}

// -- SVG status icons (no emoji) -------------------------------------------
const SvgI = ({ d, size = 14, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>{d}</svg>
);
const IconShield  = ({ size = 14 }) => <SvgI size={size} d={<path d="M8 1L2 4v4c0 3.3 2.6 6.4 6 7 3.4-.6 6-3.7 6-7V4L8 1z"/>} />;
const IconCheck   = ({ size = 11 }) => <SvgI size={size} d={<path d="M2 8l4 4 8-7"/>} />;
const IconPhone   = ({ size = 12 }) => <SvgI size={size} d={<><path d="M4 1h3l1.5 3.5L7 6a9 9 0 003 3l1.5-1.5L15 9v3a2 2 0 01-2 2A13 13 0 012 3a2 2 0 012-2"/></>} />;
const IconWarn    = ({ size = 11 }) => <SvgI size={size} d={<><path d="M8 2L1.5 13h13L8 2z"/><path d="M8 7v3M8 12v.5"/></>} />;
const IconEmergency = ({ size = 11 }) => <SvgI size={size} d={<><path d="M8 1v5M8 9v.5"/><circle cx="8" cy="12.5" r=".5" fill="currentColor"/><path d="M3.3 3.3L1 1M12.7 3.3L15 1M8 1a7 7 0 100 14A7 7 0 008 1z"/></>} />;

// -- Premium status chip ---------------------------------------------------
function StatusChipPill({ isIncomplete, isActive, isParent, isProtected }) {
  if (isIncomplete) return (
    <span className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-600 text-[10px] font-bold px-2.5 py-1 rounded-full">
      <IconWarn /> Incomplete
    </span>
  );
  if (!isActive) return (
    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-[10px] font-bold px-2.5 py-1 rounded-full">
      Disabled
    </span>
  );
  if (isParent) return (
    <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full">
      <IconCheck /> Verified
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-full">
      <IconCheck /> Authorized
    </span>
  );
}

// -- Toggle switch ---------------------------------------------------------
function Toggle({ isOn, onChange, disabled }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`w-10 h-5.5 rounded-full transition-all duration-200 flex items-center px-0.5 flex-shrink-0 ${
        isOn ? "bg-emerald-400" : "bg-gray-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      style={{ height: 22, width: 40 }}
    >
      <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${
        isOn ? "translate-x-[18px]" : "translate-x-0"
      }`} />
    </button>
  );
}

// ── Pickup Person Card — Premium redesign ──────────────────────────────────

function PickupCard({ person, onEdit, onDelete, onToggleStatus, busy }) {
  const isProtected  = person.isProtected;
  const isParent     = person.isParent;
  const isActive     = person.status === "Active";
  const isIncomplete = person.isIncomplete;
  const isBusy       = busy === person.entryId;

  return (
    <div className={`bg-white rounded-3xl p-6 transition-all border ${
      isIncomplete ? "border-orange-200 shadow-sm shadow-orange-100"
      : isParent   ? "border-gray-100 shadow-sm"
      : isActive   ? "border-gray-100"
      : "border-gray-100 opacity-55"
    }`}>
      <div className="flex items-center gap-5">

        {/* Circular photo with status dot */}
        <div className="relative flex-shrink-0">
          {person.photoUrl ? (
            <img src={person.photoUrl} alt={person.pickupName}
              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md" />
          ) : (
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-black text-white border-2 border-white shadow-md ${
              isIncomplete ? "bg-orange-300" : isParent ? "bg-slate-700" : "bg-gray-300"
            }`}>
              {initials(person.pickupName)}
            </div>
          )}
          {/* Status indicator dot */}
          <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${
            isIncomplete ? "bg-orange-400" : isActive ? "bg-emerald-400" : "bg-gray-300"
          }`}>
            {isIncomplete
              ? <IconWarn size={9} className="text-white" stroke="white" />
              : isActive
              ? <IconCheck size={8} className="text-white" stroke="white" />
              : <span className="text-white text-[8px] font-black leading-none">x</span>
            }
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-base font-black text-[#0F172A] leading-tight">{person.pickupName}</h3>
            {isParent && !isIncomplete && (
              <div className="text-gray-400" title="Protected record">
                <IconShield size={13} />
              </div>
            )}
          </div>

          <p className="text-gray-400 text-xs font-medium mb-2">{person.relation}</p>

          {/* Status chips row */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChipPill
              isIncomplete={isIncomplete}
              isActive={isActive}
              isParent={isParent}
              isProtected={isProtected}
            />
            {isParent && !isIncomplete && (
              <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-bold px-2.5 py-1 rounded-full">
                Default
              </span>
            )}
            {person.emergency && (
              <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold px-2.5 py-1 rounded-full">
                <IconEmergency /> Emergency
              </span>
            )}
          </div>

          {/* Mobile */}
          {person.mobile ? (
            <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-2">
              <IconPhone /> {person.mobile}
            </p>
          ) : isParent ? (
            <p className="flex items-center gap-1.5 text-xs text-orange-400 mt-2">
              <IconPhone /> Mobile not added
            </p>
          ) : null}
        </div>

        {/* Right actions */}
        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          {/* Active toggle */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 font-medium">{isActive ? "Active" : "Disabled"}</span>
            <Toggle isOn={isActive} onChange={() => onToggleStatus(person)} disabled={isBusy} />
          </div>

          {/* Edit / Complete */}
          <button
            onClick={() => onEdit(person)}
            disabled={isBusy}
            className={`text-xs font-bold px-4 py-1.5 rounded-xl transition-all ${
              isIncomplete
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
            }`}
          >
            {isIncomplete ? "Complete" : "Edit"}
          </button>

          {/* Delete — only for non-protected */}
          {!isProtected && (
            <button
              onClick={() => onDelete(person)}
              disabled={isBusy}
              className="text-xs font-bold text-gray-300 hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Add / Edit Modal (non-protected) ──────────────────────────────────────

function PickupModal({ mode, initial = {}, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    pickupName: initial.pickupName || "",
    relation:   initial.relation   || RELATION_OPTIONS[0],
    mobile:     initial.mobile     || "",
    emergency:  initial.emergency  || false,
    notes:      initial.notes      || "",
    status:     initial.status     || "Active",
  });
  const [photoPreview,  setPhotoPreview]  = useState(initial.photoUrl || "");
  const [photoData,     setPhotoData]     = useState(initial.photoUrl || "");
  const [photoLoading,  setPhotoLoading]  = useState(false);
  const fileRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    try {
      const compressed = await compressPhoto(file);
      setPhotoPreview(compressed);
      setPhotoData(compressed);
    } catch { /* ignore */ }
    finally { setPhotoLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[35px] p-10 w-full max-w-lg shadow-2xl max-h-[95vh] overflow-y-auto">
        <h2 className="text-3xl font-black text-[#0F172A] mb-8">
          {mode === "add" ? "Add Authorized Person" : "Edit Authorized Person"}
        </h2>

        <div className="space-y-5">
          {/* Photo */}
          <div className="flex flex-col items-center gap-3">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-2xl cursor-pointer overflow-hidden border-2 border-dashed border-gray-300 hover:border-yellow-400 transition-all flex items-center justify-center bg-gray-50"
            >
              {photoLoading ? (
                <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              ) : photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">📷</span>
              )}
            </div>
            <p className="text-xs text-gray-400 font-medium">Click to upload photo</p>
            <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />
          </div>

          <div>
            <label className="text-gray-500 text-sm font-medium block mb-1">Full Name *</label>
            <input
              value={form.pickupName}
              onChange={e => set("pickupName", e.target.value)}
              placeholder="e.g. Rohan Kumar"
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="text-gray-500 text-sm font-medium block mb-1">Relationship *</label>
            <select
              value={form.relation}
              onChange={e => set("relation", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none focus:border-yellow-400"
            >
              {RELATION_OPTIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="text-gray-500 text-sm font-medium block mb-1">Mobile Number</label>
            <input
              value={form.mobile}
              onChange={e => set("mobile", e.target.value)}
              placeholder="+91 9876543210"
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none focus:border-yellow-400"
            />
          </div>

          {mode === "edit" && (
            <div>
              <label className="text-gray-500 text-sm font-medium block mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => set("status", e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none focus:border-yellow-400"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-gray-500 text-sm font-medium block mb-1">Notes</label>
            <input
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Optional note"
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none focus:border-yellow-400"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set("emergency", !form.emergency)}
              className={`w-12 h-7 rounded-full transition-all duration-200 flex items-center px-1 ${
                form.emergency ? "bg-red-400" : "bg-gray-200"
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${
                form.emergency ? "translate-x-5" : "translate-x-0"
              }`} />
            </div>
            <span className="font-bold text-gray-700">Emergency Contact</span>
          </label>
        </div>

        <div className="flex gap-4 mt-8">
          <button onClick={onClose} disabled={loading}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-4 rounded-2xl transition-all">
            Cancel
          </button>
          <button
            onClick={() => onSave({ ...form, photoUrl: photoData })}
            disabled={loading || !form.pickupName.trim()}
            className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all"
          >
            {loading ? "Saving…" : mode === "add" ? "Add Person" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Protected Modal (Father / Mother) ─────────────────────────────────

function EditProtectedModal({ person, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    mobile:    person.mobile    || "",
    emergency: person.emergency || false,
    notes:     person.notes     || "",
    status:    person.status    || "Active",
  });
  const [photoPreview,  setPhotoPreview]  = useState(person.photoUrl || "");
  const [photoData,     setPhotoData]     = useState(person.photoUrl || "");
  const [photoLoading,  setPhotoLoading]  = useState(false);
  const fileRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    try {
      const compressed = await compressPhoto(file);
      setPhotoPreview(compressed);
      setPhotoData(compressed);
    } catch { /* ignore */ }
    finally { setPhotoLoading(false); }
  }

  const isIncomplete = person.isIncomplete;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[35px] p-10 w-full max-w-lg shadow-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-3xl font-black text-[#0F172A]">Edit {person.relation}</h2>
          {isIncomplete
            ? <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-1 rounded-full">⚠️ Incomplete</span>
            : <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded-full">🛡️ Protected</span>
          }
        </div>
        <p className="text-gray-400 text-sm mb-8">
          {isIncomplete
            ? `Missing fields: ${person.missingFields?.join(", ") || "photo, mobile"}. Add them to complete this profile.`
            : "Name and relationship cannot be changed for protected records."
          }
        </p>

        <div className="space-y-5">
          {/* Photo upload */}
          <div>
            <label className="text-gray-500 text-sm font-medium block mb-2">
              Photo {isIncomplete && !person.photoUrl && <span className="text-orange-500 font-bold">* Required</span>}
            </label>
            <div className="flex items-center gap-4">
              <div
                onClick={() => fileRef.current?.click()}
                className={`w-20 h-20 rounded-2xl cursor-pointer overflow-hidden border-2 border-dashed transition-all flex items-center justify-center ${
                  !photoPreview
                    ? "border-orange-300 bg-orange-50 hover:border-orange-500"
                    : "border-gray-300 bg-gray-50 hover:border-yellow-400"
                }`}
              >
                {photoLoading ? (
                  <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                ) : photoPreview ? (
                  <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">📷</span>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-sm font-bold text-yellow-600 bg-yellow-50 hover:bg-yellow-100 px-4 py-2 rounded-xl transition-all border border-yellow-200"
                >
                  {photoPreview ? "Change Photo" : "Upload Photo"}
                </button>
                <p className="text-xs text-gray-400 mt-1">150×150 JPEG recommended</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />
            </div>
          </div>

          <div>
            <label className="text-gray-500 text-sm font-medium block mb-1">
              Mobile Number {isIncomplete && !person.mobile && <span className="text-orange-500 font-bold">* Required</span>}
            </label>
            <input
              value={form.mobile}
              onChange={e => set("mobile", e.target.value)}
              placeholder="+91 9876543210"
              className={`w-full bg-gray-50 border rounded-2xl px-5 py-4 font-bold outline-none focus:border-yellow-400 ${
                isIncomplete && !person.mobile ? "border-orange-300" : "border-gray-200"
              }`}
            />
          </div>

          <div>
            <label className="text-gray-500 text-sm font-medium block mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => set("status", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none focus:border-yellow-400"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="text-gray-500 text-sm font-medium block mb-1">Notes</label>
            <input
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Optional note"
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-bold outline-none focus:border-yellow-400"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set("emergency", !form.emergency)}
              className={`w-12 h-7 rounded-full transition-all duration-200 flex items-center px-1 ${
                form.emergency ? "bg-red-400" : "bg-gray-200"
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${
                form.emergency ? "translate-x-5" : "translate-x-0"
              }`} />
            </div>
            <span className="font-bold text-gray-700">Emergency Contact</span>
          </label>
        </div>

        <div className="flex gap-4 mt-8">
          <button onClick={onClose} disabled={loading}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-4 rounded-2xl transition-all">
            Cancel
          </button>
          <button
            onClick={() => onSave({ ...form, photoUrl: photoData })}
            disabled={loading}
            className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all"
          >
            {loading ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Migration Banner ───────────────────────────────────────────────────────

function MigrationBanner({ result, onDismiss }) {
  if (!result) return null;
  const hasIncomplete = result.incomplete?.length > 0;
  return (
    <div className={`rounded-2xl p-5 mb-6 flex items-start gap-4 ${
      hasIncomplete ? "bg-orange-50 border border-orange-200" : "bg-green-50 border border-green-200"
    }`}>
      <span className="text-2xl flex-shrink-0">{hasIncomplete ? "⚠️" : "✅"}</span>
      <div className="flex-1">
        <p className={`font-bold text-sm ${hasIncomplete ? "text-orange-700" : "text-green-700"}`}>
          {result.created?.length > 0
            ? `Auto-created ${result.created.join(" & ")} pickup record(s) from student profile.`
            : "Parent pickup records already up to date."
          }
        </p>
        {hasIncomplete && (
          <p className="text-xs text-orange-600 mt-1">
            Some records are incomplete — click <strong>Complete Profile</strong> to add missing photo and mobile number.
          </p>
        )}
      </div>
      <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 text-lg font-bold flex-shrink-0">×</button>
    </div>
  );
}

// ── Family Information Card (Phase 4) ──────────────────────────────────────

function FamilyCard({ studentId }) {
  const navigate = useNavigate();
  const [family,    setFamily]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [action,    setAction]    = useState(null);     // null | "create" | "link"
  const [allFams,   setAllFams]   = useState([]);
  const [query,     setQuery]     = useState("");
  const [linkBusy,  setLinkBusy]  = useState(false);
  const [unlinkBusy,setUnlinkBusy]= useState(false);
  const [saveBusy,  setSaveBusy]  = useState(false);
  const [error,     setError]     = useState("");

  const [newFam, setNewFam] = useState({
    fatherName: "", motherName: "", primaryContact: "",
    alternateContact: "", email: "", address: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { family: fam } = await familyService.getFamilyForStudent(studentId);
      setFamily(fam || null);
    } catch { setFamily(null); }
    finally { setLoading(false); }
  }, [studentId]);

  useEffect(() => { if (studentId) load(); }, [studentId, load]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newFam.fatherName && !newFam.motherName) {
      setError("At least one parent name is required."); return;
    }
    setSaveBusy(true); setError("");
    try {
      const { familyId } = await familyService.create(newFam);
      await familyService.linkStudent(familyId, studentId);
      setAction(null);
      load();
    } catch (err) { setError(err?.response?.data?.error || "Failed to create family."); }
    finally { setSaveBusy(false); }
  }

  async function handleLink(familyId) {
    setLinkBusy(familyId); setError("");
    try {
      await familyService.linkStudent(familyId, studentId);
      setAction(null);
      load();
    } catch (err) { setError(err?.response?.data?.error || "Failed to link."); }
    finally { setLinkBusy(null); }
  }

  async function handleUnlink() {
    if (!family) return;
    setUnlinkBusy(true); setError("");
    try {
      await familyService.unlinkStudent(family.familyId, studentId);
      load();
    } catch (err) { setError(err?.response?.data?.error || "Failed to unlink."); }
    finally { setUnlinkBusy(false); }
  }

  async function openLink() {
    setAction("link"); setQuery(""); setError("");
    try {
      const { families } = await familyService.getAll();
      setAllFams(families || []);
    } catch { setAllFams([]); }
  }

  const filtered = allFams.filter(f => {
    const q = query.toLowerCase();
    return (
      f.familyCode.toLowerCase().includes(q) ||
      f.fatherName.toLowerCase().includes(q) ||
      f.motherName.toLowerCase().includes(q) ||
      f.primaryContact.includes(q)
    );
  });

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-[#FDFAF5] focus:outline-none focus:border-yellow-400";

  return (
    <div className="bg-white rounded-[35px] p-8 shadow-sm mt-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-yellow-50 flex items-center justify-center text-xl">👨‍👩‍👧‍👦</div>
          <h2 className="text-xl font-black text-[#0F172A]">Family</h2>
        </div>


      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : family ? (
        <div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Family Code</p>
              <p className="text-sm font-bold text-[#0F172A] font-mono">{family.familyCode}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Siblings</p>
              <p className="text-sm font-bold text-[#0F172A]">{(family.studentIds?.length || 1) - 1} sibling(s)</p>
            </div>
            {family.fatherName && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Guardian 1</p>
                <p className="text-sm font-bold text-[#0F172A]">{family.fatherName}</p>
              </div>
            )}
            {family.motherName && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Guardian 2</p>
                <p className="text-sm font-bold text-[#0F172A]">{family.motherName}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleUnlink}
            disabled={unlinkBusy}
            className="text-xs text-red-500 hover:text-red-700 font-semibold disabled:opacity-50"
          >{unlinkBusy ? "Removing…" : "Remove from Family"}</button>
        </div>
      ) : (
        <div>
          {action === null && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-400 mb-2">This student is not linked to any family yet.</p>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => { setAction("create"); setError(""); }}
                  className="px-4 py-2 rounded-xl bg-yellow-400 text-amber-800 font-bold text-sm hover:bg-yellow-500 transition-colors"
                >+ Create New Family</button>
                <button
                  onClick={openLink}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                >Link to Existing Family</button>
              </div>
            </div>
          )}

          {action === "create" && (
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Guardian 1</label>
                  <input className={inputCls} value={newFam.fatherName} onChange={e => setNewFam(f => ({ ...f, fatherName: e.target.value }))} placeholder="Guardian 1 name" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Guardian 2</label>
                  <input className={inputCls} value={newFam.motherName} onChange={e => setNewFam(f => ({ ...f, motherName: e.target.value }))} placeholder="Guardian 2 name" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Primary Contact *</label>
                  <input className={inputCls} value={newFam.primaryContact} onChange={e => setNewFam(f => ({ ...f, primaryContact: e.target.value }))} placeholder="+91 98765 43210" required />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1 block">Email</label>
                  <input className={inputCls} type="email" value={newFam.email} onChange={e => setNewFam(f => ({ ...f, email: e.target.value }))} placeholder="family@example.com" />
                </div>
              </div>
              {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={saveBusy} className="px-4 py-2 rounded-xl bg-yellow-400 text-amber-800 font-bold text-sm disabled:opacity-50">
                  {saveBusy ? "Creating…" : "Create & Link"}
                </button>
                <button type="button" onClick={() => setAction(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {action === "link" && (
            <div>
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by family code, name, or contact…"
                className={inputCls + " mb-3"}
              />
              <div className="max-h-48 overflow-y-auto space-y-2">
                {filtered.length === 0 && <p className="text-sm text-gray-400">No families found.</p>}
                {filtered.map(f => (
                  <div key={f.familyId} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-[#FDFAF5]">
                    <div>
                      <p className="text-sm font-bold text-[#0F172A]">{f.fatherName || f.motherName}</p>
                      <p className="text-xs text-gray-400">{f.familyCode} · {f.studentIds?.length || 0} child(ren)</p>
                    </div>
                    <button
                      onClick={() => handleLink(f.familyId)}
                      disabled={linkBusy === f.familyId}
                      className="px-3 py-1.5 rounded-lg bg-yellow-400 text-amber-800 font-bold text-xs disabled:opacity-50"
                    >{linkBusy === f.familyId ? "Linking…" : "Link"}</button>
                  </div>
                ))}
              </div>
              {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
              <button onClick={() => setAction(null)} className="mt-3 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

function StudentProfile() {
  const { id } = useParams();

  // ── Student ──────────────────────────────────────────────────
  const [student,  setStudent]  = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving,   setSaving]   = useState(false);

  // ── Tabs ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("overview");

  // ── Pickup Authorization ──────────────────────────────────────
  const [persons,       setPersons]       = useState([]);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupError,   setPickupError]   = useState("");
  const [busyId,        setBusyId]        = useState(null);
  const [showAdd,       setShowAdd]       = useState(false);
  const [addLoading,    setAddLoading]    = useState(false);
  const [editTarget,    setEditTarget]    = useState(null);
  const [editLoading,   setEditLoading]   = useState(false);
  const [toast,         setToast]         = useState("");

  // ── Migration ─────────────────────────────────────────────────
  const [migrating,       setMigrating]       = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const migrationCheckedRef = useRef(false);

  // ── Audit Log ─────────────────────────────────────────────────
  const [auditLogs,    setAuditLogs]    = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showAudit,    setShowAudit]    = useState(false);

  // ── Pickup History ────────────────────────────────────────────
  const [phEntries, setPhEntries] = useState([]);
  const [phLoading, setPhLoading] = useState(false);

  // ── Fetch student ─────────────────────────────────────────────
  useEffect(() => {
    api.get(`/students/${id}`)
      .then(r => { setStudent(r.data); setFormData(r.data); })
      .catch(err => console.error(err));
  }, [id]);

  // Reset migration check when student changes
  const studentId = student?.Student_ID || student?.studentId || "";
  useEffect(() => { migrationCheckedRef.current = false; }, [studentId]);

  // ── Auto-migrate + load pickup persons ────────────────────────
  const loadPickupPersons = useCallback(async (skipMigration = false) => {
    if (!studentId) return;
    setPickupLoading(true);
    setPickupError("");
    try {
      const res     = await api.get(`/api/pickup-authorization?studentId=${studentId}`);
      const entries = res.data?.entries || [];
      setPersons(entries);

      // Auto-migrate if Father/Mother records are missing — run only once per load
      if (!skipMigration && !migrationCheckedRef.current && student) {
        migrationCheckedRef.current = true;

        const hasFather    = entries.some(e => e.isParent && e.relation === "Father");
        const hasMother    = entries.some(e => e.isParent && e.relation === "Mother");
        const needsFather  = !!(student.Father_Name || "").trim() && !hasFather;
        const needsMother  = !!(student.Mother_Name || "").trim() && !hasMother;

        if (needsFather || needsMother) {
          setMigrating(true);
          api.post("/api/pickup-authorization/migrate-student", {
            studentId,
            studentName:  student.Student_Name || "",
            fatherName:   student.Father_Name   || "",
            fatherMobile: student.Father_Whatsapp || student.Father_Phone || "",
            fatherPhoto:  student.father_photo   || "",
            motherName:   student.Mother_Name    || "",
            motherMobile: student.Mother_Whatsapp || student.Mother_Phone || "",
            motherPhoto:  student.mother_photo   || "",
          }).then(r => {
            if (r.data.created?.length > 0 || r.data.incomplete?.length > 0) {
              setMigrationResult(r.data);
              // Reload to show the newly created records
              loadPickupPersons(true);
            }
          }).catch(err => console.error("[StudentProfile] Migration failed:", err.message))
            .finally(() => setMigrating(false));
        }
      }
    } catch (e) {
      setPickupError(e?.response?.data?.error || "Failed to load pickup persons.");
    } finally {
      setPickupLoading(false);
    }
  }, [studentId, student]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "pickup" && studentId) loadPickupPersons();
  }, [activeTab, studentId, loadPickupPersons]);

  // ── Audit logs ────────────────────────────────────────────────
  const loadAuditLogs = useCallback(async () => {
    if (!studentId) return;
    setAuditLoading(true);
    try {
      const res = await api.get(`/api/pickup-authorization/audit?studentId=${studentId}`);
      setAuditLogs(res.data?.logs || []);
    } catch (e) {
      console.error("Audit fetch failed:", e.message);
    } finally {
      setAuditLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (showAudit) loadAuditLogs();
  }, [showAudit, loadAuditLogs]);

  // ── Pickup History ────────────────────────────────────────────
  const loadPickupHistory = useCallback(async () => {
    if (!studentId) return;
    setPhLoading(true);
    try {
      const res = await api.get(`/api/pickup-history?studentId=${studentId}&limit=30`);
      setPhEntries(res.data?.entries || res.data || []);
    } catch (e) {
      console.error("[StudentProfile] Pickup history fetch failed:", e.message);
    } finally {
      setPhLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (activeTab === "pickup" && studentId) loadPickupHistory();
  }, [activeTab, studentId, loadPickupHistory]);

  // ── Toast helper ──────────────────────────────────────────────
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  // ── Student edit ──────────────────────────────────────────────
  const handleChange = e => setFormData(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.put(`/students/${id}`, formData).then(r => r.data);
      setStudent(updated);
      setEditMode(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Pickup CRUD ───────────────────────────────────────────────
  const handleAdd = async (form) => {
    if (!studentId) return;
    setAddLoading(true);
    try {
      await api.post("/api/pickup-authorization", {
        studentId,
        studentName: student?.Student_Name || "",
        pickupName:  form.pickupName,
        relation:    form.relation,
        mobile:      form.mobile,
        photoUrl:    form.photoUrl || "",
        emergency:   form.emergency,
        notes:       form.notes,
        isParent:    false,
        isProtected: false,
      });
      setShowAdd(false);
      showToast(`${form.pickupName} added as authorized pickup person.`);
      loadPickupPersons(true);
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to add person.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = async (form) => {
    if (!editTarget) return;
    setEditLoading(true);
    try {
      await api.put(`/api/pickup-authorization/${editTarget.entryId}`, {
        mobile:    form.mobile,
        emergency: form.emergency,
        notes:     form.notes,
        status:    form.status,
        photoUrl:  form.photoUrl,
        ...(!editTarget.isProtected && {
          pickupName: form.pickupName,
          relation:   form.relation,
        }),
      });
      setEditTarget(null);
      showToast("Updated successfully.");
      loadPickupPersons(true);
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to update.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleStatus = async (person) => {
    setBusyId(person.entryId);
    const newStatus = person.status === "Active" ? "Inactive" : "Active";
    try {
      await api.put(`/api/pickup-authorization/${person.entryId}`, { status: newStatus });
      showToast(`${person.pickupName} set to ${newStatus}.`);
      loadPickupPersons(true);
    } catch (e) {
      alert(e?.response?.data?.error || "Failed to update status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (person) => {
    if (!window.confirm(`Remove ${person.pickupName} from authorized pickup list?`)) return;
    setBusyId(person.entryId);
    try {
      await api.delete(`/api/pickup-authorization/${person.entryId}`);
      showToast(`${person.pickupName} removed.`);
      loadPickupPersons(true);
    } catch (e) {
      const data = e?.response?.data;
      if (data?.code === "PROTECTED_RECORD") {
        alert("Protected records cannot be deleted. Use Disable instead.");
      } else {
        alert(data?.error || "Failed to delete.");
      }
    } finally {
      setBusyId(null);
    }
  };

  // ── Loading guard ─────────────────────────────────────────────
  if (!student) {
    return (
      <div className="flex items-center justify-center h-screen text-3xl font-bold text-gray-400">
        Loading Student…
      </div>
    );
  }

  const parentPersons     = persons.filter(p => p.isParent);
  const additionalPersons = persons.filter(p => !p.isParent);
  const incompleteCount   = persons.filter(p => p.isIncomplete).length;

  const TABS = [
    { key: "overview",    label: "Overview"    },
    { key: "parents",     label: "Parents"     },
    { key: "attendance",  label: "Attendance"  },
    { key: "food",        label: "Food"        },
    { key: "naps",        label: "Naps"        },
    { key: "pickup",      label: "Pickup", badge: incompleteCount },
    { key: "medical",     label: "Medical"     },
    { key: "billing",     label: "Billing"     },
    { key: "finance",     label: "Finance"     },
    { key: "docs",        label: "Docs"        },
    { key: "notes",       label: "Notes"       },
    { key: "timeline",    label: "Timeline"    },
  ];

  return (
    <div className="flex bg-white min-h-screen">

      {/* SIDEBAR */}
      <Sidebar />

      {/* MAIN CONTENT */}
      <div className="ml-[280px] w-full p-8">

        {/* TOPBAR */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-4xl font-black text-[#0F172A]">Student Profile</h2>
            <p className="text-gray-500 mt-1 text-lg">Complete information &amp; security settings</p>
          </div>
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-3xl bg-white shadow-md flex items-center justify-center text-xl">🔔</div>
            <div className="bg-white rounded-3xl px-5 py-3 shadow-md flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-yellow-400 flex items-center justify-center text-white font-black text-xl">K</div>
              <div>
                <h3 className="font-bold text-[#0F172A]">Kunal</h3>
                <p className="text-gray-500 text-sm">Admin</p>
              </div>
            </div>
          </div>
        </div>

        {/* HERO CARD */}
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-300 rounded-[40px] p-10 shadow-2xl relative overflow-hidden mb-8">
          <div className="flex items-center gap-8">
            <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-5xl text-white font-black shadow-2xl flex-shrink-0 overflow-hidden">
              {student.profile_image
                ? <img src={student.profile_image} alt="" className="w-full h-full object-cover" />
                : initials(student.Student_Name)}
            </div>
            <div>
              <h1 className="text-5xl font-black text-white">{student.Student_Name}</h1>
              <p className="text-white/90 text-xl mt-2">{student.Class} · {student.Center}</p>
              <div className="flex gap-3 mt-5 flex-wrap">
                <span className="bg-white/20 text-white px-5 py-2 rounded-2xl font-bold backdrop-blur-md text-sm">Active</span>
                <span className="bg-white/20 text-white px-5 py-2 rounded-2xl font-bold backdrop-blur-md text-sm">{student.Student_ID}</span>
                <span className="bg-white/20 text-white px-5 py-2 rounded-2xl font-bold backdrop-blur-md text-sm">
                  Joined: {student.Admission_Date || "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {/* ── TAB: OVERVIEW ── */}
        {activeTab === "overview" && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-[30px] p-8 shadow-sm">
                <p className="text-gray-400 font-medium text-sm">Attendance</p>
                <h2 className="text-5xl font-black text-[#0F172A] mt-4">92%</h2>
              </div>
              <div className="bg-white rounded-[30px] p-8 shadow-sm">
                <p className="text-gray-400 font-medium text-sm">Fee Status</p>
                <h2 className="text-4xl font-black text-green-500 mt-4">Paid</h2>
              </div>
              <div className="bg-white rounded-[30px] p-8 shadow-sm">
                <p className="text-gray-400 font-medium text-sm">Medical Alert</p>
                <h2 className="text-2xl font-black text-red-500 mt-4">Peanut Allergy</h2>
              </div>
              <div className="bg-white rounded-[30px] p-8 shadow-sm">
                <p className="text-gray-400 font-medium text-sm">Vaccination</p>
                <h2 className="text-3xl font-black text-blue-500 mt-4">Updated</h2>
              </div>
            </div>

            <div className="flex justify-end mb-4">
              <button
                onClick={() => editMode ? handleSave() : setEditMode(true)}
                disabled={saving}
                className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-60 text-white font-bold px-8 py-4 rounded-3xl shadow-lg transition-all"
              >
                {saving ? "Saving…" : editMode ? "Save Changes" : "Edit Profile"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="bg-white rounded-[35px] p-10 shadow-sm">
                <h2 className="text-3xl font-black text-[#0F172A] mb-8">Personal Information</h2>
                <div className="grid grid-cols-2 gap-8">
                  <InfoField label="Date of Birth"  value={student.DOB}    editMode={editMode} name="DOB"    formData={formData} onChange={handleChange} />
                  <InfoField label="Gender"          value={student.Gender} editMode={false}    name="Gender" formData={formData} onChange={handleChange} />
                  <InfoField label="Class"           value={student.Class}  editMode={editMode} name="Class"  formData={formData} onChange={handleChange} />
                  <InfoField label="Center"          value={student.Center} editMode={editMode} name="Center" formData={formData} onChange={handleChange} />
                </div>
              </div>

              <div className="bg-white rounded-[35px] p-10 shadow-sm">
                <h2 className="text-3xl font-black text-[#0F172A] mb-8">Parent Details</h2>
                <div className="grid grid-cols-2 gap-8">
                  <InfoField label="Father Name"      value={student.Father_Name}     editMode={editMode} name="Father_Name"     formData={formData} onChange={handleChange} />
                  <InfoField label="Mother Name"      value={student.Mother_Name}     editMode={editMode} name="Mother_Name"     formData={formData} onChange={handleChange} />
                  <InfoField label="Father WhatsApp"  value={student.Father_Whatsapp} editMode={editMode} name="Father_Whatsapp" formData={formData} onChange={handleChange} />
                  <div>
                    <p className="text-gray-400 mb-3 text-sm font-medium">Father Email</p>
                    <h3 className="text-lg font-black text-[#0F172A] break-all">{student.Father_Email || "—"}</h3>
                  </div>
                </div>
              </div>
            </div>
            {/* Family Information Card */}
            <FamilyCard studentId={student?.Student_ID || student?.studentId || ""} />
          </div>
        )}

        {/* ── TAB: PARENTS ── */}
        {activeTab === "parents" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Father */}
              <div className="bg-white rounded-[35px] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-xl">👨</div>
                  <h2 className="text-xl font-black text-[#0F172A]">Father</h2>
                </div>
                <div className="space-y-4">
                  {[
                    { label: "Name",      value: student.Father_Name      },
                    { label: "WhatsApp",  value: student.Father_Whatsapp  },
                    { label: "Phone",     value: student.Father_Phone     },
                    { label: "Email",     value: student.Father_Email     },
                    { label: "Occupation",value: student.Father_Occupation},
                  ].map(f => f.value ? (
                    <div key={f.label}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{f.label}</p>
                      <p className="text-sm font-bold text-[#0F172A] mt-0.5 break-all">{f.value}</p>
                    </div>
                  ) : null)}
                  {!student.Father_Name && <p className="text-sm text-gray-400 italic">No father details on record.</p>}
                </div>
              </div>
              {/* Mother */}
              <div className="bg-white rounded-[35px] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-pink-50 flex items-center justify-center text-xl">👩</div>
                  <h2 className="text-xl font-black text-[#0F172A]">Mother</h2>
                </div>
                <div className="space-y-4">
                  {[
                    { label: "Name",      value: student.Mother_Name      },
                    { label: "WhatsApp",  value: student.Mother_Whatsapp  },
                    { label: "Phone",     value: student.Mother_Phone     },
                    { label: "Email",     value: student.Mother_Email     },
                    { label: "Occupation",value: student.Mother_Occupation},
                  ].map(f => f.value ? (
                    <div key={f.label}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{f.label}</p>
                      <p className="text-sm font-bold text-[#0F172A] mt-0.5 break-all">{f.value}</p>
                    </div>
                  ) : null)}
                  {!student.Mother_Name && <p className="text-sm text-gray-400 italic">No mother details on record.</p>}
                </div>
              </div>
            </div>
            {/* Address */}
            {(student.Address || student.City || student.State) && (
              <div className="bg-white rounded-[35px] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center text-xl">🏠</div>
                  <h2 className="text-xl font-black text-[#0F172A]">Home Address</h2>
                </div>
                <p className="text-sm font-semibold text-gray-600">
                  {[student.Address, student.City, student.State, student.Pincode].filter(Boolean).join(", ")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: ATTENDANCE ── */}
        {activeTab === "attendance" && (
          <div className="bg-white rounded-[35px] p-10 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-xl">📅</div>
              <h2 className="text-2xl font-black text-[#0F172A]">Attendance</h2>
            </div>
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-green-50 rounded-[24px] p-6 text-center">
                <p className="text-green-500 text-xs font-bold uppercase tracking-wide mb-2">Present</p>
                <h3 className="text-4xl font-black text-green-700">—</h3>
              </div>
              <div className="bg-red-50 rounded-[24px] p-6 text-center">
                <p className="text-red-400 text-xs font-bold uppercase tracking-wide mb-2">Absent</p>
                <h3 className="text-4xl font-black text-red-600">—</h3>
              </div>
              <div className="bg-yellow-50 rounded-[24px] p-6 text-center">
                <p className="text-yellow-600 text-xs font-bold uppercase tracking-wide mb-2">Attendance %</p>
                <h3 className="text-4xl font-black text-yellow-700">—</h3>
              </div>
            </div>
            <p className="text-center text-sm text-gray-400 italic">Full attendance calendar coming soon.</p>
          </div>
        )}

        {/* ── TAB: FOOD ── */}
        {activeTab === "food" && (
          <div className="bg-white rounded-[35px] p-10 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-xl">🍱</div>
              <h2 className="text-2xl font-black text-[#0F172A]">Food &amp; Meals</h2>
            </div>
            <p className="text-gray-400">Meal consumption records for this student will appear here.</p>
            <div className="mt-8 bg-orange-50 rounded-[24px] p-8 text-orange-400 italic text-center text-sm">
              Meal tracking coming soon.
            </div>
          </div>
        )}

        {/* ── TAB: NAPS ── */}
        {activeTab === "naps" && (
          <div className="bg-white rounded-[35px] p-10 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-xl">😴</div>
              <h2 className="text-2xl font-black text-[#0F172A]">Nap Tracker</h2>
            </div>
            <p className="text-gray-400">Nap logs and sleep records for this student will appear here.</p>
            <div className="mt-8 bg-purple-50 rounded-[24px] p-8 text-purple-400 italic text-center text-sm">
              Nap history coming soon.
            </div>
          </div>
        )}

        {/* ── TAB: PICKUP AUTHORIZATION ── */}
        {activeTab === "pickup" && (
          <div>

            {/* Security hero bar */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-3xl p-7 mb-8 flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/10 flex-shrink-0">
                {student.profile_image
                  ? <img src={student.profile_image} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-white/10 flex items-center justify-center text-white font-black text-2xl">{initials(student.Student_Name)}</div>
                }
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-black text-white leading-tight">{student.Student_Name}</h2>
                <p className="text-white/50 text-sm mt-0.5">{student.Class}</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 bg-white/10 text-white/80 text-xs font-bold px-3 py-1.5 rounded-full border border-white/10">
                    <IconShield size={12} /> {persons.filter(p => p.status === "Active").length} Authorized
                  </span>
                  {incompleteCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 bg-orange-500/20 text-orange-300 text-xs font-bold px-3 py-1.5 rounded-full border border-orange-400/30">
                      <IconWarn size={11} /> {incompleteCount} Need Attention
                    </span>
                  )}
                  {migrating && (
                    <span className="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-400/30">
                      <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                      Setting up…
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowAdd(true)}
                className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-black text-sm px-5 py-3 rounded-2xl transition-all flex-shrink-0"
              >
                + Add Person
              </button>
            </div>

            {/* Migration result banner */}
            <MigrationBanner result={migrationResult} onDismiss={() => setMigrationResult(null)} />

            {pickupLoading && !migrating && (
              <div className="text-center py-16 text-gray-400 font-bold">Loading…</div>
            )}

            {pickupError && (
              <div className="bg-red-50 text-red-500 font-bold rounded-2xl p-5 mb-6">{pickupError}</div>
            )}

            {!pickupLoading && !pickupError && (
              <>
                {/* Incomplete notice */}
                {incompleteCount > 0 && !migrationResult && (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <IconWarn size={16} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="font-bold text-orange-700 text-sm">
                        {incompleteCount} profile{incompleteCount > 1 ? "s need" : " needs"} attention
                      </p>
                      <p className="text-xs text-orange-500 mt-0.5">
                        Tap <strong>Complete</strong> on the card to add the missing photo or mobile.
                      </p>
                    </div>
                  </div>
                )}

                {/* Parents */}
                {parentPersons.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="text-gray-300"><IconShield size={14} /></div>
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                        Parents
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {parentPersons.map(p => (
                        <PickupCard
                          key={p.entryId}
                          person={p}
                          onEdit={setEditTarget}
                          onDelete={handleDelete}
                          onToggleStatus={handleToggleStatus}
                          busy={busyId}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional guardians */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                      Additional Guardians
                    </h3>
                    {additionalPersons.length > 0 && (
                      <span className="text-xs text-gray-400 font-medium">{additionalPersons.length} added</span>
                    )}
                  </div>
                  {additionalPersons.length === 0 ? (
                    <button
                      onClick={() => setShowAdd(true)}
                      className="w-full bg-white border-2 border-dashed border-gray-200 rounded-3xl p-8 text-center hover:border-yellow-300 hover:bg-yellow-50/30 transition-all group"
                    >
                      <div className="text-gray-300 group-hover:text-yellow-400 transition-colors mb-2 flex justify-center">
                        <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="8" cy="8" r="6.5"/><path d="M8 5v6M5 8h6"/>
                        </svg>
                      </div>
                      <p className="font-bold text-gray-400 group-hover:text-gray-600 transition-colors text-sm">Add a guardian</p>
                      <p className="text-xs text-gray-300 mt-1">Grandparents, driver, nanny, family friend</p>
                    </button>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {additionalPersons.map(p => (
                        <PickupCard
                          key={p.entryId}
                          person={p}
                          onEdit={setEditTarget}
                          onDelete={handleDelete}
                          onToggleStatus={handleToggleStatus}
                          busy={busyId}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {persons.length === 0 && !pickupLoading && !migrating && (
                  <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-300">
                      <IconShield size={28} />
                    </div>
                    <p className="font-black text-gray-700 text-lg">No pickup persons added</p>
                    <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">
                      Parent records are set up automatically. Add additional guardians using the button above.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Audit Log */}
            <div className="mt-8">
              <button
                onClick={() => setShowAudit(v => !v)}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 font-bold transition-all"
              >
                <span>{showAudit ? "▼" : "▶"}</span>
                <span>Audit Log</span>
                {auditLogs.length > 0 && (
                  <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {auditLogs.length}
                  </span>
                )}
              </button>

              {showAudit && (
                <div className="mt-4 bg-white rounded-[28px] p-6 shadow-sm">
                  {auditLoading ? (
                    <p className="text-gray-400 font-bold text-center py-6">Loading audit log…</p>
                  ) : auditLogs.length === 0 ? (
                    <p className="text-gray-400 text-center py-6">No audit entries found.</p>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                      {auditLogs.map((log, i) => (
                        <div key={log.logId || i} className="flex items-start gap-4 py-3 border-b border-gray-50 last:border-0">
                          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                            log.action === "created"  ? "bg-green-400"  :
                            log.action === "deleted"  ? "bg-red-400"    :
                            log.action === "disabled" ? "bg-orange-400" :
                            log.action === "enabled"  ? "bg-blue-400"   :
                            "bg-gray-300"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#0F172A]">{log.description}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {fmtDate(log.createdAt)}
                              {log.actorUserId && log.actorUserId !== "system" && log.actorUserId !== "migration"
                                ? ` · by ${log.actorUserId}` : ""}
                            </p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${
                            log.action === "created"  ? "bg-green-50 text-green-600"   :
                            log.action === "deleted"  ? "bg-red-50 text-red-500"       :
                            log.action === "disabled" ? "bg-orange-50 text-orange-500" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {log.action}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Pickup History ──────────────────────────────────────── */}
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Pickup History</h3>
                {phLoading && (
                  <div className="w-3 h-3 border border-gray-300 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              {!phLoading && phEntries.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No pickup events recorded for this student.</p>
              ) : (
                <div className="space-y-2">
                  {phEntries.map((h, i) => (
                    <div key={h.entryId || h.id || i} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
                      {/* Collector photo or initial */}
                      {h.selfieImage && h.selfieImage !== "staff-checkout" ? (
                        <img src={h.selfieImage} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-400 flex-shrink-0">
                          {(h.pickupName || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      {/* Collector name + relation */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#0F172A] truncate">{h.pickupName || "Unknown"}</p>
                        <p className="text-xs text-gray-400">{h.relation || "—"}</p>
                      </div>
                      {/* Status badge */}
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${
                        h.approvalStatus === "Authorized" ? "bg-green-50 text-green-600" :
                        h.approvalStatus === "Emergency"  ? "bg-orange-50 text-orange-500" :
                        h.approvalStatus === "Blocked"    ? "bg-red-50 text-red-500" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {h.approvalStatus || "Recorded"}
                      </span>
                      {/* Date */}
                      <p className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">{h.date || fmtDate(h.checkoutTime)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: BILLING ── */}
        {activeTab === "billing" && (
          <div className="bg-white rounded-[35px] p-10 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-yellow-50 flex items-center justify-center text-xl">🧾</div>
                <h2 className="text-2xl font-black text-[#0F172A]">Billing</h2>
              </div>
              <a
                href="/invoice"
                className="bg-yellow-400 hover:bg-yellow-500 text-white font-bold text-sm px-5 py-2.5 rounded-2xl transition-all"
              >
                + New Invoice
              </a>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Create and manage invoices for this student. Use the Finance tab for ledger, statement, and payment history.
            </p>
            <div className="grid grid-cols-2 gap-5">
              <a href="/invoice" className="flex items-center gap-4 p-5 rounded-[24px] border border-gray-100 hover:border-yellow-300 hover:shadow-md transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-xl group-hover:bg-blue-100 transition-colors">📄</div>
                <div>
                  <p className="font-black text-[#0F172A] text-sm">View All Invoices</p>
                  <p className="text-xs text-gray-400 mt-0.5">Open full invoice management</p>
                </div>
              </a>
              <a href="/fees" className="flex items-center gap-4 p-5 rounded-[24px] border border-gray-100 hover:border-yellow-300 hover:shadow-md transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-xl group-hover:bg-green-100 transition-colors">💰</div>
                <div>
                  <p className="font-black text-[#0F172A] text-sm">Fee Templates</p>
                  <p className="text-xs text-gray-400 mt-0.5">Manage fee structures</p>
                </div>
              </a>
            </div>
          </div>
        )}

        {/* ── TAB: FINANCE ── */}
        {activeTab === "finance" && (
          <ParentLedger
            studentId={studentId}
            studentName={student?.Student_Name}
          />
        )}

        {/* ── TAB: MEDICAL ── */}
        {activeTab === "medical" && (
          <div className="bg-white rounded-[35px] p-10 shadow-sm">
            <h2 className="text-3xl font-black text-[#0F172A] mb-4">Medical Information</h2>
            <p className="text-gray-400">Medical records, allergies, and vaccination history will appear here.</p>
            <div className="mt-10 grid grid-cols-3 gap-6">
              <div className="bg-red-50 rounded-[24px] p-6">
                <p className="text-red-400 text-sm font-bold mb-2">Allergies</p>
                <h3 className="text-2xl font-black text-red-600">Peanut Allergy</h3>
              </div>
              <div className="bg-blue-50 rounded-[24px] p-6">
                <p className="text-blue-400 text-sm font-bold mb-2">Vaccination</p>
                <h3 className="text-2xl font-black text-blue-600">Up to Date</h3>
              </div>
              <div className="bg-green-50 rounded-[24px] p-6">
                <p className="text-green-400 text-sm font-bold mb-2">Blood Group</p>
                <h3 className="text-2xl font-black text-green-600">{student.Blood_Group || "—"}</h3>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: DOCS ── */}
        {activeTab === "docs" && (
          <div className="bg-white rounded-[35px] p-10 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-xl">📁</div>
              <h2 className="text-2xl font-black text-[#0F172A]">Documents</h2>
            </div>
            <p className="text-gray-400 mb-6">Birth certificate, vaccination records, admission forms and other documents.</p>
            <div className="mt-4 bg-indigo-50 rounded-[24px] p-8 text-indigo-300 italic text-center text-sm">
              Document uploads coming soon.
            </div>
          </div>
        )}

        {/* ── TAB: NOTES ── */}
        {activeTab === "notes" && (
          <div className="bg-white rounded-[35px] p-10 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-xl">📝</div>
              <h2 className="text-2xl font-black text-[#0F172A]">Notes</h2>
            </div>
            <p className="text-gray-400">Staff notes and observations about the student will appear here.</p>
            <div className="mt-8 bg-gray-50 rounded-[24px] p-8 text-gray-400 italic text-center">
              No notes added yet.
            </div>
          </div>
        )}

        {/* ── TAB: TIMELINE ── */}
        {activeTab === "timeline" && (
          <div className="bg-white rounded-[35px] p-10 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-xl">🕐</div>
              <h2 className="text-2xl font-black text-[#0F172A]">Timeline</h2>
            </div>
            <p className="text-gray-400 mb-6">Chronological activity log — admissions, fee events, updates, milestones.</p>
            <div className="space-y-0">
              {[
                { icon: "🎓", color: "bg-yellow-100 text-yellow-600", label: "Admission", desc: `Admitted to ${student.Class || "—"}`, date: student.Admission_Date },
              ].filter(e => e.date).map((e, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-base flex-shrink-0 ${e.color}`}>{e.icon}</div>
                    <div className="w-px flex-1 bg-gray-100 mt-1" />
                  </div>
                  <div className="pb-6 pt-1.5">
                    <p className="font-bold text-sm text-[#0F172A]">{e.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{e.desc}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{e.date}</p>
                  </div>
                </div>
              ))}
              <div className="mt-4 text-center text-sm text-gray-400 italic">Full activity timeline coming soon.</div>
            </div>
          </div>
        )}

      </div>

      {/* ── Add Person Modal ── */}
      {showAdd && (
        <PickupModal
          mode="add"
          onClose={() => setShowAdd(false)}
          onSave={handleAdd}
          loading={addLoading}
        />
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        editTarget.isProtected ? (
          <EditProtectedModal
            person={editTarget}
            onClose={() => setEditTarget(null)}
            onSave={handleEdit}
            loading={editLoading}
          />
        ) : (
          <PickupModal
            mode="edit"
            initial={editTarget}
            onClose={() => setEditTarget(null)}
            onSave={handleEdit}
            loading={editLoading}
          />
        )
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white font-bold px-8 py-4 rounded-2xl shadow-2xl z-50">
          ✓ {toast}
        </div>
      )}

    </div>
  );
}

export default StudentProfile;
