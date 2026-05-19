import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { INR, sumAmounts } from "../utils/currency";
import { api } from "../services/authService";

const get  = url      => api.get(url).then(r => r.data);
const post = (url, d) => api.post(url, d).then(r => r.data);
const del  = url      => api.delete(url).then(r => r.data);

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Online"];
const CLASSES = ["Daycare", "Playgroup", "Nursery", "LKG", "UKG",
                 "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];

const STATUS_CFG = {
  Paid:      { cls: "badge badge-success" },
  Pending:   { cls: "badge badge-warn"    },
  Partial:   { cls: "badge badge-info"    },
  Overdue:   { cls: "badge badge-danger"  },
  Cancelled: { cls: "badge badge-neutral" },
};

function overdueDays(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - due) / 86400000));
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

// -- Toast system --
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, msg) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return {
    toasts,
    success: useCallback(m => add("success", m), [add]),
    error:   useCallback(m => add("error",   m), [add]),
    info:    useCallback(m => add("info",    m), [add]),
  };
}

function Toasts({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-[500] flex flex-col gap-1.5 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`yd-toast pointer-events-auto ${
          t.type === "success" ? "yd-toast-success" : t.type === "error" ? "yd-toast-error" : "yd-toast-info"
        }`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.Pending;
  return <span className={cfg.cls}>{status || "Pending"}</span>;
}

function OverdueBadge({ dueDate, status }) {
  if (status === "Paid" || status === "Cancelled") return null;
  const days = overdueDays(dueDate);
  if (days <= 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-yd-danger bg-yd-danger-soft border border-yd-danger-border ml-1">
      {days}d overdue
    </span>
  );
}

function StatCard({ label, value, sub, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start px-4 py-3 rounded-xl border transition-all text-left
        ${active
          ? "bg-yd-navy text-white border-yd-navy shadow-md"
          : "bg-white border-yd-border-light hover:border-yd-border hover:shadow-sm"}`}>
      <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${active ? "text-white/70" : "text-yd-text-3"}`}>{label}</span>
      <span className={`text-xl font-black leading-none ${active ? "text-white" : "text-yd-navy"}`}>{value}</span>
      {sub && <span className={`text-[10px] mt-0.5 ${active ? "text-white/60" : "text-yd-text-3"}`}>{sub}</span>}
    </button>
  );
}

function SortTh({ col, label, sortCol, sortDir, onSort, className = "" }) {
  const active = sortCol === col;
  return (
    <th
      className={`px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap
        ${active ? "text-yd-yellow" : "text-white/80"} hover:text-white ${className}`}
      onClick={() => onSort(col)}>
      {label} {active ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
    </th>
  );
}

function ActionMenu({ inv, onView, onPay, onDelete, onWhatsApp, onPrint }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const items = [
    { label: "View Details",   action: onView },
    { label: "Record Payment", action: onPay,    hide: inv.status === "Paid" || inv.status === "Cancelled" },
    { label: "WhatsApp Share", action: onWhatsApp },
    { label: "Print / PDF",    action: onPrint },
    { label: "Delete Invoice", action: onDelete, danger: true },
  ].filter(i => !i.hide);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-yd-bg text-yd-text-2 hover:text-yd-navy transition-colors font-black text-base">
        &middot;&middot;&middot;
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-2xl border border-yd-border-light py-1 min-w-[160px]">
          {items.map(item => (
            <button
              key={item.label}
              onClick={e => { e.stopPropagation(); setOpen(false); item.action(); }}
              className={`w-full flex items-center px-3 py-2 text-xs font-medium text-left transition-colors
                ${item.danger ? "text-yd-danger hover:bg-yd-danger-soft" : "text-yd-text hover:bg-yd-bg"}`}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function printInvoice(inv, payments = []) {
  const w = window.open("", "_blank");
  const paid = payments.filter(p => p.invoiceNumber === inv.invoiceNumber);
  const INR_P = n => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;
  const timeline = paid.map(p =>
    `<tr><td>${p.paymentDate}</td><td>${INR_P(p.amount)}</td><td>${p.paymentMode}</td><td>${p.transactionId || "–"}</td><td>${p.notes || "–"}</td></tr>`
  ).join("");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${inv.invoiceNumber}</title><style>
    *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:32px}
    .logo{font-size:24px;font-weight:900;color:#F4C400}.header{display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #04114B}
    .inv-title{font-size:20px;font-weight:900;color:#04114B}table{width:100%;border-collapse:collapse;margin:12px 0}
    th{background:#04114B;color:white;padding:8px 10px;text-align:left;font-size:11px}td{padding:7px 10px;border-bottom:1px solid #eee}
    tr:nth-child(even) td{background:#f9f9f9}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}
    .field label{display:block;font-size:10px;color:#888;font-weight:bold;margin-bottom:2px}.field span{font-size:13px;font-weight:600}
    .totals{background:#f8f8f8;border:1px solid #eee;border-radius:8px;padding:12px;margin:16px 0}
    .totals td{padding:4px 8px;border:none}.total-row{font-size:16px;font-weight:900;color:#04114B}
    .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700}
    .paid{background:#d1fae5;color:#065f46}.pending{background:#fef3c7;color:#92400e}
    .partial{background:#e0f2fe;color:#0c4a6e}.overdue{background:#fee2e2;color:#991b1b}
    @media print{button{display:none}}
  </style></head><body>
  <div class="header">
    <div><div class="logo">Yellow Dot</div><div style="font-size:11px;color:#666;margin-top:4px">Premium Preschool CRM</div></div>
    <div style="text-align:right">
      <div class="inv-title">${inv.invoiceNumber}</div>
      <div style="font-size:11px;color:#666;margin-top:4px">Invoice Date: ${inv.invoiceDate}</div>
      <div style="font-size:11px;color:#666">Due Date: ${inv.dueDate || "–"}</div>
      <span class="badge ${(inv.status || "").toLowerCase()}">${inv.status}</span>
    </div>
  </div>
  <div class="grid">
    <div>
      <div class="field"><label>Student Name</label><span>${inv.studentName}</span></div>
      <div class="field" style="margin-top:8px"><label>Class</label><span>${inv.class}</span></div>
      <div class="field" style="margin-top:8px"><label>Student ID</label><span>${inv.studentId}</span></div>
    </div>
    <div>
      <div class="field"><label>Fee Type</label><span>${inv.feeType}</span></div>
      <div class="field" style="margin-top:8px"><label>Billing Cycle</label><span>${inv.billingCycle}</span></div>
      ${inv.durationFrom ? `<div class="field" style="margin-top:8px"><label>Period</label><span>${inv.durationFrom} – ${inv.durationTo}</span></div>` : ""}
    </div>
  </div>
  <table class="totals">
    <tr><td>Amount (Base)</td><td style="text-align:right">${INR_P(inv.amount)}</td></tr>
    <tr><td>GST</td><td style="text-align:right">${INR_P(inv.gst)}</td></tr>
    <tr><td>Discount</td><td style="text-align:right">- ${INR_P(inv.discount)}</td></tr>
    <tr class="total-row"><td>Total Amount</td><td style="text-align:right">${INR_P(inv.totalAmount)}</td></tr>
    <tr><td>Paid Amount</td><td style="text-align:right;color:#065f46">${INR_P(inv.paidAmount)}</td></tr>
    <tr><td>Balance Due</td><td style="text-align:right;color:#991b1b;font-weight:700">${INR_P(inv.balance)}</td></tr>
  </table>
  ${paid.length ? `<div style="margin-top:16px"><strong>Payment History</strong></div><table><thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Transaction ID</th><th>Notes</th></tr></thead><tbody>${timeline}</tbody></table>` : ""}
  ${inv.notes ? `<div style="margin-top:12px;padding:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px"><strong>Notes:</strong> ${inv.notes}</div>` : ""}
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#888;text-align:center">This is a computer generated invoice. No signature required.</div>
  <button onclick="window.print()" style="margin-top:16px;padding:8px 20px;background:#04114B;color:white;border:none;border-radius:6px;cursor:pointer">Print / Save PDF</button>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

function whatsappShare(inv) {
  const phone = (inv.fatherWhatsApp || inv.motherWhatsApp || "").replace(/\D/g, "");
  if (!phone || phone.length < 10) return null;
  const dialCode = phone.startsWith("91") ? phone : `91${phone}`;
  const msg =
    `*Yellow Dot Preschool – Invoice*\n\nInvoice: *${inv.invoiceNumber}*\nStudent: ${inv.studentName} (${inv.class})\n` +
    `Fee Type: ${inv.feeType}\nInvoice Date: ${inv.invoiceDate}\nDue Date: ${inv.dueDate || "–"}\n\n` +
    `Total Amount: *${INR(inv.totalAmount)}*\nPaid Amount: ${INR(inv.paidAmount)}\nBalance Due: *${INR(inv.balance)}*\n` +
    `Status: ${inv.status}\n\nPlease contact us for payment. Thank you!`;
  return `https://wa.me/${dialCode}?text=${encodeURIComponent(msg)}`;
}

// -- Drawer wrapper --
function Drawer({ open, onClose, title, subtitle, children, width = "max-w-[540px]", footer }) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", h); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative ml-auto h-full ${width} w-full bg-white shadow-2xl flex flex-col invoice-drawer`}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-yd-border flex-shrink-0">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-[15px] font-black text-yd-navy leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-yd-text-3 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-yd-bg flex items-center justify-center text-yd-text-2 hover:bg-yd-border hover:text-yd-navy transition-colors text-sm font-bold">
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-yd-border bg-yd-bg flex items-center gap-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

const inputCls = (err) => `yd-input text-sm${err ? " border-yd-danger bg-yd-danger-soft" : ""}`;

function Field({ label, error, children, span2 }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className="yd-text-label block mb-1">{label}</label>
      {children}
      {error && <p className="text-[10px] text-yd-danger mt-0.5">{error}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// VIEW INVOICE DRAWER
// ══════════════════════════════════════════════════════════════════
function ViewInvoiceDrawer({ open, inv, allPayments, onClose, onPay }) {
  if (!inv) return null;
  const payments = allPayments.filter(p => p.invoiceNumber === inv.invoiceNumber);
  const days = overdueDays(inv.dueDate);
  const pct  = inv.totalAmount > 0 ? Math.min(100, (inv.paidAmount / inv.totalAmount) * 100) : 0;

  const footer = inv.status !== "Paid" && inv.status !== "Cancelled" ? (
    <button onClick={onPay} className="btn btn-dark flex-1">+ Record Payment</button>
  ) : null;

  return (
    <Drawer open={open} onClose={onClose}
      title={`Invoice – ${inv.invoiceNumber}`}
      subtitle={`${inv.studentName} · ${inv.class}`}
      width="max-w-[520px]"
      footer={footer}>
      <div className="px-6 py-5 space-y-4">

        {/* Status banner */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border font-bold
          ${inv.status === "Paid"    ? "bg-yd-success-soft text-yd-success border-yd-success-border"
          : inv.status === "Overdue" ? "bg-yd-danger-soft text-yd-danger border-yd-danger-border"
          : inv.status === "Partial" ? "bg-yd-info-soft text-yd-info border-yd-info-border"
          : "bg-yd-warn-soft text-yd-warn border-yd-warn-border"}`}>
          <StatusBadge status={inv.status} />
          <span className="text-xs">
            {inv.status === "Overdue" && days > 0 ? `Overdue by ${days} day${days > 1 ? "s" : ""}`
            : inv.status === "Paid"    ? "Full payment received"
            : inv.status === "Partial" ? `${INR(inv.balance)} remaining`
            : inv.dueDate ? `Due on ${inv.dueDate}` : "Payment pending"}
          </span>
        </div>

        {/* Progress */}
        {inv.totalAmount > 0 && (
          <div className="bg-yd-navy rounded-xl p-4">
            <div className="flex justify-between text-xs mb-3">
              <span className="text-white/60 font-semibold">Paid</span>
              <span className="font-black text-green-300">{INR(inv.paidAmount)}</span>
            </div>
            <div className="bg-white/10 rounded-full h-2 overflow-hidden mb-3">
              <div className="h-full bg-yd-yellow rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/60 font-semibold">Balance Due</span>
              <span className="font-black text-white text-base">{INR(inv.balance)}</span>
            </div>
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-yd-bg rounded-xl p-3">
            <div className="yd-text-label mb-2">Student</div>
            <div className="text-sm font-black text-yd-navy">{inv.studentName}</div>
            <div className="text-xs text-yd-text-3">{inv.class} &middot; {inv.studentId}</div>
          </div>
          <div className="bg-yd-bg rounded-xl p-3">
            <div className="yd-text-label mb-2">Fee Details</div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between"><span className="text-yd-text-3">Type</span><span className="font-semibold">{inv.feeType}</span></div>
              <div className="flex justify-between"><span className="text-yd-text-3">Cycle</span><span className="font-semibold">{inv.billingCycle || "–"}</span></div>
              <div className="flex justify-between"><span className="text-yd-text-3">Inv Date</span><span className="font-semibold">{inv.invoiceDate}</span></div>
              <div className="flex justify-between"><span className="text-yd-text-3">Due Date</span><span className="font-semibold">{inv.dueDate || "–"}</span></div>
            </div>
          </div>
        </div>

        {/* Amount breakdown */}
        <div className="bg-yd-bg rounded-xl p-3">
          <div className="yd-text-label mb-2">Amount Breakdown</div>
          <div className="text-xs space-y-1.5">
            <div className="flex justify-between"><span className="text-yd-text-3">Base Amount</span><span className="font-semibold">{INR(inv.amount)}</span></div>
            <div className="flex justify-between"><span className="text-yd-text-3">GST</span><span className="font-semibold">{INR(inv.gst)}</span></div>
            <div className="flex justify-between"><span className="text-yd-text-3">Discount</span><span className="font-semibold text-yd-success">- {INR(inv.discount)}</span></div>
            <div className="border-t border-yd-border pt-1.5 flex justify-between font-black text-yd-navy">
              <span>Total</span><span>{INR(inv.totalAmount)}</span>
            </div>
          </div>
        </div>

        {inv.notes && (
          <div className="bg-yd-warn-soft border border-yd-warn-border rounded-xl p-3">
            <div className="yd-text-label text-yd-warn mb-1">Notes</div>
            <div className="text-xs text-yd-text">{inv.notes}</div>
          </div>
        )}

        {/* Payment history */}
        <div>
          <div className="yd-text-label mb-2">Payment History</div>
          {payments.length === 0 ? (
            <div className="text-xs text-yd-text-3 italic text-center py-4 bg-yd-bg rounded-xl">No payments recorded yet.</div>
          ) : (
            <div className="space-y-2">
              {payments.map((p, i) => (
                <div key={p.paymentId || i} className="flex items-start gap-3 bg-yd-bg rounded-xl px-3 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-yd-success-soft flex items-center justify-center text-[10px] font-black text-yd-success flex-shrink-0">
                    ₹
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-yd-success">{INR(p.amount)}</span>
                      <span className="text-[10px] text-yd-text-3">via {p.paymentMode}</span>
                      {p.transactionId && <span className="text-[10px] text-yd-text-3 font-mono">#{p.transactionId}</span>}
                      <span className="text-[10px] text-yd-text-3 ml-auto">{p.paymentDate}</span>
                    </div>
                    {p.notes     && <div className="text-[10px] text-yd-text-3 mt-0.5">{p.notes}</div>}
                    {p.staffName && <div className="text-[10px] text-yd-text-3">By: {p.staffName}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════════════
// RECORD PAYMENT DRAWER
// ══════════════════════════════════════════════════════════════════
// State is reset via key prop in parent — no effect needed.
function RecordPaymentDrawer({ open, inv, onSave, onClose }) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(() => ({
    amount:        inv ? String(inv.balance || inv.totalAmount || "") : "",
    paymentMode:   "Cash",
    transactionId: "",
    paymentDate:   todayISO(),
    notes:         "",
    staffName:     "Staff",
  }));

  if (!inv) return null;
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: "" })); };

  function validate() {
    const e = {};
    if (!form.amount || Number(form.amount) <= 0)  e.amount = "Enter valid amount.";
    if (Number(form.amount) > inv.balance + 0.01)  e.amount = `Max payable is ${INR(inv.balance)}.`;
    if (!form.paymentDate)                         e.paymentDate = "Required.";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({ invoiceNumber: inv.invoiceNumber, studentId: inv.studentId, studentName: inv.studentName,
        amount: Number(form.amount), paymentMode: form.paymentMode, transactionId: form.transactionId,
        paymentDate: form.paymentDate, notes: form.notes, staffName: form.staffName });
      onClose();
    } finally { setSaving(false); }
  }

  const pcts = [25, 50, 75, 100];

  const footer = (
    <>
      <button onClick={onClose} className="btn btn-ghost flex-shrink-0">Cancel</button>
      <button onClick={handleSubmit} disabled={saving} className="btn btn-success flex-1">
        {saving ? "Saving..." : "Record Payment"}
      </button>
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Record Payment" subtitle={`${inv.studentName} – ${inv.invoiceNumber}`} width="max-w-[460px]" footer={footer}>
      <div className="px-6 py-5 space-y-4">
        <div className="bg-yd-navy rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-white/60">Invoice</div>
            <div className="text-xs font-bold text-white">{inv.invoiceNumber}</div>
          </div>
          <div className="text-right">
            <div className="yd-text-label text-white/40 mb-0.5">Balance Due</div>
            <div className="text-2xl font-black text-white">{INR(inv.balance)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Payment Amount (₹) *" error={errors.amount} span2>
            <input type="number" min="0" max={inv.balance} value={form.amount}
              onChange={e => set("amount", e.target.value)}
              className={`${inputCls(errors.amount)} text-base font-bold`} />
            <div className="flex gap-2 mt-2">
              {pcts.map(p => (
                <button key={p} type="button"
                  onClick={() => set("amount", String(Math.round(inv.balance * p / 100)))}
                  className="flex-1 py-1 text-[10px] font-bold rounded-lg bg-yd-yellow-soft text-yd-navy hover:bg-yd-yellow transition-colors">
                  {p}%
                </button>
              ))}
            </div>
          </Field>
          <Field label="Payment Mode">
            <select value={form.paymentMode} onChange={e => set("paymentMode", e.target.value)} className={inputCls()}>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Transaction ID">
            <input type="text" value={form.transactionId} onChange={e => set("transactionId", e.target.value)} className={inputCls()} placeholder="UTR / Ref No." />
          </Field>
          <Field label="Payment Date *" error={errors.paymentDate}>
            <input type="date" value={form.paymentDate} onChange={e => set("paymentDate", e.target.value)} className={inputCls(errors.paymentDate)} />
          </Field>
          <Field label="Staff Name">
            <input type="text" value={form.staffName} onChange={e => set("staffName", e.target.value)} className={inputCls()} />
          </Field>
          <Field label="Notes" span2>
            <textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} className={`${inputCls()} resize-none`} placeholder="Optional notes..." />
          </Field>
        </div>

        {Number(form.amount) > 0 && Number(form.amount) < inv.balance && (
          <div className="bg-yd-info-soft border border-yd-info-border rounded-xl px-3 py-2 text-xs text-yd-info">
            After this payment, balance will be <strong>{INR(inv.balance - Number(form.amount))}</strong> &rarr; status: Partial
          </div>
        )}
      </div>
    </Drawer>
  );
}

// -- Delete Confirm Modal --
function ConfirmModal({ msg, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="w-12 h-12 rounded-2xl bg-yd-danger-soft flex items-center justify-center mx-auto mb-3 border border-yd-danger-border">
          <span className="text-yd-danger font-black text-xl">!</span>
        </div>
        <h3 className="text-sm font-black text-yd-navy text-center mb-2">Delete Invoice?</h3>
        <p className="text-xs text-yd-text-2 text-center mb-4">{msg}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="btn btn-danger flex-1">
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// EMPTY STATE COMPONENTS
// ══════════════════════════════════════════════════════════════════

/** SVG invoice illustration — stacked papers, navy header, yellow ₹ badge. */
function InvoiceIllustration() {
  return (
    <svg width="220" height="168" viewBox="0 0 220 168" fill="none" aria-hidden="true"
      style={{ display: "block" }}>
      <defs>
        <pattern id="inv-dot-grid" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.3" fill="#EDE8DA" />
        </pattern>
      </defs>

      {/* Warm dot-grid fills the illustration area — prevents blank space */}
      <rect width="220" height="168" rx="16" fill="url(#inv-dot-grid)" />

      {/* Second document — slightly rotated behind main one */}
      <g transform="rotate(-6, 100, 75)">
        <rect x="36" y="14" width="140" height="120" rx="10"
          fill="#FFF8E1" stroke="#EADDB0" strokeWidth="1.2" />
      </g>

      {/* Main document — drop shadow */}
      <rect x="32" y="20" width="144" height="122" rx="10"
        fill="rgba(4,17,75,0.06)" />

      {/* Main document — body */}
      <rect x="28" y="16" width="144" height="122" rx="10"
        fill="white" stroke="#EDE8DA" strokeWidth="1.5" />

      {/* Navy header */}
      <rect x="28" y="16" width="144" height="28" rx="10" fill="#04114B" />
      <rect x="28" y="34" width="144" height="10"            fill="#04114B" />

      {/* Header — "INVOICE" label bar */}
      <rect x="38" y="24" width="38" height="5.5" rx="2.75"
        fill="rgba(255,255,255,0.85)" />
      {/* Header — date chip */}
      <rect x="112" y="21" width="50" height="13" rx="6.5"
        fill="rgba(244,196,0,0.18)" />
      <rect x="116" y="25" width="42" height="5" rx="2.5"
        fill="rgba(244,196,0,0.65)" />

      {/* Status badge — PAID */}
      <rect x="128" y="54" width="36" height="11" rx="5.5" fill="#D1FAE5" />
      <rect x="134" y="57.5" width="24" height="4" rx="2" fill="#16A34A" opacity="0.75" />

      {/* Invoice rows — varying widths for realism */}
      <rect x="38" y="66" width="74" height="5" rx="2.5" fill="#EDE8DA" />
      <rect x="155" y="66" width="10" height="5" rx="2.5" fill="#EDE8DA" />
      <rect x="38" y="78" width="56" height="5" rx="2.5" fill="#EDE8DA" />
      <rect x="155" y="78" width="10" height="5" rx="2.5" fill="#EDE8DA" />
      <rect x="38" y="90" width="66" height="5" rx="2.5" fill="#EDE8DA" />
      <rect x="155" y="90" width="10" height="5" rx="2.5" fill="#EDE8DA" />

      {/* Divider */}
      <rect x="38" y="104" width="128" height="1" fill="#EDE8DA" />

      {/* Total row */}
      <rect x="38" y="112" width="32" height="5" rx="2.5" fill="#EDE8DA" />
      <rect x="133" y="110" width="30" height="9" rx="4.5" fill="#04114B" />

      {/* Yellow ₹ badge — overlaps bottom-right corner of the document */}
      <circle cx="156" cy="122" r="27" fill="#F4C400" />
      <circle cx="156" cy="122" r="27" stroke="white" strokeWidth="4" />
      <text x="156" y="130" textAnchor="middle" fontSize="24" fontWeight="900"
        fontFamily="'Plus Jakarta Sans',system-ui,-apple-system,sans-serif"
        fill="#04114B">₹</text>
    </svg>
  );
}

/** True empty state — zero invoices in the system. */
function EmptyInvoices({ onNew, onTemplates }) {
  const card = {
    display: "flex", flexDirection: "column", alignItems: "center",
    background: "white", border: "1px solid #F0EBD8", borderRadius: 20,
    padding: "40px 48px 36px", maxWidth: 520, width: "100%",
    boxShadow: "0 4px 24px rgba(244,196,0,0.09), 0 1px 4px rgba(0,0,0,0.05)",
    marginBottom: 14,
  };
  const stepNum = (n, accent) => ({
    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
    background: accent ? "#F4C400" : "#04114B",
    color: accent ? "#04114B" : "white",
    fontWeight: 900, fontSize: 13,
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 10px",
  });

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "36px 20px 40px", minHeight: "100%", boxSizing: "border-box",
    }}>

      {/* ── Illustration + headline + CTAs ─────────────────────── */}
      <div style={card}>
        <InvoiceIllustration />

        <h2 style={{
          fontSize: 20, fontWeight: 900, color: "#04114B",
          letterSpacing: "-0.45px", margin: "22px 0 10px",
          textAlign: "center", lineHeight: 1.15,
        }}>
          Start tracking fees &amp; payments
        </h2>

        <p style={{
          fontSize: 13, color: "#6B7280", textAlign: "center",
          maxWidth: 340, lineHeight: 1.6, margin: "0 0 26px",
        }}>
          Create your first invoice to monitor outstanding balances, record payments, and send reminders to parents.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={onNew} className="btn btn-primary" style={{ minWidth: 148 }}>
            + New Invoice
          </button>
          <button onClick={onTemplates} className="btn btn-ghost" style={{ minWidth: 148 }}>
            Fee Templates
          </button>
        </div>
      </div>

      {/* ── How it works strip ─────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 24px 1fr 24px 1fr",
        alignItems: "start", gap: 0,
        maxWidth: 520, width: "100%",
        background: "white", border: "1px solid #F0EBD8",
        borderRadius: 16, padding: "20px 28px 22px",
      }}>

        {/* Step 1 */}
        <div style={{ textAlign: "center" }}>
          <div style={stepNum(1, false)}>1</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#04114B", marginBottom: 3, lineHeight: 1.3 }}>
            Set up templates
          </div>
          <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.5 }}>
            Define fee types &amp; billing cycles once
          </div>
        </div>

        {/* Arrow */}
        <div style={{ textAlign: "center", paddingTop: 7, color: "#C8C0A8", fontSize: 15, userSelect: "none" }}>
          →
        </div>

        {/* Step 2 */}
        <div style={{ textAlign: "center" }}>
          <div style={stepNum(2, true)}>2</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#04114B", marginBottom: 3, lineHeight: 1.3 }}>
            Create invoices
          </div>
          <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.5 }}>
            Generate per-student invoices in seconds
          </div>
        </div>

        {/* Arrow */}
        <div style={{ textAlign: "center", paddingTop: 7, color: "#C8C0A8", fontSize: 15, userSelect: "none" }}>
          →
        </div>

        {/* Step 3 */}
        <div style={{ textAlign: "center" }}>
          <div style={stepNum(3, false)}>3</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#04114B", marginBottom: 3, lineHeight: 1.3 }}>
            Track &amp; collect
          </div>
          <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.5 }}>
            Record payments, watch balances clear
          </div>
        </div>

      </div>
    </div>
  );
}

/** Filter-no-results state — invoices exist but none match current filters. */
function NoResults({ search, onClear }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "60px 20px",
    }}>

      {/* Icon container */}
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: "white", border: "1.5px solid #F0EBD8",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20,
        boxShadow: "0 2px 12px rgba(4,17,75,0.06)",
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
          stroke="#04114B" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      <div style={{ fontSize: 15, fontWeight: 800, color: "#04114B", marginBottom: 7, letterSpacing: "-0.2px" }}>
        No matching invoices
      </div>

      <div style={{
        fontSize: 12.5, color: "#6B7280", maxWidth: 290,
        textAlign: "center", lineHeight: 1.6, marginBottom: 22,
      }}>
        {search
          ? <>Nothing found for{" "}
              <strong style={{ color: "#04114B", fontWeight: 700 }}>"{search}"</strong>
              {" "}— try a different name or invoice number.
            </>
          : "No invoices match your current filters. Try adjusting or clearing them."
        }
      </div>

      <button onClick={onClear} className="btn btn-ghost btn-sm">
        Clear all filters
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SKELETON LOADING COMPONENTS
// ══════════════════════════════════════════════════════════════════

/** Single shimmering stat card — mirrors StatCard dimensions exactly. */
function SkeletonStatCard({ delay = 0 }) {
  const s = { animationDelay: `${delay * 110}ms` };
  return (
    <div className="flex flex-col items-start px-4 py-3 rounded-xl border border-yd-border-light bg-white">
      <div className="yd-skeleton h-2 w-14 mb-2.5" style={s} />
      <div className="yd-skeleton h-6 w-8  mb-1.5" style={s} />
      <div className="yd-skeleton h-2 w-20"         style={s} />
    </div>
  );
}

/** Shimmering collected / outstanding summary card (col-span-2). */
function SkeletonSummaryCard() {
  return (
    <div className="col-span-2 flex items-center bg-white rounded-xl border border-yd-border-light px-4 py-3 gap-3">
      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="yd-skeleton h-2 w-16" style={{ animationDelay: "480ms" }} />
        <div className="yd-skeleton h-5 w-24" style={{ animationDelay: "480ms" }} />
      </div>
      <div className="w-px h-8 bg-yd-border-light" />
      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="yd-skeleton h-2 w-20" style={{ animationDelay: "540ms" }} />
        <div className="yd-skeleton h-5 w-24" style={{ animationDelay: "540ms" }} />
      </div>
    </div>
  );
}

// Column widths vary per-row so the skeleton reads as real data, not a grid.
const SK_STUDENT_W  = [28, 32, 24, 30, 28, 24, 32, 26];
const SK_FEETYPE_W  = [24, 20, 28, 22, 24, 28, 20, 26];

/** One shimmering table row — matches the 11-column invoice table exactly. */
function SkeletonRow({ idx }) {
  const d  = `${idx * 55}ms`;
  const s  = (w) => ({ animationDelay: d, width: w });
  const bg = idx % 2 === 0 ? "bg-white" : "bg-yd-bg";
  const sw = SK_STUDENT_W[idx % 8] * 4;   // px
  const fw = SK_FEETYPE_W[idx % 8] * 4;   // px

  return (
    <tr className={bg}>
      {/* Invoice No */}
      <td className="px-4 py-[11px] border-b border-yd-border-light">
        <div className="yd-skeleton h-[11px] mb-1.5" style={s(80)} />
        <div className="yd-skeleton h-[8px]"          style={s(52)} />
      </td>
      {/* Student */}
      <td className="px-3 py-[11px] border-b border-yd-border-light">
        <div className="yd-skeleton h-[11px] mb-1.5" style={s(sw)} />
        <div className="yd-skeleton h-[8px]"          style={s(56)} />
      </td>
      {/* Class badge */}
      <td className="px-3 py-[11px] border-b border-yd-border-light">
        <div className="yd-skeleton h-[20px]" style={{ ...s(60), borderRadius: 9999 }} />
      </td>
      {/* Fee Type */}
      <td className="px-3 py-[11px] border-b border-yd-border-light">
        <div className="yd-skeleton h-[11px]" style={s(fw)} />
      </td>
      {/* Inv Date */}
      <td className="px-3 py-[11px] border-b border-yd-border-light">
        <div className="yd-skeleton h-[11px]" style={s(64)} />
      </td>
      {/* Due Date */}
      <td className="px-3 py-[11px] border-b border-yd-border-light">
        <div className="yd-skeleton h-[11px]" style={s(64)} />
      </td>
      {/* Total (right) */}
      <td className="px-3 py-[11px] border-b border-yd-border-light">
        <div className="yd-skeleton h-[11px] ml-auto" style={s(52)} />
      </td>
      {/* Paid (right) */}
      <td className="px-3 py-[11px] border-b border-yd-border-light">
        <div className="yd-skeleton h-[11px] ml-auto" style={s(44)} />
      </td>
      {/* Balance (right) */}
      <td className="px-3 py-[11px] border-b border-yd-border-light">
        <div className="yd-skeleton h-[11px] ml-auto" style={s(52)} />
      </td>
      {/* Status badge */}
      <td className="px-3 py-[11px] border-b border-yd-border-light">
        <div className="yd-skeleton h-[20px]" style={{ ...s(52), borderRadius: 9999 }} />
      </td>
      {/* Actions */}
      <td className="px-3 py-[11px] border-b border-yd-border-light text-right">
        <div className="yd-skeleton h-[26px] ml-auto" style={{ ...s(26), borderRadius: 8 }} />
      </td>
    </tr>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN INVOICES PAGE
// ══════════════════════════════════════════════════════════════════
export default function Invoices() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadErr,  setLoadErr]  = useState(false);

  const [statusFilter, setStatusFilter] = useState("All");
  const [classFilter,  setClassFilter]  = useState("");
  const [feeFilter,    setFeeFilter]    = useState("");
  const [monthFilter,  setMonthFilter]  = useState("");
  const [search,       setSearch]       = useState("");
  const [sortCol,      setSortCol]      = useState("createdAt");
  const [sortDir,      setSortDir]      = useState("desc");

  const [viewInv,   setViewInv]   = useState(null);
  const [payInv,    setPayInv]    = useState(null);
  const [payKey,    setPayKey]    = useState(0);     // bumped to remount RecordPaymentDrawer
  const [deleteInv, setDeleteInv] = useState(null);
  const [deleting,  setDeleting]  = useState(false);

  const mountedRef = useRef(true);
  // Reset to true on every (re)mount.
  // Without this, React StrictMode's cleanup sets current=false, then the
  // Promise.resolve().then(loadData) microtask fires *after* cleanup with
  // current=false — so setLoading(false) is skipped and loading never ends.
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadErr(false);
    try {
      const [invRes, payRes] = await Promise.allSettled([
        get("/api/invoices"),
        get("/api/payments"),
      ]);
      if (!mountedRef.current) return;

      if (invRes.status === "fulfilled" && invRes.value?.success) {
        setInvoices(invRes.value.invoices || []);
      } else {
        setLoadErr(true);
        const msg = invRes.reason?.message
          || invRes.value?.error
          || "Failed to load invoices.";
        toast.error(msg);
      }

      if (payRes.status === "fulfilled" && payRes.value?.success) {
        setPayments(payRes.value.payments || []);
      }
      // Payment errors are non-fatal — invoices still render without them.

    } catch (e) {
      if (mountedRef.current) {
        setLoadErr(true);
        toast.error(e.message || "Failed to load data.");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [toast.error]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mount-time fetch — microtask keeps setState out of the synchronous effect body.
  useEffect(() => { Promise.resolve().then(loadData); }, [loadData]);

  const stats = useMemo(() => {
    const total       = invoices.length;
    const paid        = invoices.filter(i => i.status === "Paid").length;
    const pending     = invoices.filter(i => i.status === "Pending").length;
    const partial     = invoices.filter(i => i.status === "Partial").length;
    const overdue     = invoices.filter(i => i.status === "Overdue").length;
    const collected   = sumAmounts(invoices, "paidAmount");
    const outstanding = sumAmounts(invoices, "balance");
    return { total, paid, pending, partial, overdue, collected, outstanding };
  }, [invoices]);

  const feeTypes = useMemo(() =>
    [...new Set(invoices.map(i => i.feeType).filter(Boolean))].sort(), [invoices]);

  const months = useMemo(() => {
    const ms = new Set();
    invoices.forEach(i => { if (i.invoiceDate) ms.add(i.invoiceDate.slice(0, 7)); });
    return [...ms].sort().reverse();
  }, [invoices]);

  const filtered = useMemo(() => {
    let list = [...invoices];
    if (statusFilter !== "All") list = list.filter(i => i.status === statusFilter);
    if (classFilter)            list = list.filter(i => i.class === classFilter);
    if (feeFilter)              list = list.filter(i => i.feeType === feeFilter);
    if (monthFilter)            list = list.filter(i => (i.invoiceDate || "").startsWith(monthFilter));
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(i =>
        i.studentName?.toLowerCase().includes(q) ||
        i.invoiceNumber?.toLowerCase().includes(q) ||
        i.studentId?.toLowerCase().includes(q) ||
        i.feeType?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (["totalAmount","paidAmount","balance","amount"].includes(sortCol)) { va = Number(va)||0; vb = Number(vb)||0; }
      else { va = String(va||""); vb = String(vb||""); }
      return va < vb ? (sortDir === "asc" ? -1 : 1) : va > vb ? (sortDir === "asc" ? 1 : -1) : 0;
    });
    return list;
  }, [invoices, statusFilter, classFilter, feeFilter, monthFilter, search, sortCol, sortDir]);

  function handleSort(col) {
    setSortCol(c => { setSortDir(d => c === col ? (d === "asc" ? "desc" : "asc") : "desc"); return col; });
  }

  async function handleRecordPayment(data) {
    const res = await post("/api/payments", data);
    if (!res.success) throw new Error(res.error || "Failed to record payment.");
    if (res.invoice) setInvoices(prev => prev.map(i => i.invoiceNumber === res.invoice.invoiceNumber ? { ...i, ...res.invoice } : i));
    if (res.payment) setPayments(prev => [res.payment, ...prev]);
    if (viewInv && viewInv.invoiceNumber === data.invoiceNumber && res.invoice) setViewInv(v => ({ ...v, ...res.invoice }));
    toast.success("Payment recorded.");
  }

  async function handleDelete() {
    if (!deleteInv) return;
    setDeleting(true);
    try {
      const res = await del(`/api/invoices/${deleteInv.invoiceNumber}`);
      if (!res.success) throw new Error(res.error || "Delete failed.");
      setInvoices(prev => prev.filter(i => i.invoiceNumber !== deleteInv.invoiceNumber));
      toast.success("Invoice deleted.");
      setDeleteInv(null);
    } catch (e) { toast.error(e.message); }
    finally { setDeleting(false); }
  }

  function handleWhatsApp(inv) {
    const url = whatsappShare(inv);
    if (!url) { toast.error("No WhatsApp number for this student."); return; }
    window.open(url, "_blank");
  }

  function handlePayFlow(inv) { setViewInv(null); setTimeout(() => { setPayKey(k => k + 1); setPayInv(inv); }, 80); }

  return (
    <div className="flex h-screen overflow-hidden bg-yd-bg">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Page header */}
        <div className="flex-shrink-0 bg-white border-b border-yd-border-light px-5 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yd-yellow-soft border border-yd-yellow flex items-center justify-center">
              <span className="text-yd-navy font-black text-[10px]">INV</span>
            </div>
            <div>
              <h1 className="text-[15px] font-black text-yd-navy leading-none">Invoices</h1>
              {loading ? (
                <div className="yd-skeleton h-[10px] w-48 mt-1.5" />
              ) : (
                <p className="text-[10px] text-yd-text-3 mt-0.5">
                  {invoices.length} invoices &middot; {INR(stats.collected)} collected &middot; {INR(stats.outstanding)} outstanding
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} title="Refresh"
              className="w-8 h-8 rounded-lg bg-yd-bg border border-yd-border flex items-center justify-center text-yd-text-2 hover:text-yd-navy hover:border-yd-navy transition-colors text-sm">
              ↺
            </button>
            <button onClick={() => navigate("/invoice/templates")} className="btn btn-ghost btn-sm">
              Fee Templates
            </button>
            <button onClick={() => navigate("/invoice/new")} className="btn btn-primary btn-sm">
              + New Invoice
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="flex-shrink-0 px-4 pt-3 pb-1 grid grid-cols-7 gap-2">
          {loading ? (
            <>
              <SkeletonStatCard delay={0} />
              <SkeletonStatCard delay={1} />
              <SkeletonStatCard delay={2} />
              <SkeletonStatCard delay={3} />
              <SkeletonStatCard delay={4} />
              <SkeletonSummaryCard />
            </>
          ) : (
            <>
              <StatCard label="Total"   value={stats.total}   sub={INR(stats.collected + stats.outstanding)} active={statusFilter === "All"}     onClick={() => setStatusFilter("All")} />
              <StatCard label="Paid"    value={stats.paid}    sub={INR(sumAmounts(invoices.filter(i=>i.status==="Paid"),    "totalAmount"))} active={statusFilter === "Paid"}    onClick={() => setStatusFilter("Paid")} />
              <StatCard label="Pending" value={stats.pending} sub={INR(sumAmounts(invoices.filter(i=>i.status==="Pending"), "balance"))}     active={statusFilter === "Pending"} onClick={() => setStatusFilter("Pending")} />
              <StatCard label="Partial" value={stats.partial} sub={INR(sumAmounts(invoices.filter(i=>i.status==="Partial"), "balance"))}     active={statusFilter === "Partial"} onClick={() => setStatusFilter("Partial")} />
              <StatCard label="Overdue" value={stats.overdue} sub={INR(sumAmounts(invoices.filter(i=>i.status==="Overdue"), "balance"))}     active={statusFilter === "Overdue"} onClick={() => setStatusFilter("Overdue")} />
              <div className="col-span-2 flex items-center bg-white rounded-xl border border-yd-border-light px-4 py-3 gap-3">
                <div className="flex-1 text-center">
                  <div className="yd-text-label mb-0.5">Collected</div>
                  <div className="text-base font-black text-yd-success">{INR(stats.collected)}</div>
                </div>
                <div className="w-px h-8 bg-yd-border-light" />
                <div className="flex-1 text-center">
                  <div className="yd-text-label mb-0.5">Outstanding</div>
                  <div className="text-base font-black text-yd-danger">{INR(stats.outstanding)}</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Filters */}
        <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 flex-wrap">
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
            className="border border-yd-border rounded-lg px-2.5 py-1.5 text-xs text-yd-text bg-white focus:outline-none focus:border-yd-navy transition-colors">
            <option value="">All Classes</option>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={feeFilter} onChange={e => setFeeFilter(e.target.value)}
            className="border border-yd-border rounded-lg px-2.5 py-1.5 text-xs text-yd-text bg-white focus:outline-none focus:border-yd-navy transition-colors">
            <option value="">All Fee Types</option>
            {feeTypes.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            className="border border-yd-border rounded-lg px-2.5 py-1.5 text-xs text-yd-text bg-white focus:outline-none focus:border-yd-navy transition-colors">
            <option value="">All Months</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 border border-yd-border rounded-lg px-2.5 py-1.5 bg-white focus-within:border-yd-navy transition-colors min-w-[220px]">
            <span className="text-yd-text-3 text-xs">&#128269;</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search student, invoice no..."
              className="flex-1 text-xs bg-transparent outline-none text-yd-text placeholder-yd-text-3" />
            {search && <button onClick={() => setSearch("")} className="text-yd-text-3 hover:text-yd-navy text-xs">&times;</button>}
          </div>
          {loading
            ? <div className="yd-skeleton h-[10px] w-10" style={{ animationDelay: "200ms" }} />
            : <span className="text-[10px] text-yd-text-3 font-semibold whitespace-nowrap">{filtered.length} / {invoices.length}</span>
          }
        </div>

        {/* Table area */}
        <div className="flex-1 overflow-auto px-4 pb-4">
          {loading ? (
            <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-yd-navy">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-white/80 rounded-tl-xl whitespace-nowrap">Invoice No</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-white/80 whitespace-nowrap">Student</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-white/80 whitespace-nowrap">Class</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-white/80 whitespace-nowrap">Fee Type</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-white/80 whitespace-nowrap">Inv Date</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-white/80 whitespace-nowrap">Due Date</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-white/80 whitespace-nowrap">Total</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-white/80 whitespace-nowrap">Paid</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-white/80 whitespace-nowrap">Balance</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-white/80 whitespace-nowrap">Status</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-white/80 rounded-tr-xl whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 9 }).map((_, i) => (
                  <SkeletonRow key={i} idx={i} />
                ))}
              </tbody>
            </table>
          ) : loadErr ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <div className="text-sm font-bold text-yd-danger mb-2">Could not load invoices</div>
              <div className="text-xs text-yd-text-3 mb-3">Check that the backend server is running on port 5000.</div>
              <button onClick={loadData} className="btn btn-dark btn-sm">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            invoices.length === 0
              ? <EmptyInvoices
                  onNew={() => navigate("/invoice/new")}
                  onTemplates={() => navigate("/invoice/templates")}
                />
              : <NoResults
                  search={search}
                  onClear={() => {
                    setSearch(""); setStatusFilter("All");
                    setClassFilter(""); setFeeFilter(""); setMonthFilter("");
                  }}
                />
          ) : (
            <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-yd-navy">
                  <SortTh col="invoiceNumber" label="Invoice No"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="rounded-tl-xl pl-4" />
                  <SortTh col="studentName"   label="Student"     sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="class"         label="Class"       sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="feeType"       label="Fee Type"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="invoiceDate"   label="Inv Date"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="dueDate"       label="Due Date"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="totalAmount"   label="Total"       sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right pr-3" />
                  <SortTh col="paidAmount"    label="Paid"        sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right pr-3" />
                  <SortTh col="balance"       label="Balance"     sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right pr-3" />
                  <SortTh col="status"        label="Status"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-white/80 rounded-tr-xl">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, idx) => (
                  <tr key={inv.invoiceNumber}
                    onClick={() => setViewInv(inv)}
                    className={`cursor-pointer transition-colors hover:bg-yd-yellow-pale ${idx % 2 === 0 ? "bg-white" : "bg-yd-bg"}`}>
                    <td className="px-4 py-2.5 border-b border-yd-border-light">
                      <div className="font-mono font-bold text-yd-navy text-[11px]">{inv.invoiceNumber}</div>
                      <div className="text-[9px] text-yd-text-3">{inv.invoiceId}</div>
                    </td>
                    <td className="px-3 py-2.5 border-b border-yd-border-light">
                      <div className="font-semibold text-yd-text truncate max-w-[130px]">{inv.studentName}</div>
                      <div className="text-[9px] text-yd-text-3">{inv.studentId}</div>
                    </td>
                    <td className="px-3 py-2.5 border-b border-yd-border-light">
                      <span className="badge badge-yellow">{inv.class || "–"}</span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-yd-border-light text-yd-text-2 truncate max-w-[110px]">{inv.feeType || "–"}</td>
                    <td className="px-3 py-2.5 border-b border-yd-border-light text-yd-text-2">{inv.invoiceDate || "–"}</td>
                    <td className="px-3 py-2.5 border-b border-yd-border-light">
                      <span className={overdueDays(inv.dueDate) > 0 && inv.status !== "Paid" && inv.status !== "Cancelled" ? "text-yd-danger font-semibold" : "text-yd-text-2"}>
                        {inv.dueDate || "–"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-yd-border-light text-right font-bold text-yd-text">{INR(inv.totalAmount)}</td>
                    <td className="px-3 py-2.5 border-b border-yd-border-light text-right font-semibold text-yd-success">{INR(inv.paidAmount)}</td>
                    <td className="px-3 py-2.5 border-b border-yd-border-light text-right font-bold">
                      <span className={inv.balance > 0 ? "text-yd-danger" : "text-yd-success"}>{INR(inv.balance)}</span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-yd-border-light">
                      <div className="flex items-center gap-1">
                        <StatusBadge status={inv.status} />
                        <OverdueBadge dueDate={inv.dueDate} status={inv.status} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 border-b border-yd-border-light text-right" onClick={e => e.stopPropagation()}>
                      <ActionMenu
                        inv={inv}
                        onView={() => setViewInv(inv)}
                        onPay={() => setPayInv(inv)}
                        onDelete={() => setDeleteInv(inv)}
                        onWhatsApp={() => handleWhatsApp(inv)}
                        onPrint={() => printInvoice(inv, payments)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ViewInvoiceDrawer
        open={!!viewInv}
        inv={viewInv}
        allPayments={payments}
        onClose={() => setViewInv(null)}
        onPay={() => handlePayFlow(viewInv)}
      />

      <RecordPaymentDrawer
        key={payKey}
        open={!!payInv}
        inv={payInv}
        onSave={handleRecordPayment}
        onClose={() => setPayInv(null)}
      />

      {deleteInv && (
        <ConfirmModal
          msg={`Delete invoice ${deleteInv.invoiceNumber} for ${deleteInv.studentName}? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteInv(null)}
          loading={deleting}
        />
      )}

      <Toasts toasts={toast.toasts} />
    </div>
  );
}
