import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getTicketSettings, type PaymentMethod, type Product, type Sale, type SaleItem, type User } from '../db';
import { localName, useI18n } from '../i18n';
import { fmtDH, fmtQty, genTicketNumber, round2, todayISO } from '../utils';
import { Modal, NumPad, useToast } from '../components/shared';
import { printSaleTicket } from '../print';

interface CartLine extends SaleItem {
  key: number;
}

export default function POS({ user }: { user: User }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.filter((p) => p.active).toArray(), []) ?? [];

  const [catFilter, setCatFilter] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [qtyModal, setQtyModal] = useState<Product | null>(null);
  const [payModal, setPayModal] = useState(false);
  const [doneSale, setDoneSale] = useState<Sale | null>(null);

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

  const addLine = (p: Product, qty: number) => {
    if (qty <= 0) return;
    const unitPrice = p.price;
    setCart((c) => [
      ...c,
      {
        key: Date.now() + Math.random(),
        productId: p.id!,
        nameFr: p.nameFr,
        nameAr: p.nameAr,
        unit: p.unit,
        qty,
        unitPrice,
        total: round2(qty * unitPrice),
      },
    ]);
  };

  const catColor = (id: number) => categories.find((c) => c.id === id)?.color ?? '#999';

  const finishSale = async (payment: PaymentMethod, paid: number, discount: number) => {
    const total = round2(subtotal - discount);
    const sale: Sale = {
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
    const id = await db.transaction('rw', db.sales, db.products, async () => {
      for (const it of sale.items) {
        const p = await db.products.get(it.productId);
        if (p) await db.products.update(it.productId, { stock: round2(p.stock - it.qty) });
      }
      return db.sales.add(sale);
    });
    sale.id = id as number;
    setCart([]);
    setPayModal(false);
    setDoneSale(sale);
    toast(t('saleDone'));
    const ts = await getTicketSettings();
    printSaleTicket(sale, ts);
  };

  return (
    <div className="pos">
      <div className="pos-left">
        <div className="filters" style={{ marginBottom: 10 }}>
          <input placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        </div>
        <div className="cat-chips">
          <button className={`cat-chip ${catFilter === null ? 'on' : ''}`} onClick={() => setCatFilter(null)}>
            {t('all')}
          </button>
          {categories.map((c) => (
            <button key={c.id} className={`cat-chip ${catFilter === c.id ? 'on' : ''}`} onClick={() => setCatFilter(c.id!)}>
              <span>{c.icon}</span> {localName(c, lang)}
            </button>
          ))}
        </div>
        <div className="product-grid">
          {visible.map((p) => (
            <button key={p.id} className={`prod-card ${p.stock <= p.lowStock ? 'low' : ''}`} onClick={() => setQtyModal(p)}>
              <span className="pc-band" style={{ background: catColor(p.categoryId) }} />
              <span className="pc-icon">{categories.find((c) => c.id === p.categoryId)?.icon ?? '🥩'}</span>
              <span className="pc-name">{localName(p, lang)}</span>
              <span>
                <span className="pc-price">{fmtDH(p.price, lang)}{p.unit === 'kg' ? t('perKg') : t('perPiece')}</span>
                <br />
                <span className="pc-stock">
                  {t('stock')}: {fmtQty(p.stock, p.unit)} {p.unit === 'kg' ? t('kg') : ''}
                  {p.stock <= p.lowStock ? ' ⚠️' : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="pos-cart">
        <div className="cart-head">
          <h2>🧺 {t('cart')} ({cart.length})</h2>
          {cart.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => setCart([])}>{t('clearCart')}</button>
          )}
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
              <button className="cl-del" onClick={() => setCart((c) => c.filter((x) => x.key !== l.key))}>🗑</button>
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
          <button className="btn btn-success btn-lg btn-block" disabled={cart.length === 0} onClick={() => setPayModal(true)}>
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
