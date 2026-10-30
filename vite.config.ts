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
      // offline shell only: data always comes from Supabase
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'], navigateFallback: 'index.html' },
    }),
  ],
  build: {
    rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], supabase: ['@supabase/supabase-js'] } } },
  },
  test: { environment: 'node' },
} as never);
