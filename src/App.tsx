import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedIfEmpty, type Role, type User } from './db';
import { localName, useI18n, type TKey } from './i18n';
import { Drawer, ToastProvider, tap } from './components/shared';
import { Icon, type IconName } from './components/Icon';
import { getSyncStatus, initSync, subscribeSync } from './sync';
import { cycleTheme, getTheme, subscribeTheme } from './theme';
import { appLogo } from './logo';
import { fmtQty } from './utils';
import Login from './components/Login';
import POS from './pages/POS';
import Products from './pages/Products';
import Purchases from './pages/Purchases';
import Waste from './pages/Waste';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';

export type PageId = 'pos' | 'products' | 'purchases' | 'waste' | 'reports' | 'users' | 'settings';

interface NavDef {
  id: PageId;
  icon: IconName;
  label: TKey;
  roles: Role[];
}

export const NAV: NavDef[] = [
  { id: 'pos', icon: 'book', label: 'navPos', roles: ['admin', 'manager', 'cashier'] },
  { id: 'products', icon: 'meat', label: 'navProducts', roles: ['admin', 'manager'] },
  { id: 'purchases', icon: 'truck', label: 'navPurchases', roles: ['admin', 'manager'] },
  { id: 'waste', icon: 'scale', label: 'navWaste', roles: ['admin', 'manager', 'cashier'] },
  { id: 'reports', icon: 'chart', label: 'navReports', roles: ['admin', 'manager'] },
  { id: 'users', icon: 'users', label: 'navUsers', roles: ['admin'] },
  { id: 'settings', icon: 'settings', label: 'navSettings', roles: ['admin'] },
];

/** Phones only have room for a handful of dock slots; the rest move behind "More". */
const DOCK_SLOTS = 4;

/* Network reachability, so a queued change reads as "waiting" and not as a
   failure — a red badge on a till makes staff think the register is broken. */
const onlineSubscribe = (fn: () => void) => {
  window.addEventListener('online', fn);
  window.addEventListener('offline', fn);
  return () => {
    window.removeEventListener('online', fn);
    window.removeEventListener('offline', fn);
  };
};
const onlineSnapshot = () => navigator.onLine;

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<PageId>('pos');
  const [menuOpen, setMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const lowStock = useLiveQuery(() => db.products.filter((p) => p.active && p.stock <= p.lowStock).toArray(), []) ?? [];

  useEffect(() => {
    seedIfEmpty()
      .catch((e) => console.error('seed failed', e))
      .finally(() => {
        setReady(true);
        initSync();
      });
  }, []);

  const sync = useSyncExternalStore(subscribeSync, getSyncStatus);
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  const online = useSyncExternalStore(onlineSubscribe, onlineSnapshot);

  if (!ready) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="boot">
            <img className="login-logo" src={appLogo} alt="" width={76} height={76} />
            <div className="login-sub" style={{ margin: 0 }}>{t('loading')}</div>
            <div className="boot-bar" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <ToastProvider>
        <Login onLogin={(u) => { setUser(u); setPage('pos'); }} />
      </ToastProvider>
    );
  }

  const allowed = NAV.filter((n) => n.roles.includes(user.role));
  const current = allowed.some((n) => n.id === page) ? page : 'pos';
  const currentNav = allowed.find((n) => n.id === current)!;
  const go = (id: PageId) => {
    tap();
    setPage(id);
    setMenuOpen(false);
  };

  const overflow = allowed.length > DOCK_SLOTS;
  const docked = overflow ? allowed.slice(0, DOCK_SLOTS) : allowed;
  const inMore = overflow && !docked.some((n) => n.id === current);

  const renderPage = () => {
    switch (current) {
      case 'pos': return <POS user={user} />;
      case 'products': return <Products />;
      case 'purchases': return <Purchases user={user} />;
      case 'waste': return <Waste user={user} />;
      case 'reports': return <Reports />;
      case 'users': return <Users currentUser={user} />;
      case 'settings': return <Settings />;
    }
  };

  // Losing the network is normal on a shop line and is not a failure: writes
  // keep queuing locally and flush on reconnect, so it reads amber, not red.
  const syncState = !sync.enabled
    ? 'off'
    : !online
      ? 'busy'
      : sync.error
        ? 'err'
        : sync.syncing || sync.pending > 0
          ? 'busy'
          : 'live';
  // the pill stays short; the descriptive wording lives in the tooltip
  const syncLabel = !sync.enabled
    ? t('offline')
    : !online
      ? t('offline')
      : sync.error
        ? t('errorShort')
        : sync.syncing
          ? t('syncing')
          : sync.pending > 0
            ? `${sync.pending} ${t('pendingChanges')}`
            : t('online');
  const syncTitle = !sync.enabled
    ? t('cloudOff')
    : !online
      ? t('offlineQueued')
      : sync.error
        ? t('cloudError')
        : t('cloudConnected');

  const themeIcon: IconName = theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'monitor';
  const themeLabel = theme === 'light' ? t('themeLight') : theme === 'dark' ? t('themeDark') : t('themeSystem');

  return (
    <ToastProvider>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <img className="brand-mark" src={appLogo} alt="" width={40} height={40} />
            <span>{t('appName')}</span>
          </div>
          <nav>
            {allowed.map((n, i) => (
              <button
                key={n.id}
                className={`nav-item ${current === n.id ? 'active' : ''}`}
                style={{ '--i': i } as CSSProperties}
                onClick={() => go(n.id)}
              >
                <span className="ni-icon"><Icon name={n.icon} size={20} /></span>
                <span>{t(n.label)}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-user">
            <div className="su-name">{user.name}</div>
            <div className="su-role">{t(user.role)}</div>
            <button className="btn btn-ghost btn-sm btn-block" onClick={() => setUser(null)}>
              <Icon name="logout" size={17} /> {t('logout')}
            </button>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="tb-icon-btn hide-desktop" onClick={() => setMenuOpen(true)} aria-label={t('menu')}>
              <Icon name="menu" size={21} />
            </button>
            <div className="topbar-brand">
              <img className="brand-mark" src={appLogo} alt="" width={38} height={38} />
              <span style={{ minWidth: 0 }}>
                <span className="tb-name" style={{ display: 'block' }}>{t('appName')}</span>
                <span className="tb-page">{t(currentNav.label)}</span>
              </span>
            </div>
            <div className="tb-heading">
              <h1 key={current}>{t(currentNav.label)}</h1>
              <div className="tb-sub">{user.name} · {t(user.role)}</div>
            </div>
            <div className="topbar-right">
              <span className="sync-pill" role="status" title={syncTitle} aria-label={syncTitle}>
                <span className={`sync-dot ${syncState}`} />
                <span className="sp-text">{syncLabel}</span>
              </span>
              <button className="tb-icon-btn" onClick={() => { tap(); cycleTheme(); }} aria-label={`${t('appearance')}: ${themeLabel}`} title={`${t('appearance')}: ${themeLabel}`}>
                <Icon name={themeIcon} size={19} />
              </button>
              <button className="tb-icon-btn" onClick={() => setAlertsOpen(true)} aria-label={t('lowStockAlert')}>
                <Icon name="bell" size={19} />
                {lowStock.length > 0 && <span className="tb-badge">{lowStock.length}</span>}
              </button>
              <div className="lang-switch">
                <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>FR</button>
                <button className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>ع</button>
              </div>
            </div>
          </header>

          <main className="content">
            <div className="page-swap" key={current}>{renderPage()}</div>
          </main>
        </div>

        <nav className="bottomnav" aria-label={t('menu')}>
          {docked.map((n) => (
            <button key={n.id} className={current === n.id ? 'active' : ''} onClick={() => go(n.id)}>
              <span className="ni-icon"><Icon name={n.icon} size={21} /></span>
              <span>{t(n.label)}</span>
            </button>
          ))}
          {overflow && (
            <button className={inMore ? 'active' : ''} onClick={() => { tap(); setMenuOpen(true); }}>
              <span className="ni-icon"><Icon name="dots" size={21} /></span>
              <span>{t('more')}</span>
            </button>
          )}
        </nav>

        {menuOpen && (
          <Drawer title={t('appName')} onClose={() => setMenuOpen(false)}>
            <nav className="menu-drawer">
              {allowed.map((n, i) => (
                <button
                  key={n.id}
                  className={`menu-item ${current === n.id ? 'active' : ''}`}
                  style={{ '--i': i } as CSSProperties}
                  onClick={() => go(n.id)}
                >
                  <Icon name={n.icon} size={21} />
                  <span>{t(n.label)}</span>
                </button>
              ))}
              <button
                className="menu-item"
                style={{ '--i': allowed.length } as CSSProperties}
                onClick={() => { setMenuOpen(false); setUser(null); }}
              >
                <Icon name="logout" size={21} />
                <span>{t('logout')}</span>
              </button>
            </nav>

            <div className="switch-row" style={{ marginTop: 18 }}>
              <label style={{ margin: 0 }}>{t('appLang')}</label>
              <div className="lang-switch">
                <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>Français</button>
                <button className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>العربية</button>
              </div>
            </div>
            <div className="switch-row">
              <label style={{ margin: 0 }}>{t('appearance')}</label>
              <button className="btn btn-ghost btn-sm" onClick={() => { tap(); cycleTheme(); }}>
                <Icon name={themeIcon} size={17} /> {themeLabel}
              </button>
            </div>
          </Drawer>
        )}

        {alertsOpen && (
          <Drawer title={t('lowStockAlert')} onClose={() => setAlertsOpen(false)}>
            {lowStock.length === 0 ? (
              <div className="empty-state"><div className="es-icon">✅</div><div>{t('noData')}</div></div>
            ) : (
              <div className="alert-list">
                {lowStock.map((p, i) => (
                  <div key={p.id} className="alert-row" style={{ '--i': i } as CSSProperties}>
                    <span className="alert-ico"><Icon name="alert" size={20} /></span>
                    <span className="alert-name">{localName(p, lang)}</span>
                    <span className="alert-qty">{fmtQty(p.stock, p.unit)} {p.unit === 'kg' ? t('kg') : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </Drawer>
        )}
      </div>
    </ToastProvider>
  );
}
