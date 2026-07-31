# Module Registry

**Status: DARK.** Nothing in the running application imports this yet. That is deliberate — do not "clean it up."

Full design: [`docs/platform-architecture/PLATFORM_ARCHITECTURE.md`](../../../../docs/platform-architecture/PLATFORM_ARCHITECTURE.md) §5.

## What this is

One entry per module. Every other module list in the app is intended to become a derived view of these entries, replacing five hand-maintained registries that must currently be kept in sync by hand:

| Today | Entries | Becomes |
|---|---|---|
| `App.jsx` `<Route>` declarations | 106 | `selectRoutes()` |
| `config/sidebarConfig.js` | 74 items | `selectNavGroups()` |
| `pages/quickNavigation/modules.js` | 34 cards | `selectGridSections()` |
| `config/rbacConfig.js` `PERMISSION_CATEGORIES` | 27 modules | `selectPermissionModules()` |
| `MODULE_ROUTE_MAP` — duplicated in `rbacConfig.js` **and** backend `roleService.js` | 25 each | `selectRouteKeyMap()` |

Adding a module today means editing five files across two repos. That is the problem this solves.

## Why it is dark

Phase 0 of the migration (§12) builds the registry and proves it correct *before* anything depends on it. `npm run verify:registry` compares it against the live app and fails on any drift. Later phases flip consumers over one at a time; each is mechanical only because this check passes first.

```bash
npm run verify:registry
```

## Rules for editing

- **Data only — no imports.** `icon` is a string, not a lucide component; routes carry no `component` reference. The verifier runs in plain Node, and a registry that imported every page would pull the whole app into any consumer's bundle. Components are attached in Phase 7 via a separate lazy map keyed by path.
- **Describe the app as it is, not as it should be.** Two shipped-but-unrouted modules were found while writing this (see `knownGaps.js`). They are recorded, not papered over.
- **If you change a route, sidebar item, or grid card anywhere, run the verifier.** It will tell you exactly what drifted.

## Files

| File | Purpose |
|---|---|
| `index.js` | Assembles all modules; the derived-view selectors |
| `defineModule.js` | Entry contract + validation (throws on malformed entries) |
| `categories.js` | Category definitions, accents, sidebar group metadata |
| `knownGaps.js` | Pre-existing defects the registry surfaced; also the verifier's allowlist |
| `modules/*.js` | The entries themselves, grouped by domain |

Entries live here rather than beside their modules for now. They move to `modules/<name>/registry.js` when module folders are created in later phases — the shape does not change.
