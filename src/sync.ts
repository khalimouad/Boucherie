import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import {
  db,
  getTombstones,
  setTombstones,
  setApplyingRemote,
  SYNCED_TABLES,
  type SyncedTable,
} from './db';
import { setClockOffset } from './utils';

/* Cloud endpoint of the shop. The publishable key is safe to embed; all data
   access is gated by Row Level Security + the shop's cloud password. */
export const SUPABASE_URL = 'https://nkqlwcjgvxkhxhmnrpfc.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_UhGqkbZO4LFihxJcquAEUg_BOy3gcaO';
export const CLOUD_EMAIL = 'uncmou+caisse@gmail.com';

const CONF_KEY = 'pos-cloud';
const LAST_PULL_KEY = 'pos-last-pull';

interface CloudConf {
  enabled: boolean;
  password: string;
}

function getConf(): CloudConf {
  try {
    return { enabled: false, password: '', ...JSON.parse(localStorage.getItem(CONF_KEY) ?? '{}') };
  } catch {
    return { enabled: false, password: '' };
  }
}

function setConf(c: CloudConf) {
  localStorage.setItem(CONF_KEY, JSON.stringify(c));
}

export interface SyncStatus {
  enabled: boolean;
  signedIn: boolean;
  syncing: boolean;
  pending: number;
  lastSync: string | null; // ISO
  error: string | null;
}

let status: SyncStatus = {
  enabled: getConf().enabled,
  signedIn: false,
  syncing: false,
  pending: 0,
  lastSync: null,
  error: null,
};

const listeners = new Set<() => void>();

export function subscribeSync(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

function update(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((fn) => fn());
}

let client: SupabaseClient | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let channel: RealtimeChannel | null = null;
let syncRunning = false;

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

async function measureClockOffset() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: SUPABASE_KEY } });
    const serverDate = res.headers.get('date');
    if (serverDate) setClockOffset(new Date(serverDate).getTime() - Date.now());
  } catch {
    /* offline — keep previous offset */
  }
}

async function ensureSignedIn(): Promise<boolean> {
  const c = getClient();
  const { data } = await c.auth.getSession();
  if (data.session) {
    update({ signedIn: true });
    return true;
  }
  const conf = getConf();
  if (!conf.password) return false;
  const { error } = await c.auth.signInWithPassword({ email: CLOUD_EMAIL, password: conf.password });
  update({ signedIn: !error, error: error ? error.message : null });
  return !error;
}

async function countPending(): Promise<number> {
  let n = getTombstones().length;
  for (const tbl of SYNCED_TABLES) {
    n += await db.table(tbl).filter((r) => (r as { _dirty?: number })._dirty === 1).count();
  }
  return n;
}

function rowPk(tbl: SyncedTable, row: Record<string, unknown>): string {
  return String(tbl === 'settings' ? row.key : row.id);
}

async function pushChanges(c: SupabaseClient) {
  // tombstones first (deletions)
  const tombs = getTombstones();
  if (tombs.length > 0) {
    const payload = tombs.map((t) => ({ table_name: t.tbl, id: t.id, data: {}, deleted: true }));
    const { error } = await c.from('pos_rows').upsert(payload);
    if (error) throw new Error(error.message);
    setTombstones([]);
  }

  for (const tbl of SYNCED_TABLES) {
    const dirty = (await db.table(tbl).filter((r) => (r as { _dirty?: number })._dirty === 1).toArray()) as Record<
      string,
      unknown
    >[];
    if (dirty.length === 0) continue;

    const payload = dirty.map((row) => {
      const { _dirty, ...data } = row;
      return { table_name: tbl, id: rowPk(tbl, row), data, deleted: false };
    });
    const { error } = await c.from('pos_rows').upsert(payload);
    if (error) throw new Error(error.message);

    // clear the dirty flag unless the row changed again while we were pushing
    setApplyingRemote(true);
    try {
      await db.transaction('rw', db.table(tbl), async () => {
        for (const row of dirty) {
          const cur = (await db.table(tbl).get(rowPk(tbl, row))) as Record<string, unknown> | undefined;
          if (cur && cur.updatedAt === row.updatedAt) {
            const { _dirty, ...clean } = cur;
            await db.table(tbl).put(clean);
          }
        }
      });
    } finally {
      setApplyingRemote(false);
    }
  }
}

async function pullChanges(c: SupabaseClient) {
  let since = localStorage.getItem(LAST_PULL_KEY) ?? '1970-01-01T00:00:00Z';
  for (;;) {
    const { data, error } = await c
      .from('pos_rows')
      .select('table_name, id, data, updated_at, deleted')
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    setApplyingRemote(true);
    try {
      for (const row of data) {
        const tbl = row.table_name as SyncedTable;
        if (!(SYNCED_TABLES as readonly string[]).includes(tbl)) continue;
        const table = db.table(tbl);
        const local = (await table.get(row.id)) as Record<string, unknown> | undefined;
        if (row.deleted) {
          if (local) await table.delete(row.id);
          continue;
        }
        const remote = row.data as Record<string, unknown>;
        if (local) {
          const localAt = String(local.updatedAt ?? '');
          const remoteAt = String(remote.updatedAt ?? '');
          if (localAt === remoteAt) continue; // echo of our own push
          if (local._dirty === 1 && localAt > remoteAt) continue; // local pending change is newer
        }
        await table.put(remote);
      }
    } finally {
      setApplyingRemote(false);
    }

    since = data[data.length - 1].updated_at as string;
    localStorage.setItem(LAST_PULL_KEY, since);
    if (data.length < 500) break;
  }
}

export async function syncNow(): Promise<void> {
  if (syncRunning || !getConf().enabled) return;
  syncRunning = true;
  update({ syncing: true });
  try {
    await measureClockOffset();
    if (!(await ensureSignedIn())) {
      update({ syncing: false, error: status.error ?? 'auth' });
      return;
    }
    const c = getClient();
    await pushChanges(c);
    await pullChanges(c);
    update({
      syncing: false,
      error: null,
      lastSync: new Date().toISOString(),
      pending: await countPending(),
    });
  } catch (e) {
    update({ syncing: false, error: e instanceof Error ? e.message : String(e), pending: await countPending() });
  } finally {
    syncRunning = false;
  }
}

let debounceId: ReturnType<typeof setTimeout> | null = null;
function requestSync(delay = 600) {
  if (debounceId) clearTimeout(debounceId);
  debounceId = setTimeout(() => void syncNow(), delay);
}

function startLoop() {
  if (timer) return;
  timer = setInterval(() => void syncNow(), 15000);
  window.addEventListener('online', () => requestSync(1000));
  // realtime: any remote write wakes us up so the manager's phone stays live
  const c = getClient();
  channel = c
    .channel('pos-rows-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_rows' }, () => requestSync())
    .subscribe();
}

function stopLoop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (channel) {
    void getClient().removeChannel(channel);
    channel = null;
  }
}

/** Called once at app start. */
export function initSync() {
  if (getConf().enabled) {
    update({ enabled: true });
    startLoop();
    requestSync(500);
  }
  void countPending().then((pending) => update({ pending }));
}

/** Enable cloud sync on this device with the shop password. */
export async function enableSync(password: string): Promise<string | null> {
  const c = getClient();
  const { error } = await c.auth.signInWithPassword({ email: CLOUD_EMAIL, password });
  if (error) return error.message;
  setConf({ enabled: true, password });
  update({ enabled: true, signedIn: true, error: null });
  startLoop();
  requestSync(100);
  return null;
}

export async function disableSync() {
  setConf({ enabled: false, password: '' });
  stopLoop();
  try {
    await getClient().auth.signOut();
  } catch {
    /* offline */
  }
  update({ enabled: false, signedIn: false, syncing: false });
}
