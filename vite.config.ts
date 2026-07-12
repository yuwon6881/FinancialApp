/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"
import path from "path"
import { VitePWA } from 'vite-plugin-pwa'

// Inject a Content-Security-Policy <meta> at build time. This is defense-in-depth for the
// Bearer token in localStorage: `connect-src` restricts where script can send data, so even
// an injected script can't exfiltrate the token to an attacker's host; `script-src 'self'`
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
        // 'unsafe-inline' covers the inline splash <style> + Radix/Tailwind inline styles;
        // fonts.googleapis.com is the Google Fonts stylesheet host.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob:",
        "font-src 'self' data: https://fonts.gstatic.com",
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
        short_name: 'Finance',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
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
        },
      },
    },
  },
  }
})
