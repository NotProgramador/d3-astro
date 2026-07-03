-- ============================================================
-- Tinta estuvo aquí — schema base (Fase 5)
-- ============================================================
-- Nada de PII en texto plano fuera de email. Todo lo sensible
-- (recovery_code, device_token, access_key NFC) se guarda como
-- hash. Los hashes se calculan en Edge Functions usando un PEPPER.
-- ============================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------
-- Trigger reutilizable para updated_at
-- --------------------------------------------------------------
create or replace function public.tintamap_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- --------------------------------------------------------------
-- 1. explorer_profiles
-- --------------------------------------------------------------
create table if not exists public.explorer_profiles (
  id                   uuid primary key default gen_random_uuid(),
  auth_user_id         uuid null,
  public_id            text unique not null,
  recovery_code_hash   text unique not null,
  email                text null,
  email_verified       boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  last_seen_at         timestamptz not null default now()
);

create index if not exists explorer_profiles_email_idx
  on public.explorer_profiles (email)
  where email is not null;

drop trigger if exists trg_explorer_profiles_touch on public.explorer_profiles;
create trigger trg_explorer_profiles_touch
before update on public.explorer_profiles
for each row execute function public.tintamap_touch_updated_at();

-- --------------------------------------------------------------
-- 2. explorer_devices
-- --------------------------------------------------------------
create table if not exists public.explorer_devices (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references public.explorer_profiles(id) on delete cascade,
  device_token_hash  text unique not null,
  created_at         timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  revoked_at         timestamptz null
);

create index if not exists explorer_devices_profile_idx
  on public.explorer_devices (profile_id);

-- --------------------------------------------------------------
-- 3. node_families
-- --------------------------------------------------------------
create table if not exists public.node_families (
  id             text primary key,
  slug           text unique not null,
  name           text not null,
  description    text,
  content_type   text,
  symbol         text,
  image_url      text null,
  animation_url  text null,
  tutorial_url   text null,
  content_json   jsonb not null default '{}'::jsonb,
  reward_json    jsonb not null default '{}'::jsonb,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_node_families_touch on public.node_families;
create trigger trg_node_families_touch
before update on public.node_families
for each row execute function public.tintamap_touch_updated_at();

-- --------------------------------------------------------------
-- 4. node_placements
-- --------------------------------------------------------------
create table if not exists public.node_placements (
  id               text primary key,
  family_id        text not null references public.node_families(id),
  location_id      text not null,
  display_name     text,
  zone_name        text null,
  location_hint    text null,
  access_key_hash  text unique not null,
  status           text not null default 'draft'
                     check (status in ('draft','active','paused','missing','retired','replaced')),
  installed_at     timestamptz null,
  last_checked_at  timestamptz null,
  scan_count       bigint not null default 0,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists node_placements_family_idx
  on public.node_placements (family_id);

create index if not exists node_placements_status_idx
  on public.node_placements (status);

drop trigger if exists trg_node_placements_touch on public.node_placements;
create trigger trg_node_placements_touch
before update on public.node_placements
for each row execute function public.tintamap_touch_updated_at();

-- --------------------------------------------------------------
-- 5. discoveries
-- --------------------------------------------------------------
create table if not exists public.discoveries (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.explorer_profiles(id) on delete cascade,
  placement_id      text not null references public.node_placements(id),
  family_id         text not null references public.node_families(id),
  first_scanned_at  timestamptz not null default now(),
  last_scanned_at   timestamptz not null default now(),
  scan_count        integer not null default 1,
  unique (profile_id, placement_id)
);

create index if not exists discoveries_profile_idx
  on public.discoveries (profile_id);

create index if not exists discoveries_family_idx
  on public.discoveries (family_id);

-- --------------------------------------------------------------
-- 6. email_preferences
-- --------------------------------------------------------------
create table if not exists public.email_preferences (
  profile_id        uuid primary key references public.explorer_profiles(id) on delete cascade,
  recovery_emails   boolean not null default true,
  clue_emails       boolean not null default false,
  event_emails      boolean not null default false,
  project_news      boolean not null default false,
  consented_at      timestamptz null,
  unsubscribed_at   timestamptz null
);

-- --------------------------------------------------------------
-- 7. rewards
-- --------------------------------------------------------------
create table if not exists public.rewards (
  id             uuid primary key default gen_random_uuid(),
  family_id      text null references public.node_families(id),
  placement_id   text null references public.node_placements(id),
  name           text not null,
  description    text,
  reward_type    text,
  stock          integer null,
  claimed_count  integer not null default 0,
  active_from    timestamptz null,
  active_until   timestamptz null,
  is_active      boolean not null default false,
  rules_json     jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

-- --------------------------------------------------------------
-- 8. reward_claims
-- --------------------------------------------------------------
create table if not exists public.reward_claims (
  id           uuid primary key default gen_random_uuid(),
  reward_id    uuid not null references public.rewards(id),
  profile_id   uuid not null references public.explorer_profiles(id),
  claim_code   text unique not null,
  status       text not null default 'available'
                 check (status in ('available','claimed','expired','cancelled')),
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz null,
  unique (reward_id, profile_id)
);

-- --------------------------------------------------------------
-- 9. node_maintenance
-- --------------------------------------------------------------
create table if not exists public.node_maintenance (
  id           uuid primary key default gen_random_uuid(),
  placement_id text not null references public.node_placements(id),
  status       text,
  notes        text,
  photo_url    text null,
  checked_at   timestamptz not null default now()
);

-- --------------------------------------------------------------
-- 10. email_outbox — cola de correos pendientes si SMTP no está listo
-- --------------------------------------------------------------
create table if not exists public.email_outbox (
  id         uuid primary key default gen_random_uuid(),
  to_email   text not null,
  subject    text not null,
  body_text  text not null,
  body_html  text null,
  kind       text not null,
  status     text not null default 'pending'
               check (status in ('pending','sent','failed','skipped')),
  attempts   integer not null default 0,
  last_error text null,
  created_at timestamptz not null default now(),
  sent_at    timestamptz null
);

-- --------------------------------------------------------------
-- 11. recovery_attempts — rate limit ligero
-- --------------------------------------------------------------
create table if not exists public.recovery_attempts (
  id            uuid primary key default gen_random_uuid(),
  ip_hash       text null,
  identifier    text not null,   -- hash del code o del email
  succeeded     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists recovery_attempts_recent_idx
  on public.recovery_attempts (identifier, created_at desc);
