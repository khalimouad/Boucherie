import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  defaultBarcode,
  getBarcodeSettings,
  getTicketSettings,
  uid,
  type PaymentMethod,
  type Product,
  type Sale,
  type SaleItem,
  type User,
} from '../db';
import { localName, useI18n } from '../i18n';
import { fmtDH, fmtDateTime, fmtQty, genTicketNumber, round2, todayISO } from '../utils';
import { Empty, Modal, NumPad, ProductGridSkeleton, useToast } from '../components/shared';
import { printSaleTicket, printSessionReport } from '../print';
import { parseBarcode, useScanner } from '../barcode';
import { productImage } from '../productImages';
import { openDrawerViaBridge } from '../printBridge';
import { addCashMovement, closeSession, computeSessionTotals, openSession } from '../cashSession';
import type { CashMovementType, CashSession } from '../db';

interface CartLine extends SaleItem {
  key: number;
}

export default function POS({ user }: { user: User }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) ?? [];
  const productsRaw = useLiveQuery(() => db.products.filter((p) => p.active).toArray(), []);
  const products = productsRaw ?? [];
  const barcodeCfg = useLiveQuery(() => getBarcodeSettings(), []) ?? defaultBarcode;
  const session = useLiveQuery(() => db.cashSessions.where('status').equals('open').first(), []);

  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [qtyModal, setQtyModal] = useState<Product | null>(null);
  const [payModal, setPayModal] = useState(false);
  const [doneSale, setDoneSale] = useState<Sale | null>(null);
  const [movementModal, setMovementModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [closedSummary, setClosedSummary] = useState<CashSession | null>(null);
  const [scanModal, setScanModal] = useState(false);

  const visible = useMemo(() => {
    let list = products;
    if (catFilter !== null) list = list.filter((p) => p.categoryId === catFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => p.nameFr.toLowerCase().includes(q) || p.nameAr.includes(q));
    }
    return list;
  }, [products, catFilter, query]);

  const subtotal = round2(cart.reduce((s, l) => s + l.total, 0));

  const addLine = useCallback((p: Product, qty: number) => {
    if (qty <= 0) return;
    setCart((c) => [
      ...c,
      {
        key: Date.now() + Math.random(),
        productId: p.id!,
        nameFr: p.nameFr,
        nameAr: p.nameAr,
        unit: p.unit,
        qty,
        unitPrice: p.price,
        total: round2(qty * p.price),
      },
    ]);
  }, []);

  const onScan = useCallback(
    (code: string) => {
      const res = parseBarcode(code, barcodeCfg, products);
      setQuery('');
      if (!res) {
        toast(`${t('scanUnknown')} (${code})`, 'info');
        return;
      }
      if (res.qty !== null) {
        addLine(res.product, res.qty);
        toast(`✅ ${t('scanAdded')}: ${localName(res.product, lang)}`);
      } else if (res.product.unit === 'piece') {
        addLine(res.product, 1);
        toast(`✅ ${t('scanAdded')}: ${localName(res.product, lang)}`);
      } else {
        setQtyModal(res.product);
      }
    },
    [barcodeCfg, products, addLine, toast, t, lang],
  );
  useScanner(onScan, barcodeCfg.enabled);

  const catColor = (id: string) => categories.find((c) => c.id === id)?.color ?? '#999';

  const handleOpenDrawer = async () => {
    const ok = await openDrawerViaBridge();
    toast(ok ? t('drawerOpened') : t('drawerFailed'), ok ? 'success' : 'info');
  };

  const finishSale = async (payment: PaymentMethod, paid: number, discount: number) => {
    const total = round2(subtotal - discount);
    const sale: Sale = {
      id: uid(),
      number: genTicketNumber(),
      date: todayISO(),
      items: cart.map(({ key, ...rest }) => rest),
      subtotal,
      discount,
      total,
      paid: payment === 'cash' ? paid : total,
      change: payment === 'cash' ? round2(paid - total) : 0,
      payment,
      userId: user.id!,
      userName: user.name,
      status: 'done',
    };
    await db.transaction('rw', db.sales, db.products, async () => {
      for (const it of sale.items) {
        const p = await db.products.get(it.productId);
        if (p) await db.products.update(it.productId, { stock: round2(p.stock - it.qty) });
      }
      await db.sales.add(sale);
    });
    setCart([]);
    setPayModal(false);
    setDoneSale(sale);
    toast(t('saleDone'));
    const ts = await getTicketSettings();
    printSaleTicket(sale, ts);
  };

  // Closing flips `session` to undefined on the next tick (useLiveQuery re-runs
  // against a table with no open row), so the summary modal is rendered from
  // this outer branch — otherwise it would be unmounted before ever showing.
  if (!session) {
    return (
      <>
        <OpenRegisterScreen user={user} />
        {closedSummary && (
          <ClosedSummaryModal session={closedSummary} onClose={() => setClosedSummary(null)} />
        )}
      </>
    );
  }

  return (
    <div className="pos-page">
      <div className="session-card">
        <div className="sc-top">
          <div>
            <div className="sc-title">{t('cashSession')}</div>
            <div className="sc-meta">
              {t('openedSince')} {t('by')} {session.openedByName}
              <br />
              {fmtDateTime(session.openedAt, lang)}
            </div>
            <span className="session-pill"><span className="dot" /> {t('ongoing')}</span>
          </div>
          <div className="sc-icon" aria-hidden="true">🗄️</div>
        </div>
        <div className="sc-amount-row">
          <span className="sc-amount-label">{t('openingAmount')}</span>
          <span className="sc-amount">{fmtDH(session.openingAmount, lang)}</span>
        </div>
        <div className="sc-divider" />
        <div className="sc-actions">
          <button className="sc-btn sc-btn-close" onClick={() => setCloseModal(true)}>🔒 {t('closeRegister')}</button>
          <button className="sc-btn sc-btn-cash" onClick={() => setMovementModal(true)}>💵 {t('cashMovement')}</button>
        </div>
      </div>
      <div className="pos">
      <div className="pos-left">
        <div className="pos-search">
          <div className="search-field">
            <span className="search-ico" aria-hidden="true">🔍</span>
            <input placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {barcodeCfg.enabled && (
            <button className="scan-btn" onClick={() => setScanModal(true)} aria-label={t('barcodeTest')} title={t('barcode')}>▥</button>
          )}
        </div>
        <div className="cat-chips">
          <button className={`cat-chip ${catFilter === null ? 'on' : ''}`} onClick={() => setCatFilter(null)}>
            ▦ {t('all')}
          </button>
          {categories.map((c) => (
            <button key={c.id} className={`cat-chip ${catFilter === c.id ? 'on' : ''}`} onClick={() => setCatFilter(c.id!)}>
              <span>{c.icon}</span> {localName(c, lang)}
            </button>
          ))}
        </div>
        {productsRaw === undefined ? (
          <ProductGridSkeleton />
        ) : visible.length === 0 ? (
          <Empty icon="🔍" />
        ) : (
          <div className="product-grid">
            {visible.map((p) => {
              const cat = categories.find((c) => c.id === p.categoryId);
              return (
                <button key={p.id} className={`prod-card ${p.stock <= p.lowStock ? 'low' : ''}`} onClick={() => setQtyModal(p)}>
                  {p.stock <= p.lowStock && <span className="pc-lowbadge">{t('lowStockAlert')}</span>}
                  <span
                    className="pc-media"
                    style={{ backgroundImage: `url("${p.image || productImage(cat?.icon ?? '🥩', catColor(p.categoryId))}")` }}
                  >
                    <span className="pc-add" aria-hidden="true">＋</span>
                  </span>
                  <span className="pc-body">
                    <span className="pc-name">{localName(p, lang)}</span>
                    <span className="pc-price">{fmtDH(p.price, lang)}{p.unit === 'kg' ? t('perKg') : t('perPiece')}</span>
                    <span className="pc-stock">
                      {t('stock')}: {fmtQty(p.stock, p.unit)} {p.unit === 'kg' ? t('kg') : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="pos-cart">
        <div className="cart-head">
          <h2>🧺 {t('cart')} ({cart.length})</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-icon sm" onClick={handleOpenDrawer} aria-label={t('openDrawer')} title={t('openDrawer')}>🗄️</button>
            {cart.length > 0 && (
              <button className="btn btn-danger btn-sm" onClick={() => setCart([])}>{t('clearCart')}</button>
            )}
          </div>
        </div>
        <div className="cart-items">
          {cart.length === 0 && <div className="cart-empty">{t('emptyCart')}</div>}
          {cart.map((l) => (
            <div key={l.key} className="cart-line">
              <div className="cl-info">
                <div className="cl-name">{localName(l, lang)}</div>
                <div className="cl-detail">
                  {fmtQty(l.qty, l.unit)} {l.unit === 'kg' ? t('kg') : t('piece')} × {fmtDH(l.unitPrice, lang)}
                </div>
              </div>
              <div className="cl-total">{fmtDH(l.total, lang)}</div>
              <button className="cl-del" aria-label={t('delete')} onClick={() => setCart((c) => c.filter((x) => x.key !== l.key))}>🗑</button>
            </div>
          ))}
        </div>
        <div className="cart-totals">
          <div className="row grand">
            <span>{t('total')}</span>
            <span>{fmtDH(subtotal, lang)}</span>
          </div>
        </div>
        <div className="cart-actions">
          <button className="btn-checkout" disabled={cart.length === 0} onClick={() => setPayModal(true)}>
            💵 {t('pay')}
          </button>
        </div>
      </div>

      {qtyModal && (
        <QtyModal
          product={qtyModal}
          onClose={() => setQtyModal(null)}
          onAdd={(qty) => {
            addLine(qtyModal, qty);
            setQtyModal(null);
          }}
        />
      )}

      {payModal && (
        <PayModal subtotal={subtotal} onClose={() => setPayModal(false)} onConfirm={finishSale} />
      )}

      {doneSale && (
        <Modal
          title={`✅ ${t('saleDone')}`}
          onClose={() => setDoneSale(null)}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={async () => printSaleTicket(doneSale, await getTicketSettings(), true)}
              >
                🖨 {t('reprint')}
              </button>
              <button className="btn btn-primary" onClick={() => setDoneSale(null)}>
                {t('newSale')}
              </button>
            </>
          }
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>{t('ticketNo')} {doneSale.number}</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '10px 0' }}>{fmtDH(doneSale.total, lang)}</div>
            {doneSale.change > 0 && (
              <div className="change-banner">{t('changeDue')}: {fmtDH(doneSale.change, lang)}</div>
            )}
          </div>
        </Modal>
      )}
      </div>

      {scanModal && (
        <ScanModal
          onClose={() => setScanModal(false)}
          onScan={(code) => {
            setScanModal(false);
            onScan(code);
          }}
        />
      )}

      {movementModal && (
        <CashMovementModal
          onClose={() => setMovementModal(false)}
          onConfirm={async (type, amount, note) => {
            await addCashMovement(session, type, amount, note, user);
            setMovementModal(false);
            toast(t('movementAdded'));
          }}
        />
      )}

      {closeModal && (
        <CloseRegisterModal
          session={session}
          onClose={() => setCloseModal(false)}
          onConfirm={async (counted, note) => {
            await closeSession(session, counted, note, user);
            const finalSession = await db.cashSessions.get(session.id!);
            setCloseModal(false);
            toast(t('registerClosedDone'));
            if (finalSession) setClosedSummary(finalSession);
          }}
        />
      )}

      {closedSummary && (
        <ClosedSummaryModal session={closedSummary} onClose={() => setClosedSummary(null)} />
      )}
    </div>
  );
}

function ClosedSummaryModal({ session, onClose }: { session: CashSession; onClose: () => void }) {
  const { t, lang } = useI18n();
  const diff = session.difference ?? 0;
  return (
    <Modal
      title={`🔒 ${t('registerClosedDone')}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={async () => printSessionReport(session, await getTicketSettings())}>
            🖨 {t('printReport')}
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            {t('close')}
          </button>
        </>
      }
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>{t('expectedCash')}: {fmtDH(session.expectedAmount ?? 0, lang)}</div>
        <div style={{ fontSize: '2.2rem', fontWeight: 800, margin: '10px 0' }}>{fmtDH(session.countedAmount ?? 0, lang)}</div>
        <div className={`change-banner ${diff < 0 ? 'warn' : ''}`}>
          {t('cashDifference')}: {diff >= 0 ? '+' : ''}{fmtDH(diff, lang)}
        </div>
      </div>
    </Modal>
  );
}

function OpenRegisterScreen({ user }: { user: User }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [val, setVal] = useState('');
  const amount = parseFloat(val.replace(',', '.')) || 0;

  const confirm = async () => {
    await openSession(user, amount);
    toast(t('registerOpenedDone'));
  };

  return (
    <div className="login-screen" style={{ minHeight: 'calc(100vh - 140px)' }}>
      <div className="login-card">
        <div className="login-logo">🗄️</div>
        <div className="login-title">{t('registerClosed')}</div>
        <div className="login-sub">{t('registerClosedHint')}</div>
        <label>{t('openingAmount')}</label>
        <div className="numpad-display">{val || '0'} {lang === 'ar' ? 'د.م.' : 'DH'}</div>
        <NumPad value={val} onChange={setVal} />
        <button className="btn btn-success btn-lg btn-block" style={{ marginTop: 14 }} onClick={confirm}>
          🔓 {t('openRegister')}
        </button>
      </div>
    </div>
  );
}

function CashMovementModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (type: CashMovementType, amount: number, note: string) => void;
}) {
  const { t, lang } = useI18n();
  const [type, setType] = useState<CashMovementType>('out');
  const [val, setVal] = useState('');
  const [note, setNote] = useState('');
  const amount = parseFloat(val.replace(',', '.')) || 0;

  return (
    <Modal
      title={`💰 ${t('cashMovement')}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" disabled={amount <= 0} onClick={() => onConfirm(type, amount, note)}>
            {t('save')}
          </button>
        </>
      }
    >
      <div className="pay-methods" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <button className={`pay-method ${type === 'in' ? 'on' : ''}`} onClick={() => setType('in')}>
          <span className="pm-icon">⬇️</span>
          {t('cashIn')}
        </button>
        <button className={`pay-method ${type === 'out' ? 'on' : ''}`} onClick={() => setType('out')}>
          <span className="pm-icon">⬆️</span>
          {t('cashOut')}
        </button>
      </div>
      <label>{t('amount')} (DH)</label>
      <div className="numpad-display">{val || '0'} {lang === 'ar' ? 'د.م.' : 'DH'}</div>
      <NumPad value={val} onChange={setVal} />
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t('note')}</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

function CloseRegisterModal({
  session,
  onClose,
  onConfirm,
}: {
  session: CashSession;
  onClose: () => void;
  onConfirm: (counted: number, note: string) => void;
}) {
  const { t, lang } = useI18n();
  const [totals, setTotals] = useState<{ cashSalesTotal: number; cashInTotal: number; cashOutTotal: number; expectedAmount: number } | null>(null);
  const [val, setVal] = useState('');
  const [note, setNote] = useState('');
  const counted = parseFloat(val.replace(',', '.')) || 0;
  const diff = totals ? round2(counted - totals.expectedAmount) : 0;

  useEffect(() => {
    computeSessionTotals(session).then(setTotals);
  }, [session]);

  return (
    <Modal
      title={`🔒 ${t('closeRegister')}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-danger" disabled={!totals} onClick={() => onConfirm(counted, note)}>
            {t('confirmClose')}
          </button>
        </>
      }
    >
      {totals && (
        <div style={{ marginBottom: 14 }}>
          <div className="switch-row"><span>{t('openingAmount')}</span><strong>{fmtDH(session.openingAmount, lang)}</strong></div>
          <div className="switch-row"><span>{t('cashSalesTotal')}</span><strong>{fmtDH(totals.cashSalesTotal, lang)}</strong></div>
          <div className="switch-row"><span>{t('cashIn')}</span><strong>{fmtDH(totals.cashInTotal, lang)}</strong></div>
          <div className="switch-row"><span>{t('cashOut')}</span><strong>{totals.cashOutTotal > 0 ? '-' : ''}{fmtDH(totals.cashOutTotal, lang)}</strong></div>
          <div className="switch-row"><span>{t('expectedCash')}</span><strong>{fmtDH(totals.expectedAmount, lang)}</strong></div>
        </div>
      )}
      <label>{t('countedCash')} (DH)</label>
      <div className="numpad-display">{val || '0'} {lang === 'ar' ? 'د.م.' : 'DH'}</div>
      <NumPad value={val} onChange={setVal} />
      {totals && val && (
        <div className={`change-banner ${diff < 0 ? 'warn' : ''}`}>
          {t('cashDifference')}: {diff >= 0 ? '+' : ''}{fmtDH(diff, lang)}
        </div>
      )}
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t('note')}</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

/* Manual barcode / PLU entry — for hand-keying a scale label when no scanner is at hand. */
function ScanModal({ onClose, onScan }: { onClose: () => void; onScan: (code: string) => void }) {
  const { t } = useI18n();
  const [val, setVal] = useState('');
  return (
    <Modal
      title={`▥ ${t('barcode')}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" disabled={val.length < 3} onClick={() => onScan(val)}>{t('add')}</button>
        </>
      }
    >
      <label>{t('barcodeTestPlaceholder')}</label>
      <div className="numpad-display">{val || '—'}</div>
      <NumPad value={val} onChange={setVal} allowDecimal={false} maxLen={13} />
    </Modal>
  );
}

/* Weight / quantity entry with touch keypad; weight products can also be entered by amount (DH). */
function QtyModal({ product, onClose, onAdd }: { product: Product; onClose: () => void; onAdd: (qty: number) => void }) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<'qty' | 'amount'>('qty');
  const [val, setVal] = useState('');

  const num = parseFloat(val.replace(',', '.')) || 0;
  const qty = mode === 'qty' ? num : product.price > 0 ? num / product.price : 0;
  const total = round2(qty * product.price);

  return (
    <Modal
      title={`${localName(product, lang)} — ${fmtDH(product.price, lang)}${product.unit === 'kg' ? t('perKg') : t('perPiece')}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-success" disabled={qty <= 0} onClick={() => onAdd(round2(qty * 1000) / 1000)}>
            {t('add')} — {fmtDH(total, lang)}
          </button>
        </>
      }
    >
      {product.unit === 'kg' && (
        <div className="seg" style={{ marginBottom: 12, width: '100%', display: 'flex' }}>
          <button className={mode === 'qty' ? 'on' : ''} style={{ flex: 1 }} onClick={() => { setMode('qty'); setVal(''); }}>
            ⚖️ {t('byWeight')}
          </button>
          <button className={mode === 'amount' ? 'on' : ''} style={{ flex: 1 }} onClick={() => { setMode('amount'); setVal(''); }}>
            💰 {t('byAmount')}
          </button>
        </div>
      )}
      <label>{mode === 'amount' ? `${t('amount')} (DH)` : product.unit === 'kg' ? t('enterWeight') : t('enterQty')}</label>
      <div className="numpad-display">
        {val || '0'} {mode === 'amount' ? 'DH' : product.unit === 'kg' ? t('kg') : ''}
      </div>
      <NumPad value={val} onChange={setVal} allowDecimal={product.unit === 'kg' || mode === 'amount'} />
      {qty > 0 && (
        <div style={{ textAlign: 'center', marginTop: 12, fontWeight: 700, color: 'var(--text-2)' }}>
          {fmtQty(qty, product.unit)} {product.unit === 'kg' ? t('kg') : t('piece')} = {fmtDH(total, lang)}
        </div>
      )}
    </Modal>
  );
}

function PayModal({
  subtotal,
  onClose,
  onConfirm,
}: {
  subtotal: number;
  onClose: () => void;
  onConfirm: (payment: PaymentMethod, paid: number, discount: number) => void;
}) {
  const { t, lang } = useI18n();
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [paidStr, setPaidStr] = useState('');
  const [discountStr, setDiscountStr] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);

  const discount = round2(Math.min(parseFloat(discountStr.replace(',', '.')) || 0, subtotal));
  const total = round2(subtotal - discount);
  const paid = round2(parseFloat(paidStr.replace(',', '.')) || 0);
  const change = round2(paid - total);
  const canConfirm = payment !== 'cash' || paid >= total;

  const quick = [total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  const methods: { id: PaymentMethod; icon: string; label: string }[] = [
    { id: 'cash', icon: '💵', label: t('cash') },
    { id: 'card', icon: '💳', label: t('card') },
    { id: 'credit', icon: '📒', label: t('credit') },
  ];

  return (
    <Modal
      title={`${t('payment')} — ${fmtDH(total, lang)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-success" disabled={!canConfirm} onClick={() => onConfirm(payment, payment === 'cash' ? paid : total, discount)}>
            ✅ {t('finishSale')}
          </button>
        </>
      }
    >
      <div className="pay-methods">
        {methods.map((m) => (
          <button key={m.id} className={`pay-method ${payment === m.id ? 'on' : ''}`} onClick={() => setPayment(m.id)}>
            <span className="pm-icon">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {!showDiscount ? (
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => setShowDiscount(true)}>
          ➖ {t('discount')}
        </button>
      ) : (
        <div className="field">
          <label>{t('discount')} (DH)</label>
          <input inputMode="decimal" value={discountStr} onChange={(e) => setDiscountStr(e.target.value)} placeholder="0,00" />
        </div>
      )}

      {payment === 'cash' && (
        <>
          <label>{t('received')}</label>
          <div className="numpad-display">{paidStr || '0'} DH</div>
          <div className="quick-amounts">
            {quick.map((q) => (
              <button key={q} onClick={() => setPaidStr(String(q))}>{q === total ? `= ${t('exactAmount')}` : fmtDH(q, lang)}</button>
            ))}
          </div>
          <NumPad value={paidStr} onChange={setPaidStr} />
          {paid > 0 && (
            <div className={`change-banner ${change < 0 ? 'warn' : ''}`}>
              {change >= 0 ? `${t('changeDue')}: ${fmtDH(change, lang)}` : t('insufficient')}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
