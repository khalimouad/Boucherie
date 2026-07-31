import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useI18n } from '../i18n';
import { Icon } from './Icon';

/* ---------- haptics ----------
   A short tick on keypad / add-to-cart makes a touch till feel physical.
   Silently unavailable on iOS Safari and desktop, which is fine. */
export function tap(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

/* ---------- exit animations ----------
   Overlays are rendered conditionally by their parent, so an exit animation
   needs the close to be deferred: flip to `closing`, let CSS play, then unmount. */
const EXIT_MS = 190;

function useDismiss(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const dismiss = useCallback(() => {
    if (timer.current) return;
    setClosing(true);
    timer.current = setTimeout(() => onCloseRef.current(), EXIT_MS);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss]);

  return { closing, dismiss };
}

/* ---------- swipe-to-dismiss ----------
   Dragging the grab handle down past a threshold closes the sheet; anything
   shorter springs back. Pointer events cover touch, pen and mouse. */
function useSheetDrag(dismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const moved = useRef(0);

  const setY = (y: number, animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.classList.toggle('dragging', !animate);
    el.classList.toggle('settling', animate);
    el.style.transform = y ? `translateY(${y}px)` : '';
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (window.innerWidth > 700) return; // sheet behaviour is mobile-only
    start.current = e.clientY;
    moved.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (start.current === null) return;
    moved.current = Math.max(0, e.clientY - start.current);
    setY(moved.current, false);
  };

  const onPointerUp = () => {
    if (start.current === null) return;
    start.current = null;
    if (moved.current > 110) {
      setY(window.innerHeight, true);
      dismiss();
    } else {
      setY(0, true);
    }
  };

  return {
    ref,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}

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
    tap(kind === 'success' ? 14 : 8);
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
          <Icon name={msg.kind === 'success' ? 'check' : 'alert'} size={18} />
          {msg.text}
        </div>
      )}
    </TCtx.Provider>
  );
}

/* ---------- Modal (centered dialog on desktop, bottom sheet on phones) ---------- */
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
  const { closing, dismiss } = useDismiss(onClose);
  const { ref, handlers } = useSheetDrag(dismiss);

  return (
    <div
      className={`modal-backdrop ${closing ? 'closing' : ''}`}
      onClick={(e) => e.target === e.currentTarget && dismiss()}
    >
      <div ref={ref} className={`modal ${wide ? 'wide' : ''} ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-grab" {...handlers} aria-hidden="true" />
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="x-btn" onClick={dismiss} aria-label="Fermer">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Drawer (side panel on desktop, bottom sheet on phones) ---------- */
export function Drawer({
  title,
  onClose,
  children,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const { closing, dismiss } = useDismiss(onClose);
  const { ref, handlers } = useSheetDrag(dismiss);

  return (
    <div
      className={`drawer-backdrop ${closing ? 'closing' : ''}`}
      onClick={(e) => e.target === e.currentTarget && dismiss()}
    >
      <aside ref={ref} className={`drawer ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true">
        <div className="drawer-head" {...handlers}>
          <h2>{title}</h2>
          <button className="x-btn" onClick={dismiss} aria-label="Fermer">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

/* ---------- Toggle switch ---------- */
export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          tap();
          onChange(e.target.checked);
        }}
      />
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
    tap();
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
