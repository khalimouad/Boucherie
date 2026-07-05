import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'fr' | 'ar';

const dict = {
  // general
  appName: { fr: 'Boucherie POS', ar: 'نقطة بيع الجزارة' },
  loading: { fr: 'Chargement…', ar: 'جارٍ التحميل…' },
  save: { fr: 'Enregistrer', ar: 'حفظ' },
  cancel: { fr: 'Annuler', ar: 'إلغاء' },
  delete: { fr: 'Supprimer', ar: 'حذف' },
  edit: { fr: 'Modifier', ar: 'تعديل' },
  add: { fr: 'Ajouter', ar: 'إضافة' },
  search: { fr: 'Rechercher…', ar: 'بحث…' },
  confirm: { fr: 'Confirmer', ar: 'تأكيد' },
  close: { fr: 'Fermer', ar: 'إغلاق' },
  actions: { fr: 'Actions', ar: 'إجراءات' },
  date: { fr: 'Date', ar: 'التاريخ' },
  total: { fr: 'Total', ar: 'المجموع' },
  today: { fr: "Aujourd'hui", ar: 'اليوم' },
  week: { fr: '7 jours', ar: '7 أيام' },
  month: { fr: 'Ce mois', ar: 'هذا الشهر' },
  from: { fr: 'Du', ar: 'من' },
  to: { fr: 'Au', ar: 'إلى' },
  all: { fr: 'Tous', ar: 'الكل' },
  none: { fr: 'Aucun', ar: 'لا شيء' },
  yes: { fr: 'Oui', ar: 'نعم' },
  no: { fr: 'Non', ar: 'لا' },
  print: { fr: 'Imprimer', ar: 'طباعة' },
  quantity: { fr: 'Quantité', ar: 'الكمية' },
  price: { fr: 'Prix', ar: 'الثمن' },
  amount: { fr: 'Montant', ar: 'المبلغ' },
  name: { fr: 'Nom', ar: 'الاسم' },
  note: { fr: 'Remarque', ar: 'ملاحظة' },
  active: { fr: 'Actif', ar: 'نشط' },
  inactive: { fr: 'Inactif', ar: 'غير نشط' },
  required: { fr: 'Champ obligatoire', ar: 'حقل إجباري' },
  noData: { fr: 'Aucune donnée', ar: 'لا توجد بيانات' },
  confirmDelete: { fr: 'Supprimer cet élément ?', ar: 'هل تريد حذف هذا العنصر؟' },

  // login
  welcome: { fr: 'Bienvenue', ar: 'مرحبا بيك' },
  selectUser: { fr: 'Choisissez votre compte', ar: 'اختار الحساب ديالك' },
  enterPin: { fr: 'Entrez votre code PIN', ar: 'دخّل الكود السري' },
  wrongPin: { fr: 'Code PIN incorrect', ar: 'الكود السري غالط' },
  login: { fr: 'Connexion', ar: 'دخول' },
  logout: { fr: 'Déconnexion', ar: 'خروج' },
  back: { fr: 'Retour', ar: 'رجوع' },

  // nav
  navPos: { fr: 'Caisse', ar: 'الصندوق' },
  navProducts: { fr: 'Produits', ar: 'المنتجات' },
  navPurchases: { fr: 'Achats', ar: 'المشتريات' },
  navWaste: { fr: 'Freinte', ar: 'الكسور' },
  navReports: { fr: 'Rapports', ar: 'التقارير' },
  navUsers: { fr: 'Utilisateurs', ar: 'المستخدمين' },
  navSettings: { fr: 'Paramètres', ar: 'الإعدادات' },

  // roles
  admin: { fr: 'Administrateur', ar: 'مدير' },
  manager: { fr: 'Gérant', ar: 'مسيّر' },
  cashier: { fr: 'Caissier', ar: 'كاسّي' },

  // pos
  cart: { fr: 'Panier', ar: 'السلة' },
  emptyCart: { fr: 'Panier vide — touchez un produit', ar: 'السلة خاوية — كليكي على منتج' },
  clearCart: { fr: 'Vider', ar: 'إفراغ' },
  pay: { fr: 'Encaisser', ar: 'خلّص' },
  payment: { fr: 'Paiement', ar: 'الخلاص' },
  cash: { fr: 'Espèces', ar: 'كاش' },
  card: { fr: 'Carte', ar: 'بطاقة' },
  credit: { fr: 'Crédit', ar: 'كريدي' },
  received: { fr: 'Montant reçu', ar: 'المبلغ المستلم' },
  changeDue: { fr: 'Monnaie à rendre', ar: 'الصرف' },
  insufficient: { fr: 'Montant insuffisant', ar: 'المبلغ ماكافيش' },
  discount: { fr: 'Remise', ar: 'تخفيض' },
  subtotal: { fr: 'Sous-total', ar: 'المجموع الجزئي' },
  finishSale: { fr: 'Valider la vente', ar: 'تأكيد البيع' },
  saleDone: { fr: 'Vente enregistrée', ar: 'تسجّل البيع' },
  printTicket: { fr: 'Imprimer le ticket', ar: 'طباعة التيكي' },
  newSale: { fr: 'Nouvelle vente', ar: 'بيع جديد' },
  enterWeight: { fr: 'Poids (kg)', ar: 'الوزن (كلغ)' },
  enterQty: { fr: 'Quantité', ar: 'الكمية' },
  byWeight: { fr: 'Par poids', ar: 'بالوزن' },
  byAmount: { fr: 'Par montant', ar: 'بالمبلغ' },
  exactAmount: { fr: 'Montant exact', ar: 'المبلغ بالضبط' },
  stock: { fr: 'Stock', ar: 'المخزون' },
  kg: { fr: 'kg', ar: 'كلغ' },
  piece: { fr: 'pièce', ar: 'حبة' },
  perKg: { fr: '/kg', ar: '/كلغ' },
  perPiece: { fr: '/pièce', ar: '/حبة' },

  // products
  product: { fr: 'Produit', ar: 'المنتج' },
  category: { fr: 'Catégorie', ar: 'الفئة' },
  categories: { fr: 'Catégories', ar: 'الفئات' },
  nameFr: { fr: 'Nom (français)', ar: 'الاسم (بالفرنسية)' },
  nameAr: { fr: 'Nom (arabe)', ar: 'الاسم (بالعربية)' },
  sellPrice: { fr: 'Prix de vente', ar: 'ثمن البيع' },
  costPrice: { fr: 'Prix d’achat', ar: 'ثمن الشراء' },
  unit: { fr: 'Unité', ar: 'الوحدة' },
  lowStock: { fr: 'Seuil d’alerte', ar: 'حد التنبيه' },
  lowStockAlert: { fr: 'Stock bas', ar: 'مخزون ناقص' },
  newProduct: { fr: 'Nouveau produit', ar: 'منتج جديد' },
  newCategory: { fr: 'Nouvelle catégorie', ar: 'فئة جديدة' },
  icon: { fr: 'Icône', ar: 'أيقونة' },
  color: { fr: 'Couleur', ar: 'اللون' },

  // purchases
  purchase: { fr: 'Achat', ar: 'الشراء' },
  newPurchase: { fr: 'Nouvel achat', ar: 'شراء جديد' },
  supplier: { fr: 'Fournisseur', ar: 'المورّد' },
  suppliers: { fr: 'Fournisseurs', ar: 'الموردين' },
  newSupplier: { fr: 'Nouveau fournisseur', ar: 'مورّد جديد' },
  phone: { fr: 'Téléphone', ar: 'الهاتف' },
  unitCost: { fr: 'Coût unitaire', ar: 'ثمن الوحدة' },
  addLine: { fr: 'Ajouter une ligne', ar: 'زيد سطر' },
  purchaseSaved: { fr: 'Achat enregistré, stock mis à jour', ar: 'تسجّل الشراء وتحدّث المخزون' },
  items: { fr: 'Articles', ar: 'السلع' },

  // waste
  waste: { fr: 'Freinte', ar: 'الكسور' },
  declareWaste: { fr: 'Déclarer une freinte', ar: 'تسجيل كسور' },
  reason: { fr: 'Motif', ar: 'السبب' },
  rBones: { fr: 'Os', ar: 'العظام' },
  rFat: { fr: 'Gras', ar: 'الشحمة' },
  rSpoiled: { fr: 'Avarié', ar: 'خاسر' },
  rTrim: { fr: 'Parage', ar: 'التنقية' },
  rExpired: { fr: 'Périmé', ar: 'منتهي الصلاحية' },
  rOther: { fr: 'Autre', ar: 'آخر' },
  wasteValue: { fr: 'Valeur perdue', ar: 'القيمة الضائعة' },
  wasteSaved: { fr: 'Freinte enregistrée', ar: 'تسجّلات الكسور' },

  // reports
  reports: { fr: 'Rapports', ar: 'التقارير' },
  salesReport: { fr: 'Ventes', ar: 'المبيعات' },
  purchasesReport: { fr: 'Achats', ar: 'المشتريات' },
  wasteReport: { fr: 'Rapport de freinte', ar: 'تقرير الكسور' },
  salesCount: { fr: 'Nb de ventes', ar: 'عدد المبيعات' },
  revenue: { fr: 'Chiffre d’affaires', ar: 'رقم المعاملات' },
  avgTicket: { fr: 'Ticket moyen', ar: 'متوسط التيكي' },
  byProduct: { fr: 'Par produit', ar: 'حسب المنتج' },
  byPayment: { fr: 'Par mode de paiement', ar: 'حسب طريقة الخلاص' },
  byCashier: { fr: 'Par caissier', ar: 'حسب الكاسّي' },
  byReason: { fr: 'Par motif', ar: 'حسب السبب' },
  bySupplier: { fr: 'Par fournisseur', ar: 'حسب المورّد' },
  qtySold: { fr: 'Qté vendue', ar: 'الكمية المبيعة' },
  qtyLost: { fr: 'Qté perdue', ar: 'الكمية الضائعة' },
  purchasesTotal: { fr: 'Total achats', ar: 'مجموع المشتريات' },
  wasteTotal: { fr: 'Total freinte', ar: 'مجموع الكسور' },
  wasteRate: { fr: 'Taux de freinte', ar: 'نسبة الكسور' },
  wasteRateHint: { fr: 'Valeur freinte / valeur achats', ar: 'قيمة الكسور / قيمة المشتريات' },
  grossMargin: { fr: 'Marge brute estimée', ar: 'الهامش الخام التقديري' },
  exportCsv: { fr: 'Exporter CSV', ar: 'تصدير CSV' },
  ticketNo: { fr: 'Ticket N°', ar: 'تيكي رقم' },
  voidSale: { fr: 'Annuler la vente', ar: 'إلغاء البيع' },
  voided: { fr: 'Annulée', ar: 'ملغية' },
  reprint: { fr: 'Réimprimer', ar: 'إعادة الطباعة' },
  details: { fr: 'Détails', ar: 'التفاصيل' },

  // users
  user: { fr: 'Utilisateur', ar: 'المستخدم' },
  role: { fr: 'Rôle', ar: 'الدور' },
  pin: { fr: 'Code PIN (4 chiffres)', ar: 'الكود السري (4 أرقام)' },
  newUser: { fr: 'Nouvel utilisateur', ar: 'مستخدم جديد' },
  pinKeepEmpty: { fr: 'Laisser vide pour garder le PIN actuel', ar: 'خليه خاوي باش يبقى الكود القديم' },
  lastAdmin: { fr: 'Impossible : dernier administrateur', ar: 'ما يمكنش: آخر مدير' },

  // settings
  settings: { fr: 'Paramètres', ar: 'الإعدادات' },
  shopInfo: { fr: 'Informations boutique', ar: 'معلومات المحل' },
  shopNameFr: { fr: 'Nom (français)', ar: 'الاسم (بالفرنسية)' },
  shopNameAr: { fr: 'Nom (arabe)', ar: 'الاسم (بالعربية)' },
  address: { fr: 'Adresse', ar: 'العنوان' },
  logo: { fr: 'Logo', ar: 'اللوغو' },
  uploadLogo: { fr: 'Choisir un logo', ar: 'اختار لوغو' },
  removeLogo: { fr: 'Retirer le logo', ar: 'حيّد اللوغو' },
  ticketDesign: { fr: 'Design du ticket', ar: 'تصميم التيكي' },
  ticketPreview: { fr: 'Aperçu du ticket', ar: 'معاينة التيكي' },
  paperWidth: { fr: 'Largeur papier', ar: 'عرض الورقة' },
  fontSize: { fr: 'Taille du texte', ar: 'حجم الخط' },
  small: { fr: 'Petit', ar: 'صغير' },
  normal: { fr: 'Normal', ar: 'عادي' },
  large: { fr: 'Grand', ar: 'كبير' },
  showLogo: { fr: 'Afficher le logo', ar: 'إظهار اللوغو' },
  showAddress: { fr: 'Afficher l’adresse', ar: 'إظهار العنوان' },
  showPhone: { fr: 'Afficher le téléphone', ar: 'إظهار الهاتف' },
  showCashier: { fr: 'Afficher le caissier', ar: 'إظهار الكاسّي' },
  headerText: { fr: 'Texte d’en-tête', ar: 'نص الرأس' },
  footerText: { fr: 'Texte de pied', ar: 'نص الأسفل' },
  ticketLang: { fr: 'Langue du ticket', ar: 'لغة التيكي' },
  both: { fr: 'Bilingue', ar: 'باللغتين' },
  french: { fr: 'Français', ar: 'الفرنسية' },
  arabic: { fr: 'Arabe', ar: 'العربية' },
  appLang: { fr: 'Langue de l’application', ar: 'لغة التطبيق' },
  settingsSaved: { fr: 'Paramètres enregistrés', ar: 'تسجّلات الإعدادات' },
  testPrint: { fr: 'Test d’impression', ar: 'تجربة الطباعة' },
  dangerZone: { fr: 'Zone dangereuse', ar: 'منطقة الخطر' },
  resetData: { fr: 'Réinitialiser toutes les données', ar: 'مسح جميع البيانات' },
  resetConfirm: {
    fr: 'ATTENTION : toutes les ventes, achats et produits seront supprimés. Continuer ?',
    ar: 'انتبه: غادي يتمسحو جميع المبيعات والمشتريات والمنتجات. نكملو؟',
  },
} as const;

export type TKey = keyof typeof dict;

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
  dir: 'ltr' | 'rtl';
}

const Ctx = createContext<I18nCtx>(null as unknown as I18nCtx);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('pos-lang') as Lang) || 'fr');
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('pos-lang', l);
  };
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang === 'ar' ? 'ar-MA' : 'fr';
  }, [lang, dir]);
  const t = (k: TKey) => dict[k][lang];
  return <Ctx.Provider value={{ lang, setLang, t, dir }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

export function localName(obj: { nameFr: string; nameAr: string }, lang: Lang) {
  return lang === 'ar' ? obj.nameAr || obj.nameFr : obj.nameFr || obj.nameAr;
}
