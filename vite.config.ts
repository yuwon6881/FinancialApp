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
      const connectSrc = ["'self'", apiOrigin].filter(Boolean).join(' ')
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
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Financial App',
        short_name: 'FinancialApp',
        description: 'Double-entry safe ledger system and financial planning app.',
        id: '/',
        scope: '/',
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0d14',
        theme_color: '#0a0d14',
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
      workbox: {
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
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
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
