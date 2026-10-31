import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { initTheme } from './app/theme';
import { AuthProvider } from './auth/AuthProvider';
import { supabaseConfigured } from './data/supabase';
import './styles/index.css';

initTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    // realtime keeps the data fresh: no frantic refetching
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {supabaseConfigured ? (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    ) : (
      <main className="mx-auto grid max-w-prose gap-3 p-6">
        <h1 className="poster text-poster">Configurazione mancante</h1>
        <p>
          Imposta <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (vedi <code>.env.example</code> e il
          README) e ricompila l’app.
        </p>
      </main>
    )}
  </StrictMode>,
);
