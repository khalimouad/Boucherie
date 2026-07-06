import { getBridgeSettings, type BridgeSettings, type Sale, type TicketSettings } from './db';
import { buildSaleTicketJob, drawerKickBytes } from './escpos';

async function post(cfg: BridgeSettings, path: string, body: Uint8Array, timeoutMs = 4000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(cfg.url.replace(/\/$/, '') + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', ...(cfg.token ? { 'X-Bridge-Token': cfg.token } : {}) },
      body: body as BodyInit,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export async function bridgePing(cfg: BridgeSettings): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(cfg.url.replace(/\/$/, '') + '/ping', { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** Tries the local print bridge (silent, can kick the drawer); caller should
 * fall back to the browser print dialog when this returns false. */
export async function printSaleViaBridge(sale: Sale, ts: TicketSettings, duplicate = false): Promise<boolean> {
  const cfg = await getBridgeSettings();
  if (!cfg.enabled) return false;
  const openDrawer = !duplicate && sale.payment === 'cash' && cfg.openDrawerOnCash;
  const job = await buildSaleTicketJob(sale, ts, { duplicate, openDrawer });
  return post(cfg, '/print', job);
}

export async function openDrawerViaBridge(): Promise<boolean> {
  const cfg = await getBridgeSettings();
  if (!cfg.enabled) return false;
  return post(cfg, '/drawer', drawerKickBytes());
}

export async function testPrintViaBridge(sale: Sale, ts: TicketSettings): Promise<boolean> {
  const cfg = await getBridgeSettings();
  if (!cfg.enabled) return false;
  const job = await buildSaleTicketJob(sale, ts, { openDrawer: false });
  return post(cfg, '/print', job, 6000);
}
