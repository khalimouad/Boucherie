import type { Sale, TicketSettings } from './db';
import { fmtDH, fmtDateTime, fmtQty } from './utils';

const DOTS = { '58': 384, '80': 576 } as const;
const ESC = 0x1b;
const GS = 0x1d;

function bi(ts: TicketSettings, fr: string, ar: string): string {
  const useFr = ts.ticketLang === 'fr' || ts.ticketLang === 'both';
  const useAr = ts.ticketLang === 'ar' || ts.ticketLang === 'both';
  const parts: string[] = [];
  if (useFr && fr) parts.push(fr);
  if (useAr && ar && ar !== fr) parts.push(ar);
  return parts.join(' — ');
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Draws the ticket onto a 2D context and returns the final content height.
 * Text is rendered via canvas (not printer fonts) so Arabic always shapes
 * correctly regardless of the printer's built-in code pages.
 */
function draw(ctx: CanvasRenderingContext2D, width: number, sale: Sale, ts: TicketSettings, duplicate: boolean, logo: HTMLImageElement | null): number {
  const pad = 14;
  const baseFont = ts.fontSize === 'small' ? 22 : ts.fontSize === 'large' ? 30 : 26;
  let y = 14;

  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';

  const line = (text: string, size = baseFont, weight: 'normal' | 'bold' = 'normal', align: CanvasTextAlign = 'left') => {
    if (!text) return;
    ctx.font = `${weight} ${size}px "Noto Sans Arabic", Arial, sans-serif`;
    ctx.textAlign = align;
    const x = align === 'center' ? width / 2 : align === 'right' ? width - pad : pad;
    ctx.fillText(text, x, y);
    y += Math.round(size * 1.4);
  };

  const rule = () => {
    y += 4;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 16;
  };

  const row = (left: string, right: string, size = baseFont - 2, weight: 'normal' | 'bold' = 'normal') => {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(left, pad, y);
    ctx.textAlign = 'right';
    ctx.fillText(right, width - pad, y);
    y += Math.round(size * 1.45);
  };

  if (ts.showLogo && logo) {
    const maxW = width - pad * 2;
    const scale = Math.min(1, maxW / logo.width);
    const w = logo.width * scale;
    const h = logo.height * scale;
    ctx.drawImage(logo, (width - w) / 2, y, w, h);
    y += h + 10;
  }

  const fr = ts.ticketLang === 'fr' || ts.ticketLang === 'both';
  const ar = ts.ticketLang === 'ar' || ts.ticketLang === 'both';
  if (fr && ts.shopNameFr) line(ts.shopNameFr, baseFont + 8, 'bold', 'center');
  if (ar && ts.shopNameAr) line(ts.shopNameAr, baseFont + 6, 'bold', 'center');
  if (ts.showAddress && ts.address) line(ts.address, baseFont - 4, 'normal', 'center');
  if (ts.showPhone && ts.phone) line((fr ? 'Tél: ' : 'الهاتف: ') + ts.phone, baseFont - 4, 'normal', 'center');
  if (ts.headerFr && fr) line(ts.headerFr, baseFont - 4, 'normal', 'center');
  if (ts.headerAr && ar) line(ts.headerAr, baseFont - 4, 'normal', 'center');

  if (duplicate) {
    y += 4;
    line(bi(ts, 'DUPLICATA', 'نسخة'), baseFont, 'bold', 'center');
  }

  rule();
  line(`${bi(ts, 'Ticket', 'تيكي')} N° ${sale.number}`, baseFont - 2);
  line(fmtDateTime(sale.date, 'fr'), baseFont - 2);
  if (ts.showCashier) line(`${bi(ts, 'Caissier', 'الكاسّي')}: ${sale.userName}`, baseFont - 2);
  rule();

  for (const it of sale.items) {
    line(bi(ts, it.nameFr, it.nameAr), baseFont - 2, 'bold');
    const unitLabel = it.unit === 'kg' ? 'kg' : fr ? 'pc' : 'حبة';
    row(`${fmtQty(it.qty, it.unit)} ${unitLabel} × ${fmtDH(it.unitPrice, 'fr')}`, fmtDH(it.total, 'fr'), baseFont - 4);
  }
  rule();

  if (sale.discount > 0) {
    row(bi(ts, 'Sous-total', 'المجموع الجزئي'), fmtDH(sale.subtotal, 'fr'));
    row(bi(ts, 'Remise', 'تخفيض'), `-${fmtDH(sale.discount, 'fr')}`);
  }
  row(bi(ts, 'TOTAL', 'المجموع'), fmtDH(sale.total, 'fr'), baseFont + 4, 'bold');
  const payLabel = { cash: ['Espèces', 'كاش'], card: ['Carte', 'بطاقة'], credit: ['Crédit', 'كريدي'] }[sale.payment];
  row(bi(ts, payLabel[0], payLabel[1]), fmtDH(sale.paid, 'fr'), baseFont - 2);
  if (sale.change > 0) row(bi(ts, 'Monnaie', 'الصرف'), fmtDH(sale.change, 'fr'), baseFont - 2);

  y += 10;
  if (ts.footerFr && fr) line(ts.footerFr, baseFont - 4, 'normal', 'center');
  if (ts.footerAr && ar) line(ts.footerAr, baseFont - 4, 'normal', 'center');
  y += 20;
  return y;
}

export async function renderTicketCanvas(sale: Sale, ts: TicketSettings, duplicate = false): Promise<HTMLCanvasElement> {
  const width = DOTS[ts.paperWidth];
  let logo: HTMLImageElement | null = null;
  if (ts.showLogo && ts.logo) {
    try {
      logo = await loadImage(ts.logo);
    } catch {
      logo = null;
    }
  }

  // dry run on a tall scratch canvas just to learn the real content height
  const scratch = document.createElement('canvas');
  scratch.width = width;
  scratch.height = 4000;
  const height = draw(scratch.getContext('2d')!, width, sale, ts, duplicate, logo);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  draw(ctx, width, sale, ts, duplicate, logo);
  return canvas;
}

function concatBytes(chunks: (Uint8Array | number[])[]): Uint8Array {
  const arrs = chunks.map((c) => (c instanceof Uint8Array ? c : new Uint8Array(c)));
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

/** 1-bit-per-pixel packing, MSB first, as required by the ESC/POS raster image command. */
function canvasToRaster(canvas: HTMLCanvasElement): { widthBytes: number; heightPx: number; data: Uint8Array } {
  const { width, height } = canvas;
  const img = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
  const widthBytes = Math.ceil(width / 8);
  const data = new Uint8Array(widthBytes * height);
  for (let y = 0; y < height; y++) {
    const rowOff = y * widthBytes;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = img[i + 3];
      const lum = a === 0 ? 255 : img[i] * 0.3 + img[i + 1] * 0.59 + img[i + 2] * 0.11;
      if (lum < 200) data[rowOff + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { widthBytes, heightPx: height, data };
}

// Some clone firmwares choke on one giant GS v 0 command; send tall images in bands.
const MAX_BAND_PX = 240;

/** Cash drawers hang off the printer's RJ11 port; this is the standard ESC/POS pulse. */
export function drawerKickBytes(): Uint8Array {
  return new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xfa]);
}

export function buildTicketJob(canvas: HTMLCanvasElement, opts: { openDrawer?: boolean } = {}): Uint8Array {
  const { widthBytes, heightPx, data } = canvasToRaster(canvas);
  const parts: (Uint8Array | number[])[] = [[ESC, 0x40]]; // initialize
  for (let y = 0; y < heightPx; y += MAX_BAND_PX) {
    const bandH = Math.min(MAX_BAND_PX, heightPx - y);
    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = bandH & 0xff;
    const yH = (bandH >> 8) & 0xff;
    parts.push([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
    parts.push(data.subarray(y * widthBytes, (y + bandH) * widthBytes));
  }
  parts.push([0x0a, 0x0a, 0x0a]); // feed for tear-off margin
  parts.push([GS, 0x56, 0x01]); // partial cut
  if (opts.openDrawer) parts.push(drawerKickBytes());
  return concatBytes(parts);
}

export async function buildSaleTicketJob(sale: Sale, ts: TicketSettings, opts: { duplicate?: boolean; openDrawer?: boolean } = {}): Promise<Uint8Array> {
  const canvas = await renderTicketCanvas(sale, ts, opts.duplicate);
  return buildTicketJob(canvas, { openDrawer: opts.openDrawer });
}
