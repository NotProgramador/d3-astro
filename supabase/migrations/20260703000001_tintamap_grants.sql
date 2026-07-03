-- ============================================================
-- Tinta estuvo aquí — GRANTs administrativos
-- ============================================================
-- Contexto: las migraciones anteriores crearon las tablas como
-- rol `postgres` sin conceder CRUD explícito a `service_role`.
-- Resultado: PostgREST, al ejecutar con service_role, choca contra
-- `permission denied for table node_placements` (SQLSTATE 42501).
--
-- Este archivo NO desactiva RLS y NO abre permisos amplios a `anon`
-- ni a `authenticated`. `anon` conserva únicamente la lectura pública
-- de `node_families` que ya autoriza la policy de RLS.
-- ============================================================

-- Uso del schema para roles no-postgres (idempotente).
grant usage on schema public to service_role, anon, authenticated;

-- CRUD explícito a service_role sobre las 11 tablas del módulo.
grant select, insert, update, delete on
  public.explorer_profiles,
  public.explorer_devices,
  public.node_families,
  public.node_placements,
  public.discoveries,
  public.email_preferences,
  public.rewards,
  public.reward_claims,
  public.node_maintenance,
  public.email_outbox,
  public.recovery_attempts
to service_role;

-- Lectura pública mínima de node_families (metadatos no sensibles).
-- La RLS policy `node_families_public_read` sigue filtrando por is_active=true.
grant select on public.node_families to anon, authenticated;

-- Vista administrativa: sólo service_role.
grant select on public.node_status_overview to service_role;

-- Default privileges para futuras tablas creadas por `postgres` en
-- el schema public. Evita que este mismo bug reaparezca si se añade
-- una tabla nueva sin recordar concederle acceso.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
