import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedIfEmpty, type Role, type User } from './db';
import { localName, useI18n, type TKey } from './i18n';
import { Drawer, ToastProvider } from './components/shared';
import { Icon, type IconName } from './components/Icon';
import { getSyncStatus, initSync, subscribeSync } from './sync';
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

  if (!ready) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">🥩</div>
          <div className="login-sub">{t('loading')}</div>
        </div>
      </div>
    );
  }

  if (!user) return <ToastProvider><Login onLogin={(u) => { setUser(u); setPage('pos'); }} /></ToastProvider>;

  const allowed = NAV.filter((n) => n.roles.includes(user.role));
  const current = allowed.some((n) => n.id === page) ? page : 'pos';
  const go = (id: PageId) => { setPage(id); setMenuOpen(false); };

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

  const syncTitle = !sync.enabled ? t('cloudOff') : sync.error ? t('cloudError') : t('cloudConnected');

  return (
    <ToastProvider>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span className="logo-emoji"><Icon name="meat" size={22} /></span>
            <span>{t('appName')}</span>
          </div>
          <nav>
            {allowed.map((n) => (
              <button key={n.id} className={`nav-item ${current === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
                <span className="ni-icon"><Icon name={n.icon} size={20} /></span>
                <span>{t(n.label)}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-user">
            <div className="su-name">{user.name}</div>
            <div className="su-role">{t(user.role)}</div>
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => setUser(null)}>
              <Icon name="logout" size={17} /> {t('logout')}
            </button>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <h1>{t(allowed.find((n) => n.id === current)!.label)}</h1>
            <button className="tb-icon-btn hide-desktop" onClick={() => setMenuOpen(true)} aria-label={t('menu')}>
              <Icon name="menu" size={22} />
            </button>
            <div className="topbar-brand">
              <span className="tb-logo" aria-hidden="true"><Icon name="meat" size={20} /></span>
              <span className="tb-name">{t('appName')}</span>
            </div>
            <div className="topbar-right">
              <span className="sync-dot" role="status" aria-label={syncTitle} title={syncTitle}
                style={{ background: !sync.enabled ? 'var(--border-strong)' : sync.error ? 'var(--brand-500)' : sync.pending > 0 ? 'var(--amber)' : 'var(--accent)' }}
              />
              <button className="tb-icon-btn" onClick={() => setAlertsOpen(true)} aria-label={t('lowStockAlert')}>
                <Icon name="bell" size={20} />
                {lowStock.length > 0 && <span className="tb-badge">{lowStock.length}</span>}
              </button>
              <div className="lang-switch">
                <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>FR</button>
                <button className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>ع</button>
              </div>
            </div>
          </header>
          <main className="content">{renderPage()}</main>
        </div>

        <nav className="bottomnav">
          {allowed.map((n) => (
            <button key={n.id} className={current === n.id ? 'active' : ''} onClick={() => setPage(n.id)}>
              <span className="ni-icon"><Icon name={n.icon} size={22} /></span>
              <span>{t(n.label)}</span>
            </button>
          ))}
        </nav>

        {menuOpen && (
          <Drawer title={t('appName')} onClose={() => setMenuOpen(false)}>
            <nav className="menu-drawer">
              {allowed.map((n) => (
                <button key={n.id} className={`menu-item ${current === n.id ? 'active' : ''}`} onClick={() => go(n.id)}>
                  <Icon name={n.icon} size={22} />
                  <span>{t(n.label)}</span>
                </button>
              ))}
              <button className="menu-item" onClick={() => { setMenuOpen(false); setUser(null); }}>
                <Icon name="logout" size={22} />
                <span>{t('logout')}</span>
              </button>
              <div className="lang-switch" style={{ margin: '12px 8px 0' }}>
                <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>Français</button>
                <button className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>العربية</button>
              </div>
            </nav>
          </Drawer>
        )}

        {alertsOpen && (
          <Drawer title={t('lowStockAlert')} onClose={() => setAlertsOpen(false)}>
            {lowStock.length === 0 ? (
              <div className="empty-state"><div className="es-icon">✅</div><div>{t('noData')}</div></div>
            ) : (
              <div className="alert-list">
                {lowStock.map((p) => (
                  <div key={p.id} className="alert-row">
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
