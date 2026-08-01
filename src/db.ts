import Dexie, { type EntityTable } from 'dexie';
import { nowMs, uid } from './utils';
import { ticketLogo } from './logo';

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
  image?: string; // optional product photo (downscaled dataURL)
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

export type CashMovementType = 'in' | 'out';

export interface CashMovement extends Synced {
  id?: string;
  sessionId: string;
  date: string; // ISO
  type: CashMovementType;
  amount: number;
  note: string;
  userId: string;
  userName: string;
}

export interface CashSession extends Synced {
  id?: string;
  openedAt: string; // ISO
  openedBy: string;
  openedByName: string;
  openingAmount: number;
  closedAt: string | null;
  closedBy: string | null;
  closedByName: string | null;
  countedAmount: number | null;
  expectedAmount: number | null;
  difference: number | null; // countedAmount - expectedAmount
  cashSalesTotal: number | null;
  cashInTotal: number | null;
  cashOutTotal: number | null;
  note: string;
  status: 'open' | 'closed';
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
  'cashSessions',
  'cashMovements',
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
  cashSessions: EntityTable<CashSession, 'id'>;
  cashMovements: EntityTable<CashMovement, 'id'>;
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

db.version(2).stores({
  users: 'id, name, role',
  categories: 'id, sort',
  products: 'id, categoryId, nameFr, active',
  suppliers: 'id, name',
  purchases: 'id, date, supplierId',
  sales: 'id, date, number, userId',
  waste: 'id, date, productId, reason',
  settings: 'key',
  cashSessions: 'id, status, openedAt',
  cashMovements: 'id, sessionId, date',
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
  shopNameFr: 'Boucherie & Restaurant Abdeddaim',
  shopNameAr: 'جزارة ومطعم عبد الدايم',
  // Une seule écriture sur cette ligne : mélanger arabe et latin déclenche le
  // réordonnancement bidirectionnel et casse la mise en page sur 80 mm.
  address: 'واحة سيدي إبراهيم، مراكش',
  phone: '0661859564',
  logo: ticketLogo,
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

/* Catalogue de la maison. Les viandes se vendent au kilo ; tout ce qui sort de
   la cuisine (tajines, plats, boissons) se vend à la portion.

   `lowStock: -1` partout au départ : le seuil se compare avec
   `stock <= lowStock`, et un seuil négatif désactive donc l'alerte. Comme le
   stock démarre à 0, un vrai seuil ferait clignoter « stock bas » sur tout le
   catalogue dès le premier jour. Chaque article se règle ensuite dans
   Produits, une fois le stock réel saisi via un achat. */
const NO_ALERT = -1;

interface SeedItem {
  n: number;
  fr: string;
  ar: string;
  price: number;
  unit?: Unit; // défaut : 'piece'
  low?: number; // défaut : NO_ALERT
}

const CAT_SEED: { n: number; fr: string; ar: string; color: string; icon: string; items: SeedItem[] }[] = [
  {
    n: 101, fr: 'Viandes', ar: 'اللحوم', color: '#b91c1c', icon: '🥩',
    items: [
      { n: 201, fr: 'Mouton', ar: 'الغنمي', price: 150, unit: 'kg' },
      { n: 202, fr: 'Bœuf', ar: 'البقر', price: 100, unit: 'kg' },
      { n: 203, fr: 'Chèvre', ar: 'المعزي', price: 140, unit: 'kg' },
      { n: 204, fr: 'Côtelettes', ar: 'كوطليط', price: 200, unit: 'kg' },
      { n: 205, fr: 'Foie de bœuf', ar: 'كبدة البقر', price: 160, unit: 'kg' },
      { n: 206, fr: 'Foie de mouton', ar: 'كبدة الغنمي', price: 200, unit: 'kg' },
      { n: 207, fr: 'Poulet désossé', ar: 'الهبرة ديال الدجاج', price: 70, unit: 'kg' },
      { n: 208, fr: 'Pilons de poulet', ar: 'بيلو', price: 70, unit: 'kg' },
      { n: 209, fr: 'Cuisse complète', ar: 'فخض كومبلي', price: 35, unit: 'kg' },
    ],
  },
  {
    n: 102, fr: 'Préparations & grillades', ar: 'المحضرات والمشوي', color: '#c2410c', icon: '🍢',
    items: [
      { n: 221, fr: 'Kefta', ar: 'الكفتة', price: 120, unit: 'kg' },
      { n: 222, fr: 'Kefta au fromage', ar: 'الكفتة بالفرماج', price: 130, unit: 'kg' },
      { n: 223, fr: 'Saucisses', ar: 'صوصيص', price: 130, unit: 'kg' },
      { n: 224, fr: 'Boulfaf', ar: 'بولفاف', price: 200, unit: 'kg' },
      { n: 225, fr: 'Brochettes de poulet', ar: 'بروشيت دجاج', price: 80, unit: 'kg' },
      { n: 226, fr: 'Brochettes de mouton', ar: 'بروشيت غنمي', price: 180, unit: 'kg' },
      { n: 227, fr: 'Brochettes de filet', ar: 'بروشيت لفيلي', price: 180, unit: 'kg' },
    ],
  },
  {
    n: 103, fr: 'Tajines', ar: 'الطواجين', color: '#b45309', icon: '🍲',
    items: [
      { n: 241, fr: 'Tajine bœuf 250 g', ar: 'طاجين بقر 250غ', price: 50 },
      { n: 242, fr: 'Tajine bœuf 500 g', ar: 'طاجين بقر 500غ', price: 100 },
      { n: 243, fr: 'Tajine bœuf 750 g', ar: 'طاجين بقر 750غ', price: 150 },
      { n: 244, fr: 'Tajine bœuf 1 kg', ar: 'طاجين بقر 1000غ', price: 200 },
      { n: 245, fr: 'Tajine mouton 250 g', ar: 'طاجين غنمي 250غ', price: 60 },
      { n: 246, fr: 'Tajine mouton 500 g', ar: 'طاجين غنمي 500غ', price: 120 },
      { n: 247, fr: 'Tajine mouton 750 g', ar: 'طاجين غنمي 750غ', price: 180 },
      { n: 248, fr: 'Tajine mouton 1 kg', ar: 'طاجين غنمي 1000غ', price: 240 },
      { n: 249, fr: 'Tajine chèvre 250 g', ar: 'طاجين المعزي 250غ', price: 60 },
      { n: 250, fr: 'Tajine chèvre 500 g', ar: 'طاجين المعزي 500غ', price: 120 },
      { n: 251, fr: 'Tajine chèvre 750 g', ar: 'طاجين المعزي 750غ', price: 180 },
      { n: 252, fr: 'Tajine chèvre 1 kg', ar: 'طاجين المعزي 1000غ', price: 240 },
    ],
  },
  {
    n: 104, fr: 'Plats & accompagnements', ar: 'المأكولات', color: '#15803d', icon: '🍽️',
    items: [
      { n: 271, fr: 'Plat tête d’agneau', ar: 'ماكلة لحم الراس', price: 25 },
      { n: 272, fr: 'Plat pieds (kraïn)', ar: 'ماكلة كرعين', price: 25 },
      { n: 273, fr: 'Plat poulet', ar: 'ماكلة دجاج', price: 25 },
      { n: 274, fr: 'Taqlia', ar: 'تقلية', price: 20 },
      { n: 275, fr: 'Loubia', ar: 'لوبية', price: 12 },
      { n: 276, fr: 'Lentilles', ar: 'لعدس', price: 12 },
      { n: 277, fr: 'Frites', ar: 'فريت', price: 10 },
      { n: 278, fr: 'Salade marocaine', ar: 'شلاضا مغربية', price: 10 },
      { n: 279, fr: 'Oignon & tomate grillés', ar: 'بصلة ومطيشة فشواية', price: 7 },
      { n: 280, fr: 'Bocadillos', ar: 'بوكاديوس', price: 10 },
      { n: 281, fr: 'Pain', ar: 'خبزة', price: 1 },
      { n: 282, fr: 'Grillade (au kilo)', ar: 'شواية للكيلو', price: 30, unit: 'kg' },
    ],
  },
  {
    n: 105, fr: 'Desserts', ar: 'الحلويات', color: '#be185d', icon: '🍰',
    items: [
      { n: 291, fr: 'Salade de fruits', ar: 'سلطة فواكه', price: 15 },
      { n: 292, fr: 'Flan', ar: 'فلو', price: 20 },
    ],
  },
  {
    n: 106, fr: 'Boissons', ar: 'المشروبات', color: '#0369a1', icon: '🍵',
    items: [
      { n: 301, fr: 'Thé (petit)', ar: 'أتاي صغير', price: 10 },
      { n: 302, fr: 'Thé (moyen)', ar: 'أتاي متوسط', price: 15 },
      { n: 303, fr: 'Thé (grand)', ar: 'أتاي كبير', price: 20 },
      { n: 304, fr: 'Limonade maxi', ar: 'موناضا ماكسي', price: 10 },
      { n: 305, fr: 'Limonade 1 L', ar: 'موناضا إترو', price: 15 },
      { n: 306, fr: 'Jus de betterave', ar: 'عصير الباربا', price: 10 },
      { n: 307, fr: 'Jus de mangue', ar: 'عصير مونغ', price: 15 },
      { n: 308, fr: 'Jus de citron', ar: 'عصير الليمون', price: 15 },
    ],
  },
];

let seeded = false;
export async function seedIfEmpty() {
  if (seeded) return;
  seeded = true;

  // Comptes et catalogue sont semés indépendamment : après une
  // réinitialisation des données (qui conserve les utilisateurs), le catalogue
  // doit revenir au rechargement.
  if ((await db.users.count()) === 0) {
    await db.users.bulkAdd([
      { id: sid(1), name: 'Admin', pinHash: await hashPin('1234'), role: 'admin', active: true },
      { id: sid(2), name: 'Caissier', pinHash: await hashPin('0000'), role: 'cashier', active: true },
    ] as User[]);
  }

  if ((await db.categories.count()) > 0) return;

  await db.categories.bulkAdd(
    CAT_SEED.map((c, i) => ({
      id: sid(c.n), nameFr: c.fr, nameAr: c.ar, color: c.color, icon: c.icon, sort: i + 1,
    })) as Category[],
  );

  await db.products.bulkAdd(
    CAT_SEED.flatMap((c) =>
      c.items.map((it): Product => ({
        id: sid(it.n),
        categoryId: sid(c.n),
        nameFr: it.fr,
        nameAr: it.ar,
        unit: it.unit ?? 'piece',
        price: it.price,
        // Le coût d'achat se remplit tout seul au premier achat enregistré ;
        // le laisser à 0 évite d'inventer une marge qui fausserait les rapports.
        cost: 0,
        stock: 0,
        lowStock: it.low ?? NO_ALERT,
        code: String(it.n),
        active: true,
      })),
    ),
  );
}

export { uid };
