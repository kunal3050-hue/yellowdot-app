import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      // Assets to include in the precache manifest
      includeAssets: [
        'favicon.svg',
        'icons/apple-touch-icon-180x180.png',
        'icons/pwa-64x64.png',
      ],

      // ── Web App Manifest ──────────────────────────────────────────────────
      manifest: {
        name: 'Yellow Dot CRM',
        short_name: 'Yellow Dot',
        description: 'Childcare Management Platform — Attendance, Meals, Fees & More',
        theme_color: '#F4C400',
        background_color: '#FFFDF7',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/?source=pwa',
        id: 'yellowdot-crm',
        lang: 'en',
        categories: ['education', 'productivity', 'business'],

        icons: [
          {
            src: 'icons/pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],

        // App shortcuts — shown in long-press menu on Android
        shortcuts: [
          {
            name: 'Students',
            short_name: 'Students',
            url: '/students?source=pwa-shortcut',
            description: 'View & manage students',
            icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Attendance',
            short_name: 'Attendance',
            url: '/attendance?source=pwa-shortcut',
            description: 'Mark daily attendance',
            icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Invoices',
            short_name: 'Invoices',
            url: '/invoice?source=pwa-shortcut',
            description: 'Fee collection & invoices',
            icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },

      // ── Workbox (service worker) config ───────────────────────────────────
      workbox: {
        // Precache all built static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // SPA fallback — serve index.html for all navigation requests
        navigateFallback: '/index.html',

        // Don't cache Firebase auth redirects or admin routes
        navigateFallbackDenylist: [/^\/__/, /\/api\//],

        // Runtime caching strategies
        runtimeCaching: [
          // Firebase Firestore / Functions — network-first
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.cloudfunctions\.net\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'functions-cache',
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts — stale-while-revalidate
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-cache',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Face detection models (large binary, cache aggressively)
          {
            urlPattern: /\/models\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ml-models-cache',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],

        // Skip waiting so updates activate immediately on next navigation
        skipWaiting: true,
        clientsClaim: true,
      },

      // Don't enable SW in dev — it breaks HMR
      devOptions: { enabled: false },
    }),
  ],

  build: {
    chunkSizeWarningLimit: 800,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')
          ) return 'vendor-react';

          if (
            id.includes('node_modules/firebase/') ||
            id.includes('node_modules/@firebase/')
          ) return 'vendor-firebase';

          if (
            id.includes('node_modules/jspdf') ||
            id.includes('node_modules/jspdf-autotable')
          ) return 'vendor-jspdf';

          if (id.includes('node_modules/html2canvas')) return 'vendor-html2canvas';

          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/victory-') ||
            id.includes('node_modules/@nivo/')
          ) return 'vendor-charts';

          if (
            id.includes('node_modules/@vladmandic/face-api') ||
            id.includes('node_modules/@tensorflow')
          ) return 'vendor-face-api';

          if (
            id.includes('node_modules/qrcode') ||
            id.includes('node_modules/jsqr')
          ) return 'vendor-qrcode';

          if (id.includes('node_modules/hls.js')) return 'vendor-hlsjs';

          if (id.includes('node_modules/dompurify')) return 'vendor-security';
        },
      },
    },
  },
})
