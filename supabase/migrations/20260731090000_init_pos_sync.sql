-- =============================================================================
-- Boucherie POS — 0001 · cloud sync store
--
-- The app is offline-first: every till and phone keeps a full copy of the shop
-- in IndexedDB (Dexie) and replicates through a single append/merge table.
-- Each local row is pushed as one JSON document keyed by (table_name, id);
-- deletions travel as tombstones (deleted = true) so every device learns about
-- them. `updated_at` is server-assigned and is the cursor the clients page on.
--
-- Apply with:  supabase db push        (or paste into the SQL editor)
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Sync store
-- -----------------------------------------------------------------------------
create table if not exists public.pos_rows (
  -- logical Dexie table this document belongs to
  table_name  text        not null,
  -- primary key of the local row (uuid, or the setting key for `settings`)
  id          text        not null,
  -- the row itself, exactly as the client holds it
  data        jsonb       not null default '{}'::jsonb,
  -- tombstone marker: the row was deleted on some device
  deleted     boolean     not null default false,
  -- server clock, assigned by trigger; clients pull everything greater than
  -- the last value they saw
  updated_at  timestamptz not null default clock_timestamp(),
  created_at  timestamptz not null default now(),

  constraint pos_rows_pkey primary key (table_name, id),
  constraint pos_rows_table_name_check check (
    table_name in (
      'users', 'categories', 'products', 'suppliers', 'purchases',
      'sales', 'waste', 'settings', 'cashSessions', 'cashMovements',
      'tableOrders'
    )
  )
);

comment on table public.pos_rows is
  'Offline-first replication log for the Boucherie POS. One JSON document per local row.';

-- The pull query is `updated_at > cursor order by updated_at limit 500`.
create index if not exists pos_rows_updated_at_idx
  on public.pos_rows (updated_at);

-- Reporting views filter by table_name and skip tombstones.
create index if not exists pos_rows_table_live_idx
  on public.pos_rows (table_name)
  where deleted = false;

-- -----------------------------------------------------------------------------
-- Server-assigned updated_at
--
-- clock_timestamp() (not now()) so rows written inside one transaction get
-- distinct timestamps: the client pages with a strict `>` cursor, and ties on
-- a page boundary would otherwise be skipped.
-- -----------------------------------------------------------------------------
create or replace function public.pos_rows_touch()
returns trigger
language plpgsql
-- search_path figé : sans lui, un objet homonyme créé dans un schéma en amont
-- du chemin de recherche pourrait détourner l'exécution du trigger.
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := clock_timestamp();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists pos_rows_touch on public.pos_rows;
create trigger pos_rows_touch
  before insert or update on public.pos_rows
  for each row execute function public.pos_rows_touch();

-- -----------------------------------------------------------------------------
-- Row level security
--
-- The shop signs in with one cloud account shared by its devices (see
-- CLOUD_EMAIL in src/sync.ts), so access is "any authenticated session".
-- Anonymous callers get nothing, even though the publishable key is embedded
-- in the app bundle. See supabase/README.md for per-shop isolation if you ever
-- host several shops in one project.
-- -----------------------------------------------------------------------------
alter table public.pos_rows enable row level security;

drop policy if exists "authenticated read"   on public.pos_rows;
drop policy if exists "authenticated insert" on public.pos_rows;
drop policy if exists "authenticated update" on public.pos_rows;
drop policy if exists "authenticated delete" on public.pos_rows;

create policy "authenticated read"
  on public.pos_rows for select
  to authenticated
  using (true);

create policy "authenticated insert"
  on public.pos_rows for insert
  to authenticated
  with check (true);

create policy "authenticated update"
  on public.pos_rows for update
  to authenticated
  using (true)
  with check (true);

-- Hard deletes are reserved for tombstone housekeeping (see below); the app
-- itself only ever writes `deleted = true`.
create policy "authenticated delete"
  on public.pos_rows for delete
  to authenticated
  using (deleted = true);

revoke all on public.pos_rows from anon;
grant select, insert, update, delete on public.pos_rows to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime — a write on any device wakes the others instead of waiting for the
-- 15 s poll (src/sync.ts subscribes to postgres_changes on this table).
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pos_rows'
  ) then
    alter publication supabase_realtime add table public.pos_rows;
  end if;
exception
  when undefined_object then
    -- self-hosted instance without the supabase_realtime publication
    null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Housekeeping: drop tombstones every device has certainly seen.
-- Safe to call from a cron job:  select public.pos_rows_purge_tombstones(90);
-- -----------------------------------------------------------------------------
create or replace function public.pos_rows_purge_tombstones(older_than_days int default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.pos_rows
   where deleted = true
     and updated_at < now() - make_interval(days => older_than_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.pos_rows_purge_tombstones(int) is
  'Deletes deletion markers older than N days. Only run it once every device has synced past that point.';

-- PostgREST expose toute fonction du schéma public en RPC. Celle-ci est
-- SECURITY DEFINER : laissée ouverte, un appel anonyme sur
-- /rest/v1/rpc/pos_rows_purge_tombstones supprimerait les marqueurs de
-- suppression, et les appareils pas encore synchronisés verraient réapparaître
-- des articles supprimés. Réservée à l'administration.
revoke all on function public.pos_rows_purge_tombstones(int) from public, anon, authenticated;
grant execute on function public.pos_rows_purge_tombstones(int) to service_role;
