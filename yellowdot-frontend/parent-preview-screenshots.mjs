/**
 * parent-preview-screenshots.mjs
 * Captures Parent Module UX screenshots using mocked sample data.
 * Network layer is mocked (page.route) so NO backend/Firebase is required.
 * Parent routes render in DEV without ProtectedRoute (import.meta.env.DEV).
 *
 * Usage: node parent-preview-screenshots.mjs   (dev server must be on :5173)
 */

import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

const BASE = "http://localhost:5173";
const OUT = "./verify-screenshots/parent";
mkdirSync(OUT, { recursive: true });

// ── Sample data ────────────────────────────────────────────────────
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
const DAY = 86400000, HR = 3600000;

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
  parent: {
    uid: "demo-uid", schoolId: "ydseawoods",
    email: "priya.sharma@example.com", name: "Priya Sharma",
    phone: "+91 98765 43210", relation: "mother", status: "active",
    studentIds: ["YD001", "YD014"],
  },
  children: CHILDREN,
};

const FEED = {
  feed: [
    { id: "e1", type: "event", tag: "Event", date: iso(5 * DAY),
      title: "Annual Sports Day", image: "",
      body: "Join us for races, games and lots of fun! Please send your child in their sports uniform with a water bottle." },
    { id: "a1", type: "announcement", tag: "Update", date: iso(-2 * HR),
      title: "School reopens Monday", image: "",
      body: "We can't wait to welcome everyone back after the short break. Classes resume at 9:00 AM sharp." },
    { id: "ac1", type: "activity", tag: "Activity", date: iso(-5 * HR),
      title: "Splash & Sensory Play 💦", image: "",
      body: "Today the little ones explored water play — pouring, splashing and giggling all morning. Wonderful for motor skills and confidence!" },
    { id: "ac2", type: "activity", tag: "Activity", date: iso(-1 * DAY),
      title: "Storytime: The Hungry Caterpillar 🐛", image: "",
      body: "A classroom favourite! The children acted out the story and proudly named every fruit the caterpillar ate." },
    { id: "e2", type: "event", tag: "Holiday", date: iso(-3 * DAY),
      title: "Holi Celebration", image: "",
      body: "Colourful fun with skin-safe organic colours. Thank you to all the families who joined us!" },
  ],
};

async function mockApi(page) {
  // NOTE: Playwright matches routes in REVERSE registration order, so the
  // broad catch-all is registered FIRST and specific mocks AFTER (they win).
  await page.route("**/api/**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/parent/me", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ME) }));
  await page.route("**/api/parent/feed", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FEED) }));
  await page.route("**/api/parent/child/**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ child: CHILDREN[0] }) }));
}

const SHOTS = [
  { name: "1-parent-login",   path: "/login" },
  { name: "2-parent-home",    path: "/parent-home" },
  { name: "3-attendance",     path: "/parent-attendance" },
  { name: "4-profile",        path: "/parent-profile" },
  { name: "5-child-profile",  path: "/parent-child/YD001" },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
});
const page = await context.newPage();
await mockApi(page);

for (const s of SHOTS) {
  await page.goto(BASE + s.path, { waitUntil: "networkidle" });
  await page.waitForTimeout(900); // allow lazy chunk + render
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: true });
  console.log("captured", s.name, "→", s.path);
}

await browser.close();
console.log("DONE → " + OUT);
