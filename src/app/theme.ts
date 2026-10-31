import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
/** localStorage key: kept as 'tema' so users keep the preference they already saved. */
const KEY = 'tema';

function apply(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1a2e' : '#1f56a8');
}

/** Called at boot before the first render, to avoid the light→dark flash. */
export function initTheme() {
  apply((localStorage.getItem(KEY) as Theme) || 'system');
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (((localStorage.getItem(KEY) as Theme) || 'system') === 'system') apply('system');
  });
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, set] = useState<Theme>(() => (localStorage.getItem(KEY) as Theme) || 'system');
  useEffect(() => {
    localStorage.setItem(KEY, theme);
    apply(theme);
  }, [theme]);
  return [theme, set];
}
