# Base de données cloud — Supabase

Le POS fonctionne **hors-ligne d'abord** : chaque caisse et chaque téléphone garde
une copie complète de la boutique dans IndexedDB. La base cloud sert uniquement à
répliquer ces copies entre appareils (et à faire des requêtes SQL sur les ventes).

Ces migrations créent tout ce dont `src/sync.ts` a besoin. Sans elles, la
synchronisation cloud reste inactive — l'application continue de marcher en local.

## Contenu

| Fichier | Rôle |
|---|---|
| `migrations/20260731090000_init_pos_sync.sql` | Table `pos_rows` (journal de réplication), trigger `updated_at`, index, RLS, Realtime, purge des tombstones |
| `migrations/20260731090100_reporting_views.sql` | Vues SQL typées (`v_products`, `v_sales`, `v_daily_sales`, `v_monthly_waste_rate`…) au-dessus du JSON |

### Le modèle de données

Une seule table porte toute la réplication :

```
pos_rows(table_name, id, data jsonb, deleted bool, updated_at timestamptz)
         └── clé primaire (table_name, id)
```

* `table_name` : la table Dexie d'origine (`products`, `sales`, `cashSessions`…).
* `data` : la ligne locale telle quelle, en JSON.
* `deleted` : marqueur de suppression (tombstone) — c'est ainsi qu'une suppression
  se propage aux autres appareils.
* `updated_at` : horloge **serveur**, posée par trigger avec `clock_timestamp()`
  (et non `now()`) pour que deux lignes écrites dans la même transaction aient des
  horodatages distincts : le client pagine avec un curseur strict `>` et sauterait
  sinon des lignes en limite de page.

Les vues de reporting projettent ce JSON en colonnes typées, en `security_invoker`
— la RLS de `pos_rows` s'applique donc aussi à travers elles. Les hash de code PIN
sont volontairement exclus de `v_users`.

## Appliquer les migrations

### Avec la CLI Supabase (recommandé)

```bash
npm install -g supabase          # ou : brew install supabase/tap/supabase
supabase link --project-ref <votre-project-ref>
supabase db push
```

### Sans CLI

Ouvrez **SQL Editor** dans le tableau de bord Supabase et exécutez les deux
fichiers de `migrations/`, dans l'ordre des noms. Les scripts sont **idempotents** :
les relancer ne casse rien.

### En local

```bash
supabase start && supabase db reset
```

## Après la migration

1. **Créer le compte de la boutique** : Dashboard → *Authentication* → *Users* →
   *Add user*, avec l'adresse définie par `CLOUD_EMAIL` dans `src/sync.ts`
   (`alwaha.boucherie@gmail.com`) et un mot de passe fort. Tous les appareils de la
   boutique partagent ce compte.
2. **Vérifier `SUPABASE_URL` / `SUPABASE_KEY`** dans `src/sync.ts` : ils doivent
   pointer sur votre projet (la clé *publishable* est faite pour être embarquée ;
   c'est la RLS qui protège les données).
3. Dans l'app : **Paramètres → Synchronisation cloud**, saisir le mot de passe,
   activer. Le voyant du bandeau passe au vert et la pastille indique les
   changements en attente.

## Sécurité

La RLS est active : `anon` (donc quiconque possède la clé publique) ne peut rien
lire ni écrire ; seules les sessions **authentifiées** ont accès. La suppression
physique est limitée aux lignes déjà marquées `deleted = true`.

Le modèle suppose **une boutique = un projet Supabase = un compte**. Pour héberger
plusieurs boutiques dans un même projet, ajoutez une colonne propriétaire et
resserrez les politiques :

```sql
alter table public.pos_rows add column owner uuid not null default auth.uid();
alter table public.pos_rows drop constraint pos_rows_pkey;
alter table public.pos_rows add constraint pos_rows_pkey primary key (owner, table_name, id);

drop policy "authenticated read" on public.pos_rows;
create policy "own rows" on public.pos_rows
  for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
```

C'est nécessaire car les identifiants du catalogue de démarrage sont fixes et
identiques sur toutes les installations : sans colonne propriétaire, deux
boutiques entreraient en collision sur la clé primaire.

## Entretien

Les tombstones s'accumulent. Une fois que tous les appareils ont synchronisé
au-delà de la date visée :

```sql
select public.pos_rows_purge_tombstones(90);  -- supprime les marqueurs > 90 jours
```

À planifier via *Database → Cron* si la boutique tourne toute l'année.

## Requêtes utiles

```sql
select * from v_daily_sales limit 30;                    -- CA par jour
select * from v_product_sales limit 20;                  -- top produits + marge
select * from v_monthly_waste_rate;                      -- taux de freinte
select * from v_cash_sessions where status = 'open';     -- caisses ouvertes
select date_trunc('hour', sold_at) h, sum(total)         -- heures de pointe
  from v_sales where status = 'done' group by 1 order by 1;
```
