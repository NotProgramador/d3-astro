-- =============================================================
-- Tinta estuvo aquí — seed REMOTO idempotente
-- =============================================================
-- Este archivo es SEGURO para aplicar en un proyecto remoto de
-- Supabase que ya tiene datos: sólo hace INSERT ... ON CONFLICT
-- DO UPDATE y bloques DO condicionales. NUNCA borra filas de
-- explorer_profiles, explorer_devices, discoveries, reward_claims
-- ni email_preferences.
--
-- Uso:
--   Copia el contenido en Supabase Dashboard → SQL Editor
--   (proyecto remoto) y ejecútalo. También sirve para
--   staging repetido: puede correrse N veces sin duplicar nada.
--
-- IMPORTANTE — pepper y access keys:
--   Los access_key_hash de abajo se calcularon a partir de los
--   tokens dev TOKEN_A0X_DEV / B0X / C0X con PEPPER exactamente
--   igual a "dev-pepper-change-me". Estos hashes SÓLO sirven
--   mientras el secret remoto TINTAMAP_PEPPER esté configurado
--   como "dev-pepper-change-me". Para producción pública final:
--     1. Rotar TINTAMAP_PEPPER en Supabase secrets.
--     2. Regenerar tokens con:
--          node scripts/generate-tintamap-keys.mjs --production
--     3. Aplicar el prod-node-import.sql generado.
--     4. Rescribir las etiquetas NFC físicas con los tokens nuevos.
--   No hay riesgo criptográfico en publicar estos hashes: son
--   sha256(secret||pepper) y no permiten recuperar el token.
-- =============================================================

-- --------------------------------------------------------------
-- 1. Familias — INSERT ... ON CONFLICT (id) DO UPDATE
-- --------------------------------------------------------------
insert into public.node_families
  (id, slug, name, description, content_type, symbol, image_url, content_json, reward_json, is_active)
values
  ('FAMILY-A', 'tinta-con-lapiz', 'Tinta sostiene un lápiz',
    'Pregunta breve, animación mínima y un pequeño tutorial de dibujo.',
    'dialogue', '✏️', '/images/ui/tinta_lapiz.png',
    jsonb_build_object(
      'dialogues', jsonb_build_array(
        '¿Dibujas lo que ves o lo que recuerdas?',
        'Mira un objeto cercano durante treinta segundos.',
        'Ahora intenta dibujarlo sin volver a mirarlo.',
        'Te dejé un ejercicio.'
      ),
      'tutorial', jsonb_build_object(
        'title', 'Dibujo de memoria en tres pasos',
        'steps', jsonb_build_array(
          'Observa durante 30 segundos.',
          'Oculta el objeto.',
          'Dibuja lo que permaneció en tu memoria.'
        )
      )
    ),
    jsonb_build_object('placeholder', 'Mini print de Tinta con lápiz'),
    true),
  ('FAMILY-B', 'tinta-observa', 'Tinta observa',
    'Tips de dibujo, una mini viñeta y un ejercicio breve.',
    'tips', '👁️', '/images/ui/tinta_lapiz.png',
    jsonb_build_object(
      'tips', jsonb_build_array(
        'Empieza siempre por la forma general antes que por el detalle.',
        'Deja espacio en blanco: el aire también dibuja.',
        'Traza con el brazo, no sólo con la muñeca.'
      ),
      'vignette', 'Placeholder editorial — la viñeta llega en la siguiente sesión.',
      'exercise', 'Dibuja tu mano sin mirarla, sólo sintiendo el trazo.'
    ),
    jsonb_build_object('placeholder', 'Paquete digital de referencias'),
    true),
  ('FAMILY-C', 'tinta-transforma', 'Tinta transforma',
    'Dinámica creativa: una mancha, una forma, un reto.',
    'dynamic', '🌀', '/images/ui/tinta_lapiz.png',
    jsonb_build_object(
      'stain', 'Placeholder — mancha SVG llega en la siguiente sesión.',
      'challenge', 'Convierte esta forma en personaje, objeto o lugar.'
    ),
    jsonb_build_object('placeholder', 'Paquete de stickers de Tinta'),
    true)
on conflict (id) do update set
  slug         = excluded.slug,
  name         = excluded.name,
  description  = excluded.description,
  content_type = excluded.content_type,
  symbol       = excluded.symbol,
  image_url    = excluded.image_url,
  content_json = excluded.content_json,
  reward_json  = excluded.reward_json,
  is_active    = excluded.is_active,
  updated_at   = now();

-- --------------------------------------------------------------
-- 2. Placements — INSERT ... ON CONFLICT (id) DO UPDATE
--
-- Los access_key_hash abajo son sha256( token_dev || 'dev-pepper-change-me' ).
-- Reproducibles con: node -e "const c=require('crypto'); \
--   console.log(c.createHash('sha256').update('TOKEN_A01_DEV'+'dev-pepper-change-me').digest('hex'))"
-- --------------------------------------------------------------
insert into public.node_placements
  (id, family_id, location_id, display_name, zone_name, location_hint, access_key_hash, status, installed_at)
values
  ('A-01', 'FAMILY-A', 'LOC-A-01', 'Aparición 1 · lápiz', 'Zona norte', 'Cerca de una pared con marca de tiza.',
    'c78eeec20417251cf563724b938e0b86a122b4b8281cca8968488e1fe7906942', 'active', now()),
  ('A-02', 'FAMILY-A', 'LOC-A-02', 'Aparición 2 · lápiz', 'Zona centro', 'Junto a un poste con papeles.',
    'e8cf442e2babda91de1bb90bb8f1864c8e1e6cfa8f58dce8ff290de5aea4541f', 'active', now()),
  ('A-03', 'FAMILY-A', 'LOC-A-03', 'Aparición 3 · lápiz', 'Zona sur', 'Debajo de un letrero antiguo.',
    '3ba60f0667a5e0c80533af49ee480ab76b9614a0b550ebab436bfe1a091e5847', 'active', now()),
  ('B-01', 'FAMILY-B', 'LOC-B-01', 'Aparición 1 · observa', 'Zona norte', 'A la altura de la vista.',
    '7709e1bbd815441c5d59abe218e4b6f93b5fef0c2600280e59a86c5366a824f4', 'active', now()),
  ('B-02', 'FAMILY-B', 'LOC-B-02', 'Aparición 2 · observa', 'Zona centro', 'Escondida entre dos cristales.',
    'b6d6386907a294d769ed00c06807f4efb0941e5b810456d59cb2da95e7a57681', 'active', now()),
  ('B-03', 'FAMILY-B', 'LOC-B-03', 'Aparición 3 · observa', 'Zona sur', 'Justo donde nadie mira.',
    '2cffead9f77a795c6747e62e7585b928fcf80c7122b4cfb81debd14212234a7c', 'active', now()),
  ('C-01', 'FAMILY-C', 'LOC-C-01', 'Aparición 1 · transforma', 'Zona norte', 'Cerca de una banca de hierro.',
    'c21227234393848ba5f09dec00c9fa5277c79c19973d9289b2853878baba13ae', 'active', now()),
  ('C-02', 'FAMILY-C', 'LOC-C-02', 'Aparición 2 · transforma', 'Zona centro', 'A ras del suelo.',
    '38d11107228ef5c60aa84840c6316bbf3fe2ef19bde65d354d3844faaf9c3e22', 'active', now()),
  ('C-03', 'FAMILY-C', 'LOC-C-03', 'Aparición 3 · transforma', 'Zona sur', 'En la esquina más ruidosa.',
    '4a70397eedaf75a722e4284ef68c7a24a1342d1c7bc354bb3f0e345cbcf84d39', 'active', now())
on conflict (id) do update set
  family_id       = excluded.family_id,
  location_id     = excluded.location_id,
  display_name    = excluded.display_name,
  zone_name       = excluded.zone_name,
  location_hint   = excluded.location_hint,
  access_key_hash = excluded.access_key_hash,
  status          = excluded.status,
  updated_at      = now();

-- --------------------------------------------------------------
-- 3. Rewards — sin unique natural, así que:
--    (a) si ya existe una fila para FAMILY-A → UPDATE al estado deseado
--    (b) si NO existe ninguna → INSERT
--    (c) FAMILY-B y FAMILY-C: crear como inactivas sólo si faltan
-- --------------------------------------------------------------
do $reward$
begin
  -- FAMILY-A activa
  if exists (select 1 from public.rewards where family_id = 'FAMILY-A') then
    update public.rewards
      set name        = 'Mini print de Tinta con lápiz',
          description = 'Recompensa provisional al completar la familia A.',
          reward_type = 'physical_claim',
          stock       = 10,
          is_active   = true
      where family_id = 'FAMILY-A';
  else
    insert into public.rewards (family_id, name, description, reward_type, stock, is_active)
    values ('FAMILY-A', 'Mini print de Tinta con lápiz',
            'Recompensa provisional al completar la familia A.',
            'physical_claim', 10, true);
  end if;

  -- FAMILY-B placeholder (inactivo)
  if not exists (select 1 from public.rewards where family_id = 'FAMILY-B') then
    insert into public.rewards (family_id, name, description, reward_type, stock, is_active)
    values ('FAMILY-B', 'Paquete digital de referencias',
            'Recompensa provisional al completar la familia B.',
            'digital', null, false);
  end if;

  -- FAMILY-C placeholder (inactivo)
  if not exists (select 1 from public.rewards where family_id = 'FAMILY-C') then
    insert into public.rewards (family_id, name, description, reward_type, stock, is_active)
    values ('FAMILY-C', 'Paquete de stickers de Tinta',
            'Recompensa provisional al completar la familia C.',
            'stickers', null, false);
  end if;
end
$reward$;

-- --------------------------------------------------------------
-- 4. Verificación rápida — muestra qué quedó configurado.
-- --------------------------------------------------------------
select 'families' as tabla, count(*) as filas from public.node_families
union all
select 'placements', count(*) from public.node_placements
union all
select 'rewards',    count(*) from public.rewards
union all
select 'rewards_activas', count(*) from public.rewards where is_active = true;

-- Esperado tras primera aplicación limpia:
--   families         → 3
--   placements       → 9
--   rewards          → 3
--   rewards_activas  → 1  (sólo FAMILY-A)
