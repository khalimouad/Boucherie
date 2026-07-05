import { useEffect, useState } from 'react';
import { seedIfEmpty, type Role, type User } from './db';
import { useI18n, type TKey } from './i18n';
import { ToastProvider } from './components/shared';
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
  icon: string;
  label: TKey;
  roles: Role[];
}

export const NAV: NavDef[] = [
  { id: 'pos', icon: '🛒', label: 'navPos', roles: ['admin', 'manager', 'cashier'] },
  { id: 'products', icon: '🥩', label: 'navProducts', roles: ['admin', 'manager'] },
  { id: 'purchases', icon: '🚚', label: 'navPurchases', roles: ['admin', 'manager'] },
  { id: 'waste', icon: '⚖️', label: 'navWaste', roles: ['admin', 'manager', 'cashier'] },
  { id: 'reports', icon: '📊', label: 'navReports', roles: ['admin', 'manager'] },
  { id: 'users', icon: '👥', label: 'navUsers', roles: ['admin'] },
  { id: 'settings', icon: '⚙️', label: 'navSettings', roles: ['admin'] },
];

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<PageId>('pos');

  useEffect(() => {
    seedIfEmpty().then(() => setReady(true));
  }, []);

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

  return (
    <ToastProvider>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span className="logo-emoji">🥩</span>
            <span>{t('appName')}</span>
          </div>
          <nav>
            {allowed.map((n) => (
              <button key={n.id} className={`nav-item ${current === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
                <span className="ni-icon">{n.icon}</span>
                <span>{t(n.label)}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-user">
            <div className="su-name">{user.name}</div>
            <div className="su-role">{t(user.role)}</div>
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => setUser(null)}>
              ⎋ {t('logout')}
            </button>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <h1>{t(allowed.find((n) => n.id === current)!.label)}</h1>
            <div className="topbar-right">
              <div className="lang-switch">
                <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>FR</button>
                <button className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>ع</button>
              </div>
              <button className="btn btn-ghost btn-sm hide-desktop-logout" onClick={() => setUser(null)} title={t('logout')}>⎋</button>
            </div>
          </header>
          <main className="content">{renderPage()}</main>
        </div>

        <nav className="bottomnav">
          {allowed.map((n) => (
            <button key={n.id} className={current === n.id ? 'active' : ''} onClick={() => setPage(n.id)}>
              <span className="ni-icon">{n.icon}</span>
              <span>{t(n.label)}</span>
            </button>
          ))}
        </nav>
      </div>
    </ToastProvider>
  );
}
