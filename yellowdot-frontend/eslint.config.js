import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // ── Service layer boundary — PLATFORM ARCHITECTURE §5A ─────────────────────
  // Nothing outside the service layer may reach for the raw HTTP client.
  // Consumers resolve a registered service instead:
  //     const attendance = useService("attendance");   // components
  //     callRead("attendance", "summary", { date });   // hooks, providers
  //
  // Enforced INCREMENTALLY, on purpose. 32 files import `api` directly today;
  // turning this on globally as an error would break lint on contact and tell
  // us nothing new. So it is a WARNING everywhere (the debt stays visible and
  // countable) and an ERROR in the directories already migrated. The error list
  // grows as each phase moves its consumers over — that is what keeps the
  // boundary from decaying the way the original service layer did.
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/services/**', 'src/platform/services/**'],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [{
          group: ['**/services/authService', '**/services/authService.js'],
          importNames: ['api'],
          message:
            'Do not import `api` outside the service layer (PLATFORM ARCHITECTURE §5A). ' +
            'Use useService("<id>") in components, or callRead("<id>", "<read>") in hooks. ' +
            'If the endpoint is missing, add a method to the service in src/services/.',
        }],
      }],
    },
  },
  {
    // Migrated zones — the boundary is hard here.
    files: ['src/platform/**/*.{js,jsx}', 'src/pages/quickNavigation/**/*.{js,jsx}'],
    ignores: ['src/platform/services/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/services/authService', '**/services/authService.js'],
          importNames: ['api'],
          message:
            'This directory is migrated to the Service Registry (§5A) — importing `api` here is a regression. ' +
            'Use useService("<id>") or callRead("<id>", "<read>").',
        }],
      }],
    },
  },
])
