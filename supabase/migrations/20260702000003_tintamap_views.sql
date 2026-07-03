-- ============================================================
-- Tinta estuvo aquí — vista administrativa
-- ============================================================
-- Sólo accesible con service_role (RLS bloquea anon).
-- Útil para consultar estado de la red de placements desde SQL.
-- ============================================================

create or replace view public.node_status_overview as
select
  p.id                                as placement_id,
  p.family_id,
  f.name                              as family_name,
  p.status,
  p.scan_count,
  p.installed_at,
  p.last_checked_at,
  (select count(distinct d.profile_id)
     from public.discoveries d
    where d.placement_id = p.id)      as unique_discoverers,
  p.updated_at
from public.node_placements p
join public.node_families f on f.id = p.family_id
order by p.family_id, p.id;

comment on view public.node_status_overview
  is 'Panel administrativo mínimo. Sólo lectura vía service_role.';
