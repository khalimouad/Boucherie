import type { Lang } from './i18n';

/** Format a number as Moroccan Dirhams, always 2 decimals: "1 234,56 DH" / "1 234,56 د.م." */
export function fmtDH(n: number, lang: Lang = 'fr'): string {
  const v = (Number.isFinite(n) ? n : 0).toFixed(2);
  const [int, dec] = v.split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = sign ? int.slice(1) : int;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
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

export function todayISO(): string {
  return new Date().toISOString();
}

export function startOfDay(d = new Date()): Date {
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
  const d = new Date();
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
