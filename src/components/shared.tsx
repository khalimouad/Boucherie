import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useI18n } from '../i18n';

/* ---------- Toast ---------- */
interface ToastCtx {
  toast: (msg: string, kind?: 'success' | 'info') => void;
}
const TCtx = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(TCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; kind: string; key: number } | null>(null);
  const toast = useCallback((text: string, kind: 'success' | 'info' = 'success') => {
    setMsg({ text, kind, key: Date.now() });
  }, []);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(id);
  }, [msg]);
  return (
    <TCtx.Provider value={{ toast }}>
      {children}
      {msg && (
        <div className={`toast ${msg.kind}`} role="status" aria-live="polite" key={msg.key}>
          <span aria-hidden="true">{msg.kind === 'success' ? '✅' : 'ℹ️'}</span>
          {msg.text}
        </div>
      )}
    </TCtx.Provider>
  );
}

/* ---------- Modal ---------- */
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="x-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Toggle switch ---------- */
export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      <span className="thumb" />
    </span>
  );
}

/* ---------- NumPad (touch keypad) ---------- */
export function NumPad({
  value,
  onChange,
  allowDecimal = true,
  maxLen = 9,
}: {
  value: string;
  onChange: (v: string) => void;
  allowDecimal?: boolean;
  maxLen?: number;
}) {
  const press = (k: string) => {
    if (k === 'C') return onChange('');
    if (k === '⌫') return onChange(value.slice(0, -1));
    if (k === '.') {
      if (!allowDecimal || value.includes('.')) return;
      return onChange(value === '' ? '0.' : value + '.');
    }
    if (value.length >= maxLen) return;
    // collapse a leading zero for numeric amounts only — PIN entry (allowDecimal=false)
    // must keep raw digits so codes like 0000 stay typable
    if (allowDecimal && value === '0' && k !== '.') return onChange(k);
    // limit to 3 decimals (weights) — money inputs get rounded on commit
    const dot = value.indexOf('.');
    if (dot >= 0 && value.length - dot > 3) return;
    onChange(value + k);
  };
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', allowDecimal ? '.' : 'C', '0', '⌫'];
  return (
    <div className="numpad">
      {keys.map((k) => (
        <button key={k} type="button" className={k === '⌫' || k === 'C' ? 'action' : ''} onClick={() => press(k)}>
          {k === '.' ? ',' : k}
        </button>
      ))}
    </div>
  );
}

/* ---------- Empty state ---------- */
export function Empty({ icon = '📦' }: { icon?: string }) {
  const { t } = useI18n();
  return (
    <div className="empty-state">
      <div className="es-icon">{icon}</div>
      <div>{t('noData')}</div>
    </div>
  );
}

/* ---------- Skeleton loading placeholders ---------- */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function ProductGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="skeleton-card" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ padding: 18 }} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="skeleton-line" style={{ width: `${88 - i * 4}%` }} />
      ))}
    </div>
  );
}
