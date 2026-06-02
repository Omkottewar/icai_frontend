import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api/* to the Express server so the browser sees a single origin.
// This means session cookies "just work" without cross-origin / SameSite drama.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
