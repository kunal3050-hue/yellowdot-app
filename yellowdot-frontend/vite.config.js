import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      // injectManifest: VitePWA reads public/firebase-messaging-sw.js as the SW
      // template, injects self.__WB_MANIFEST, and outputs dist/firebase-messaging-sw.js.
      // This makes ONE SW that handles both Workbox precaching and FCM messaging,
      // eliminating the /sw.js vs /firebase-messaging-sw.js scope "/" conflict that
      // previously caused getToken() to fail.
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'firebase-messaging-sw.js',
      registerType: 'autoUpdate',
      selfDestroying: false,

      // Assets to include in the precache manifest
      includeAssets: [
        'favicon.svg',
        'icons/favicon.ico',
        'icons/apple-touch-icon-180x180.png',
        'icons/pwa-64x64.png',
        'icons/pwa-192x192.png',
        'icons/pwa-512x512.png',
        'icons/maskable-icon-512x512.png',
      ],

      // ── Web App Manifest ──────────────────────────────────────────────────
      // Fixed platform brand — same in every environment, not tenant-specific.
      manifest: {
        name: 'KUE BOXS Care',
        short_name: 'KUE BOXS Care',
        description: 'Childcare Management Platform — Attendance, Meals, Fees & More',
        version: '1.2.0',
        theme_color: '#F4C400',
        background_color: '#F4C400',
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

      // Runtime caching and skipWaiting/clientsClaim are now handled directly
      // inside public/firebase-messaging-sw.js (the combined Workbox + FCM SW).

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

          if (id.includes('node_modules/dompurify')) return 'vendor-security';
        },
      },
    },
  },
})
