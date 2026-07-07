/**
 * parent-memories-screenshots.mjs
 * Phase 4 review screenshots (mobile + desktop + lightbox) → docs/parent-review/screenshots/.
 * Sample images are inline SVG data-URIs so they render without network.
 */

import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

const BASE = "http://localhost:5173";
const OUT = "../docs/parent-review/screenshots";
mkdirSync(OUT, { recursive: true });

// Inline SVG "photo" so it renders with no network.
function svg(c1, c2, emoji, label) {
  const s = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs>
    <rect width='800' height='600' fill='url(#g)'/>
    <text x='400' y='300' font-size='160' text-anchor='middle' dominant-baseline='central'>${emoji}</text>
    <text x='400' y='470' font-size='40' fill='rgba(60,47,0,0.65)' font-family='sans-serif' text-anchor='middle'>${label}</text>
  </svg>`;
  return "data:image/svg+xml," + encodeURIComponent(s);
}

const iso = off => new Date(Date.now() + off).toISOString().slice(0, 10);
const DAY = 86400000;

const CHILDREN = [
  { studentId: "YD001", studentName: "Aarav Sharma", class: "Nursery A", status: "Active", profileImage: "", fatherName: "Rohan Sharma", motherName: "Priya Sharma" },
  { studentId: "YD014", studentName: "Anaya Sharma", class: "Playgroup", status: "Active", profileImage: "", fatherName: "Rohan Sharma", motherName: "Priya Sharma" },
];
const ME = {
  parent: { uid: "demo", schoolId: "ydseawoods", email: "priya.sharma@example.com", name: "Priya Sharma", phone: "+91 98765 43210", relation: "mother", status: "active", studentIds: ["YD001", "YD014"] },
  children: CHILDREN,
};

const MEMORIES = {
  memories: [
    { id: "m1", studentId: "YD001", type: "photo", date: iso(0),
      mediaUrl: svg("#FFE066", "#F4C400", "🎨", "Art &amp; Craft"),
      caption: "Aarav painted a bright yellow sun today and proudly showed everyone! ☀️" },
    { id: "m2", studentId: "YD014", type: "video", date: iso(0),
      mediaUrl: "", thumbnailUrl: svg("#FFD42E", "#D9AE00", "🎵", "Music &amp; Movement"),
      caption: "Anaya danced through the whole music session — so much energy! 💛" },
    { id: "m3", studentId: "YD001", type: "photo", date: iso(-1 * DAY),
      mediaUrl: svg("#FFEB99", "#FFD42E", "🌳", "Garden Walk"),
      caption: "Exploring the garden and spotting butterflies during outdoor time." },
    { id: "m4", studentId: "YD014", type: "photo", date: iso(-3 * DAY),
      mediaUrl: svg("#FFF4CC", "#FFE066", "🧁", "Birthday Treats"),
      caption: "Celebrating a friend's birthday with cupcakes and big smiles!" },
    { id: "m5", studentId: "YD001", type: "photo", date: iso(-4 * DAY),
      mediaUrl: svg("#FFE066", "#F4C400", "🧱", "Building Blocks"),
      caption: "Built the tallest tower in class with teamwork. 🏗️" },
  ],
};

async function mockApi(page) {
  await page.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/parent/me", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ME) }));
  await page.route("**/api/parent/memories**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MEMORIES) }));
}

const VIEWPORTS = {
  mobile:  { width: 390,  height: 1500, deviceScaleFactor: 2, isMobile: true },
  desktop: { width: 1280, height: 1200, deviceScaleFactor: 1, isMobile: false },
};

const browser = await chromium.launch();
for (const [vp, cfg] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: { width: cfg.width, height: cfg.height }, deviceScaleFactor: cfg.deviceScaleFactor, isMobile: cfg.isMobile });
  const page = await ctx.newPage();
  await mockApi(page);
  await page.goto(BASE + "/parent-memories", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/phase4-memories-${vp}.png`, fullPage: true });
  console.log("captured phase4-memories-" + vp);
  await ctx.close();
}

// Lightbox (tap first photo) on mobile
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const page = await ctx.newPage();
  await mockApi(page);
  await page.goto(BASE + "/parent-memories", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  try {
    await page.locator("img").first().click({ force: true, timeout: 8000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/phase4-memories-lightbox.png` });
    console.log("captured phase4-memories-lightbox");
  } catch (e) {
    console.warn("lightbox capture skipped:", e.message);
  }
  await ctx.close();
}

await browser.close();
console.log("DONE → " + OUT);
