import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, type User, type Waste as WasteRow, type WasteReason } from '../db';
import { localName, useI18n, type TKey } from '../i18n';
import { fmtDH, fmtDateTime, fmtQty, round2, startOfDay, todayISO } from '../utils';
import { Empty, Modal, useToast } from '../components/shared';

export const REASONS: { id: WasteReason; key: TKey; icon: string }[] = [
  { id: 'bones', key: 'rBones', icon: '🦴' },
  { id: 'fat', key: 'rFat', icon: '🧈' },
  { id: 'trim', key: 'rTrim', icon: '🔪' },
  { id: 'spoiled', key: 'rSpoiled', icon: '🤢' },
  { id: 'expired', key: 'rExpired', icon: '📅' },
  { id: 'other', key: 'rOther', icon: '❓' },
];

export default function Waste({ user }: { user: User }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const rows = useLiveQuery(() => db.waste.orderBy('date').reverse().limit(200).toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];

  const [show, setShow] = useState(false);
  const [productId, setProductId] = useState<string>('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<WasteReason>('bones');
  const [note, setNote] = useState('');

  const today = startOfDay().toISOString();
  const todayRows = rows.filter((r) => r.date >= today);
  const todayValue = round2(todayRows.reduce((s, r) => s + r.value, 0));

  const product = products.find((p) => p.id === productId);
  const qtyNum = parseFloat(qty.replace(',', '.')) || 0;
  const unitCost = product ? (product.cost > 0 ? product.cost : product.price) : 0;
  const value = round2(qtyNum * unitCost);

  const save = async () => {
    if (!product || qtyNum <= 0) return toast(t('required'), 'info');
    const row: WasteRow = {
      id: uid(),
      date: todayISO(),
      productId: product.id!,
      nameFr: product.nameFr,
      nameAr: product.nameAr,
      unit: product.unit,
      qty: qtyNum,
      unitCost,
      value,
      reason,
      note: note.trim(),
      userId: user.id!,
      userName: user.name,
    };
    await db.transaction('rw', db.waste, db.products, async () => {
      await db.products.update(product.id!, { stock: round2(product.stock - qtyNum) });
      await db.waste.add(row);
    });
    setShow(false);
    setProductId('');
    setQty('');
    setNote('');
    setReason('bones');
    toast(t('wasteSaved'));
  };

  const reasonLabel = (id: WasteReason) => {
    const r = REASONS.find((x) => x.id === id)!;
    return `${r.icon} ${t(r.key)}`;
  };

  return (
    <div>
      <div className="page-head">
        <h2>⚖️ {t('waste')} — الكسور</h2>
        <button className="btn btn-primary" onClick={() => setShow(true)}>＋ {t('declareWaste')}</button>
      </div>

      <div className="stats-grid">
        <div className="stat red">
          <div className="st-label">{t('today')} — {t('wasteValue')}</div>
          <div className="st-value">{fmtDH(todayValue, lang)}</div>
        </div>
        <div className="stat">
          <div className="st-label">{t('today')} — {t('items')}</div>
          <div className="st-value">{todayRows.length}</div>
        </div>
      </div>

      <div className="card table-wrap">
        {rows.length === 0 ? (
          <Empty icon="⚖️" />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('product')}</th>
                <th className="num">{t('quantity')}</th>
                <th>{t('reason')}</th>
                <th className="num">{t('wasteValue')}</th>
                <th>{t('user')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDateTime(r.date, lang)}</td>
                  <td><strong>{localName(r, lang)}</strong>{r.note && <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{r.note}</div>}</td>
                  <td className="num">{fmtQty(r.qty, r.unit)} {r.unit === 'kg' ? t('kg') : ''}</td>
                  <td><span className="badge red">{reasonLabel(r.reason)}</span></td>
                  <td className="num"><strong>{fmtDH(r.value, lang)}</strong></td>
                  <td>{r.userName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {show && (
        <Modal
          title={`＋ ${t('declareWaste')}`}
          onClose={() => setShow(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShow(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" disabled={!product || qtyNum <= 0} onClick={save}>
                {t('save')} — {fmtDH(value, lang)}
              </button>
            </>
          }
        >
          <div className="field">
            <label>{t('product')} *</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">—</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{localName(p, lang)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('quantity')} {product?.unit === 'kg' ? `(${t('kg')})` : ''} *</label>
            <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0,000" />
          </div>
          <div className="field">
            <label>{t('reason')}</label>
            <div className="pay-methods" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {REASONS.map((r) => (
                <button key={r.id} className={`pay-method ${reason === r.id ? 'on' : ''}`} onClick={() => setReason(r.id)}>
                  <span className="pm-icon">{r.icon}</span>
                  {t(r.key)}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>{t('note')}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {product && qtyNum > 0 && (
            <div className="change-banner warn">
              {t('wasteValue')}: {fmtDH(value, lang)} ({fmtDH(unitCost, lang)} × {fmtQty(qtyNum, product.unit)})
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
