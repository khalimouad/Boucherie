/** Colour scheme store. The shop chooses light / dark, or follows the device
 * (a till in a bright shop wants light, the manager's phone at night doesn't).
 * The resolved theme is stamped on <html data-theme> so CSS can flip tokens. */

export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'pos-theme';
const listeners = new Set<() => void>();

function read(): ThemeMode {
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

let mode: ThemeMode = read();

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

export function resolveTheme(m: ThemeMode = mode): 'light' | 'dark' {
  if (m !== 'system') return m;
  return media?.matches ? 'dark' : 'light';
}

function apply() {
  const resolved = resolveTheme();
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0d1117' : '#f5f7fa');
}

export function getTheme(): ThemeMode {
  return mode;
}

export function setTheme(m: ThemeMode) {
  mode = m;
  localStorage.setItem(KEY, m);
  apply();
  listeners.forEach((fn) => fn());
}

/** Cycles light → dark → system, which keeps the toggle a single tap. */
export function cycleTheme() {
  setTheme(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light');
}

export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initTheme() {
  apply();
  media?.addEventListener('change', () => {
    if (mode === 'system') {
      apply();
      listeners.forEach((fn) => fn());
    }
  });
}
