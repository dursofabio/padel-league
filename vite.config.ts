import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base: works on GitHub Pages as a user or project site. Hash routing (/#/...): no 404 on refresh.
export default defineConfig({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Padel League',
        short_name: 'Padel',
        description: 'Campionato di padel: disponibilità, campi, risultati e classifiche.',
        lang: 'it',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f4f7fb',
        theme_color: '#1f56a8',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      // offline shell only: data always comes from Supabase. Only the initial chunks are precached;
      // the role areas (organizer, court manager…) are cached on first visit, not downloaded by everyone.
      workbox: {
        globPatterns: ['index.html', 'icon.svg', 'assets/index-*.{js,css}', 'assets/react-*.js', 'assets/supabase-*.js', 'assets/*.woff2'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          { urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style', handler: 'StaleWhileRevalidate', options: { cacheName: 'chunk' } },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'], supabase: ['@supabase/supabase-js'] } } },
  },
  test: { environment: 'node' },
} as never);
