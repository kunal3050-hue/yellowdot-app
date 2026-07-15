/**
 * dataTableExport.js — pluggable export handlers for DataTable v2
 * ──────────────────────────────────────────────────────────────────
 * Each handler takes (rows, columns, opts) and produces a download / print
 * job. Registered in one place so adding a new format (e.g. PDF) later is
 * "add a handler," not "touch DataTable.jsx."
 *
 * `columns` passed in are already filtered to visible, exportable columns
 * (action/select columns are excluded by the caller).
 */

function cellText(row, col) {
  const raw = typeof col.accessorFn === "function" ? col.accessorFn(row) : row[col.key];
  if (col.exportValue) return String(col.exportValue(raw, row));
  if (raw == null) return "";
  return String(raw);
}

function buildRows(rows, columns) {
  return rows.map(row => columns.map(col => cellText(row, col)));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── CSV ───────────────────────────────────────────────────────────────────
function exportCsv(rows, columns, { filename = "export" } = {}) {
  const header = columns.map(c => csvEscape(c.label));
  const body = buildRows(rows, columns).map(r => r.map(csvEscape));
  const csv = [header, ...body].map(r => r.join(",")).join("\r\n");
  // UTF-8 BOM so Excel opens non-ASCII characters correctly
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

// ── Excel (.xls via HTML table — Excel opens this natively, zero deps) ────
function exportExcel(rows, columns, { filename = "export" } = {}) {
  const header = columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = buildRows(rows, columns)
    .map(r => `<tr>${r.map(v => `<td>${escapeHtml(v)}</td>`).join("")}</tr>`)
    .join("");
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8" />
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
        <x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head>
      <body><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body>
    </html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  downloadBlob(blob, `${filename}.xls`);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Print ───────────────────────────────────────────────────────────────
function exportPrint(rows, columns, { filename = "export", title } = {}) {
  const header = columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = buildRows(rows, columns)
    .map(r => `<tr>${r.map(v => `<td>${escapeHtml(v)}</td>`).join("")}</tr>`)
    .join("");
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return; // popup blocked — caller may want to surface a toast
  win.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title || filename)}</title>
        <style>
          body { font-family: -apple-system, sans-serif; padding: 24px; color: #0F172A; }
          h1 { font-size: 16px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #E2E8F0; padding: 6px 10px; text-align: left; }
          th { background: #F8FAFC; text-transform: uppercase; font-size: 10px; letter-spacing: .05em; }
          tr:nth-child(even) td { background: #FAFAFA; }
        </style>
      </head>
      <body>
        ${title ? `<h1>${escapeHtml(title)}</h1>` : ""}
        <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

// ── PDF (jsPDF + jspdf-autotable — both already project dependencies) ─────
async function exportPdf(rows, columns, { filename = "export", title } = {}) {
  const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
  await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });
  if (title) doc.text(title, 14, 14);
  doc.autoTable({
    head: [columns.map(c => c.label)],
    body: buildRows(rows, columns),
    startY: title ? 20 : 10,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 23, 42] },
  });
  doc.save(`${filename}.pdf`);
}

export const EXPORT_HANDLERS = {
  csv: exportCsv,
  excel: exportExcel,
  print: exportPrint,
  pdf: exportPdf,
};

/**
 * Run an export handler by key. `format` must be one of EXPORT_HANDLERS'
 * keys, or a custom handler function passed directly via `exportHandlers`
 * override on DataTable.
 */
export function runExport(format, rows, columns, opts, customHandlers) {
  const handler = customHandlers?.[format] || EXPORT_HANDLERS[format];
  if (!handler) throw new Error(`Unknown export format: ${format}`);
  return handler(rows, columns, opts);
}
