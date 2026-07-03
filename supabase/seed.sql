-- ============================================================
-- Tinta estuvo aquí — datos seed (SOLO DESARROLLO)
-- ============================================================
-- Los access_key_hash se calculan aquí mismo con pgcrypto usando
-- el PEPPER de desarrollo. La Edge Function `unlock-node` calcula
-- el hash con la misma fórmula:  sha256( token || pepper )
--
-- Para producción:
--   1. Cambia el PEPPER en `supabase secrets set TINTAMAP_PEPPER=...`
--   2. NO uses estos tokens; genera nuevos y re-inserta hashes.
--   3. Nunca commitees el PEPPER real ni los tokens reales.
-- ============================================================

create extension if not exists "pgcrypto";

-- PEPPER de desarrollo. DEBE COINCIDIR con `TINTAMAP_PEPPER` en las
-- Edge Functions locales (ver .env.example). Si se cambia, re-corre
-- este seed.
do $$
declare
  dev_pepper text := 'dev-pepper-change-me';
  fn_hash    text;
begin
  -- Función auxiliar local (idempotente).
  create or replace function public.tintamap_hash(secret text, pepper text)
  returns text language sql immutable as $f$
    select encode(digest(secret || pepper, 'sha256'), 'hex')
  $f$;

  -- ------------------------------------------------------------
  -- Familias
  -- ------------------------------------------------------------
  insert into public.node_families (id, slug, name, description, content_type, symbol, image_url, content_json, reward_json, is_active) values
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
  on conflict (id) do nothing;

  -- ------------------------------------------------------------
  -- Placements (hashes calculados con el PEPPER de dev)
  -- ------------------------------------------------------------
  insert into public.node_placements
    (id, family_id, location_id, display_name, zone_name, location_hint, access_key_hash, status, installed_at)
  values
    ('A-01','FAMILY-A','LOC-A-01','Aparición 1 · lápiz','Zona norte','Cerca de una pared con marca de tiza.',    public.tintamap_hash('TOKEN_A01_DEV', dev_pepper), 'active', now()),
    ('A-02','FAMILY-A','LOC-A-02','Aparición 2 · lápiz','Zona centro','Junto a un poste con papeles.',           public.tintamap_hash('TOKEN_A02_DEV', dev_pepper), 'active', now()),
    ('A-03','FAMILY-A','LOC-A-03','Aparición 3 · lápiz','Zona sur','Debajo de un letrero antiguo.',              public.tintamap_hash('TOKEN_A03_DEV', dev_pepper), 'active', now()),
    ('B-01','FAMILY-B','LOC-B-01','Aparición 1 · observa','Zona norte','A la altura de la vista.',               public.tintamap_hash('TOKEN_B01_DEV', dev_pepper), 'active', now()),
    ('B-02','FAMILY-B','LOC-B-02','Aparición 2 · observa','Zona centro','Escondida entre dos cristales.',        public.tintamap_hash('TOKEN_B02_DEV', dev_pepper), 'active', now()),
    ('B-03','FAMILY-B','LOC-B-03','Aparición 3 · observa','Zona sur','Justo donde nadie mira.',                  public.tintamap_hash('TOKEN_B03_DEV', dev_pepper), 'active', now()),
    ('C-01','FAMILY-C','LOC-C-01','Aparición 1 · transforma','Zona norte','Cerca de una banca de hierro.',       public.tintamap_hash('TOKEN_C01_DEV', dev_pepper), 'active', now()),
    ('C-02','FAMILY-C','LOC-C-02','Aparición 2 · transforma','Zona centro','A ras del suelo.',                    public.tintamap_hash('TOKEN_C02_DEV', dev_pepper), 'active', now()),
    ('C-03','FAMILY-C','LOC-C-03','Aparición 3 · transforma','Zona sur','En la esquina más ruidosa.',            public.tintamap_hash('TOKEN_C03_DEV', dev_pepper), 'active', now())
  on conflict (id) do nothing;

  -- ------------------------------------------------------------
  -- Recompensas del piloto
  -- ------------------------------------------------------------
  -- FAMILY-A queda ACTIVA con reward_type='physical_claim' y stock=10;
  -- es la única que participa en el cierre de loop de este piloto.
  -- FAMILY-B y FAMILY-C quedan como placeholder inactivo.
  insert into public.rewards (family_id, name, description, reward_type, stock, is_active) values
    ('FAMILY-A', 'Mini print de Tinta con lápiz', 'Recompensa provisional al completar la familia A.', 'physical_claim', 10, true),
    ('FAMILY-B', 'Paquete digital de referencias', 'Recompensa provisional al completar la familia B.', 'digital', null, false),
    ('FAMILY-C', 'Paquete de stickers de Tinta', 'Recompensa provisional al completar la familia C.', 'stickers', null, false);
end;
$$;
