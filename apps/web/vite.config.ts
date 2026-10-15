import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const apiTarget = process.env['VITE_API_PROXY_TARGET'] ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Defensores del Toqui — Registro E-1',
        short_name: 'Toqui E-1',
        description: 'Copiloto de registro de observaciones para educadoras (datos sintéticos).',
        lang: 'es-CL',
        theme_color: '#D62839',
        background_color: '#FFF9F2',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    // En local, /api/* se redirige a la API para evitar CORS.
    proxy: {
      '/api': { target: apiTarget, rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
