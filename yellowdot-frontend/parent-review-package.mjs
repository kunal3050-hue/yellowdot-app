/**
 * parent-review-package.mjs
 * Generates the Parent Review Package screenshots (mobile + desktop)
 * into docs/parent-review/screenshots/.
 *
 * Network is mocked (page.route) with realistic sample data — no backend
 * or Firebase needed. Parent routes render in DEV without ProtectedRoute.
 *
 * Usage: node parent-review-package.mjs   (dev server must be on :5173)
 */

import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

const BASE = "http://localhost:5173";
const OUT = "../docs/parent-review/screenshots";
mkdirSync(OUT, { recursive: true });

// ── Realistic sample data ──────────────────────────────────────────
const iso = (off) => new Date(Date.now() + off).toISOString();
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
  // Playwright matches routes in REVERSE registration order:
  // register the broad catch-all first, specific mocks after (they win).
  await page.route("**/api/**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/parent/me", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ME) }));
  await page.route("**/api/parent/feed", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FEED) }));
  await page.route("**/api/parent/child/**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ child: CHILDREN[0] }) }));
}

const SCREENS = [
  { name: "1-login",         path: "/login",              dock: false },
  { name: "2-home",          path: "/parent-home",        dock: true  },
  { name: "3-profile",       path: "/parent-profile",     dock: true  },
  { name: "4-child-profile", path: "/parent-child/YD001", dock: true  },
  { name: "5-attendance",    path: "/parent-attendance",  dock: true  },
];

const VIEWPORTS = {
  mobile:  { width: 390,  height: 844, deviceScaleFactor: 2, isMobile: true },
  desktop: { width: 1280, height: 900, deviceScaleFactor: 1, isMobile: false },
};

const browser = await chromium.launch();

for (const [vp, cfg] of Object.entries(VIEWPORTS)) {
  const context = await browser.newContext({
    viewport: { width: cfg.width, height: cfg.height },
    deviceScaleFactor: cfg.deviceScaleFactor,
    isMobile: cfg.isMobile,
  });
  const page = await context.newPage();
  await mockApi(page);

  for (const s of SCREENS) {
    await page.goto(BASE + s.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${s.name}-${vp}.png` }); // viewport (real look, dock intact)
    console.log("captured", `${s.name}-${vp}`);
  }

  // Bottom navigation close-up (from Home, where the dock is shown).
  await page.goto(BASE + "/parent-home", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const clipH = 110;
  await page.screenshot({
    path: `${OUT}/6-bottom-nav-${vp}.png`,
    clip: { x: 0, y: cfg.height - clipH, width: cfg.width, height: clipH },
  });
  console.log("captured", `6-bottom-nav-${vp}`);

  await context.close();
}

await browser.close();
console.log("DONE → " + OUT);
