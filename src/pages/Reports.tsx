import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getTicketSettings, type CashSession, type Sale } from '../db';
import { localName, useI18n } from '../i18n';
import { dateInputValue, downloadCSV, fmtDH, fmtDateTime, round2, startOfDay } from '../utils';
import { Empty, Modal, useToast } from '../components/shared';
import { printSaleTicket, printSessionReport } from '../print';
import { REASONS } from './Waste';

type Tab = 'sales' | 'purchases' | 'waste' | 'sessions';
type Range = 'today' | 'week' | 'month' | 'custom';

export default function Reports() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('sales');
  const [range, setRange] = useState<Range>('today');
  const [fromStr, setFromStr] = useState(dateInputValue(new Date()));
  const [toStr, setToStr] = useState(dateInputValue(new Date()));
  const [detail, setDetail] = useState<Sale | null>(null);

  const [fromISO, toISO] = useMemo(() => {
    const now = new Date();
    if (range === 'today') return [startOfDay(now).toISOString(), now.toISOString()];
    if (range === 'week') {
      const f = startOfDay(new Date(now.getTime() - 6 * 86400000));
      return [f.toISOString(), now.toISOString()];
    }
    if (range === 'month') {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      return [f.toISOString(), now.toISOString()];
    }
    const f = startOfDay(new Date(fromStr + 'T00:00:00'));
    const tt = new Date(toStr + 'T23:59:59.999');
    return [f.toISOString(), tt.toISOString()];
  }, [range, fromStr, toStr]);

  const sales = useLiveQuery(() => db.sales.where('date').between(fromISO, toISO, true, true).toArray(), [fromISO, toISO]) ?? [];
  const purchases = useLiveQuery(() => db.purchases.where('date').between(fromISO, toISO, true, true).toArray(), [fromISO, toISO]) ?? [];
  const waste = useLiveQuery(() => db.waste.where('date').between(fromISO, toISO, true, true).toArray(), [fromISO, toISO]) ?? [];
  const sessions = useLiveQuery(() => db.cashSessions.where('openedAt').between(fromISO, toISO, true, true).reverse().toArray(), [fromISO, toISO]) ?? [];
  const [sessionDetail, setSessionDetail] = useState<CashSession | null>(null);

  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const productsMap = useMemo(() => new Map(products.map((p) => [p.id!, p])), [products]);
  // approximate cost of goods sold using current product cost
  const costOf = (productId: string): number => productsMap.get(productId)?.cost ?? 0;

  const doneSales = sales.filter((s) => s.status === 'done');
  const revenue = round2(doneSales.reduce((s, x) => s + x.total, 0));
  const purchasesTotal = round2(purchases.reduce((s, x) => s + x.total, 0));
  const wasteTotal = round2(waste.reduce((s, x) => s + x.value, 0));
  const wasteRate = purchasesTotal > 0 ? (wasteTotal / purchasesTotal) * 100 : 0;
  const cogs = round2(doneSales.reduce((s, x) => s + x.items.reduce((a, it) => a + it.qty * costOf(it.productId), 0), 0));

  /* aggregations */
  const byProduct = useMemo(() => {
    const m = new Map<string, { nameFr: string; nameAr: string; qty: number; total: number; unit: 'kg' | 'piece' }>();
    for (const s of doneSales)
      for (const it of s.items) {
        const cur = m.get(it.productId) ?? { nameFr: it.nameFr, nameAr: it.nameAr, qty: 0, total: 0, unit: it.unit };
        cur.qty += it.qty;
        cur.total = round2(cur.total + it.total);
        m.set(it.productId, cur);
      }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [doneSales]);

  const byPayment = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of doneSales) m.set(s.payment, round2((m.get(s.payment) ?? 0) + s.total));
    return m;
  }, [doneSales]);

  const byCashier = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    for (const s of doneSales) {
      const cur = m.get(s.userName) ?? { count: 0, total: 0 };
      cur.count++;
      cur.total = round2(cur.total + s.total);
      m.set(s.userName, cur);
    }
    return [...m.entries()];
  }, [doneSales]);

  const wasteByProduct = useMemo(() => {
    const m = new Map<string, { nameFr: string; nameAr: string; qty: number; value: number; unit: 'kg' | 'piece' }>();
    for (const w of waste) {
      const cur = m.get(w.productId) ?? { nameFr: w.nameFr, nameAr: w.nameAr, qty: 0, value: 0, unit: w.unit };
      cur.qty += w.qty;
      cur.value = round2(cur.value + w.value);
      m.set(w.productId, cur);
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  }, [waste]);

  const wasteByReason = useMemo(() => {
    const m = new Map<string, { qty: number; value: number }>();
    for (const w of waste) {
      const cur = m.get(w.reason) ?? { qty: 0, value: 0 };
      cur.qty += w.qty;
      cur.value = round2(cur.value + w.value);
      m.set(w.reason, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [waste]);

  const purchasesBySupplier = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    for (const p of purchases) {
      const cur = m.get(p.supplierName) ?? { count: 0, total: 0 };
      cur.count++;
      cur.total = round2(cur.total + p.total);
      m.set(p.supplierName, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [purchases]);

  const payLabel = (p: string) => (p === 'cash' ? t('cash') : p === 'card' ? t('card') : t('credit'));
  const reasonLabel = (id: string) => {
    const r = REASONS.find((x) => x.id === id);
    return r ? `${r.icon} ${t(r.key)}` : id;
  };

  const voidSale = async (s: Sale) => {
    if (!confirm(t('confirmDelete'))) return;
    await db.transaction('rw', db.sales, db.products, async () => {
      for (const it of s.items) {
        const p = await db.products.get(it.productId);
        if (p) await db.products.update(it.productId, { stock: round2(p.stock + it.qty) });
      }
      await db.sales.update(s.id!, { status: 'void' });
    });
    setDetail(null);
    toast(t('voided'));
  };

  const exportSales = () => {
    downloadCSV(`ventes_${fromStr}_${toStr}.csv`, [
      ['Ticket', 'Date', 'Caissier', 'Paiement', 'Sous-total', 'Remise', 'Total', 'Statut'],
      ...sales.map((s) => [s.number, fmtDateTime(s.date, 'fr'), s.userName, s.payment, s.subtotal.toFixed(2), s.discount.toFixed(2), s.total.toFixed(2), s.status]),
    ]);
  };
  const exportWaste = () => {
    downloadCSV(`freinte_${fromStr}_${toStr}.csv`, [
      ['Date', 'Produit', 'المنتج', 'Quantité', 'Coût unitaire', 'Valeur', 'Motif', 'Utilisateur'],
      ...waste.map((w) => [fmtDateTime(w.date, 'fr'), w.nameFr, w.nameAr, w.qty, w.unitCost.toFixed(2), w.value.toFixed(2), w.reason, w.userName]),
    ]);
  };

  return (
    <div>
      <div className="page-head">
        <div className="seg">
          <button className={tab === 'sales' ? 'on' : ''} onClick={() => setTab('sales')}>💵 {t('salesReport')}</button>
          <button className={tab === 'purchases' ? 'on' : ''} onClick={() => setTab('purchases')}>🚚 {t('purchasesReport')}</button>
          <button className={tab === 'waste' ? 'on' : ''} onClick={() => setTab('waste')}>⚖️ {t('wasteReport')}</button>
          <button className={tab === 'sessions' ? 'on' : ''} onClick={() => setTab('sessions')}>🗄️ {t('cashSessionsReport')}</button>
        </div>
        <div className="ph-actions">
          {tab === 'sales' && <button className="btn btn-ghost" onClick={exportSales}>⬇ {t('exportCsv')}</button>}
          {tab === 'waste' && <button className="btn btn-ghost" onClick={exportWaste}>⬇ {t('exportCsv')}</button>}
        </div>
      </div>

      <div className="filters">
        <div className="seg">
          <button className={range === 'today' ? 'on' : ''} onClick={() => setRange('today')}>{t('today')}</button>
          <button className={range === 'week' ? 'on' : ''} onClick={() => setRange('week')}>{t('week')}</button>
          <button className={range === 'month' ? 'on' : ''} onClick={() => setRange('month')}>{t('month')}</button>
          <button className={range === 'custom' ? 'on' : ''} onClick={() => setRange('custom')}>📅</button>
        </div>
        {range === 'custom' && (
          <>
            <div className="field">
              <label>{t('from')}</label>
              <input type="date" value={fromStr} onChange={(e) => setFromStr(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('to')}</label>
              <input type="date" value={toStr} onChange={(e) => setToStr(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {tab === 'sales' && (
        <>
          <div className="stats-grid">
            <div className="stat green">
              <div className="st-label">{t('revenue')}</div>
              <div className="st-value">{fmtDH(revenue, lang)}</div>
            </div>
            <div className="stat">
              <div className="st-label">{t('salesCount')}</div>
              <div className="st-value">{doneSales.length}</div>
            </div>
            <div className="stat">
              <div className="st-label">{t('avgTicket')}</div>
              <div className="st-value">{fmtDH(doneSales.length ? revenue / doneSales.length : 0, lang)}</div>
            </div>
            <div className="stat amber">
              <div className="st-label">{t('grossMargin')}</div>
              <div className="st-value">{fmtDH(round2(revenue - cogs), lang)}</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card card-pad">
              <h2>{t('byProduct')}</h2>
              {byProduct.length === 0 ? <Empty /> : (
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>{t('product')}</th><th className="num">{t('qtySold')}</th><th className="num">{t('total')}</th></tr></thead>
                    <tbody>
                      {byProduct.map((r, i) => (
                        <tr key={i}>
                          <td>{localName(r, lang)}</td>
                          <td className="num">{r.qty.toFixed(r.unit === 'kg' ? 3 : 0)}</td>
                          <td className="num"><strong>{fmtDH(r.total, lang)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <div className="card card-pad" style={{ marginBottom: 14 }}>
                <h2>{t('byPayment')}</h2>
                {[...byPayment.entries()].map(([p, v]) => (
                  <div key={p} className="switch-row"><span>{payLabel(p)}</span><strong>{fmtDH(v, lang)}</strong></div>
                ))}
                {byPayment.size === 0 && <Empty />}
              </div>
              <div className="card card-pad">
                <h2>{t('byCashier')}</h2>
                {byCashier.map(([name, v]) => (
                  <div key={name} className="switch-row"><span>{name} ({v.count})</span><strong>{fmtDH(v.total, lang)}</strong></div>
                ))}
                {byCashier.length === 0 && <Empty />}
              </div>
            </div>
          </div>

          <div className="card table-wrap" style={{ marginTop: 14 }}>
            {sales.length === 0 ? <Empty icon="🧾" /> : (
              <table className="data">
                <thead>
                  <tr><th>{t('ticketNo')}</th><th>{t('date')}</th><th>{t('user')}</th><th>{t('payment')}</th><th className="num">{t('total')}</th><th></th></tr>
                </thead>
                <tbody>
                  {[...sales].sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
                    <tr key={s.id} className="clickable" onClick={() => setDetail(s)}>
                      <td>{s.number} {s.status === 'void' && <span className="badge gray">{t('voided')}</span>}</td>
                      <td>{fmtDateTime(s.date, lang)}</td>
                      <td>{s.userName}</td>
                      <td>{payLabel(s.payment)}</td>
                      <td className="num"><strong>{fmtDH(s.total, lang)}</strong></td>
                      <td>›</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'purchases' && (
        <>
          <div className="stats-grid">
            <div className="stat red">
              <div className="st-label">{t('purchasesTotal')}</div>
              <div className="st-value">{fmtDH(purchasesTotal, lang)}</div>
            </div>
            <div className="stat">
              <div className="st-label">{t('purchasesReport')}</div>
              <div className="st-value">{purchases.length}</div>
            </div>
          </div>
          <div className="card card-pad">
            <h2>{t('bySupplier')}</h2>
            {purchasesBySupplier.map(([name, v]) => (
              <div key={name} className="switch-row"><span>{name} ({v.count})</span><strong>{fmtDH(v.total, lang)}</strong></div>
            ))}
            {purchasesBySupplier.length === 0 && <Empty icon="🚚" />}
          </div>
        </>
      )}

      {tab === 'waste' && (
        <>
          <div className="stats-grid">
            <div className="stat red">
              <div className="st-label">{t('wasteTotal')} (كسور)</div>
              <div className="st-value">{fmtDH(wasteTotal, lang)}</div>
            </div>
            <div className="stat amber">
              <div className="st-label">{t('wasteRate')}</div>
              <div className="st-value">{wasteRate.toFixed(1).replace('.', ',')} %</div>
              <div className="st-sub">{t('wasteRateHint')}</div>
            </div>
            <div className="stat">
              <div className="st-label">{t('purchasesTotal')}</div>
              <div className="st-value">{fmtDH(purchasesTotal, lang)}</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card card-pad">
              <h2>{t('byProduct')}</h2>
              {wasteByProduct.length === 0 ? <Empty icon="⚖️" /> : (
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>{t('product')}</th><th className="num">{t('qtyLost')}</th><th className="num">{t('wasteValue')}</th></tr></thead>
                    <tbody>
                      {wasteByProduct.map((r, i) => (
                        <tr key={i}>
                          <td>{localName(r, lang)}</td>
                          <td className="num">{r.qty.toFixed(r.unit === 'kg' ? 3 : 0)}</td>
                          <td className="num"><strong>{fmtDH(r.value, lang)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="card card-pad">
              <h2>{t('byReason')}</h2>
              {wasteByReason.map(([r, v]) => (
                <div key={r} className="switch-row">
                  <span>{reasonLabel(r)}</span>
                  <strong>{fmtDH(v.value, lang)}</strong>
                </div>
              ))}
              {wasteByReason.length === 0 && <Empty icon="⚖️" />}
            </div>
          </div>
        </>
      )}

      {tab === 'sessions' && (
        <div className="card table-wrap">
          {sessions.length === 0 ? (
            <Empty icon="🗄️" />
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>{t('opening')}</th>
                  <th>{t('by')}</th>
                  <th className="num">{t('openingAmount')}</th>
                  <th>{t('closing')}</th>
                  <th className="num">{t('expectedCash')}</th>
                  <th className="num">{t('countedCash')}</th>
                  <th className="num">{t('cashDifference')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => setSessionDetail(s)}>
                    <td>{fmtDateTime(s.openedAt, lang)}</td>
                    <td>{s.openedByName}</td>
                    <td className="num">{fmtDH(s.openingAmount, lang)}</td>
                    <td>{s.status === 'open' ? <span className="badge amber">{t('ongoing')}</span> : fmtDateTime(s.closedAt!, lang)}</td>
                    <td className="num">{s.expectedAmount !== null ? fmtDH(s.expectedAmount, lang) : '—'}</td>
                    <td className="num">{s.countedAmount !== null ? fmtDH(s.countedAmount, lang) : '—'}</td>
                    <td className="num">
                      {s.difference !== null ? (
                        <span className={`badge ${s.difference === 0 ? 'green' : s.difference > 0 ? 'amber' : 'red'}`}>
                          {s.difference >= 0 ? '+' : ''}{fmtDH(s.difference, lang)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {sessionDetail && (
        <Modal
          title={`🗄️ ${t('cashSession')}`}
          onClose={() => setSessionDetail(null)}
          footer={
            sessionDetail.status === 'closed' ? (
              <button className="btn btn-primary" onClick={async () => printSessionReport(sessionDetail, await getTicketSettings())}>
                🖨 {t('printReport')}
              </button>
            ) : undefined
          }
        >
          <div className="switch-row"><span>{t('opening')}</span><strong>{fmtDateTime(sessionDetail.openedAt, lang)}</strong></div>
          <div className="switch-row"><span>{t('by')}</span><strong>{sessionDetail.openedByName}</strong></div>
          <div className="switch-row"><span>{t('openingAmount')}</span><strong>{fmtDH(sessionDetail.openingAmount, lang)}</strong></div>
          {sessionDetail.status === 'closed' && (
            <>
              <div className="switch-row"><span>{t('closing')}</span><strong>{fmtDateTime(sessionDetail.closedAt!, lang)}</strong></div>
              <div className="switch-row"><span>{t('by')}</span><strong>{sessionDetail.closedByName}</strong></div>
              <div className="switch-row"><span>{t('cashSalesTotal')}</span><strong>{fmtDH(sessionDetail.cashSalesTotal ?? 0, lang)}</strong></div>
              <div className="switch-row"><span>{t('cashIn')}</span><strong>{fmtDH(sessionDetail.cashInTotal ?? 0, lang)}</strong></div>
              <div className="switch-row"><span>{t('cashOut')}</span><strong>{(sessionDetail.cashOutTotal ?? 0) > 0 ? '-' : ''}{fmtDH(sessionDetail.cashOutTotal ?? 0, lang)}</strong></div>
              <div className="switch-row"><span>{t('expectedCash')}</span><strong>{fmtDH(sessionDetail.expectedAmount ?? 0, lang)}</strong></div>
              <div className="switch-row"><span>{t('countedCash')}</span><strong>{fmtDH(sessionDetail.countedAmount ?? 0, lang)}</strong></div>
              <div className="switch-row"><span>{t('cashDifference')}</span><strong>{(sessionDetail.difference ?? 0) >= 0 ? '+' : ''}{fmtDH(sessionDetail.difference ?? 0, lang)}</strong></div>
            </>
          )}
          {sessionDetail.note && <p style={{ marginTop: 10, color: 'var(--text-2)' }}>{sessionDetail.note}</p>}
        </Modal>
      )}

      {detail && (
        <Modal
          title={`🧾 ${t('ticketNo')} ${detail.number}`}
          onClose={() => setDetail(null)}
          footer={
            <>
              {detail.status === 'done' && (
                <button className="btn btn-danger" onClick={() => voidSale(detail)}>🚫 {t('voidSale')}</button>
              )}
              <button className="btn btn-primary" onClick={async () => printSaleTicket(detail, await getTicketSettings(), true)}>
                🖨 {t('reprint')}
              </button>
            </>
          }
        >
          <p style={{ marginBottom: 10, color: 'var(--text-2)' }}>
            {fmtDateTime(detail.date, lang)} — {detail.userName} — {payLabel(detail.payment)}
            {detail.status === 'void' && <span className="badge gray" style={{ marginInlineStart: 8 }}>{t('voided')}</span>}
          </p>
          <div className="table-wrap">
            <table className="data">
              <tbody>
                {detail.items.map((it, i) => (
                  <tr key={i}>
                    <td>{localName(it, lang)}<div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{it.qty} × {fmtDH(it.unitPrice, lang)}</div></td>
                    <td className="num">{fmtDH(it.total, lang)}</td>
                  </tr>
                ))}
                {detail.discount > 0 && (
                  <tr><td>{t('discount')}</td><td className="num">-{fmtDH(detail.discount, lang)}</td></tr>
                )}
                <tr><td><strong>{t('total')}</strong></td><td className="num"><strong>{fmtDH(detail.total, lang)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
