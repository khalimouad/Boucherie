-- =============================================================================
-- Boucherie POS — 0002 · reporting views
--
-- pos_rows stores opaque JSON, which is fine for the app but painful for SQL.
-- These views expose typed, relational projections of the same data so the
-- owner can query the shop from the Supabase SQL editor, a BI tool or a
-- scheduled export — without the app having to push a second copy.
--
-- Read-only by construction. `security_invoker` makes them run with the
-- caller's rights, so pos_rows' row level security still applies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Reference data
-- -----------------------------------------------------------------------------
create or replace view public.v_categories
with (security_invoker = true) as
select
  r.id,
  r.data->>'nameFr'            as name_fr,
  r.data->>'nameAr'            as name_ar,
  r.data->>'color'             as color,
  r.data->>'icon'              as icon,
  (r.data->>'sort')::int       as sort,
  r.updated_at
from public.pos_rows r
where r.table_name = 'categories' and r.deleted = false;

create or replace view public.v_products
with (security_invoker = true) as
select
  r.id,
  r.data->>'categoryId'            as category_id,
  r.data->>'nameFr'                as name_fr,
  r.data->>'nameAr'                as name_ar,
  r.data->>'unit'                  as unit,
  (r.data->>'price')::numeric      as price,
  (r.data->>'cost')::numeric       as cost,
  (r.data->>'stock')::numeric      as stock,
  (r.data->>'lowStock')::numeric   as low_stock,
  r.data->>'code'                  as code,
  (r.data->>'active')::boolean     as active,
  r.updated_at
from public.pos_rows r
where r.table_name = 'products' and r.deleted = false;

create or replace view public.v_suppliers
with (security_invoker = true) as
select
  r.id,
  r.data->>'name'  as name,
  r.data->>'phone' as phone,
  r.updated_at
from public.pos_rows r
where r.table_name = 'suppliers' and r.deleted = false;

-- PIN hashes are deliberately left out of the view.
create or replace view public.v_users
with (security_invoker = true) as
select
  r.id,
  r.data->>'name'              as name,
  r.data->>'role'              as role,
  (r.data->>'active')::boolean as active,
  r.updated_at
from public.pos_rows r
where r.table_name = 'users' and r.deleted = false;

-- -----------------------------------------------------------------------------
-- Sales
-- -----------------------------------------------------------------------------
create or replace view public.v_sales
with (security_invoker = true) as
select
  r.id,
  r.data->>'number'                as ticket_number,
  (r.data->>'date')::timestamptz   as sold_at,
  (r.data->>'subtotal')::numeric   as subtotal,
  (r.data->>'discount')::numeric   as discount,
  (r.data->>'total')::numeric      as total,
  (r.data->>'paid')::numeric       as paid,
  (r.data->>'change')::numeric     as change_given,
  r.data->>'payment'               as payment_method,
  r.data->>'userId'                as user_id,
  r.data->>'userName'              as user_name,
  r.data->>'status'                as status,
  jsonb_array_length(coalesce(r.data->'items', '[]'::jsonb)) as line_count,
  r.updated_at
from public.pos_rows r
where r.table_name = 'sales' and r.deleted = false;

create or replace view public.v_sale_items
with (security_invoker = true) as
select
  r.id                             as sale_id,
  r.data->>'number'                as ticket_number,
  (r.data->>'date')::timestamptz   as sold_at,
  r.data->>'status'                as sale_status,
  item->>'productId'               as product_id,
  item->>'nameFr'                  as name_fr,
  item->>'nameAr'                  as name_ar,
  item->>'unit'                    as unit,
  (item->>'qty')::numeric          as qty,
  (item->>'unitPrice')::numeric    as unit_price,
  (item->>'total')::numeric        as total
from public.pos_rows r
cross join lateral jsonb_array_elements(coalesce(r.data->'items', '[]'::jsonb)) as item
where r.table_name = 'sales' and r.deleted = false;

-- -----------------------------------------------------------------------------
-- Purchases
-- -----------------------------------------------------------------------------
create or replace view public.v_purchases
with (security_invoker = true) as
select
  r.id,
  (r.data->>'date')::timestamptz as purchased_at,
  r.data->>'supplierId'          as supplier_id,
  r.data->>'supplierName'        as supplier_name,
  (r.data->>'total')::numeric    as total,
  r.data->>'userId'              as user_id,
  r.data->>'userName'            as user_name,
  r.data->>'note'                as note,
  r.updated_at
from public.pos_rows r
where r.table_name = 'purchases' and r.deleted = false;

create or replace view public.v_purchase_items
with (security_invoker = true) as
select
  r.id                            as purchase_id,
  (r.data->>'date')::timestamptz  as purchased_at,
  r.data->>'supplierName'         as supplier_name,
  item->>'productId'              as product_id,
  item->>'nameFr'                 as name_fr,
  item->>'nameAr'                 as name_ar,
  (item->>'qty')::numeric         as qty,
  (item->>'unitCost')::numeric    as unit_cost,
  (item->>'total')::numeric       as total
from public.pos_rows r
cross join lateral jsonb_array_elements(coalesce(r.data->'items', '[]'::jsonb)) as item
where r.table_name = 'purchases' and r.deleted = false;

-- -----------------------------------------------------------------------------
-- Waste (freinte / الكسور)
-- -----------------------------------------------------------------------------
create or replace view public.v_waste
with (security_invoker = true) as
select
  r.id,
  (r.data->>'date')::timestamptz  as declared_at,
  r.data->>'productId'            as product_id,
  r.data->>'nameFr'               as name_fr,
  r.data->>'nameAr'               as name_ar,
  r.data->>'unit'                 as unit,
  (r.data->>'qty')::numeric       as qty,
  (r.data->>'unitCost')::numeric  as unit_cost,
  (r.data->>'value')::numeric     as value,
  r.data->>'reason'               as reason,
  r.data->>'note'                 as note,
  r.data->>'userName'             as user_name,
  r.updated_at
from public.pos_rows r
where r.table_name = 'waste' and r.deleted = false;

-- -----------------------------------------------------------------------------
-- Cash register sessions
-- -----------------------------------------------------------------------------
create or replace view public.v_cash_sessions
with (security_invoker = true) as
select
  r.id,
  (r.data->>'openedAt')::timestamptz        as opened_at,
  r.data->>'openedByName'                   as opened_by,
  (r.data->>'openingAmount')::numeric       as opening_amount,
  nullif(r.data->>'closedAt', '')::timestamptz as closed_at,
  r.data->>'closedByName'                   as closed_by,
  (r.data->>'countedAmount')::numeric       as counted_amount,
  (r.data->>'expectedAmount')::numeric      as expected_amount,
  (r.data->>'difference')::numeric          as difference,
  (r.data->>'cashSalesTotal')::numeric      as cash_sales_total,
  (r.data->>'cashInTotal')::numeric         as cash_in_total,
  (r.data->>'cashOutTotal')::numeric        as cash_out_total,
  r.data->>'status'                         as status,
  r.data->>'note'                           as note,
  r.updated_at
from public.pos_rows r
where r.table_name = 'cashSessions' and r.deleted = false;

create or replace view public.v_cash_movements
with (security_invoker = true) as
select
  r.id,
  r.data->>'sessionId'           as session_id,
  (r.data->>'date')::timestamptz as moved_at,
  r.data->>'type'                as movement_type,
  (r.data->>'amount')::numeric   as amount,
  r.data->>'note'                as note,
  r.data->>'userName'            as user_name,
  r.updated_at
from public.pos_rows r
where r.table_name = 'cashMovements' and r.deleted = false;

-- -----------------------------------------------------------------------------
-- Roll-ups
-- -----------------------------------------------------------------------------
create or replace view public.v_daily_sales
with (security_invoker = true) as
select
  (sold_at at time zone 'Africa/Casablanca')::date as day,
  count(*)                                         as sales_count,
  sum(total)                                       as revenue,
  sum(discount)                                    as discounts,
  round(avg(total), 2)                             as avg_ticket,
  sum(total) filter (where payment_method = 'cash')   as cash_total,
  sum(total) filter (where payment_method = 'card')   as card_total,
  sum(total) filter (where payment_method = 'credit') as credit_total
from public.v_sales
where status = 'done'
group by 1
order by 1 desc;

create or replace view public.v_product_sales
with (security_invoker = true) as
select
  i.product_id,
  max(i.name_fr)                                     as name_fr,
  max(i.name_ar)                                     as name_ar,
  max(i.unit)                                        as unit,
  sum(i.qty)                                         as qty_sold,
  sum(i.total)                                       as revenue,
  sum(i.qty * coalesce(p.cost, 0))                   as cost_of_goods,
  sum(i.total) - sum(i.qty * coalesce(p.cost, 0))    as gross_margin
from public.v_sale_items i
left join public.v_products p on p.id = i.product_id
where i.sale_status = 'done'
group by i.product_id
order by revenue desc;

-- Waste rate = value lost / value purchased, the number the butcher watches.
create or replace view public.v_monthly_waste_rate
with (security_invoker = true) as
with w as (
  select date_trunc('month', declared_at) as month, sum(value) as waste_value
  from public.v_waste group by 1
),
p as (
  select date_trunc('month', purchased_at) as month, sum(total) as purchase_value
  from public.v_purchases group by 1
)
select
  coalesce(w.month, p.month)::date        as month,
  coalesce(w.waste_value, 0)              as waste_value,
  coalesce(p.purchase_value, 0)           as purchase_value,
  case
    when coalesce(p.purchase_value, 0) > 0
      then round(100 * coalesce(w.waste_value, 0) / p.purchase_value, 2)
    else null
  end                                     as waste_rate_pct
from w
full outer join p on p.month = w.month
order by 1 desc;

-- -----------------------------------------------------------------------------
grant select on
  public.v_categories, public.v_products, public.v_suppliers, public.v_users,
  public.v_sales, public.v_sale_items,
  public.v_purchases, public.v_purchase_items,
  public.v_waste, public.v_cash_sessions, public.v_cash_movements,
  public.v_daily_sales, public.v_product_sales, public.v_monthly_waste_rate
to authenticated;
