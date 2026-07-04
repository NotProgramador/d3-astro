# Deploy remoto — Tinta estuvo aquí (Netlify + Supabase)

Guía end-to-end para llevar el piloto del entorno local (Docker + Supabase CLI)
al mundo real:

- **Astro estático** en Netlify.
- **Supabase remoto** (Postgres + Edge Functions).
- **Netlify** recibe únicamente variables `PUBLIC_*`.
- **Ningún secreto** (`SUPABASE_SERVICE_ROLE_KEY`, `TINTAMAP_PEPPER`,
  `RESEND_API_KEY`) sale del panel de Supabase.

## 0. Aclaración importante

**"Supabase corriendo con `supabase start`" NO equivale a "proyecto remoto".**
El CLI local levanta contenedores Docker con Postgres + Edge Runtime + Kong,
pero eso vive sólo en tu máquina. Para que Netlify pueda hablar con Supabase
necesitamos un **proyecto real** en supabase.com.

Por eso `npx supabase projects list` sale vacío si nunca creaste uno, y
`npx supabase link` no puede vincularse a la nada.

## 1. Crear el proyecto remoto en Supabase Dashboard

1. Entra a https://supabase.com/dashboard.
2. **New project** → nombra el proyecto (ej. `d3-tinta-piloto`) y elige región.
3. Espera a que termine de provisionar (~2 min).
4. En la URL del dashboard verás algo así:
   ```
   https://supabase.com/dashboard/project/abcdefghijklmnopqrst
                                          ↑ PROJECT_REF (20 chars aprox)
   ```
5. Anota el **PROJECT_REF**. No necesitas exponer aquí ni la contraseña de la
   base ni el service_role: los usaremos localmente con `supabase link`.

## 2. Vincular el proyecto local al remoto

Ya hiciste `npx supabase login` correctamente. Ahora:

```bash
npx supabase link --project-ref <PROJECT_REF>
```

El CLI te pedirá **la contraseña de la base de datos** (la que definiste al
crear el proyecto). Escríbela **en tu terminal**, no la pongas en documentos
ni la compartas por chat.

Verifica que el link quedó:

```bash
npx supabase migration list
```

Debe listar las 4 migraciones locales y su estado remoto.

## 3. Aplicar migraciones al remoto

```bash
npx supabase db push
```

Aplica las migraciones que aún no existan en el remoto. **No usar
`supabase db reset`** — ese comando borra todos los datos.

Migraciones esperadas:

- `20260702000001_tintamap_schema.sql`
- `20260702000002_tintamap_rls.sql`
- `20260702000003_tintamap_views.sql`
- `20260703000001_tintamap_grants.sql`

Si `db push` pregunta confirmación, revisa la lista antes de aceptar.

## 4. Seed remoto idempotente

Usa `supabase/remote_seed_tintamap.sql`. Es **seguro re-aplicarlo**: sólo hace
`INSERT ... ON CONFLICT DO UPDATE` y bloques condicionales. **NUNCA borra**
filas de `explorer_profiles`, `explorer_devices`, `discoveries`,
`reward_claims`, `email_preferences`, ni `node_maintenance`.

### Aplicación recomendada — SQL Editor del Dashboard

1. Abre el proyecto en https://supabase.com/dashboard/project/&lt;PROJECT_REF&gt;.
2. Menú lateral → **SQL Editor** → **New query**.
3. Pega el contenido completo de `supabase/remote_seed_tintamap.sql`.
4. **Run**.
5. Al final debe imprimir:
   ```
   families         → 3
   placements       → 9
   rewards          → 3
   rewards_activas  → 1
   ```

### Aplicación alternativa vía CLI

```bash
# Requiere el DB URL directo (el que aparece en Dashboard → Project Settings → Database).
# NO poner la URL con contraseña en documentos versionados.
psql "$SUPABASE_DB_URL" -f supabase/remote_seed_tintamap.sql
```

## 5. Configurar secrets de las Edge Functions

```bash
# PEPPER — debe coincidir con el usado para calcular los access_key_hash del seed.
npx supabase secrets set TINTAMAP_PEPPER=dev-pepper-change-me

# Orígenes CORS permitidos — separados por coma si son varios.
npx supabase secrets set ALLOWED_ORIGINS=https://domingosdedibujar.netlify.app

# (Opcional) SMTP real. Si falta, los correos van a la tabla email_outbox.
# npx supabase secrets set RESEND_API_KEY=<clave real>
# npx supabase secrets set RECOVERY_EMAIL_FROM="Tinta <noreply@tudominio.com>"

# (Opcional) Admin secret para rotate-node-key.
# npx supabase secrets set TINTAMAP_ADMIN_SECRET=<clave larga aleatoria>
```

Verifica con:

```bash
npx supabase secrets list
```

**Nunca** pongas estos secrets en Netlify.

## 6. Desplegar Edge Functions

```bash
npx supabase functions deploy unlock-node
npx supabase functions deploy create-explorer
npx supabase functions deploy recover-by-code
npx supabase functions deploy attach-recovery-email
npx supabase functions deploy send-recovery-email
npx supabase functions deploy rotate-node-key
```

Las URLs quedarán en:

```
https://<PROJECT_REF>.supabase.co/functions/v1/<function-name>
```

## 7. Configurar Netlify

En el repo ya existe `netlify.toml` con:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

En **Netlify Dashboard → Site settings → Environment variables**, añadir
exclusivamente estas tres:

| Variable | Valor |
|---|---|
| `PUBLIC_SUPABASE_URL` | `https://<PROJECT_REF>.supabase.co` |
| `PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key del proyecto remoto (Settings → API) |
| `PUBLIC_TINTAMAP_FUNCTIONS_URL` | `https://<PROJECT_REF>.supabase.co/functions/v1` |

**NUNCA** añadas en Netlify:
- `SUPABASE_SERVICE_ROLE_KEY`
- `TINTAMAP_PEPPER`
- `RESEND_API_KEY`
- `TINTAMAP_ADMIN_SECRET`

Astro sólo lee las que empiezan con `PUBLIC_`; cualquier otra variable
quedaría fuera del bundle y no aportaría nada al frontend.

## 8. Build local previo

Antes de disparar el deploy en Netlify, confirma en local:

```bash
npm run build
```

Debe imprimir `19 page(s) built`.

## 9. Deploy en Netlify

Conecta el repo `NotProgramador/d3-astro` a Netlify. El deploy se dispara al
mergear la rama a `main` (o a la rama que configures como production).

Al terminar, el sitio queda en `https://<tu-slug>.netlify.app` (por default)
o en tu dominio custom.

## 10. Pruebas remotas (checklist)

Con el sitio ya en Netlify:

| # | Prueba | Esperado |
|---|---|---|
| 1 | `GET /tinta/tintamap` | Página portada carga; sin `[data-hydrating]` bloqueado |
| 2 | Abrir una URL de nodo con un token dev del `dev-node-urls.txt` privado | Modal + contenido de FAMILY-A |
| 3 | Confirmar creación de credencial | localStorage tiene `public_id` + `recovery_code` |
| 4 | Escanear A-02 | Progreso 2/3 en FamilyProgress |
| 5 | Escanear A-03 | Modal muestra badge "Familia completada" |
| 6 | Ver `/credencial` | Sección "Recompensas desbloqueadas" con CLAIM-TINTA-A-XXXX |
| 7 | Copiar recovery code y limpiar localStorage | Simulación de "otro dispositivo" |
| 8 | `/recuperar` → pegar código | Redirige al índice, progreso 3/3 restaurado |
| 9 | Nodo con `?k=NO_EXISTE` | Mensaje editorial "No encontramos esta aparición" |
| 10 | Console de Chrome DevTools durante 1-9 | Sin errores CORS ni 4xx/5xx |

**Verificar CORS**: si aparece un error `CORS` en la consola, revisa el secret
remoto `ALLOWED_ORIGINS`. Debe incluir el dominio exacto que muestra la barra
del navegador (incluyendo `https://`).

## 11. Migración de staging → producción

Los tokens dev (`TOKEN_A0X_DEV`) y el pepper `dev-pepper-change-me` **NO deben
usarse en la fase pública**. Antes del lanzamiento definitivo:

1. **Rotar PEPPER** en Supabase secrets:
   ```bash
   npx supabase secrets set TINTAMAP_PEPPER=<nuevo pepper aleatorio y largo>
   ```
2. **Generar tokens de producción**:
   ```bash
   TINTAMAP_PEPPER=<mismo pepper anterior> node scripts/generate-tintamap-keys.mjs --production
   ```
   Genera `private/tinta-estuvo-aqui/prod-node-keys.csv` (tokens) y
   `prod-node-import.sql` (sólo hashes).
3. **Aplicar los nuevos hashes** en la base remota vía SQL Editor:
   - Copia el contenido de `prod-node-import.sql` y ejecútalo.
   - Los tokens viejos (dev) dejan de validar automáticamente.
4. **Programar las etiquetas NFC físicas** con las URLs prefijadas del dominio
   real usando el CSV privado. El CSV nunca debe subirse a Git ni al chat.
5. **Rotar `TINTAMAP_ADMIN_SECRET`** si vas a exponerlo a más de una persona.

## 12. Chequeos de seguridad antes de dar por terminado

- `git status` no lista nada dentro de `/private/`, `.env`, ni `supabase/.env.local`.
- Grep en `src/`, `public/`, `docs/`, `dist/` por `TOKEN_[ABC]0[1-3]_DEV` → 0
  coincidencias.
- Grep en `dist/` post-build por `service_role|TINTAMAP_PEPPER|recovery_code_hash`
  → 0 coincidencias.
- Netlify env vars: sólo tres, todas `PUBLIC_*`.
- Supabase secrets: `PEPPER`, `ALLOWED_ORIGINS`, y opcionales; nunca replicados en Netlify.

## Pendientes conocidos (no bloqueantes para el piloto)

- Envío real de correos: requiere `RESEND_API_KEY` en Supabase secrets. Sin
  eso, `send-recovery-email` y `attach-recovery-email` dejan los correos en
  la tabla `email_outbox` con `status='skipped'`.
- Contenido definitivo de FAMILY-B / FAMILY-C.
- Panel administrativo interno (hoy sólo hay la vista SQL
  `node_status_overview` accesible con service_role).
