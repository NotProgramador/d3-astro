-- ============================================================
-- Tinta estuvo aquí — Row Level Security
-- ============================================================
-- Regla general: deny-all al rol anon. Toda operación sensible
-- se hace desde Edge Functions con service_role, que bypassa RLS.
-- Sólo node_families con is_active=true es legible como pública
-- (para pintar el índice de familias sin exponer keys).
-- ============================================================

alter table public.explorer_profiles     enable row level security;
alter table public.explorer_devices      enable row level security;
alter table public.node_families         enable row level security;
alter table public.node_placements       enable row level security;
alter table public.discoveries           enable row level security;
alter table public.email_preferences     enable row level security;
alter table public.rewards               enable row level security;
alter table public.reward_claims         enable row level security;
alter table public.node_maintenance      enable row level security;
alter table public.email_outbox          enable row level security;
alter table public.recovery_attempts     enable row level security;

-- Sólo lectura pública de familias activas (metadatos no sensibles).
drop policy if exists node_families_public_read on public.node_families;
create policy node_families_public_read
  on public.node_families
  for select
  to anon, authenticated
  using (is_active = true);

-- Nada más. Cualquier otra operación viaja por Edge Function.
