import { useEffect, useRef, useState } from 'react';
import { db, defaultTicket, getTicketSettings, saveTicketSettings, type Sale, type TicketSettings } from '../db';
import { useI18n } from '../i18n';
import { Modal, Switch, useToast } from '../components/shared';
import { buildTicketHTML, printHTML } from '../print';

const demoSale: Sale = {
  number: '20260705-0042',
  date: new Date().toISOString(),
  items: [
    { productId: 1, nameFr: 'Viande hachée', nameAr: 'لحم مفروم', unit: 'kg', qty: 0.75, unitPrice: 90, total: 67.5 },
    { productId: 2, nameFr: 'Merguez', nameAr: 'مركاز', unit: 'kg', qty: 0.5, unitPrice: 100, total: 50 },
    { productId: 3, nameFr: 'Poulet entier', nameAr: 'دجاجة كاملة', unit: 'piece', qty: 1, unitPrice: 55, total: 55 },
  ],
  subtotal: 172.5,
  discount: 2.5,
  total: 170,
  paid: 200,
  change: 30,
  payment: 'cash',
  userId: 1,
  userName: 'Admin',
  status: 'done',
};

export default function Settings() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [ts, setTs] = useState<TicketSettings | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getTicketSettings().then(setTs);
  }, []);

  if (!ts) return <div>{t('loading')}</div>;

  const up = (patch: Partial<TicketSettings>) => setTs({ ...ts, ...patch });

  const save = async () => {
    await saveTicketSettings(ts);
    toast(t('settingsSaved'));
  };

  const onLogoFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // downscale to keep IndexedDB small and thermal print crisp
        const maxW = 384;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        up({ logo: canvas.toDataURL('image/png') });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const resetAll = async () => {
    await Promise.all([
      db.sales.clear(),
      db.purchases.clear(),
      db.waste.clear(),
      db.products.clear(),
      db.categories.clear(),
      db.suppliers.clear(),
    ]);
    setConfirmReset(false);
    toast(t('settingsSaved'));
    location.reload();
  };

  const previewHTML = buildTicketHTML(demoSale, ts, false);
  const widthPx = ts.paperWidth === '58' ? 219 : 302; // ~96dpi

  return (
    <div>
      <div className="page-head">
        <h2>⚙️ {t('settings')}</h2>
        <button className="btn btn-primary" onClick={save}>💾 {t('save')}</button>
      </div>

      <div className="grid-2">
        <div>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h2>🏪 {t('shopInfo')}</h2>
            <div className="field">
              <label>{t('shopNameFr')}</label>
              <input value={ts.shopNameFr} onChange={(e) => up({ shopNameFr: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('shopNameAr')}</label>
              <input dir="rtl" value={ts.shopNameAr} onChange={(e) => up({ shopNameAr: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('address')}</label>
              <input value={ts.address} onChange={(e) => up({ address: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('phone')}</label>
              <input inputMode="tel" value={ts.phone} onChange={(e) => up({ phone: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('logo')}</label>
              {ts.logo && <div style={{ marginBottom: 10 }}><img className="logo-preview" src={ts.logo} alt="logo" /></div>}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && onLogoFile(e.target.files[0])} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>🖼 {t('uploadLogo')}</button>
                {ts.logo && <button className="btn btn-danger" onClick={() => up({ logo: '' })}>{t('removeLogo')}</button>}
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <h2>🎨 {t('ticketDesign')}</h2>
            <div className="grid-2">
              <div className="field">
                <label>{t('paperWidth')}</label>
                <div className="seg" style={{ display: 'flex' }}>
                  <button className={ts.paperWidth === '58' ? 'on' : ''} style={{ flex: 1 }} onClick={() => up({ paperWidth: '58' })}>58 mm</button>
                  <button className={ts.paperWidth === '80' ? 'on' : ''} style={{ flex: 1 }} onClick={() => up({ paperWidth: '80' })}>80 mm</button>
                </div>
              </div>
              <div className="field">
                <label>{t('fontSize')}</label>
                <div className="seg" style={{ display: 'flex' }}>
                  {(['small', 'normal', 'large'] as const).map((s) => (
                    <button key={s} className={ts.fontSize === s ? 'on' : ''} style={{ flex: 1 }} onClick={() => up({ fontSize: s })}>
                      {t(s)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="field">
              <label>{t('ticketLang')}</label>
              <div className="seg" style={{ display: 'flex' }}>
                <button className={ts.ticketLang === 'fr' ? 'on' : ''} style={{ flex: 1 }} onClick={() => up({ ticketLang: 'fr' })}>{t('french')}</button>
                <button className={ts.ticketLang === 'ar' ? 'on' : ''} style={{ flex: 1 }} onClick={() => up({ ticketLang: 'ar' })}>{t('arabic')}</button>
                <button className={ts.ticketLang === 'both' ? 'on' : ''} style={{ flex: 1 }} onClick={() => up({ ticketLang: 'both' })}>{t('both')}</button>
              </div>
            </div>

            <div className="switch-row"><span>{t('showLogo')}</span><Switch checked={ts.showLogo} onChange={(v) => up({ showLogo: v })} /></div>
            <div className="switch-row"><span>{t('showAddress')}</span><Switch checked={ts.showAddress} onChange={(v) => up({ showAddress: v })} /></div>
            <div className="switch-row"><span>{t('showPhone')}</span><Switch checked={ts.showPhone} onChange={(v) => up({ showPhone: v })} /></div>
            <div className="switch-row"><span>{t('showCashier')}</span><Switch checked={ts.showCashier} onChange={(v) => up({ showCashier: v })} /></div>

            <div className="grid-2" style={{ marginTop: 14 }}>
              <div className="field">
                <label>{t('headerText')} (FR)</label>
                <input value={ts.headerFr} onChange={(e) => up({ headerFr: e.target.value })} />
              </div>
              <div className="field">
                <label>{t('headerText')} (ع)</label>
                <input dir="rtl" value={ts.headerAr} onChange={(e) => up({ headerAr: e.target.value })} />
              </div>
              <div className="field">
                <label>{t('footerText')} (FR)</label>
                <input value={ts.footerFr} onChange={(e) => up({ footerFr: e.target.value })} />
              </div>
              <div className="field">
                <label>{t('footerText')} (ع)</label>
                <input dir="rtl" value={ts.footerAr} onChange={(e) => up({ footerAr: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="card card-pad" style={{ marginTop: 14, borderColor: '#fecaca' }}>
            <h2 style={{ color: 'var(--brand-600)' }}>⚠️ {t('dangerZone')}</h2>
            <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>{t('resetData')}</button>
          </div>
        </div>

        <div>
          <div className="card card-pad">
            <div className="page-head" style={{ marginBottom: 10 }}>
              <h2>🧾 {t('ticketPreview')}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => printHTML(previewHTML)}>🖨 {t('testPrint')}</button>
            </div>
            <div className="ticket-preview-wrap">
              <iframe
                title="ticket-preview"
                className="ticket-paper"
                srcDoc={previewHTML}
                style={{ width: widthPx, height: 560, border: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>

      {confirmReset && (
        <Modal
          title={`⚠️ ${t('dangerZone')}`}
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>{t('cancel')}</button>
              <button className="btn btn-danger" onClick={resetAll}>{t('confirm')}</button>
            </>
          }
        >
          <p>{t('resetConfirm')}</p>
        </Modal>
      )}
    </div>
  );
}
