-- =============================================================================
-- Boucherie POS — 0003 · service en salle (tables)
--
-- Les additions de table sont répliquées comme le reste, dans pos_rows sous
-- table_name = 'tableOrders'. La contrainte CHECK posée à l'initialisation énumère
-- les tables logiques autorisées : sans cette migration, toute addition de
-- table serait rejetée par la base et la synchronisation resterait bloquée sur
-- une violation de contrainte, alors même que l'application fonctionne en local.
--
-- Idempotent : ré-exécutable sans risque.
-- =============================================================================

alter table public.pos_rows drop constraint if exists pos_rows_table_name_check;

alter table public.pos_rows add constraint pos_rows_table_name_check check (
  table_name in (
    'users', 'categories', 'products', 'suppliers', 'purchases',
    'sales', 'waste', 'settings', 'cashSessions', 'cashMovements',
    'tableOrders'
  )
);

-- -----------------------------------------------------------------------------
-- Vue de reporting : additions de salle
-- -----------------------------------------------------------------------------
create or replace view public.v_table_orders
with (security_invoker = true) as
select
  r.id,
  r.data->>'label'                                as table_label,
  r.data->>'status'                               as status,
  (r.data->>'openedAt')::timestamptz              as opened_at,
  r.data->>'openedByName'                         as opened_by,
  nullif(r.data->>'settledAt', '')::timestamptz   as settled_at,
  nullif(r.data->>'saleId', '')                   as sale_id,
  jsonb_array_length(coalesce(r.data->'items', '[]'::jsonb)) as line_count,
  (
    select coalesce(sum((i->>'total')::numeric), 0)
    from jsonb_array_elements(coalesce(r.data->'items', '[]'::jsonb)) as i
  )                                               as total,
  r.data->>'note'                                 as note,
  r.updated_at
from public.pos_rows r
where r.table_name = 'tableOrders' and r.deleted = false;

comment on view public.v_table_orders is
  'Additions de salle : une ligne par service, ouverte puis réglée.';

-- Durée moyenne d'occupation et panier moyen par table, utile pour le service.
create or replace view public.v_table_stats
with (security_invoker = true) as
select
  table_label,
  count(*) filter (where status = 'settled')                  as services_regles,
  count(*) filter (where status = 'open')                     as en_cours,
  round(avg(total) filter (where status = 'settled'), 2)      as addition_moyenne,
  round(avg(extract(epoch from (settled_at - opened_at)) / 60)
        filter (where status = 'settled'), 0)                 as duree_moyenne_min
from public.v_table_orders
group by table_label
order by table_label;

grant select on public.v_table_orders, public.v_table_stats to authenticated;
