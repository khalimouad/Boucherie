# 🥩 Boucherie POS — نقطة بيع الجزارة

Solution de point de vente (POS) moderne et robuste pour boucherie, bilingue **Français / العربية المغربية** (avec affichage RTL complet), conçue pour **caisse tactile**, **tablette** et **mobile**.

## ✨ Fonctionnalités

- **Caisse tactile** : grille de produits par catégorie, saisie du poids au clavier tactile, vente **par poids (kg)** ou **par montant (DH)**, paiement espèces / carte / crédit avec calcul de la monnaie, remises.
- **Impression de tickets** : tickets thermiques 58 mm / 80 mm, bilingues, avec logo, réimpression et duplicata.
- **Achats (المشتريات)** : fournisseurs, bons d'achat multi-lignes, mise à jour automatique du stock et du prix de revient.
- **Freinte (الكسور)** : déclaration des pertes (os, gras, parage, avarié, périmé…), valorisation au coût, déduction du stock.
- **Rapports** : ventes (CA, ticket moyen, par produit / paiement / caissier, marge brute), achats par fournisseur, **rapport de freinte** avec taux de freinte (valeur freinte / valeur achats), export CSV, annulation de vente.
- **Accès utilisateurs** : connexion par code PIN, rôles **Administrateur / Gérant / Caissier** avec permissions par écran.
- **Paramétrage** : nom de boutique (FR/AR), adresse, téléphone, **logo personnalisé**, **design du ticket** (largeur papier, taille de texte, langue du ticket, en-tête/pied de page, éléments affichés) avec **aperçu en direct**.
- **Devise** : Dirham marocain (DH / د.م.) toujours affiché avec **2 décimales**.
- **Hors-ligne** : toutes les données sont stockées localement (IndexedDB) — aucune connexion internet requise.
- **Synchronisation cloud** (optionnelle) : réplication temps réel entre la caisse et le mobile du gérant, via Supabase.
- **Design** : thème **clair / sombre / système**, interface **mobile-first** (barre d'onglets flottante, feuilles glissantes, panier en bottom sheet) et animations fluides respectant `prefers-reduced-motion`.

## 🗄️ Base de données cloud

Le dossier [`supabase/`](supabase/) contient les migrations SQL qui créent la base
de synchronisation (table `pos_rows`, RLS, Realtime, purge des tombstones) ainsi
que des vues de reporting typées (`v_sales`, `v_daily_sales`, `v_monthly_waste_rate`…).

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Voir [`supabase/README.md`](supabase/README.md) pour la marche à suivre complète
(création du compte boutique, activation dans **Paramètres → Synchronisation cloud**,
isolation multi-boutiques, entretien).

## 🚀 Démarrage

```bash
npm install
npm run dev        # développement — http://localhost:5173
npm run build      # production — dossier dist/
npm run preview    # prévisualiser le build
```

## 🔑 Comptes par défaut

| Utilisateur | Rôle           | PIN  |
|-------------|----------------|------|
| Admin       | Administrateur | 1234 |
| Caissier    | Caissier       | 0000 |

> ⚠️ Changez les codes PIN dès la première connexion (écran **Utilisateurs**).

## 🖨️ Impression

L'impression utilise la boîte de dialogue du navigateur, compatible avec les imprimantes thermiques ESC/POS installées comme imprimante système (58 mm ou 80 mm). Configurez la largeur dans **Paramètres → Design du ticket**, et faites un **test d'impression** depuis l'aperçu.

## 🛠️ Stack technique

- React 18 + TypeScript + Vite
- Dexie (IndexedDB) — stockage local robuste et transactionnel
- Supabase (Postgres) — synchronisation cloud optionnelle, migrations dans `supabase/`
- CSS sur mesure — système de design « Slate & Ember » : jetons de couleur, thème sombre,
  responsive, RTL, animations, optimisé tactile (cibles ≥ 48 px)
