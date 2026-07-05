import Dexie, { type EntityTable } from 'dexie';

export type Role = 'admin' | 'manager' | 'cashier';
export type Unit = 'kg' | 'piece';
export type PaymentMethod = 'cash' | 'card' | 'credit';
export type WasteReason = 'bones' | 'fat' | 'spoiled' | 'trim' | 'expired' | 'other';

export interface User {
  id?: number;
  name: string;
  pinHash: string;
  role: Role;
  active: boolean;
}

export interface Category {
  id?: number;
  nameFr: string;
  nameAr: string;
  color: string;
  icon: string;
  sort: number;
}

export interface Product {
  id?: number;
  categoryId: number;
  nameFr: string;
  nameAr: string;
  unit: Unit;
  price: number; // selling price per kg or per piece, in DH
  cost: number; // last purchase cost
  stock: number; // in kg or pieces
  lowStock: number;
  active: boolean;
}

export interface Supplier {
  id?: number;
  name: string;
  phone: string;
}

export interface PurchaseItem {
  productId: number;
  nameFr: string;
  nameAr: string;
  qty: number;
  unitCost: number;
  total: number;
}

export interface Purchase {
  id?: number;
  date: string; // ISO
  supplierId: number | null;
  supplierName: string;
  items: PurchaseItem[];
  total: number;
  userId: number;
  userName: string;
  note: string;
}

export interface SaleItem {
  productId: number;
  nameFr: string;
  nameAr: string;
  unit: Unit;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface Sale {
  id?: number;
  number: string;
  date: string; // ISO
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  payment: PaymentMethod;
  userId: number;
  userName: string;
  status: 'done' | 'void';
}

export interface Waste {
  id?: number;
  date: string; // ISO
  productId: number;
  nameFr: string;
  nameAr: string;
  unit: Unit;
  qty: number;
  unitCost: number;
  value: number;
  reason: WasteReason;
  note: string;
  userId: number;
  userName: string;
}

export interface Setting {
  key: string;
  value: string;
}

export const db = new Dexie('boucherie-pos') as Dexie & {
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
  users: '++id, name, role',
  categories: '++id, sort',
  products: '++id, categoryId, nameFr, active',
  suppliers: '++id, name',
  purchases: '++id, date, supplierId',
  sales: '++id, date, number, userId',
  waste: '++id, date, productId, reason',
  settings: 'key',
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

export async function getTicketSettings(): Promise<TicketSettings> {
  const row = await db.settings.get('ticket');
  if (!row) return { ...defaultTicket };
  try {
    return { ...defaultTicket, ...JSON.parse(row.value) };
  } catch {
    return { ...defaultTicket };
  }
}

export async function saveTicketSettings(t: TicketSettings) {
  await db.settings.put({ key: 'ticket', value: JSON.stringify(t) });
}

let seeded = false;
export async function seedIfEmpty() {
  if (seeded) return;
  seeded = true;
  const userCount = await db.users.count();
  if (userCount > 0) return;

  await db.users.add({ name: 'Admin', pinHash: await hashPin('1234'), role: 'admin', active: true });
  await db.users.add({ name: 'Caissier', pinHash: await hashPin('0000'), role: 'cashier', active: true });

  const cats: Category[] = [
    { nameFr: 'Bœuf', nameAr: 'لحم البقر', color: '#b91c1c', icon: '🥩', sort: 1 },
    { nameFr: 'Agneau', nameAr: 'لحم الغنم', color: '#c2410c', icon: '🍖', sort: 2 },
    { nameFr: 'Poulet', nameAr: 'الدجاج', color: '#ca8a04', icon: '🍗', sort: 3 },
    { nameFr: 'Abats', nameAr: 'الأحشاء', color: '#7e22ce', icon: '🫀', sort: 4 },
    { nameFr: 'Préparations', nameAr: 'المحضرات', color: '#15803d', icon: '🥓', sort: 5 },
  ];
  const catIds: number[] = [];
  for (const c of cats) catIds.push((await db.categories.add(c)) as number);

  const prods: Omit<Product, 'id'>[] = [
    { categoryId: catIds[0], nameFr: 'Viande hachée', nameAr: 'لحم مفروم', unit: 'kg', price: 90, cost: 68, stock: 12, lowStock: 3, active: true },
    { categoryId: catIds[0], nameFr: 'Entrecôte', nameAr: 'أنتركوت', unit: 'kg', price: 120, cost: 92, stock: 8, lowStock: 2, active: true },
    { categoryId: catIds[0], nameFr: 'Filet de bœuf', nameAr: 'فيليه البقر', unit: 'kg', price: 160, cost: 125, stock: 5, lowStock: 2, active: true },
    { categoryId: catIds[0], nameFr: 'Jarret', nameAr: 'موزات', unit: 'kg', price: 75, cost: 55, stock: 10, lowStock: 3, active: true },
    { categoryId: catIds[1], nameFr: 'Gigot d’agneau', nameAr: 'فخذ الغنم', unit: 'kg', price: 110, cost: 85, stock: 9, lowStock: 2, active: true },
    { categoryId: catIds[1], nameFr: 'Côtelettes', nameAr: 'قطبان الضلوع', unit: 'kg', price: 115, cost: 88, stock: 7, lowStock: 2, active: true },
    { categoryId: catIds[1], nameFr: 'Épaule', nameAr: 'كتف الغنم', unit: 'kg', price: 95, cost: 72, stock: 6, lowStock: 2, active: true },
    { categoryId: catIds[2], nameFr: 'Poulet entier', nameAr: 'دجاجة كاملة', unit: 'piece', price: 55, cost: 40, stock: 15, lowStock: 4, active: true },
    { categoryId: catIds[2], nameFr: 'Escalope', nameAr: 'إسكالوب', unit: 'kg', price: 62, cost: 45, stock: 10, lowStock: 3, active: true },
    { categoryId: catIds[2], nameFr: 'Cuisses', nameAr: 'أفخاذ الدجاج', unit: 'kg', price: 38, cost: 26, stock: 12, lowStock: 3, active: true },
    { categoryId: catIds[3], nameFr: 'Foie', nameAr: 'الكبدة', unit: 'kg', price: 130, cost: 100, stock: 4, lowStock: 1, active: true },
    { categoryId: catIds[3], nameFr: 'Cœur', nameAr: 'القلب', unit: 'kg', price: 85, cost: 62, stock: 3, lowStock: 1, active: true },
    { categoryId: catIds[4], nameFr: 'Kefta préparée', nameAr: 'كفتة محضرة', unit: 'kg', price: 95, cost: 70, stock: 8, lowStock: 2, active: true },
    { categoryId: catIds[4], nameFr: 'Merguez', nameAr: 'مركاز', unit: 'kg', price: 100, cost: 74, stock: 6, lowStock: 2, active: true },
    { categoryId: catIds[4], nameFr: 'Brochettes', nameAr: 'قطبان مشوية', unit: 'kg', price: 105, cost: 78, stock: 5, lowStock: 2, active: true },
  ];
  await db.products.bulkAdd(prods as Product[]);

  await db.suppliers.bulkAdd([
    { name: 'Abattoir Municipal', phone: '05 22 11 22 33' },
    { name: 'Ferme Atlas Volailles', phone: '06 61 44 55 66' },
  ] as Supplier[]);
}
