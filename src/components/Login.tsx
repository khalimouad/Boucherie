import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hashPin, type User } from '../db';
import { useI18n } from '../i18n';
import { NumPad } from './shared';

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const { t, lang, setLang } = useI18n();
  const users = useLiveQuery(() => db.users.filter((u) => u.active).toArray(), []) ?? [];
  const [selected, setSelected] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!selected || pin.length < 4) return;
    let cancelled = false;
    hashPin(pin).then((h) => {
      if (cancelled) return;
      if (h === selected.pinHash) {
        onLogin(selected);
      } else {
        setError(true);
        setPin('');
        setTimeout(() => setError(false), 1500);
      }
    });
    return () => { cancelled = true; };
  }, [pin, selected, onLogin]);

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">🥩</div>
        <div className="login-title">{t('appName')}</div>
        <div className="login-sub">{selected ? t('enterPin') : t('selectUser')}</div>

        {!selected && (
          <>
            <div className="user-tiles">
              {users.map((u) => (
                <button key={u.id} className="user-tile" onClick={() => { setSelected(u); setPin(''); }}>
                  <span className="avatar">{u.name.charAt(0).toUpperCase()}</span>
                  <span className="tile-name">{u.name}</span>
                  <span className="tile-role">{t(u.role)}</span>
                </button>
              ))}
            </div>
            <div className="lang-switch" style={{ display: 'inline-flex' }}>
              <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>Français</button>
              <button className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>العربية</button>
            </div>
          </>
        )}

        {selected && (
          <>
            <div className="pin-dots">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`pin-dot ${pin.length > i ? 'full' : ''}`} />
              ))}
            </div>
            <div className="pin-error">{error ? t('wrongPin') : ''}</div>
            <NumPad value={pin} onChange={(v) => setPin(v.slice(0, 4))} allowDecimal={false} maxLen={4} />
            <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={() => { setSelected(null); setPin(''); }}>
              ← {t('back')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
