import { useEffect, useState } from 'react';

export type Tema = 'system' | 'light' | 'dark';
const KEY = 'tema';

function applica(t: Tema) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1a2e' : '#1f56a8');
}

/** Called at boot before the first render, to avoid the light→dark flash. */
export function initTema() {
  applica((localStorage.getItem(KEY) as Tema) || 'system');
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (((localStorage.getItem(KEY) as Tema) || 'system') === 'system') applica('system');
  });
}

export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, set] = useState<Tema>(() => (localStorage.getItem(KEY) as Tema) || 'system');
  useEffect(() => {
    localStorage.setItem(KEY, tema);
    applica(tema);
  }, [tema]);
  return [tema, set];
}
