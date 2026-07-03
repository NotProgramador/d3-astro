# Tinta estuvo aquí — Continuidad (Fases 9–17 pendientes)

Este archivo es la ficha para retomar el proyecto en la próxima sesión.
Lista exactamente qué falta, qué archivos tocar y en qué orden.

---

## Orden sugerido para la próxima sesión

### 1. Contenido interactivo real (Fase 9)

Los renderers están listos; falta contenido definitivo.

- **FAMILY-B (tips)**
  - `supabase/seed.sql` — enriquecer `content_json.vignette` con contenido real (texto o SVG multi-panel).
  - Alternativa: mover viñeta a un componente `NodeVignette.astro` en `src/components/tinta-map/` y usarlo dentro de `nodo.astro` cuando `content_type === 'tips'`.

- **FAMILY-C (dynamic)**
  - Reemplazar el `stain-placeholder` (◍) en `src/pages/tinta/tintamap/nodo.astro` por un componente SVG animado. Ver rama `renderFamilyContent(family, content)` en ese archivo.
  - Añadir botón "cambiar mancha" cuando haya al menos 3 stains distintos en `content_json.stains`.

### 2. Recompensas visuales y claim (Fase 10)

Tabla `rewards` y `reward_claims` ya existen y hay reward por familia sin `is_active`. Falta:

- Activar rewards (`update rewards set is_active=true where family_id='FAMILY-A';`).
- Crear Edge Function `claim-reward` (`supabase/functions/claim-reward/index.ts`) que:
  - valida que el explorer haya completado la familia,
  - crea `reward_claims` con `claim_code` (helper `generateClaimCode` ya existe en `_shared/ids.ts`),
  - responde con el `claim_code` una sola vez.
- UI: al final de `renderContent(res)` en `src/pages/tinta/tintamap/nodo.astro`, cuando `famProgress.completed`, mostrar un botón "Reclamar recompensa" que llame a la función y muestre el `claim_code`. Persistirlo en `localStorage` bajo clave `ddd.tintamap.claims`.

### 3. Descarga de credencial como imagen (Fase 6, final)

- Añadir a `src/pages/tinta/tintamap/credencial.astro` un botón "Guardar credencial" que renderice la card actual a un `<canvas>` (`html2canvas` o dibujo manual con `CanvasRenderingContext2D`, prefiero manual para no añadir dependencia) y descargue PNG.

### 4. Panel administrativo (Fase 13)

Ya existe la vista `node_status_overview` (sólo `service_role`). Falta:

- `src/pages/tinta/tintamap/admin/index.astro` protegido por prompt de admin secret (nunca en el bundle).
- Edge Function `admin-list-nodes` que devuelva el snapshot de la vista y requiera header `x-admin-secret`.
- Acciones: pausar/reanudar, marcar `missing`, rotar key (ya existe `rotate-node-key`).

### 5. Documento de seguridad completo (Fase 14)

- Crear `docs/TINTA_MAP_SECURITY.md`. Cubrir:
  - modelo de identidad,
  - diferencia public_id vs recovery_code,
  - flujo NFC,
  - device token,
  - flujo de recuperación,
  - rotación,
  - RLS,
  - riesgos pendientes.
- Endurecer rate-limit: rechazar más de N intentos por IP hash + código en 10 minutos. Ya existe `recovery_attempts`; añadir columna `ip_hash` (existe) y calcularla en la función (hash del `x-forwarded-for`).

### 6. Estructura de respaldo externa (Fase 15)

- Añadir en `docs/tinta-estuvo-aqui/` el resto del manual (`01_NOMENCLATURA.md` … `09_CHECKLIST_PILOTO.md`).
- No commitear datos reales; documentar la estructura recomendada de la carpeta local `TINTA_ESTUVO_AQUI/TEMPORADA_01_PILOTO_COLONIA/`.

### 7. Reels y comunicación (Fase 16)

- `docs/tinta-estuvo-aqui/08_REELS_Y_COMUNICACION.md` con los 5 guiones propuestos en el brief.

### 8. Envío real de recovery por correo (extensión de Fase 7)

Ahora `send-recovery-email` no envía el `recovery_code` real (guardamos su hash). Opciones:

- **Magic-link**: emitir un token de un uso con TTL corto, guardarlo hasheado en una nueva tabla `email_recovery_tokens`, y enviar URL `/tinta/tintamap/recuperar?magic=TOKEN` que llame a una nueva Edge Function `consume-magic-token`.
- Adoptar `supabase.auth.signInWithOtp` pero desacoplarlo del sistema de `auth.users` (o vincularlo vía `auth_user_id` que ya existe en `explorer_profiles`).

### 9. Ampliar cobertura de contenidos por placement (variantes A-01 vs A-02)

Hoy el contenido vive en `node_families.content_json`. Para bonus por placement:
- añadir columna `node_placements.bonus_json jsonb` (nueva migración) y devolverla en `unlock-node`.
- en `renderContent(res)` en `nodo.astro`, mostrar el bonus cuando no sea el primer scan de la familia.

---

## Notas de arquitectura para no rehacer nada

- Todos los hashes usan `sha256( secret || pepper )`. Cambiar la fórmula obliga a rotar todo.
- El `device_token` NUNCA sale del navegador en claro más allá de la Edge Function; el hash sí queda en DB.
- El componente `NodeContentRenderer.astro` está listo por si conviene migrar la lógica de render dentro de `nodo.astro` a un flujo con hidratación desde el server (cuando cambie el output mode).
- Las Edge Functions comparten `_shared/`, así que añadir una nueva es trivial (copiar `create-explorer` como plantilla).

## Verificación mínima antes de cerrar cada sesión futura

```bash
npm run build
supabase db reset
supabase functions serve
# Recorrer las 10 pruebas del reporte de implementación.
```
