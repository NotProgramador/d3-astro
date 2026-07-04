# Piloto físico en casa — 3 NFC (A-01, A-02, A-03)

Guía para grabar 3 etiquetas NFC reales, probarlas end-to-end en casa y
validar el loop completo del piloto de FAMILY-A.

## 1. Generar los 3 tokens privados

```bash
# Base URL por default: https://domingosdedibujar.netlify.app
node scripts/generate-tintamap-keys.mjs --home-pilot

# O con otro dominio (deploy preview, staging, etc):
node scripts/generate-tintamap-keys.mjs --home-pilot --base-url https://mi-deploy-preview.netlify.app
```

Esto crea, dentro de `private/tinta-estuvo-aqui/` (ignorado por Git):

- `home-pilot-nfc.csv` — placement + token + URL final + ubicación sugerida.
- `home-pilot-rotate.sql` — SQL para rotar los hashes de A-01/A-02/A-03 en el remoto.
- `key-generation-report.md` — resumen.

## 2. Aplicar la rotación en el remoto

Abrir `private/tinta-estuvo-aqui/home-pilot-rotate.sql` y pegarlo en:

> https://supabase.com/dashboard/project/arrwnyyscatmvonveogg/sql/new

Ejecutar. Debe reportar 3 filas afectadas (una por placement).

A partir de este punto, los tokens dev clásicos `TOKEN_A01_DEV` /
`TOKEN_A02_DEV` / `TOKEN_A03_DEV` **dejan de funcionar** para esos
placements. Los de FAMILY-B y FAMILY-C siguen intactos.

## 3. Grabar las 3 etiquetas NFC

App recomendada: **NFC Tools** (Android/iOS).

Pasos por etiqueta:

1. Abrir la app → **Escribir** → **Añadir un registro** → **URL / URI**.
2. Copiar la URL exacta de la columna `url` del CSV (para el placement correspondiente).
3. **Escribir** → acercar el teléfono a la etiqueta.
4. Repetir para A-02 y A-03.
5. Rotular físicamente cada etiqueta (marcador o sticker) con `A-01` / `A-02` / `A-03`
   para no confundirlas al pegarlas.

## 4. Colocar las etiquetas

Las ubicaciones sugeridas están en la columna `ubicacion_sugerida` del CSV.
Ejemplo:

| Placement | Ubicación sugerida en casa |
|---|---|
| A-01 | Sala / entrada — a la altura de la vista |
| A-02 | Cocina — junto a la puerta del refrigerador |
| A-03 | Recámara — cerca del escritorio o buró |

Ajustar libremente según tu casa.

## 5. Checklist de validación end-to-end

Con un **teléfono sin credencial previa** (o después de `localStorage.clear()`):

- [ ] **Escanear A-01** — abre `/tinta/tintamap/nodo?k=...`. Debe:
  - crear credencial automáticamente
  - mostrar modal "Encontraste A-01"
  - dots ● ○ ○, texto "1 de 3 apariciones de esta familia"
- [ ] Abrir `/tinta/tintamap/credencial`:
  - `public_id` visible
  - código de recuperación oculto por default con botones **Mostrar** / **Copiar**
  - botón **Descargar credencial PNG**
  - botón **Enviar mi credencial por correo** (deshabilitado hasta agregar correo)
- [ ] **Escanear A-02** — dots ● ● ○, progreso 2/3.
- [ ] **Escanear A-03** — dots ● ● ●, badge **"Familia completada"**,
      tarjeta de recompensa con `CLAIM-TINTA-A-XXXX`.
- [ ] Volver a `/credencial` — la sección "Recompensas desbloqueadas" muestra el claim.
- [ ] **Descargar credencial PNG** — se descarga `credencial-TINTA-XXXX.png`.
      Botón se colapsa a `"Descargada el DATE — Descargar de nuevo"`.
- [ ] Ir a `/tinta/tintamap/credencial`, agregar correo de recuperación.
- [ ] Botón **Enviar mi credencial por correo** ahora habilitado:
  - con `RESEND_API_KEY` seteado → se envía y llega a la bandeja.
  - sin `RESEND_API_KEY` → respuesta "guardado en cola", visible en tabla `email_outbox`.
  - Botón se colapsa a `"Enviada el DATE a e****@dom.com — Volver a enviar"`.
- [ ] Botón **Enviar código a mi correo** en la tarjeta de la recompensa
      funciona con la misma lógica de colapsado.
- [ ] En **otro dispositivo o navegador incógnito** entrar a `/tinta/tintamap/recuperar`,
      pegar el código de recuperación → aterriza en el índice con progreso 3/3.
- [ ] Escanear cualquiera de las 3 etiquetas de nuevo — no duplica claim,
      `is_first_time:false`, mismo `claim_code`.

## 6. Rotación / retirada

- Para cambiar los tokens antes de compartir el piloto con más gente,
  volver a correr `node scripts/generate-tintamap-keys.mjs --home-pilot` y
  aplicar el nuevo `home-pilot-rotate.sql` en el SQL Editor.
- Para retirar temporalmente un nodo:
  ```sql
  update public.node_placements set status = 'paused' where id = 'A-01';
  ```
  Después de esto, el token del NFC devolverá el mensaje editorial
  "Esta aparición de Tinta ya no está activa" en vez del contenido.

## 7. Seguridad

- **Nunca** compartir el CSV en Slack, WhatsApp, email o Git.
- Si un teléfono con `localStorage` se pierde antes de crear un `recovery_code`,
  ese recorrido se pierde. Guardar el recovery_code inmediatamente.
- Las etiquetas físicas son "quien las tenga, puede escanear" — no exponer
  el proyecto a un lugar público con estas 3 durante el piloto en casa.
