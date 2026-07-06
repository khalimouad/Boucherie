import Dexie, { type EntityTable } from 'dexie';
import { nowMs, uid } from './utils';

export type Role = 'admin' | 'manager' | 'cashier';
export type Unit = 'kg' | 'piece';
export type PaymentMethod = 'cash' | 'card' | 'credit';
export type WasteReason = 'bones' | 'fat' | 'spoiled' | 'trim' | 'expired' | 'other';

/** Fields injected on every synced row by the sync middleware. */
interface Synced {
  updatedAt?: string;
  _dirty?: number;
}

export interface User extends Synced {
  id?: string;
  name: string;
  pinHash: string;
  role: Role;
  active: boolean;
}

export interface Category extends Synced {
  id?: string;
  nameFr: string;
  nameAr: string;
  color: string;
  icon: string;
  sort: number;
}

export interface Product extends Synced {
  id?: string;
  categoryId: string;
  nameFr: string;
  nameAr: string;
  unit: Unit;
  price: number; // selling price per kg or per piece, in DH
  cost: number; // last purchase cost
  stock: number; // in kg or pieces
  lowStock: number;
  code: string; // scale PLU / barcode item code (digits)
  active: boolean;
}

export interface Supplier extends Synced {
  id?: string;
  name: string;
  phone: string;
}

export interface PurchaseItem {
  productId: string;
  nameFr: string;
  nameAr: string;
  qty: number;
  unitCost: number;
  total: number;
}

export interface Purchase extends Synced {
  id?: string;
  date: string; // ISO
  supplierId: string | null;
  supplierName: string;
  items: PurchaseItem[];
  total: number;
  userId: string;
  userName: string;
  note: string;
}

export interface SaleItem {
  productId: string;
  nameFr: string;
  nameAr: string;
  unit: Unit;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface Sale extends Synced {
  id?: string;
  number: string;
  date: string; // ISO
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  payment: PaymentMethod;
  userId: string;
  userName: string;
  status: 'done' | 'void';
}

export interface Waste extends Synced {
  id?: string;
  date: string; // ISO
  productId: string;
  nameFr: string;
  nameAr: string;
  unit: Unit;
  qty: number;
  unitCost: number;
  value: number;
  reason: WasteReason;
  note: string;
  userId: string;
  userName: string;
}

export interface Setting extends Synced {
  key: string;
  value: string;
}

export const SYNCED_TABLES = [
  'users',
  'categories',
  'products',
  'suppliers',
  'purchases',
  'sales',
  'waste',
  'settings',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

export const db = new Dexie('boucherie-pos-2') as Dexie & {
  users: EntityTable<User, 'id'>;
  categories: EntityTable<Category, 'id'>;
  products: EntityTable<Product, 'id'>;
  suppliers: EntityTable<Supplier, 'id'>;
  purchases: EntityTable<Purchase, 'id'>;
  sales: EntityTable<Sale, 'id'>;
  waste: EntityTable<Waste, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

db.version(1).stores({
  users: 'id, name, role',
  categories: 'id, sort',
  products: 'id, categoryId, nameFr, active',
  suppliers: 'id, name',
  purchases: 'id, date, supplierId',
  sales: 'id, date, number, userId',
  waste: 'id, date, productId, reason',
  settings: 'key',
});

/* ---- sync change tracking ----
   A DBCore middleware stamps every local write with updatedAt + _dirty so the
   sync engine knows what to push. Writes performed while applying remote
   changes (applyingRemote) are left untouched. Local deletions are recorded
   as tombstones in localStorage (survives reload, no extra transaction). */

export let applyingRemote = false;
export function setApplyingRemote(v: boolean) {
  applyingRemote = v;
}

const TOMB_KEY = 'pos-tombstones';
export interface Tombstone {
  tbl: SyncedTable;
  id: string;
}

export function getTombstones(): Tombstone[] {
  try {
    return JSON.parse(localStorage.getItem(TOMB_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function setTombstones(t: Tombstone[]) {
  localStorage.setItem(TOMB_KEY, JSON.stringify(t));
}

function recordTombstones(tbl: SyncedTable, keys: unknown[]) {
  const cur = getTombstones();
  for (const k of keys) cur.push({ tbl, id: String(k) });
  setTombstones(cur);
}

db.use({
  stack: 'dbcore',
  name: 'sync-tracker',
  create(down) {
    return {
      ...down,
      table(name) {
        const table = down.table(name);
        if (!(SYNCED_TABLES as readonly string[]).includes(name)) return table;
        return {
          ...table,
          mutate(req) {
            if (!applyingRemote) {
              if (req.type === 'add' || req.type === 'put') {
                const stamp = new Date(nowMs()).toISOString();
                for (const v of req.values as Record<string, unknown>[]) {
                  v.updatedAt = stamp;
                  v._dirty = 1;
                }
              } else if (req.type === 'delete') {
                recordTombstones(name as SyncedTable, req.keys);
              }
            }
            return table.mutate(req);
          },
        };
      },
    };
  },
});

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode('boucherie:' + pin);
  // crypto.subtle only exists in secure contexts (HTTPS / localhost); a POS
  // tablet reaching the app over plain LAN http needs the pure-JS fallback
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      /* fall through to JS implementation */
    }
  }
  const { sha256Hex } = await import('./sha256');
  return sha256Hex(data);
}

/* ---- JSON settings helpers ---- */

export interface TicketSettings {
  shopNameFr: string;
  shopNameAr: string;
  address: string;
  phone: string;
  logo: string; // dataURL or ''
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showCashier: boolean;
  showDuplicateNote: boolean;
  paperWidth: '58' | '80';
  fontSize: 'small' | 'normal' | 'large';
  headerFr: string;
  headerAr: string;
  footerFr: string;
  footerAr: string;
  ticketLang: 'fr' | 'ar' | 'both';
}

export const defaultTicket: TicketSettings = {
  shopNameFr: 'Boucherie Al Baraka',
  shopNameAr: 'جزارة البركة',
  address: 'Av. Hassan II, Casablanca',
  phone: '05 22 00 00 00',
  logo: '',
  showLogo: true,
  showAddress: true,
  showPhone: true,
  showCashier: true,
  showDuplicateNote: false,
  paperWidth: '80',
  fontSize: 'normal',
  headerFr: '',
  headerAr: '',
  footerFr: 'Merci de votre visite !',
  footerAr: 'شكرا على زيارتكم!',
  ticketLang: 'both',
};

/** Scale barcode layout: [prefix][item code][value][EAN check digit]. */
export interface BarcodeSettings {
  enabled: boolean;
  prefix: string; // e.g. '2' or '20'
  codeLen: number; // digits of the product code
  valueLen: number; // digits of the embedded value
  valueMode: 'price' | 'weight'; // price in centimes or weight in grams
}

export const defaultBarcode: BarcodeSettings = {
  enabled: true,
  prefix: '2',
  codeLen: 5,
  valueLen: 5,
  valueMode: 'price',
};

async function getJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  if (!row) return { ...fallback };
  try {
    return { ...fallback, ...JSON.parse(row.value) };
  } catch {
    return { ...fallback };
  }
}

export const getTicketSettings = () => getJsonSetting('ticket', defaultTicket);
export const saveTicketSettings = (t: TicketSettings) => db.settings.put({ key: 'ticket', value: JSON.stringify(t) });
export const getBarcodeSettings = () => getJsonSetting('barcode', defaultBarcode);
export const saveBarcodeSettings = (b: BarcodeSettings) => db.settings.put({ key: 'barcode', value: JSON.stringify(b) });

/** Local print bridge: a small helper program on the till that relays raw
 * ESC/POS bytes to the ticket printer and can pulse the cash drawer — a web
 * page cannot do either directly. It must run on the same machine as the
 * browser (http://127.0.0.1) since HTTPS pages may only call plain-HTTP
 * loopback addresses without hitting mixed-content blocking. */
export interface BridgeSettings {
  enabled: boolean;
  url: string; // e.g. http://127.0.0.1:9123
  token: string;
  openDrawerOnCash: boolean;
}

export const defaultBridge: BridgeSettings = {
  enabled: false,
  url: 'http://127.0.0.1:9123',
  token: '',
  openDrawerOnCash: true,
};

export const getBridgeSettings = () => getJsonSetting('bridge', defaultBridge);
export const saveBridgeSettings = (b: BridgeSettings) => db.settings.put({ key: 'bridge', value: JSON.stringify(b) });

/* ---- seed ----
   Seed ids are fixed so that two freshly-installed devices that later join the
   same cloud converge on the same rows instead of duplicating the catalog. */

const sid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let seeded = false;
export async function seedIfEmpty() {
  if (seeded) return;
  seeded = true;
  const userCount = await db.users.count();
  if (userCount > 0) return;

  await db.users.bulkAdd([
    { id: sid(1), name: 'Admin', pinHash: await hashPin('1234'), role: 'admin', active: true },
    { id: sid(2), name: 'Caissier', pinHash: await hashPin('0000'), role: 'cashier', active: true },
  ] as User[]);

  const cats: Category[] = [
    { id: sid(101), nameFr: 'Bœuf', nameAr: 'لحم البقر', color: '#b91c1c', icon: '🥩', sort: 1 },
    { id: sid(102), nameFr: 'Agneau', nameAr: 'لحم الغنم', color: '#c2410c', icon: '🍖', sort: 2 },
    { id: sid(103), nameFr: 'Poulet', nameAr: 'الدجاج', color: '#ca8a04', icon: '🍗', sort: 3 },
    { id: sid(104), nameFr: 'Abats', nameAr: 'الأحشاء', color: '#7e22ce', icon: '🫀', sort: 4 },
    { id: sid(105), nameFr: 'Préparations', nameAr: 'المحضرات', color: '#15803d', icon: '🥓', sort: 5 },
  ];
  await db.categories.bulkAdd(cats);

  const p = (n: number, categoryId: string, nameFr: string, nameAr: string, unit: Unit, price: number, cost: number, stock: number, lowStock: number, code: string): Product => ({
    id: sid(n), categoryId, nameFr, nameAr, unit, price, cost, stock, lowStock, code, active: true,
  });
  await db.products.bulkAdd([
    p(201, sid(101), 'Viande hachée', 'لحم مفروم', 'kg', 90, 68, 12, 3, '201'),
    p(202, sid(101), 'Entrecôte', 'أنتركوت', 'kg', 120, 92, 8, 2, '202'),
    p(203, sid(101), 'Filet de bœuf', 'فيليه البقر', 'kg', 160, 125, 5, 2, '203'),
    p(204, sid(101), 'Jarret', 'موزات', 'kg', 75, 55, 10, 3, '204'),
    p(205, sid(102), 'Gigot d’agneau', 'فخذ الغنم', 'kg', 110, 85, 9, 2, '205'),
    p(206, sid(102), 'Côtelettes', 'قطبان الضلوع', 'kg', 115, 88, 7, 2, '206'),
    p(207, sid(102), 'Épaule', 'كتف الغنم', 'kg', 95, 72, 6, 2, '207'),
    p(208, sid(103), 'Poulet entier', 'دجاجة كاملة', 'piece', 55, 40, 15, 4, '208'),
    p(209, sid(103), 'Escalope', 'إسكالوب', 'kg', 62, 45, 10, 3, '209'),
    p(210, sid(103), 'Cuisses', 'أفخاذ الدجاج', 'kg', 38, 26, 12, 3, '210'),
    p(211, sid(104), 'Foie', 'الكبدة', 'kg', 130, 100, 4, 1, '211'),
    p(212, sid(104), 'Cœur', 'القلب', 'kg', 85, 62, 3, 1, '212'),
    p(213, sid(105), 'Kefta préparée', 'كفتة محضرة', 'kg', 95, 70, 8, 2, '213'),
    p(214, sid(105), 'Merguez', 'مركاز', 'kg', 100, 74, 6, 2, '214'),
    p(215, sid(105), 'Brochettes', 'قطبان مشوية', 'kg', 105, 78, 5, 2, '215'),
  ]);

  await db.suppliers.bulkAdd([
    { id: sid(301), name: 'Abattoir Municipal', phone: '05 22 11 22 33' },
    { id: sid(302), name: 'Ferme Atlas Volailles', phone: '06 61 44 55 66' },
  ] as Supplier[]);
}

export { uid };
