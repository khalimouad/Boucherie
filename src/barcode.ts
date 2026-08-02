import { useEffect, useRef } from 'react';
import type { BarcodeSettings, Product } from './db';

export interface ScanResult {
  product: Product;
  /** Quantity resolved from the embedded value; null when the barcode only identifies the product. */
  qty: number | null;
}

const stripZeros = (s: string) => s.replace(/^0+/, '') || '0';

/**
 * Resolve a scanned barcode against the catalog.
 * Scale labels follow [prefix][item code][value][check digit] (value = price in
 * centimes or weight in grams, per settings). Any other code is matched
 * verbatim against the product `code` field.
 */
/** Check if barcode matches prefix pattern. 'x' in pattern matches any digit. */
function matchesPrefix(barcode: string, pattern: string): boolean {
  if (barcode.length < pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== 'x' && pattern[i] !== barcode[i]) return false;
  }
  return true;
}

export function parseBarcode(raw: string, cfg: BarcodeSettings, products: Product[]): ScanResult | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  const scaleLen = cfg.prefix.length + cfg.codeLen + cfg.valueLen + 1; // +1 EAN check digit
  if (cfg.enabled && digits.length === scaleLen && matchesPrefix(digits, cfg.prefix)) {
    const code = digits.slice(cfg.prefix.length, cfg.prefix.length + cfg.codeLen);
    const valueDigits = digits.slice(cfg.prefix.length + cfg.codeLen, cfg.prefix.length + cfg.codeLen + cfg.valueLen);
    const product = products.find((p) => p.code && stripZeros(p.code) === stripZeros(code));
    if (product) {
      const value = parseInt(valueDigits, 10);
      let qty: number | null = null;
      if (cfg.valueMode === 'price') {
        const amount = value / 100; // centimes → DH
        qty = product.price > 0 ? amount / product.price : null;
      } else {
        qty = value / 1000; // grams → kg
      }
      if (qty !== null) qty = Math.round(qty * 1000) / 1000;
      return { product, qty };
    }
  }

  // plain product barcode / PLU typed or scanned as-is
  const product = products.find((p) => p.code && (p.code === digits || stripZeros(p.code) === stripZeros(digits)));
  if (product) return { product, qty: null };
  return null;
}

/**
 * Keyboard-wedge scanner listener: USB scanners type digits very fast and end
 * with Enter. Bursts slower than a human typist are ignored.
 */
export function useScanner(onScan: (code: string) => void, enabled: boolean) {
  const buf = useRef('');
  const lastKey = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const now = performance.now();
      if (now - lastKey.current > 150) buf.current = '';
      lastKey.current = now;

      if (e.key >= '0' && e.key <= '9') {
        buf.current += e.key;
        return;
      }
      if (e.key === 'Enter' && buf.current.length >= 6) {
        e.preventDefault();
        const code = buf.current;
        buf.current = '';
        onScan(code);
        return;
      }
      if (e.key !== 'Shift') buf.current = '';
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onScan, enabled]);
}
