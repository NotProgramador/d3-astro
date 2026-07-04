-- ============================================================
-- Tinta estuvo aquí — timestamps de envío por correo
-- ============================================================
-- Contexto: la fase UX del piloto agrega botones "enviar
-- credencial por correo" y "enviar código a mi correo". Necesitamos
-- registrar cuándo se envió cada uno para colapsar los CTAs
-- principales una vez cumplidos.
--
-- Additive-only: no cambia RLS, no toca grants, no afecta filas
-- existentes. `if not exists` idempotente.
-- ============================================================

alter table public.explorer_profiles
  add column if not exists credential_emailed_at timestamptz null;

alter table public.reward_claims
  add column if not exists claim_emailed_at timestamptz null;
