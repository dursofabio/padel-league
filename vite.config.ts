import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: funziona su GitHub Pages sia come sito utente sia come sito di progetto.
// Il routing è hash-based (/#/...), quindi niente 404 al refresh.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: { manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/app-check'], react: ['react', 'react-dom', 'react-router-dom'] } },
    },
    chunkSizeWarningLimit: 700,
  },
  test: { environment: 'node' },
} as any);
