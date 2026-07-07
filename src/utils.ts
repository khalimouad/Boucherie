import type { Lang } from './i18n';

/** Read an image File, downscale/crop it to a square dataURL kept small enough
 * for IndexedDB + cloud sync. Used for product photos and (indirectly) logos. */
export function downscaleImage(file: File, size = 400, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Format a number as Moroccan Dirhams, always 2 decimals: "1 234,56 DH" / "1 234,56 د.م." */
export function fmtDH(n: number, lang: Lang = 'fr'): string {
  const v = (Number.isFinite(n) ? n : 0).toFixed(2);
  const [int, dec] = v.split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = sign ? int.slice(1) : int;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const num = `${sign}${grouped},${dec}`;
  return lang === 'ar' ? `${num} د.م.` : `${num} DH`;
}

/** Format a quantity: up to 3 decimals for kg, integer for pieces. */
export function fmtQty(qty: number, unit: 'kg' | 'piece'): string {
  if (unit === 'piece') return String(Math.round(qty));
  return qty.toFixed(3).replace(/\.?0+$/, '').replace('.', ',');
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Random id, safe outside secure contexts (crypto.randomUUID needs HTTPS). */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/* ---- clock correction ----
   The shop till's clock can be wrong (one photo showed year 2001). The sync
   layer measures the offset against the server clock and we apply it to every
   timestamp we generate. */
const OFFSET_KEY = 'pos-clock-offset';

export function setClockOffset(ms: number) {
  localStorage.setItem(OFFSET_KEY, String(Math.round(ms)));
}

export function getClockOffset(): number {
  const v = Number(localStorage.getItem(OFFSET_KEY));
  return Number.isFinite(v) ? v : 0;
}

export function nowMs(): number {
  return Date.now() + getClockOffset();
}

export function todayISO(): string {
  return new Date(nowMs()).toISOString();
}

export function startOfDay(d = new Date(nowMs())): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmtDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  return d.toLocaleString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: 'latn',
  } as Intl.DateTimeFormatOptions);
}

export function fmtDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    numberingSystem: 'latn',
  } as Intl.DateTimeFormatOptions);
}

export function genTicketNumber(): string {
  const d = new Date(nowMs());
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rnd = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `${ymd}-${rnd}`;
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c);
          return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(';'),
    )
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
