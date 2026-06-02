import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api/* to the Express server so the browser sees a single origin.
// This means session cookies "just work" without cross-origin / SameSite drama.
export default defineConfig({
  plugins: [react()],
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
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
      },
    },
  },
});
