import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Filter the noisy "ws proxy socket error: write ECONNABORTED" lines.
// Vite attaches its error listener directly on the per-upgrade socket
// inside `proxyReqWs` — that listener can't be removed from the proxy
// object, so the only clean way to silence the noise is to wrap the
// logger Vite uses. These errors are harmless races between the
// backend's rejection response and the browser tearing down the WS
// upgrade attempt; the chat client handles them via WS close + backoff.
const quietLogger = createLogger();
const originalError = quietLogger.error.bind(quietLogger);
quietLogger.error = (msg, options) => {
  if (typeof msg === 'string' && (
    msg.includes('ws proxy socket error') ||
    msg.includes('ECONNABORTED') ||
    msg.includes('socket hang up')
  )) {
    return;
  }
  originalError(msg, options);
};

// Proxy /api/* to the Express server so the browser sees a single origin.
// This means session cookies "just work" without cross-origin / SameSite drama.
export default defineConfig({
  customLogger: quietLogger,
  plugins: [
    react(),
    // Installable-shell PWA.
    //   - Auto-updates the SW when a new build ships (registerType:'autoUpdate').
    //   - Precaches the Vite-built static assets so the shell launches even
    //     on a flaky connection; API responses are NOT cached (NetworkOnly)
    //     because almost everything in this app — auth, payments, registrations
    //     — needs fresh data.
    //   - PWA disabled in dev so the SW doesn't interfere with HMR. Enable
    //     with `devOptions.enabled: true` if you ever need to debug it locally.
    VitePWA({
      // injectManifest lets us own the service worker (src/sw.js) so we can
      // add `push` + `notificationclick` listeners alongside Workbox's
      // precaching. The default 'generateSW' strategy doesn't expose those.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      // Register the SW in dev too — otherwise navigator.serviceWorker.ready
      // hangs forever and push enable fails with the generic "Server push is
      // not configured" error. Modern VitePWA + Vite no longer conflict with
      // HMR in dev (the older guidance to leave this off is obsolete).
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'ICAI Nagpur Branch',
        short_name: 'ICAI Nagpur',
        description: 'Official portal of the Nagpur Branch of WIRC of ICAI — events, CPE, members, and committees.',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'en-IN',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Don't bother precaching /api or /uploads — they need to hit network.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  server: {
    // Pin Vite's HMR socket explicitly. When a `ws: true` proxy entry is
    // present (see /ws below), Vite's default HMR auto-detection can fall
    // back to ws://host/ which is the same upgrade slot the proxy now owns —
    // causing the "WebSocket connection to ws://localhost:5173/ failed"
    // error in the browser console. Setting `host` + `clientPort` makes the
    // HMR client connect to a stable URL that the proxy doesn't touch.
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      clientPort: 5173,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // WebSocket upgrade path for the event chat. `ws: true` forwards the
      // HTTP/1.1 Upgrade handshake to the API server.
      //
      // The `configure` hook silences the noisy "write ECONNABORTED"
      // proxy errors that fire whenever the backend rejects a WS upgrade
      // (401/403/404 from eventChatSocket.ts). The backend writes a
      // proper HTTP rejection response onto the upstream socket; by the
      // time the proxy tries to forward it downstream, the browser has
      // already torn down the WS attempt — ECONNABORTED. Harmless: the
      // chat client sees the WS close and either retries with backoff
      // or gives up via MAX_WS_ATTEMPTS. We just don't need the stack
      // trace in the dev log every few seconds.
      //
      // We defer attaching our own handler with setImmediate so it runs
      // AFTER Vite has installed its built-in error logger; the strategy
      // is "remove Vite's loud handler, install our quiet one."
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
        configure: (proxy) => {
          setImmediate(() => {
            proxy.removeAllListeners('error');
            proxy.on('error', (err) => {
              const code = err?.code || '';
              const msg  = err?.message || '';
              // Benign races during upgrade rejection:
              if (
                code === 'ECONNABORTED' ||
                code === 'ECONNRESET'   ||
                code === 'EPIPE'        ||
                msg.includes('ECONNABORTED') ||
                msg.includes('socket hang up')
              ) {
                return;
              }
              // Real proxy error — keep one line, no stack.
              // eslint-disable-next-line no-console
              console.warn('[ws proxy]', msg || code);
            });
          });
        },
      },
    },
  },
});
