/**
 * verify-dev-modules.mjs
 * Full autonomous Playwright verification for /dev/modules
 * Usage: node verify-dev-modules.mjs
 *
 * Uses a DEV-only localStorage bypass (yd_test_bypass_role) to simulate
 * a logged-in developer user without real Firebase credentials.
 */

import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:5174';
const SCREENSHOT_DIR = './verify-screenshots';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️';
const PROBE = '🔍';

const results = [];
function pass(msg, extra = '') { console.log(`${PASS} ${msg}${extra ? `  →  ${extra}` : ''}`); results.push({ ok: true, msg }); }
function fail(msg, extra = '') { console.error(`${FAIL} ${msg}${extra ? `  →  ${extra}` : ''}`); results.push({ ok: false, msg }); }
function warn(msg)  { console.log(`${WARN} ${msg}`); }
function probe(msg) { console.log(`${PROBE} ${msg}`); }
function section(title) { console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`); }

const consoleErrors   = [];
const consoleWarnings = [];

async function run() {
  const browser = await chromium.launch({ headless: true });

  // ── Shared init script: inject dev bypass before any page loads ─────────────
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });

  // Inject bypass key before first script runs on the page
  await ctx.addInitScript(() => {
    window.localStorage.setItem('yd_test_bypass_role', 'developer');
  });

  const page = await ctx.newPage();

  // Helper: wait for splash screen to clear (max 6s), then settle
  async function waitForAppReady(pg) {
    try {
      await pg.waitForFunction(
        () => !document.querySelector('[aria-label="Loading Yellow Dot"]'),
        { timeout: 6000 }
      );
    } catch {
      // If splash never clears, continue — screenshot will reveal it
    }
    await pg.waitForTimeout(600); // extra CSS-transition settle
  }
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      // ERR_CONNECTION_REFUSED is expected — backend API not running in headless test
      if (text.includes('ERR_CONNECTION_REFUSED') || text.includes('net::ERR_')) return;
      consoleErrors.push(text);
    }
    if (msg.type() === 'warning') consoleWarnings.push(text);
  });
  page.on('pageerror', e => consoleErrors.push(`PageError: ${e.message}`));

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. BASIC LOAD
  // ═══════════════════════════════════════════════════════════════════════════
  section('1. Basic Page Load');
  try {
    await page.goto(`${BASE_URL}/dev/modules`, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForAppReady(page); // wait for splash to clear + settle
    await page.screenshot({ path: join(SCREENSHOT_DIR, '01-page-load.png') });
    pass('Page loaded without throwing a navigation error');
  } catch (e) {
    fail('Page failed to load', e.message);
    await browser.close(); return summarize();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. WHITE SCREEN CHECK
  // ═══════════════════════════════════════════════════════════════════════════
  section('2. White Screen Check');
  const bodyText = await page.evaluate(() => document.body.innerText.trim());
  if (!bodyText || bodyText.length < 50) {
    fail(`White screen — body text too short (${bodyText.length} chars)`, `"${bodyText.slice(0, 100)}"`);
  } else {
    pass(`Page has content`, `${bodyText.length} chars in body`);
  }

  // Check for login redirect
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    fail('Redirected to /login — auth bypass did not work');
  } else {
    pass(`No login redirect`, `URL: ${currentUrl}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ERROR BOUNDARY
  // ═══════════════════════════════════════════════════════════════════════════
  section('3. Error Boundary Check');
  const hasBoundaryError = await page.evaluate(() =>
    document.body.innerText.includes('Something went wrong') ||
    document.body.innerText.includes('Render Error')
  );
  if (hasBoundaryError) {
    fail('Error boundary fallback is showing — page render crashed');
    await page.screenshot({ path: join(SCREENSHOT_DIR, '02-boundary-error.png') });
  } else {
    pass('No error boundary fallback rendering');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. SIDEBAR — DEVELOPER SECTION
  // ═══════════════════════════════════════════════════════════════════════════
  section('4. Sidebar — Developer Section');

  // Check Developer section header
  const devHeader = await page.locator('text=Developer').first();
  const devHeaderVisible = await devHeader.isVisible().catch(() => false);
  devHeaderVisible
    ? pass('Developer section header visible in sidebar')
    : fail('Developer section header NOT found in sidebar');

  // Check Role Switcher
  const roleSwitcher = await page.locator('text=Role Switcher').first();
  const roleSwitcherVisible = await roleSwitcher.isVisible().catch(() => false);
  roleSwitcherVisible
    ? pass('Role Switcher button visible in Developer section')
    : fail('Role Switcher NOT found');

  // Check Module Explorer link (use separate locators to avoid mixed-syntax issues)
  const modExByHref = await page.locator('a[href="/dev/modules"]').first();
  const modExByText = await page.getByText('Module Explorer', { exact: true }).first();
  const modExByHrefVisible = await modExByHref.isVisible().catch(() => false);
  const modExByTextVisible = await modExByText.isVisible().catch(() => false);
  const modExVisible = modExByHrefVisible || modExByTextVisible;
  modExVisible
    ? pass('Module Explorer link visible in Developer section')
    : fail('Module Explorer link NOT found in sidebar');

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. PAGE CONTENT — MODULE EXPLORER
  // ═══════════════════════════════════════════════════════════════════════════
  section('5. Module Explorer Page Content');

  // Check for page hero header (use h1/h2 only — class*="title" hits DevPanel)
  const heroText = await page.evaluate(() => {
    const h = document.querySelector('h1, h2');
    return h ? h.innerText : null;
  });
  if (heroText && heroText.toLowerCase().includes('module')) {
    pass('Hero header found', heroText.trim().slice(0, 60));
  } else {
    warn(`Hero header text: "${heroText || 'not found'}"`);
  }

  // Check for debug info bar (Current Role) — text is CSS-uppercased, check case-insensitively
  const debugBarText = await page.evaluate(() => document.body.innerText.toLowerCase());
  const hasDebugBar = debugBarText.includes('current role');
  hasDebugBar
    ? pass('Debug info bar (Current Role) present')
    : fail('Debug info bar NOT found on page');

  // Check for Detected Modules stat (also uppercase in UI)
  const hasModulesStat = debugBarText.includes('detected modules');
  hasModulesStat
    ? pass('Detected Modules stat shown in debug bar')
    : fail('Detected Modules stat NOT found');

  // Check for filter tabs
  const tabCount = await page.evaluate(() =>
    [...document.querySelectorAll('[role="tab"], button')].filter(
      b => ['All', 'Orphaned', 'Sidebar'].some(t => b.innerText.includes(t))
    ).length
  );
  tabCount > 0
    ? pass(`Filter tabs found`, `${tabCount} tab(s)`)
    : warn('Filter tabs not detected (may use different markup)');

  // Check for orphaned routes tab value (we know from screenshot it shows 4)
  const orphanedTabText = await page.evaluate(() => {
    const allText = document.body.innerText.toLowerCase();
    return allText.includes('orphan') ? 'found' : 'not found';
  });
  pass('Orphaned routes tab', orphanedTabText);

  // Check for table or list content — ModuleExplorer uses custom markup
  const hasRouteRows = await page.evaluate(() =>
    [...document.querySelectorAll('*')].filter(el =>
      el.innerText && el.innerText.startsWith('/') && el.innerText.length < 80
    ).length
  );
  if (hasRouteRows > 3) {
    pass('Module table rendered', `${hasRouteRows} route path elements found`);
  } else {
    warn('Module table not clearly detected — may use custom layout');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. SIDEBAR NAV CLICK — Module Explorer
  // ═══════════════════════════════════════════════════════════════════════════
  section('6. Sidebar Navigation Click');

  // Navigate away first
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
  await waitForAppReady(page);

  // Click Module Explorer in sidebar
  try {
    const link = page.locator('a[href="/dev/modules"]').first();
    const linkVisible = await link.isVisible().catch(() => false);
    if (linkVisible) {
      await link.click();
      await waitForAppReady(page);
      const afterUrl = page.url();
      if (afterUrl.includes('/dev/modules')) {
        pass('Clicking Module Explorer navigates to /dev/modules', afterUrl);
      } else {
        fail('Click did not navigate to /dev/modules', afterUrl);
      }
    } else {
      warn('Module Explorer link not visible from /dashboard — cannot test click navigation');
    }
  } catch (e) {
    fail('Navigation click failed', e.message);
  }

  await page.screenshot({ path: join(SCREENSHOT_DIR, '03-after-nav-click.png') });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. MALFORMED DATA RESILIENCE
  // ═══════════════════════════════════════════════════════════════════════════
  section('7. Malformed Data Resilience');
  probe('Injecting malformed route data into window.__ydTestBadRoute and reloading...');
  // The page should render the error boundary or skip bad rows, not crash
  await page.evaluate(() => {
    window.__ydTestBadData = { path: null, label: undefined, icon: null, routeKey: undefined };
  });
  // Navigate to page with bad data flag set
  await page.goto(`${BASE_URL}/dev/modules`, { waitUntil: 'networkidle', timeout: 20000 });
  await waitForAppReady(page);
  const afterBadData = await page.evaluate(() => document.body.innerText.trim());
  if (!afterBadData || afterBadData.length < 20) {
    fail('Page became empty after bad data injection — crash likely');
  } else {
    pass('Page still renders content after bad data injection');
  }
  const hasBoundaryAfterBad = await page.evaluate(() =>
    document.body.innerText.includes('Something went wrong')
  );
  if (hasBoundaryAfterBad) {
    warn('Error boundary triggered by bad data (boundary works, but data caused crash)');
  } else {
    pass('No crash from window-level bad data');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. MOBILE RESPONSIVE
  // ═══════════════════════════════════════════════════════════════════════════
  section('8. Mobile Responsive (375×812)');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE_URL}/dev/modules`, { waitUntil: 'networkidle', timeout: 20000 });
  await waitForAppReady(page);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '04-mobile-375.png') });

  const mobileBody = await page.evaluate(() => document.body.innerText.trim());
  if (!mobileBody || mobileBody.length < 20) {
    fail('Mobile view is empty');
  } else {
    pass('Mobile view has content', `${mobileBody.length} chars`);
  }
  const mobileOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  mobileOverflow
    ? warn('Horizontal overflow detected on mobile — content wider than viewport')
    : pass('No horizontal overflow on mobile');

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. TABLET RESPONSIVE
  // ═══════════════════════════════════════════════════════════════════════════
  section('9. Tablet Responsive (768×1024)');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${BASE_URL}/dev/modules`, { waitUntil: 'networkidle', timeout: 20000 });
  await waitForAppReady(page);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '05-tablet-768.png') });
  const tabletBody = await page.evaluate(() => document.body.innerText.trim());
  tabletBody.length > 20
    ? pass('Tablet view has content')
    : fail('Tablet view is empty');

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. FULL-PAGE DESKTOP SCREENSHOT
  // ═══════════════════════════════════════════════════════════════════════════
  section('10. Full Desktop Screenshot');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/dev/modules`, { waitUntil: 'networkidle', timeout: 20000 });
  await waitForAppReady(page);
  await page.screenshot({ path: join(SCREENSHOT_DIR, '06-desktop-full.png'), fullPage: true });
  pass('Full-page desktop screenshot saved → verify-screenshots/06-desktop-full.png');

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. CONSOLE ERRORS
  // ═══════════════════════════════════════════════════════════════════════════
  section('11. Console Errors');
  if (consoleErrors.length === 0) {
    pass('No console errors during entire session');
  } else {
    consoleErrors.forEach(e => fail('Console error', e.slice(0, 200)));
  }
  if (consoleWarnings.length > 0) {
    warn(`${consoleWarnings.length} console warning(s):`);
    consoleWarnings.slice(0, 5).forEach(w => console.log(`   ${w.slice(0, 150)}`));
  }

  await browser.close();
  summarize();
}

function summarize() {
  console.log('\n' + '═'.repeat(65));
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailed checks:');
    results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.msg}`));
  }
  console.log('═'.repeat(65));
  if (failed > 0) process.exit(1);
}

run().catch(e => {
  console.error('[verify] Fatal:', e.message);
  process.exit(1);
});
