import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  db,
  defaultBarcode,
  defaultTicket,
  getBarcodeSettings,
  getBridgeSettings,
  getTicketSettings,
  saveBarcodeSettings,
  saveBridgeSettings,
  saveTicketSettings,
  getFeatureSettings,
  saveFeatureSettings,
  type FeatureSettings,
  type BarcodeSettings,
  type BridgeSettings,
  type Sale,
  type TicketSettings,
} from '../db';
import { useI18n, localName } from '../i18n';
import { Modal, Switch, useToast } from '../components/shared';
import { Icon } from '../components/Icon';
import { buildTicketHTML, printHTML } from '../print';
import { CLOUD_EMAIL, disableSync, enableSync, getSyncStatus, subscribeSync, syncNow } from '../sync';
import { getTheme, setTheme, subscribeTheme, type ThemeMode } from '../theme';
import { bridgePing, testPrintViaBridge } from '../printBridge';
import { parseBarcode } from '../barcode';
import { useLiveQuery } from 'dexie-react-hooks';
import { fmtDateTime, fmtQty, uid as genUid } from '../utils';

const demoSale: Sale = {
  number: '20260705-0042',
  date: new Date().toISOString(),
  items: [
    { productId: 'demo-1', nameFr: 'Mouton', nameAr: 'الغنمي', unit: 'kg', qty: 0.5, unitPrice: 150, total: 75 },
    { productId: 'demo-2', nameFr: 'Brochettes de poulet', nameAr: 'بروشيت دجاج', unit: 'kg', qty: 0.25, unitPrice: 80, total: 20 },
    { productId: 'demo-3', nameFr: 'Thé (grand)', nameAr: 'أتاي كبير', unit: 'piece', qty: 1, unitPrice: 20, total: 20 },
  ],
  subtotal: 115,
  discount: 5,
  total: 110,
  paid: 150,
  change: 40,
  payment: 'cash',
  userId: 'demo-user',
  userName: 'Admin',
  status: 'done',
};

function CloudCard() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const status = useSyncExternalStore(subscribeSync, getSyncStatus);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    setBusy(true);
    const err = await enableSync(password);
    setBusy(false);
    if (err) toast(`${t('cloudWrongPassword')}`, 'info');
    else {
      setPassword('');
      toast(t('cloudConnected'));
    }
  };

  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <h2 className="page-title"><Icon name="cloud" size={20} /> {t('cloudSync')}</h2>
      <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: 12 }}>{t('cloudHint')}</p>
      <div className="switch-row" style={{ borderBottom: 'none', paddingTop: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <span className={`sync-dot ${!status.enabled ? '' : status.error ? 'err' : status.syncing ? 'busy' : 'live'}`} />
          {!status.enabled ? t('cloudOff') : status.error ? `${t('cloudError')}` : t('cloudConnected')}
        </span>
        {status.enabled && (
          <span style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>
            {status.pending > 0 && `${status.pending} ${t('pendingChanges')} · `}
            {status.lastSync && `${t('lastSync')}: ${fmtDateTime(status.lastSync, lang)}`}
          </span>
        )}
      </div>
      {!status.enabled ? (
        <>
          <div className="field">
            <label>{t('cloudPassword')} ({CLOUD_EMAIL})</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          </div>
          <button className="btn btn-primary" disabled={!password || busy} onClick={activate}>
            <Icon name="cloud" size={17} /> {t('cloudEnable')}
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" disabled={status.syncing} onClick={() => void syncNow()}>
            <Icon name="refresh" size={17} /> {t('syncNow')}
          </button>
          <button className="btn btn-danger" onClick={() => void disableSync()}>{t('cloudDisable')}</button>
        </div>
      )}
    </div>
  );
}

function ModulesCard() {
  const { t } = useI18n();
  const { toast } = useToast();
  const saved = useLiveQuery(() => getFeatureSettings(), []);
  const [f, setF] = useState<FeatureSettings | null>(null);
  useEffect(() => { if (saved && !f) setF(saved); }, [saved, f]);
  if (!f) return null;

  // Écriture immédiate : ces bascules changent la navigation de tous les
  // appareils, mieux vaut qu'elles ne dépendent pas d'un bouton « Enregistrer »
  // qu'on oublie de presser.
  const up = async (patch: Partial<FeatureSettings>) => {
    const next = { ...f, ...patch };
    setF(next);
    await saveFeatureSettings(next);
    toast(t('settingsSaved'));
  };

  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <h2 className="page-title"><Icon name="grid" size={20} /> {t('modules')}</h2>
      <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: 12 }}>{t('modulesHint')}</p>
      <div className="switch-row">
        <span><Icon name="scale" size={17} style={{ verticalAlign: '-3px', marginInlineEnd: 8 }} />{t('enableWaste')}</span>
        <Switch checked={f.wasteEnabled} onChange={(v) => up({ wasteEnabled: v })} />
      </div>
      <div className="switch-row">
        <span><Icon name="grid" size={17} style={{ verticalAlign: '-3px', marginInlineEnd: 8 }} />{t('enableTables')}</span>
        <Switch checked={f.tablesEnabled} onChange={(v) => up({ tablesEnabled: v })} />
      </div>
      {f.tablesEnabled && (
        <div className="field" style={{ marginTop: 14 }}>
          <label>{t('tableCount')}</label>
          <input
            type="number"
            min={1}
            max={60}
            value={f.tableCount}
            onChange={(e) => up({ tableCount: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
          />
        </div>
      )}
    </div>
  );
}

function AppearanceCard() {
  const { t, lang, setLang } = useI18n();
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  const modes: { id: ThemeMode; icon: 'sun' | 'moon' | 'monitor'; label: string }[] = [
    { id: 'light', icon: 'sun', label: t('themeLight') },
    { id: 'dark', icon: 'moon', label: t('themeDark') },
    { id: 'system', icon: 'monitor', label: t('themeSystem') },
  ];

  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <h2 className="page-title"><Icon name="image" size={20} /> {t('appearance')}</h2>
      <div className="seg" style={{ display: 'flex', width: '100%', marginBottom: 14 }}>
        {modes.map((m) => (
          <button key={m.id} className={theme === m.id ? 'on' : ''} style={{ flex: 1 }} onClick={() => setTheme(m.id)}>
            <Icon name={m.icon} size={16} /> {m.label}
          </button>
        ))}
      </div>
      <label>{t('appLang')}</label>
      <div className="seg" style={{ display: 'flex', width: '100%' }}>
        <button className={lang === 'fr' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setLang('fr')}>Français</button>
        <button className={lang === 'ar' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setLang('ar')}>العربية</button>
      </div>
    </div>
  );
}

function BridgeCard() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [bg, setBg] = useState<BridgeSettings | null>(null);
  const [testing, setTesting] = useState<'idle' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    getBridgeSettings().then(setBg);
  }, []);
  if (!bg) return null;

  const up = (patch: Partial<BridgeSettings>) => {
    setBg({ ...bg, ...patch });
    setTesting('idle');
  };

  const save = async () => {
    await saveBridgeSettings(bg);
    toast(t('settingsSaved'));
  };

  const testConnection = async () => {
    setTesting('idle');
    const ok = await bridgePing(bg);
    setTesting(ok ? 'ok' : 'fail');
  };

  const testPrint = async () => {
    const ts = await getTicketSettings();
    const ok = await testPrintViaBridge(demoSale, ts);
    toast(ok ? t('bridgeConnected') : t('bridgeNotFound'), ok ? 'success' : 'info');
  };

  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <h2 className="page-title"><Icon name="printer" size={20} /> {t('printBridge')}</h2>
      <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: 12 }}>{t('printBridgeHint')}</p>
      <div className="switch-row">
        <span>{t('bridgeEnable')}</span>
        <Switch checked={bg.enabled} onChange={(v) => up({ enabled: v })} />
      </div>
      {bg.enabled && (
        <>
          <div className="field" style={{ marginTop: 12 }}>
            <label>{t('bridgeUrl')}</label>
            <input value={bg.url} onChange={(e) => up({ url: e.target.value })} placeholder="http://127.0.0.1:9123" />
          </div>
          <div className="field">
            <label>{t('bridgeToken')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={bg.token} onChange={(e) => up({ token: e.target.value })} style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={() => up({ token: genUid().slice(0, 8) })}>
                {t('bridgeGenerate')}
              </button>
            </div>
          </div>
          <div className="switch-row">
            <span>{t('bridgeOpenDrawerOnCash')}</span>
            <Switch checked={bg.openDrawerOnCash} onChange={(v) => up({ openDrawerOnCash: v })} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button className="btn btn-ghost" onClick={testConnection}><Icon name="refresh" size={16} /> {t('bridgeTestConnection')}</button>
            <button className="btn btn-ghost" onClick={testPrint}><Icon name="printer" size={16} /> {t('bridgeTestPrint')}</button>
          </div>
          {testing === 'ok' && <div className="change-banner" style={{ marginTop: 10 }}>{t('bridgeConnected')}</div>}
          {testing === 'fail' && <div className="change-banner warn" style={{ marginTop: 10 }}>{t('bridgeNotFound')}</div>}
        </>
      )}
      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={save}>
        <Icon name="check" size={17} /> {t('save')}
      </button>
    </div>
  );
}

function BarcodeCard() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [bc, setBc] = useState<BarcodeSettings | null>(null);
  const [test, setTest] = useState('');
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];

  useEffect(() => {
    getBarcodeSettings().then(setBc);
  }, []);
  if (!bc) return null;

  const up = (patch: Partial<BarcodeSettings>) => setBc({ ...bc, ...patch });
  const testResult = test.trim() ? parseBarcode(test, bc, products) : null;

  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <h2 className="page-title"><Icon name="barcode" size={20} /> {t('barcode')}</h2>
      <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: 12 }}>{t('barcodeHint')}</p>
      <div className="switch-row">
        <span>{t('barcodeEnable')}</span>
        <Switch checked={bc.enabled} onChange={(v) => up({ enabled: v })} />
      </div>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="field">
          <label>{t('barcodePrefix')}</label>
          <input inputMode="numeric" value={bc.prefix} onChange={(e) => up({ prefix: e.target.value.replace(/\D/g, '') })} />
        </div>
        <div className="field">
          <label>{t('barcodeValueMode')}</label>
          <div className="seg" style={{ display: 'flex' }}>
            <button className={bc.valueMode === 'price' ? 'on' : ''} style={{ flex: 1 }} onClick={() => up({ valueMode: 'price' })}>
              {t('barcodePrice')}
            </button>
            <button className={bc.valueMode === 'weight' ? 'on' : ''} style={{ flex: 1 }} onClick={() => up({ valueMode: 'weight' })}>
              {t('barcodeWeight')}
            </button>
          </div>
        </div>
        <div className="field">
          <label>{t('barcodeCodeLen')}</label>
          <input type="number" min={1} max={8} value={bc.codeLen} onChange={(e) => up({ codeLen: Math.max(1, Number(e.target.value) || 1) })} />
        </div>
        <div className="field">
          <label>{t('barcodeValueLen')}</label>
          <input type="number" min={1} max={8} value={bc.valueLen} onChange={(e) => up({ valueLen: Math.max(1, Number(e.target.value) || 1) })} />
        </div>
      </div>
      <div className="field">
        <label>{t('barcodeTest')}</label>
        <input inputMode="numeric" value={test} onChange={(e) => setTest(e.target.value)} placeholder={t('barcodeTestPlaceholder')} />
        {test.trim() && (
          <div className={`change-banner ${testResult ? '' : 'warn'}`} style={{ marginTop: 8, fontSize: '1rem' }}>
            {testResult
              ? `✅ ${localName(testResult.product, lang)}${testResult.qty !== null ? ` — ${fmtQty(testResult.qty, testResult.product.unit)} ${testResult.product.unit === 'kg' ? t('kg') : t('piece')}` : ''}`
              : `❌ ${t('scanUnknown')}`}
          </div>
        )}
      </div>
      <button
        className="btn btn-primary"
        onClick={async () => {
          await saveBarcodeSettings(bc);
          toast(t('settingsSaved'));
        }}
      >
        <Icon name="check" size={17} /> {t('save')}
      </button>
    </div>
  );
}

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
        <h2 className="page-title"><Icon name="settings" size={20} /> {t('settings')}</h2>
        <button className="btn btn-primary" onClick={save}><Icon name="check" size={17} /> {t('save')}</button>
      </div>

      <div className="grid-2">
        <div>
          <ModulesCard />
          <AppearanceCard />
          <CloudCard />
          <BridgeCard />
          <BarcodeCard />
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h2 className="page-title"><Icon name="book" size={20} /> {t('shopInfo')}</h2>
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
                <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Icon name="image" size={17} /> {t('uploadLogo')}</button>
                {ts.logo && <button className="btn btn-danger" onClick={() => up({ logo: '' })}>{t('removeLogo')}</button>}
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <h2 className="page-title"><Icon name="image" size={20} /> {t('ticketDesign')}</h2>
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

          <div className="card card-pad danger-card" style={{ marginTop: 14 }}>
            <h2 className="page-title"><Icon name="alert" size={20} /> {t('dangerZone')}</h2>
            <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>{t('resetData')}</button>
          </div>
        </div>

        <div>
          <div className="card card-pad">
            <div className="page-head" style={{ marginBottom: 10 }}>
              <h2 className="page-title"><Icon name="printer" size={20} /> {t('ticketPreview')}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => printHTML(previewHTML)}><Icon name="printer" size={16} /> {t('testPrint')}</button>
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
          title={`${t('dangerZone')}`}
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
