import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Purchase, type PurchaseItem, type User } from '../db';
import { localName, useI18n } from '../i18n';
import { fmtDH, fmtDateTime, fmtQty, round2, todayISO } from '../utils';
import { Empty, Modal, useToast } from '../components/shared';

export default function Purchases({ user }: { user: User }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const purchases = useLiveQuery(() => db.purchases.orderBy('date').reverse().limit(100).toArray(), []) ?? [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];

  const [showNew, setShowNew] = useState(false);
  const [showSupplier, setShowSupplier] = useState(false);
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');

  // new purchase form state
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<{ productId: number | ''; qty: string; unitCost: string }[]>([
    { productId: '', qty: '', unitCost: '' },
  ]);

  const parsedLines: PurchaseItem[] = lines
    .filter((l) => l.productId !== '' && parseFloat(l.qty) > 0)
    .map((l) => {
      const p = products.find((x) => x.id === l.productId)!;
      const qty = parseFloat(l.qty.replace(',', '.')) || 0;
      const unitCost = parseFloat(l.unitCost.replace(',', '.')) || 0;
      return { productId: p.id!, nameFr: p.nameFr, nameAr: p.nameAr, qty, unitCost, total: round2(qty * unitCost) };
    });
  const totalNew = round2(parsedLines.reduce((s, l) => s + l.total, 0));

  const resetForm = () => {
    setSupplierId('');
    setNote('');
    setLines([{ productId: '', qty: '', unitCost: '' }]);
  };

  const savePurchase = async () => {
    if (parsedLines.length === 0) return toast(t('required'), 'info');
    const sup = suppliers.find((s) => s.id === supplierId);
    const purchase: Purchase = {
      date: todayISO(),
      supplierId: sup?.id ?? null,
      supplierName: sup?.name ?? '—',
      items: parsedLines,
      total: totalNew,
      userId: user.id!,
      userName: user.name,
      note: note.trim(),
    };
    await db.transaction('rw', db.purchases, db.products, async () => {
      for (const it of parsedLines) {
        const p = await db.products.get(it.productId);
        if (p) {
          await db.products.update(it.productId, {
            stock: round2(p.stock + it.qty),
            cost: it.unitCost > 0 ? it.unitCost : p.cost,
          });
        }
      }
      await db.purchases.add(purchase);
    });
    setShowNew(false);
    resetForm();
    toast(t('purchaseSaved'));
  };

  const saveSupplier = async () => {
    if (!supName.trim()) return toast(t('required'), 'info');
    await db.suppliers.add({ name: supName.trim(), phone: supPhone.trim() });
    setSupName('');
    setSupPhone('');
    setShowSupplier(false);
    toast(t('settingsSaved'));
  };

  return (
    <div>
      <div className="page-head">
        <h2>🚚 {t('navPurchases')}</h2>
        <div className="ph-actions">
          <button className="btn btn-ghost" onClick={() => setShowSupplier(true)}>＋ {t('newSupplier')}</button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>＋ {t('newPurchase')}</button>
        </div>
      </div>

      <div className="card table-wrap">
        {purchases.length === 0 ? (
          <Empty icon="🚚" />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('supplier')}</th>
                <th>{t('items')}</th>
                <th className="num">{t('total')}</th>
                <th>{t('user')}</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => setDetail(p)}>
                  <td>{fmtDateTime(p.date, lang)}</td>
                  <td><strong>{p.supplierName}</strong></td>
                  <td>{p.items.length}</td>
                  <td className="num"><strong>{fmtDH(p.total, lang)}</strong></td>
                  <td>{p.userName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <Modal
          title={`＋ ${t('newPurchase')}`}
          onClose={() => setShowNew(false)}
          wide
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" disabled={parsedLines.length === 0} onClick={savePurchase}>
                {t('save')} — {fmtDH(totalNew, lang)}
              </button>
            </>
          }
        >
          <div className="field">
            <label>{t('supplier')}</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <select
                style={{ flex: 2, minWidth: 0 }}
                value={l.productId}
                onChange={(e) => {
                  const productId = e.target.value ? Number(e.target.value) : '';
                  const p = products.find((x) => x.id === productId);
                  setLines(lines.map((x, j) => (j === i ? { ...x, productId, unitCost: x.unitCost || (p ? String(p.cost) : '') } : x)));
                }}
              >
                <option value="">{t('product')}…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{localName(p, lang)}</option>
                ))}
              </select>
              <input
                style={{ flex: 1, minWidth: 70 }}
                inputMode="decimal"
                placeholder={t('quantity')}
                value={l.qty}
                onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
              />
              <input
                style={{ flex: 1, minWidth: 80 }}
                inputMode="decimal"
                placeholder={`${t('unitCost')} DH`}
                value={l.unitCost}
                onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitCost: e.target.value } : x)))}
              />
              <button className="cl-del" onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : lines)}>🗑</button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => setLines([...lines, { productId: '', qty: '', unitCost: '' }])}>
            ＋ {t('addLine')}
          </button>

          <div className="field" style={{ marginTop: 14 }}>
            <label>{t('note')}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </Modal>
      )}

      {showSupplier && (
        <Modal
          title={`＋ ${t('newSupplier')}`}
          onClose={() => setShowSupplier(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowSupplier(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={saveSupplier}>{t('save')}</button>
            </>
          }
        >
          <div className="field">
            <label>{t('name')} *</label>
            <input value={supName} onChange={(e) => setSupName(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('phone')}</label>
            <input inputMode="tel" value={supPhone} onChange={(e) => setSupPhone(e.target.value)} />
          </div>
        </Modal>
      )}

      {detail && (
        <Modal title={`🚚 ${t('purchase')} — ${fmtDateTime(detail.date, lang)}`} onClose={() => setDetail(null)}>
          <p style={{ marginBottom: 10 }}>
            <strong>{t('supplier')}:</strong> {detail.supplierName}
            {detail.note && <> — {detail.note}</>}
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('product')}</th>
                  <th className="num">{t('quantity')}</th>
                  <th className="num">{t('unitCost')}</th>
                  <th className="num">{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it, i) => (
                  <tr key={i}>
                    <td>{localName(it, lang)}</td>
                    <td className="num">{fmtQty(it.qty, 'kg')}</td>
                    <td className="num">{fmtDH(it.unitCost, lang)}</td>
                    <td className="num">{fmtDH(it.total, lang)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3}><strong>{t('total')}</strong></td>
                  <td className="num"><strong>{fmtDH(detail.total, lang)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
