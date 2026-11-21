/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    // Must come before the React plugin: it generates src/routeTree.gen.ts from src/routes/.
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routeFileIgnorePattern: '\\.test\\.tsx?$', // tests can live next to routes
    }),
    react(),
    tailwindcss(),
    // Installable app + offline support. See docs/decisions/0020-offline-pwa.md.
    VitePWA({
      registerType: 'autoUpdate', // new versions activate on the next visit, no prompt
      includeAssets: ['puzzle.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Puzzle Log',
        short_name: 'Puzzles',
        description: 'Track the jigsaw puzzles you have done, own and want.',
        start_url: '/',
        display: 'standalone',
        background_color: '#fafaf9',
        theme_color: '#fafaf9',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app, including the ~1 MB barcode decoder, so it opens and
        // scans offline. (Workbox's default limit is 2 MB per file.)
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Any page URL (/puzzles/abc, /scan/…, the login callback) loads the app shell.
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Puzzle photos from S3. Their signed URLs change every hour, so cache by the
            // photo itself (the URL without its signature) and keep it until evicted.
            urlPattern: ({ url }) =>
              url.hostname.includes('.s3.') && url.pathname.startsWith('/uploads/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'puzzle-photos',
              expiration: { maxEntries: 500, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
              plugins: [
                {
                  cacheKeyWillBeUsed: async ({ request }) => {
                    const url = new URL(request.url);
                    return url.origin + url.pathname;
                  },
                },
              ],
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Forward /api calls to the backend during development so there are no CORS issues.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
});
