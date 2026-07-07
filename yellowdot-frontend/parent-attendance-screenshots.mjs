/**
 * parent-attendance-screenshots.mjs
 * Phase 3 review screenshots (mobile + desktop) → docs/parent-review/screenshots/.
 * Network mocked with realistic sample data. No backend/Firebase needed.
 */

import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

const BASE = "http://localhost:5173";
const OUT = "../docs/parent-review/screenshots";
mkdirSync(OUT, { recursive: true });

const pad = n => String(n).padStart(2, "0");

const CHILDREN = [
  { studentId: "YD001", studentName: "Aarav Sharma", class: "Nursery A",
    dob: "2022-04-12", gender: "Male", admissionDate: "2025-06-01",
    status: "Active", centerId: "Seawoods", profileImage: "",
    fatherName: "Rohan Sharma", motherName: "Priya Sharma" },
  { studentId: "YD014", studentName: "Anaya Sharma", class: "Playgroup",
    dob: "2023-09-03", gender: "Female", admissionDate: "2026-04-01",
    status: "Active", centerId: "Seawoods", profileImage: "",
    fatherName: "Rohan Sharma", motherName: "Priya Sharma" },
];
const ME = {
  parent: { uid: "demo", schoolId: "ydseawoods", email: "priya.sharma@example.com",
    name: "Priya Sharma", phone: "+91 98765 43210", relation: "mother",
    status: "active", studentIds: ["YD001", "YD014"] },
  children: CHILDREN,
};

// Build a realistic current-month attendance payload (weekdays only).
function buildAttendance() {
  const now = new Date();
  const ym = now.toISOString().slice(0, 7);
  const y = now.getFullYear(), m = now.getMonth();
  const todayDay = now.getDate();
  const dow = d => new Date(y, m, d).getDay();
  const holidays = new Set([12, 13]); // mid-month break (weekday-dependent)

  const days = {};
  const history = [];
  let present = 0, absent = 0, late = 0, holiday = 0;

  for (let d = 1; d <= todayDay; d++) {
    const wd = dow(d);
    if (wd === 0 || wd === 6) continue; // weekend → no record
    const iso = `${ym}-${pad(d)}`;
    if (holidays.has(d)) { days[iso] = "Holiday"; holiday++; continue; }
    let st = "Present";
    if (d % 9 === 0) st = "Absent";
    else if (d % 7 === 0) st = "Late";
    days[iso] = st;
    if (st === "Present") present++; else if (st === "Late") late++; else absent++;
    history.push({ date: iso, status: st,
      checkIn: st === "Absent" ? "" : `09:0${d % 6}`,
      checkOut: st === "Absent" ? "" : `15:3${d % 6}` });
  }
  // a couple of upcoming holidays for calendar colour
  for (const d of holidays) {
    const iso = `${ym}-${pad(d)}`;
    if (!days[iso] && !(dow(d) === 0 || dow(d) === 6)) { days[iso] = "Holiday"; holiday++; }
  }
  // ensure today reads nicely
  const todayIso = `${ym}-${pad(todayDay)}`;
  if (!days[todayIso]) { days[todayIso] = "Present"; present++; history.push({ date: todayIso, status: "Present", checkIn: "09:02", checkOut: "" }); }

  history.reverse(); // newest first
  const recorded = present + absent + late;
  const percentage = recorded > 0 ? Math.round(((present + late) / recorded) * 100) : null;

  return {
    studentId: "YD001", month: ym, daysInMonth: new Date(y, m + 1, 0).getDate(),
    today: { date: todayIso, status: days[todayIso] || "Present" },
    percentage, summary: { present, absent, late, holiday, recorded },
    days, history,
  };
}

async function mockApi(page) {
  await page.route("**/api/**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/parent/me", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ME) }));
  await page.route("**/api/parent/child/*/attendance**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildAttendance()) }));
}

const VIEWPORTS = {
  mobile:  { width: 390,  height: 1300, deviceScaleFactor: 2, isMobile: true },
  desktop: { width: 1280, height: 1100, deviceScaleFactor: 1, isMobile: false },
};

const browser = await chromium.launch();
for (const [vp, cfg] of Object.entries(VIEWPORTS)) {
  const context = await browser.newContext({
    viewport: { width: cfg.width, height: cfg.height },
    deviceScaleFactor: cfg.deviceScaleFactor, isMobile: cfg.isMobile,
  });
  const page = await context.newPage();
  await mockApi(page);
  await page.goto(BASE + "/parent-attendance", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/phase3-attendance-${vp}.png`, fullPage: true });
  console.log("captured phase3-attendance-" + vp);
  await context.close();
}
await browser.close();
console.log("DONE → " + OUT);
