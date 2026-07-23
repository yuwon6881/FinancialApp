/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"
import path from "path"
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

// Inject a Content-Security-Policy <meta> at build time. This is defense-in-depth for both
// cookie-authenticated web clients and native clients using a secure-storage bearer token:
// `connect-src` restricts where script can send data and `script-src 'self'`
// (no 'unsafe-inline') stops injected inline script from running in the first place.
//
// connect-src is derived from the SAME VITE_API_URL the app uses (client.ts), so the policy
// can never be stricter than the real API origin and break requests. A meta tag (vs an HTTP
// header) is also Capacitor's recommended CSP delivery — the native bridge is evaluated
// outside page CSP, so this won't break the Android app. Build-only so it never interferes
// with the dev server / HMR websocket.
function cspMetaPlugin(apiUrl: string | undefined): Plugin {
  return {
    name: 'inject-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      let apiOrigin = ''
      try {
        if (apiUrl && /^https?:\/\//i.test(apiUrl)) apiOrigin = new URL(apiUrl).origin
      } catch { /* malformed VITE_API_URL -> treat API as same-origin */ }
      const connectSrc = [
        "'self'",
        apiOrigin,
        'https://firebaseinstallations.googleapis.com',
        'https://fcmregistrations.googleapis.com',
        'https://fcm.googleapis.com',
      ].filter(Boolean).join(' ')
      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        // 'unsafe-inline' covers the inline splash <style> + Radix/Tailwind inline styles.
        // Inter is self-hosted (fontsource), so no Google Fonts hosts are needed.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        `connect-src ${connectSrc}`,
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
      return {
        html,
        tags: [{
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
          injectTo: 'head-prepend',
        }],
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [
    react(), 
    tailwindcss(), 
    cspMetaPlugin(env.VITE_API_URL),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        // Chromium renders `name` under its generated Android splash icon.
        // Keep the required field non-empty but visually blank; `short_name`
        // remains the readable launcher/install label.
        name: '\u200B',
        short_name: 'FinancialApp',
        description: 'Double-entry safe ledger system and financial planning app.',
        id: '/',
        scope: '/',
        start_url: '/',
        // Keep Android's navigation controls immediately available instead of
        // requiring an initial swipe to reveal them from fullscreen mode.
        display: 'standalone',
        // Android uses this fixed value behind its generated install splash.
        background_color: '#0a0d14',
        // The document updates this pre-paint for the user's saved app theme.
        theme_color: '#f6f8fc',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      injectManifest: {
        // Precache only the latin Inter subsets for offline first paint; the other
        // unicode-range subsets are never requested for this app's English UI.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}', '**/inter-latin*.woff2']
      }
    }),
    // Opt-in bundle breakdown: ANALYZE=1 npm run build -> stats.html (not emitted otherwise).
    ...(process.env.ANALYZE ? [visualizer({ filename: 'stats.html', gzipSize: true, brotliSize: true })] : [])
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Custom environment loading a pre-bundled jsdom (single file): endpoint-
    // security file scanning makes jsdom's multi-thousand-file import exceed
    // vitest's 60s worker-start timeout. See scripts/bundle-test-dom.mjs.
    environment: './src/test/bundledDomEnvironment.ts',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // The endpoint scanner makes packages with thousands of modules (especially
    // lucide-react, MSW, and Framer Motion) very slow when Node loads them file by
    // file in each worker. Pre-bundle those stable test dependencies once into
    // Vitest's cache, then workers load the optimized output on later runs.
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: [
            '@testing-library/dom',
            '@testing-library/react',
            'framer-motion',
            'lucide-react',
            'msw',
            'msw/node',
            'react-dom',
          ],
        },
      },
    },
    // Endpoint-security file scanning makes cold in-test dynamic imports slow on
    // some dev machines; the default 5s test timeout produces flaky timeouts there.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Pin the API base URL so MSW handlers can match a stable absolute origin
    // (otherwise client.ts falls back to the relative '/api').
    env: {
      VITE_API_URL: 'http://localhost/api',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split stable, infrequently-changing vendor code into its own chunks so
        // it stays cached across app deploys instead of invalidating with every
        // build alongside app code, and can download in parallel with it.
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('\\react\\')) return 'vendor-react'
            if (id.includes('framer-motion')) return 'vendor-motion'
            if (id.includes('radix-ui') || id.includes('@radix-ui')) return 'vendor-radix'
          }
          // The offline drain/reconciliation state machine changes less often
          // than the app shell and is large enough to benefit from a parallel,
          // independently cached chunk.
          if (id.includes('/src/lib/outboxSync') || id.includes('\\src\\lib\\outboxSync')) return 'sync-engine'
          // Web-push support is used only after authentication and changes independently of
          // the app shell. Keep the orchestration helpers in their own cacheable chunk; the
          // much larger Firebase SDK is additionally loaded on demand by firebaseMessaging.
          if (id.includes('/src/lib/push/') || id.includes('\\src\\lib\\push\\') ||
              id.includes('/src/app/usePushNotifications') || id.includes('\\src\\app\\usePushNotifications')) return 'push-client'
          // DatePicker is shared between the eager app shell (TopNav bell) and
          // several lazy views; keep it in its own parallel-loaded chunk instead
          // of pinning it into the main bundle (mirrors CustomSelect/SearchableSelect).
          if (id.includes('components/ui/DatePicker') || id.includes('components\\ui\\DatePicker')) return 'DatePicker'
        },
      },
    },
  },
  }
})
