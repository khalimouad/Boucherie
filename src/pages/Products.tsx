import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, type Category, type Product, type Unit } from '../db';
import { localName, useI18n } from '../i18n';
import { fmtDH, fmtQty, downscaleImage } from '../utils';
import { Empty, Modal, TableSkeleton, useToast } from '../components/shared';

const COLORS = ['#b91c1c', '#c2410c', '#ca8a04', '#15803d', '#0e7490', '#1d4ed8', '#7e22ce', '#be185d'];
const ICONS = ['🥩', '🍖', '🍗', '🫀', '🥓', '🐄', '🐑', '🐔', '🦃', '🌭', '🍢', '🧆'];

export default function Products() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const categoriesRaw = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []);
  const productsRaw = useLiveQuery(() => db.products.toArray(), []);
  const categories = categoriesRaw ?? [];
  const products = productsRaw ?? [];

  const [tab, setTab] = useState<'products' | 'categories'>('products');
  const [query, setQuery] = useState('');
  const [editProd, setEditProd] = useState<Partial<Product> | null>(null);
  const [editCat, setEditCat] = useState<Partial<Category> | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.nameFr.toLowerCase().includes(q) || p.nameAr.includes(q));
  }, [products, query]);

  const catName = (id: string) => {
    const c = categories.find((x) => x.id === id);
    return c ? `${c.icon} ${localName(c, lang)}` : '—';
  };

  const saveProduct = async () => {
    if (!editProd?.nameFr?.trim() || !editProd.categoryId) return toast(t('required'), 'info');
    const data: Omit<Product, 'id'> = {
      categoryId: editProd.categoryId,
      nameFr: editProd.nameFr.trim(),
      nameAr: (editProd.nameAr ?? '').trim(),
      unit: (editProd.unit ?? 'kg') as Unit,
      price: Number(editProd.price) || 0,
      cost: Number(editProd.cost) || 0,
      stock: Number(editProd.stock) || 0,
      lowStock: Number(editProd.lowStock) || 0,
      code: (editProd.code ?? '').replace(/\D/g, ''),
      image: editProd.image || undefined,
      active: editProd.active ?? true,
    };
    if (editProd.id) await db.products.update(editProd.id, data);
    else await db.products.add({ ...data, id: uid() } as Product);
    setEditProd(null);
    toast(t('settingsSaved'));
  };

  const saveCategory = async () => {
    if (!editCat?.nameFr?.trim()) return toast(t('required'), 'info');
    const data: Omit<Category, 'id'> = {
      nameFr: editCat.nameFr.trim(),
      nameAr: (editCat.nameAr ?? '').trim(),
      color: editCat.color ?? COLORS[0],
      icon: editCat.icon ?? ICONS[0],
      sort: editCat.sort ?? categories.length + 1,
    };
    if (editCat.id) await db.categories.update(editCat.id, data);
    else await db.categories.add({ ...data, id: uid() } as Category);
    setEditCat(null);
    toast(t('settingsSaved'));
  };

  return (
    <div>
      <div className="page-head">
        <div className="seg">
          <button className={tab === 'products' ? 'on' : ''} onClick={() => setTab('products')}>🥩 {t('navProducts')}</button>
          <button className={tab === 'categories' ? 'on' : ''} onClick={() => setTab('categories')}>🗂 {t('categories')}</button>
        </div>
        <div className="ph-actions">
          {tab === 'products' ? (
            <button className="btn btn-primary" onClick={() => setEditProd({ unit: 'kg', active: true, categoryId: categories[0]?.id })}>
              ＋ {t('newProduct')}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setEditCat({})}>＋ {t('newCategory')}</button>
          )}
        </div>
      </div>

      {tab === 'products' && (
        <>
          <div className="filters">
            <input placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} style={{ minWidth: 220 }} />
          </div>
          <div className="card table-wrap">
            {productsRaw === undefined ? (
              <TableSkeleton />
            ) : visible.length === 0 ? (
              <Empty icon="🥩" />
            ) : (
              <table className="data card-table">
                <thead>
                  <tr>
                    <th>{t('product')}</th>
                    <th>{t('category')}</th>
                    <th>{t('unit')}</th>
                    <th className="num">{t('sellPrice')}</th>
                    <th className="num">{t('costPrice')}</th>
                    <th className="num">{t('stock')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => (
                    <tr key={p.id}>
                      <td className="card-title">
                        {p.image && <img className="prod-thumb" src={p.image} alt="" />}
                        <strong>{localName(p, lang)}</strong>
                        {!p.active && <span className="badge gray" style={{ marginInlineStart: 6 }}>{t('inactive')}</span>}
                      </td>
                      <td data-label={t('category')}>{catName(p.categoryId)}</td>
                      <td data-label={t('unit')}>{p.unit === 'kg' ? t('kg') : t('piece')}</td>
                      <td className="num" data-label={t('sellPrice')}>{fmtDH(p.price, lang)}</td>
                      <td className="num" data-label={t('costPrice')}>{fmtDH(p.cost, lang)}</td>
                      <td className="num" data-label={t('stock')}>
                        {fmtQty(p.stock, p.unit)}{' '}
                        {p.stock <= p.lowStock && <span className="badge amber">{t('lowStockAlert')}</span>}
                      </td>
                      <td className="card-actions">
                        <button className="btn-icon sm" onClick={() => setEditProd(p)} aria-label={t('edit')}>✏️</button>{' '}
                        <button
                          className="btn-icon sm btn-icon-danger"
                          aria-label={t('delete')}
                          onClick={async () => {
                            if (confirm(t('confirmDelete'))) await db.products.delete(p.id!);
                          }}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'categories' && (
        <div className="card table-wrap">
          {categoriesRaw === undefined ? (
            <TableSkeleton />
          ) : categories.length === 0 ? (
            <Empty icon="🗂" />
          ) : (
            <table className="data card-table">
              <thead>
                <tr>
                  <th>{t('nameFr')}</th>
                  <th>{t('icon')}</th>
                  <th>{t('nameAr')}</th>
                  <th>{t('color')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="card-title">{c.nameFr}</td>
                    <td data-label={t('icon')} style={{ fontSize: '1.4rem' }}>{c.icon}</td>
                    <td data-label={t('nameAr')} dir="rtl">{c.nameAr}</td>
                    <td data-label={t('color')}><span style={{ display: 'inline-block', width: 26, height: 26, borderRadius: 8, background: c.color }} /></td>
                    <td className="card-actions">
                      <button className="btn-icon sm" onClick={() => setEditCat(c)} aria-label={t('edit')}>✏️</button>{' '}
                      <button
                        className="btn-icon sm btn-icon-danger"
                        aria-label={t('delete')}
                        onClick={async () => {
                          if (confirm(t('confirmDelete'))) await db.categories.delete(c.id!);
                        }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editProd && (
        <Modal
          title={editProd.id ? `✏️ ${t('edit')}` : `＋ ${t('newProduct')}`}
          onClose={() => setEditProd(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditProd(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={saveProduct}>{t('save')}</button>
            </>
          }
        >
          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="prod-photo-slot" style={editProd.image ? { backgroundImage: `url(${editProd.image})` } : undefined}>
              {!editProd.image && <span>📷</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                ref={imgRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const img = await downscaleImage(file);
                      setEditProd((prev) => (prev ? { ...prev, image: img } : prev));
                    } catch {
                      toast(t('required'), 'info');
                    }
                  }
                  e.target.value = '';
                }}
              />
              <button className="btn btn-ghost" onClick={() => imgRef.current?.click()}>🖼 {t('photo')}</button>
              {editProd.image && (
                <button className="btn btn-danger" onClick={() => setEditProd({ ...editProd, image: undefined })}>{t('removePhoto')}</button>
              )}
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>{t('nameFr')} *</label>
              <input value={editProd.nameFr ?? ''} onChange={(e) => setEditProd({ ...editProd, nameFr: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('nameAr')}</label>
              <input dir="rtl" value={editProd.nameAr ?? ''} onChange={(e) => setEditProd({ ...editProd, nameAr: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('category')} *</label>
              <select value={editProd.categoryId ?? ''} onChange={(e) => setEditProd({ ...editProd, categoryId: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {localName(c, lang)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('unit')}</label>
              <select value={editProd.unit ?? 'kg'} onChange={(e) => setEditProd({ ...editProd, unit: e.target.value as Unit })}>
                <option value="kg">{t('kg')}</option>
                <option value="piece">{t('piece')}</option>
              </select>
            </div>
            <div className="field">
              <label>{t('sellPrice')} (DH)</label>
              <input inputMode="decimal" type="number" step="0.01" value={editProd.price ?? ''} onChange={(e) => setEditProd({ ...editProd, price: parseFloat(e.target.value) })} />
            </div>
            <div className="field">
              <label>{t('costPrice')} (DH)</label>
              <input inputMode="decimal" type="number" step="0.01" value={editProd.cost ?? ''} onChange={(e) => setEditProd({ ...editProd, cost: parseFloat(e.target.value) })} />
            </div>
            <div className="field">
              <label>{t('stock')}</label>
              <input inputMode="decimal" type="number" step="0.001" value={editProd.stock ?? ''} onChange={(e) => setEditProd({ ...editProd, stock: parseFloat(e.target.value) })} />
            </div>
            <div className="field">
              <label>{t('lowStock')}</label>
              <input inputMode="decimal" type="number" step="0.001" value={editProd.lowStock ?? ''} onChange={(e) => setEditProd({ ...editProd, lowStock: parseFloat(e.target.value) })} />
            </div>
            <div className="field">
              <label>{t('productCode')}</label>
              <input inputMode="numeric" value={editProd.code ?? ''} onChange={(e) => setEditProd({ ...editProd, code: e.target.value })} placeholder="ex: 201" />
            </div>
          </div>
          <div className="switch-row">
            <label style={{ margin: 0 }}>{t('active')}</label>
            <span className="seg">
              <button className={editProd.active !== false ? 'on' : ''} onClick={() => setEditProd({ ...editProd, active: true })}>{t('yes')}</button>
              <button className={editProd.active === false ? 'on' : ''} onClick={() => setEditProd({ ...editProd, active: false })}>{t('no')}</button>
            </span>
          </div>
        </Modal>
      )}

      {editCat && (
        <Modal
          title={editCat.id ? `✏️ ${t('edit')}` : `＋ ${t('newCategory')}`}
          onClose={() => setEditCat(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditCat(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={saveCategory}>{t('save')}</button>
            </>
          }
        >
          <div className="grid-2">
            <div className="field">
              <label>{t('nameFr')} *</label>
              <input value={editCat.nameFr ?? ''} onChange={(e) => setEditCat({ ...editCat, nameFr: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('nameAr')}</label>
              <input dir="rtl" value={editCat.nameAr ?? ''} onChange={(e) => setEditCat({ ...editCat, nameAr: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>{t('icon')}</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  className="btn btn-ghost"
                  style={{ fontSize: '1.4rem', padding: '0 12px', borderColor: editCat.icon === ic ? 'var(--brand-600)' : undefined }}
                  onClick={() => setEditCat({ ...editCat, icon: ic })}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>{t('color')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: c,
                    border: editCat.color === c ? '3px solid var(--text)' : '3px solid transparent',
                  }}
                  onClick={() => setEditCat({ ...editCat, color: c })}
                />
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
