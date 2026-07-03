# Tinta estuvo aquí — Reporte de implementación (Sesión 1)

Fecha: 2026-07-02
Alcance acordado: **prioridades 1–13** del brief.
Astro sigue **100% estático**; toda la lógica sensible corre en Edge Functions Supabase.

---

## Archivos creados

### Configuración
- `.env.example`
- `supabase/config.toml`
- `package.json` *(modificado: añade `@supabase/supabase-js` como dependencia)*

### Supabase — SQL
- `supabase/migrations/20260702000001_tintamap_schema.sql` — tablas + triggers.
- `supabase/migrations/20260702000002_tintamap_rls.sql` — RLS deny-all + lectura pública mínima de `node_families`.
- `supabase/migrations/20260702000003_tintamap_views.sql` — vista `node_status_overview`.
- `supabase/seed.sql` — 3 familias, 9 placements con hashes calculados por `pgcrypto`, 3 rewards.

### Supabase — Edge Functions
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/hash.ts`  *(sha256(token||pepper))*
- `supabase/functions/_shared/ids.ts`  *(public_id, recovery_code, claim_code)*
- `supabase/functions/_shared/db.ts`  *(cliente con service_role)*
- `supabase/functions/_shared/progress.ts`
- `supabase/functions/unlock-node/index.ts`
- `supabase/functions/create-explorer/index.ts`
- `supabase/functions/recover-by-code/index.ts`
- `supabase/functions/attach-recovery-email/index.ts`
- `supabase/functions/send-recovery-email/index.ts`
- `supabase/functions/rotate-node-key/index.ts`

### Frontend Astro
- `src/lib/supabase.ts`
- `src/lib/tintamap-api.ts`
- `src/lib/tintamap-storage.ts`
- `src/components/tinta-map/TintaMapHero.astro`
- `src/components/tinta-map/FamilyIndex.astro`
- `src/components/tinta-map/DiscoveryModal.astro`
- `src/components/tinta-map/ExplorerCredential.astro`
- `src/components/tinta-map/NfcInstructions.astro`
- `src/components/tinta-map/RecoveryForm.astro`
- `src/components/tinta-map/NodeContentRenderer.astro`
- `src/pages/tinta/tintamap/index.astro`
- `src/pages/tinta/tintamap/nodo.astro`
- `src/pages/tinta/tintamap/recuperar.astro`
- `src/pages/tinta/tintamap/credencial.astro`

### Documentación
- `docs/tinta-estuvo-aqui/00_MANUAL_MAESTRO.md`
- `docs/tinta-estuvo-aqui/DEV_URLS.md`
- `docs/TINTA_MAP_IMPLEMENTATION_REPORT.md` (este archivo)
- `docs/TINTA_MAP_CONTINUIDAD.md`

## Archivos modificados

- `src/pages/tinta.astro` — se **añade** una sección `.tinta-here-section` entre el hero y la galería. Se preservan hero, gallery-section, instagram-section y archive-section originales. Sólo se sumaron estilos para `.tinta-here-*` y reglas responsive.
- `package.json` — nueva dependencia.

## Archivos **no** tocados (garantía)

`src/pages/index.astro`, `src/pages/primeros-trazos.astro`, `src/pages/mapa-d3.astro`, `src/pages/mapa-d3/[slug].astro`, `src/pages/contacto.astro`, `src/layouts/BaseLayout.astro`, `src/components/Header.astro`, `src/components/Footer.astro`, `src/styles/global.css`, `astro.config.mjs`.

## Variables de entorno necesarias

Frontend (Astro, seguras):
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_TINTAMAP_FUNCTIONS_URL`

Edge Functions (secretos, `supabase secrets set`):
- `TINTAMAP_PEPPER`  *(coincide con `dev_pepper` de la seed en desarrollo)*
- `TINTAMAP_ADMIN_SECRET`  *(sólo para `rotate-node-key`)*
- `RESEND_API_KEY`  *(opcional; si falta, correo va a `email_outbox`)*
- `RECOVERY_EMAIL_FROM`
- `ALLOWED_ORIGINS`  *(CSV, por defecto `http://localhost:4321`)*
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`  *(los provee Supabase automáticamente en las funciones)*

## Cómo correr localmente

```bash
# 1. Instalar deps
npm install

# 2. Copiar .env.example → .env y completar valores locales
cp .env.example .env

# 3. Iniciar Supabase local (requiere Docker + supabase CLI)
supabase start
supabase db reset            # aplica migraciones + seed
supabase functions serve     # Edge Functions locales

# 4. Iniciar Astro
npm run dev
```

Toma `SUPABASE_URL` y `SUPABASE_ANON_KEY` que imprime `supabase start` y ponlos en `.env`.
Configura el PEPPER con:

```bash
supabase secrets set TINTAMAP_PEPPER=dev-pepper-change-me
supabase secrets set ALLOWED_ORIGINS=http://localhost:4321
```

## URLs de prueba

Ver `docs/tinta-estuvo-aqui/DEV_URLS.md`.

## Funcionalidad completa vs stub

| Área                                    | Estado                                                   |
|-----------------------------------------|----------------------------------------------------------|
| Acceso desde /tinta                     | ✅ Sección `Tinta estuvo aquí` añadida sin romper diseño |
| Portada `/tinta/tintamap`               | ✅ Hero + acciones + índice + NFC + editorial            |
| Validación NFC + registro               | ✅ Edge Function `unlock-node` completa                  |
| Credencial anónima                      | ✅ Creada automáticamente en primer scan o manualmente   |
| Discoveries + progreso                  | ✅ Persistidos + upsert idempotente                      |
| Recuperación por código                 | ✅ Con rate-limit ligero                                 |
| Correo opcional + preferencias          | ✅ Guarda; envío real si `RESEND_API_KEY` está           |
| Send recovery email                     | ✅ Con respuesta siempre neutral                         |
| Rotación de key de un placement         | ✅ Edge Function admin protegida por secreto             |
| Estados de nodo (paused/retired/etc)    | ✅ Devuelven mensaje editorial                           |
| Recompensa por familia completada       | 🟡 Placeholder editorial visible; sin claim_code UI      |
| Contenido FAMILY-A (dialogue)           | ✅ 4 diálogos + tutorial                                 |
| Contenido FAMILY-B (tips)               | 🟡 3 tips + placeholder viñeta + ejercicio               |
| Contenido FAMILY-C (dynamic)            | 🟡 Placeholder de mancha + reto                          |
| Descarga de credencial como imagen      | ❌ Fuera de alcance (Fase 6)                             |
| Panel admin visual                      | ❌ Sólo vista SQL `node_status_overview` (Fase 13)       |
| Guiones de reels                        | ❌ Fase 16                                               |
| Estructura de respaldo externa          | ❌ Fase 15                                               |
| Documento de seguridad completo         | ❌ Fase 14                                               |

## Verificación (a correr manualmente, ver criterio en el plan)

1. `/tinta` — la galería, Instagram y archivo intactos; aparece nueva tarjeta.
2. `/tinta/tintamap` — hero, botones, índice con nodos `?`.
3. `/tinta/tintamap/nodo?k=<A-01 dev key>` — modal + contenido dialogue + credencial creada.
   *(La key literal vive en `private/tinta-estuvo-aqui/dev-node-urls.txt`; ver `node scripts/generate-tintamap-keys.mjs`.)*
4. `/tinta/tintamap` — A-01 ahora aparece descubierto (progreso 1/3 en FAMILY-A).
5. Repetir con A-02 y A-03 → familia completada, recompensa placeholder visible.
6. `/tinta/tintamap/credencial` — modo privado con copy button.
7. Otro navegador → `/tinta/tintamap/recuperar`, pegar recovery code, restaura progreso.
8. `?k=INVALIDO` → mensaje editorial (no error).
9. `update node_placements set status='paused' where id='A-01';` → A-01 devuelve editorial.
10. Sin `.env` → mensaje "Tinta aún no está conectada", no crash.

## Riesgos y notas

- **CORS**: la variable `ALLOWED_ORIGINS` debe incluir el dominio de producción al desplegar.
- **PEPPER**: la seed usa `dev-pepper-change-me`. Rotar antes de producción y re-generar hashes.
- **Rate-limit** de `recover-by-code` está en tabla con umbral 8/hora por hash de código. Endurecer en Fase 14.
- **Sin JS**: si el navegador tiene JS desactivado, `/tinta/tintamap/nodo` no funciona. Aceptable para NFC.
- **localStorage**: pérdida sin recovery_code = pérdida de progreso. La UI invita a crear credencial en el primer scan.

## Siguientes pasos

Ver `docs/TINTA_MAP_CONTINUIDAD.md`.
