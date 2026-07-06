import type { CashSession, Sale, TicketSettings } from './db';
import { fmtDH, fmtQty, fmtDateTime } from './utils';
import { printSaleViaBridge } from './printBridge';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Build the printable ticket HTML for a sale, following the ticket design settings. */
export function buildTicketHTML(sale: Sale, ts: TicketSettings, duplicate = false): string {
  const widthMM = ts.paperWidth === '58' ? 58 : 80;
  const baseFont = ts.fontSize === 'small' ? 10 : ts.fontSize === 'large' ? 14 : 12;
  const fr = ts.ticketLang === 'fr' || ts.ticketLang === 'both';
  const ar = ts.ticketLang === 'ar' || ts.ticketLang === 'both';

  const bi = (frTxt: string, arTxt: string) => {
    const parts: string[] = [];
    if (fr && frTxt) parts.push(esc(frTxt));
    if (ar && arTxt && arTxt !== frTxt) parts.push(esc(arTxt));
    return parts.join(' — ');
  };

  const lines = sale.items
    .map((it) => {
      const name = bi(it.nameFr, it.nameAr);
      const unitLabel = it.unit === 'kg' ? 'kg' : fr ? 'pc' : 'حبة';
      return `<tr>
        <td class="item-name">${name}</td>
      </tr>
      <tr class="item-detail">
        <td>
          <span>${fmtQty(it.qty, it.unit)} ${unitLabel} × ${fmtDH(it.unitPrice, 'fr')}</span>
          <span class="line-total">${fmtDH(it.total, 'fr')}</span>
        </td>
      </tr>`;
    })
    .join('');

  const payLabel: Record<string, [string, string]> = {
    cash: ['Espèces', 'كاش'],
    card: ['Carte', 'بطاقة'],
    credit: ['Crédit', 'كريدي'],
  };
  const [payFr, payAr] = payLabel[sale.payment] ?? payLabel.cash;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: ${widthMM}mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${widthMM}mm;
    font-family: 'Courier New', 'Arial', monospace;
    font-size: ${baseFont}px;
    color: #000;
    padding: 3mm 2.5mm 6mm;
  }
  .center { text-align: center; }
  .logo { max-width: ${widthMM - 20}mm; max-height: 22mm; margin: 0 auto 2mm; display: block; }
  .shop-fr { font-size: ${baseFont + 4}px; font-weight: bold; }
  .shop-ar { font-size: ${baseFont + 3}px; font-weight: bold; direction: rtl; }
  .meta { margin-top: 1.5mm; font-size: ${baseFont - 1}px; }
  .sep { border-top: 1px dashed #000; margin: 2mm 0; }
  table { width: 100%; border-collapse: collapse; }
  .item-name { font-weight: bold; padding-top: 1mm; }
  .item-detail td { padding-bottom: 0.5mm; }
  .item-detail td { display: flex; justify-content: space-between; }
  .totals div { display: flex; justify-content: space-between; padding: 0.4mm 0; }
  .grand { font-size: ${baseFont + 4}px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 1mm 0 !important; margin: 1mm 0; }
  .footer { margin-top: 3mm; text-align: center; font-size: ${baseFont - 1}px; }
  .ar { direction: rtl; }
  .dup { border: 1px solid #000; text-align:center; font-weight: bold; margin: 1mm 0; padding: 0.5mm; }
</style>
</head>
<body>
  <div class="center">
    ${ts.showLogo && ts.logo ? `<img class="logo" src="${ts.logo}" alt="">` : ''}
    ${fr ? `<div class="shop-fr">${esc(ts.shopNameFr)}</div>` : ''}
    ${ar ? `<div class="shop-ar">${esc(ts.shopNameAr)}</div>` : ''}
    ${ts.showAddress && ts.address ? `<div class="meta">${esc(ts.address)}</div>` : ''}
    ${ts.showPhone && ts.phone ? `<div class="meta">${fr ? 'Tél' : 'الهاتف'}: ${esc(ts.phone)}</div>` : ''}
    ${ts.headerFr && fr ? `<div class="meta">${esc(ts.headerFr)}</div>` : ''}
    ${ts.headerAr && ar ? `<div class="meta ar">${esc(ts.headerAr)}</div>` : ''}
  </div>
  ${duplicate ? `<div class="dup">${bi('DUPLICATA', 'نسخة')}</div>` : ''}
  <div class="sep"></div>
  <div class="meta">
    <div>${bi('Ticket', 'تيكي')} N° ${esc(sale.number)}</div>
    <div>${fmtDateTime(sale.date, 'fr')}</div>
    ${ts.showCashier ? `<div>${bi('Caissier', 'الكاسّي')}: ${esc(sale.userName)}</div>` : ''}
  </div>
  <div class="sep"></div>
  <table>${lines}</table>
  <div class="sep"></div>
  <div class="totals">
    ${
      sale.discount > 0
        ? `<div><span>${bi('Sous-total', 'المجموع الجزئي')}</span><span>${fmtDH(sale.subtotal, 'fr')}</span></div>
           <div><span>${bi('Remise', 'تخفيض')}</span><span>-${fmtDH(sale.discount, 'fr')}</span></div>`
        : ''
    }
    <div class="grand"><span>${bi('TOTAL', 'المجموع')}</span><span>${fmtDH(sale.total, 'fr')}</span></div>
    <div><span>${bi(payFr, payAr)}</span><span>${fmtDH(sale.paid, 'fr')}</span></div>
    ${sale.change > 0 ? `<div><span>${bi('Monnaie', 'الصرف')}</span><span>${fmtDH(sale.change, 'fr')}</span></div>` : ''}
  </div>
  <div class="footer">
    ${ts.footerFr && fr ? `<div>${esc(ts.footerFr)}</div>` : ''}
    ${ts.footerAr && ar ? `<div class="ar">${esc(ts.footerAr)}</div>` : ''}
  </div>
</body>
</html>`;
}

/** Print an HTML document through a hidden iframe (works on touch kiosks and mobile). */
export function printHTML(html: string) {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '100%';
  frame.style.bottom = '100%';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      setTimeout(() => frame.remove(), 2000);
    }
  };
  frame.onload = doPrint;
  // Fallback if onload already fired before the handler was attached
  setTimeout(doPrint, 400);
}

/** Tries the local print bridge first (silent, no dialog, can kick the cash
 * drawer); falls back to the browser's print dialog when it's not configured
 * or unreachable, so printing keeps working even without the bridge installed. */
export async function printSaleTicket(sale: Sale, ts: TicketSettings, duplicate = false) {
  const ok = await printSaleViaBridge(sale, ts, duplicate).catch(() => false);
  if (!ok) printHTML(buildTicketHTML(sale, ts, duplicate));
}

/** End-of-shift cash reconciliation report — printed via the browser dialog
 * (occasional/administrative document, not part of the per-sale fast path). */
export function printSessionReport(session: CashSession, ts: TicketSettings) {
  const widthMM = ts.paperWidth === '58' ? 58 : 80;
  const fr = ts.ticketLang === 'fr' || ts.ticketLang === 'both';
  const ar = ts.ticketLang === 'ar' || ts.ticketLang === 'both';
  const bi = (a: string, b: string) => [fr ? a : '', ar ? b : ''].filter(Boolean).join(' — ');
  const row = (a: string, b: string, grand = false) =>
    `<div class="row${grand ? ' grand' : ''}"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;
  const diff = session.difference ?? 0;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @page { size: ${widthMM}mm auto; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${widthMM}mm; font-family:'Courier New',monospace; font-size:12px; padding:3mm 2.5mm 6mm; }
  .center { text-align:center; }
  .title { font-size:15px; font-weight:bold; margin-bottom:2mm; }
  .sep { border-top:1px dashed #000; margin:2mm 0; }
  .row { display:flex; justify-content:space-between; padding:0.6mm 0; }
  .grand { font-weight:bold; font-size:14px; border-top:1px solid #000; border-bottom:1px solid #000; padding:1mm 0; margin-top:1mm; }
  .diff { text-align:center; font-weight:bold; font-size:14px; margin-top:2mm; padding:1mm; border:1px solid #000; }
</style></head><body>
  <div class="center title">${esc(bi('Rapport de caisse', 'تقرير الصندوق'))}</div>
  <div class="sep"></div>
  ${row(bi('Ouverture', 'الحل'), fmtDateTime(session.openedAt, 'fr'))}
  ${row(bi('Ouvert par', 'من طرف'), session.openedByName)}
  ${session.closedAt ? row(bi('Fermeture', 'السد'), fmtDateTime(session.closedAt, 'fr')) : ''}
  ${session.closedByName ? row(bi('Fermé par', 'من طرف'), session.closedByName) : ''}
  <div class="sep"></div>
  ${row(bi('Fond de départ', 'مبلغ البداية'), fmtDH(session.openingAmount, 'fr'))}
  ${row(bi('Ventes espèces', 'مبيعات الكاش'), fmtDH(session.cashSalesTotal ?? 0, 'fr'))}
  ${row(bi('Entrées', 'دخول'), fmtDH(session.cashInTotal ?? 0, 'fr'))}
  ${row(bi('Sorties', 'خروج'), ((session.cashOutTotal ?? 0) > 0 ? '-' : '') + fmtDH(session.cashOutTotal ?? 0, 'fr'))}
  ${row(bi('Attendu', 'المنتظر'), fmtDH(session.expectedAmount ?? 0, 'fr'), true)}
  ${row(bi('Compté', 'المعدود'), fmtDH(session.countedAmount ?? 0, 'fr'))}
  <div class="diff">${esc(bi('Écart', 'الفرق'))}: ${diff >= 0 ? '+' : ''}${fmtDH(diff, 'fr')}</div>
</body></html>`;
  printHTML(html);
}
