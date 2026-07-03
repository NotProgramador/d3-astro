# Tinta estuvo aquí — Manual maestro

Extensión narrativa de Domingos de Dibujar. Intervenciones físicas
con etiquetas NFC. Cada NFC es una llave única que valida un nodo
digital, registra un descubrimiento y desbloquea contenido.

## Piezas

- **Familia** — grupo temático de apariciones (`FAMILY-A`, `FAMILY-B`, `FAMILY-C`).
- **Placement** — una etiqueta física concreta con id `FAMILIA-NN` (ej. `A-01`).
- **Ubicación (location_id)** — lugar real donde vive un placement.
- **Access key (NFC)** — token opaco. La URL NFC es `/tinta/tintamap/nodo?k=TOKEN`.
- **Discovery** — un placement descubierto por un explorer.
- **Explorer profile** — identidad anónima, con `public_id` y `recovery_code`.
- **Device token** — id opaco por navegador, guardado en `localStorage`.

## Nomenclatura

| Elemento          | Ejemplo                        |
|-------------------|--------------------------------|
| Familia           | `FAMILY-A`                     |
| Placement         | `A-01`, `A-02`, `A-03`         |
| Location ID       | `LOC-A-01`                     |
| Access key (dev)  | *(en `private/tinta-estuvo-aqui/dev-node-keys.csv`)* |
| Public ID         | `TINTA-K4X9`                   |
| Recovery code     | `D3-K4X9-P2MT-9R7L`            |

## Estados de un placement

`draft` → `active` ⇄ `paused` → `missing` / `replaced` / `retired`.
Solo `active` responde con contenido; el resto muestra un mensaje editorial.

## Flujo del explorador (anónimo)

1. Acerca el teléfono → abre `/tinta/tintamap/nodo?k=TOKEN`.
2. El frontend llama a la Edge Function `unlock-node`.
3. Backend valida token, obtiene o crea perfil por `device_token`, registra `discovery`.
4. Devuelve familia + progreso + credenciales (sólo si es la primera vez).
5. Frontend guarda `public_id` y `recovery_code` en `localStorage`.
6. Muestra modal de descubrimiento y luego el contenido.

## Seguridad mínima (esta sesión)

- Access keys NFC se guardan como `sha256( token || TINTAMAP_PEPPER )` — nunca en claro.
- Recovery code hasheado con la misma fórmula.
- Device token hasheado antes de guardarse.
- RLS activo en todas las tablas; sólo `node_families(is_active=true)` es legible por anon.
- Todo lo demás pasa por Edge Function con service_role.
- Nunca exponer `SUPABASE_SERVICE_ROLE_KEY` ni `TINTAMAP_PEPPER` en el bundle Astro.

Detalle completo pendiente en `docs/TINTA_MAP_SECURITY.md` (Fase 14, próxima sesión).
