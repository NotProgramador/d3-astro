# URLs de prueba — SÓLO DESARROLLO LOCAL

> **Este archivo ya no contiene las keys.** Las keys de desarrollo son
> secretos operativos y viven fuera del repositorio, en `private/`.
> Regenera el inventario con el script y usa los archivos privados:
>
> ```bash
> node scripts/generate-tintamap-keys.mjs
> ```
>
> Genera (dentro de `private/tinta-estuvo-aqui/`, ignorado por Git):
> - `dev-node-keys.csv`
> - `dev-node-urls.txt`
> - `key-generation-report.md`

## PEPPER de desarrollo

El pepper vive en `supabase/.env.local` (ignorado por Git) como
`TINTAMAP_PEPPER=...`. Debe coincidir con el `dev_pepper` usado en
`supabase/seed.sql`. Para comprobarlo:

```bash
node scripts/generate-tintamap-keys.mjs --verify-dev
```

Debe imprimir `MATCH` para los 9 placements y salir con exit code 0.
Si aparece `MISMATCH`, el PEPPER local de las Edge Functions ya no
coincide con el que usó la seed. Re-siembra la base o rota el pepper.

## Escenarios negativos

| Caso                     | Cómo probar                                                        |
|--------------------------|--------------------------------------------------------------------|
| Key inválida             | `http://localhost:4321/tinta/tintamap/nodo?k=NO_EXISTE`            |
| Nodo pausado             | En SQL: `update node_placements set status='paused' where id='A-01';` |
| Nodo retirado            | Igual con `status='retired'`.                                     |
| Sin `?k=`                | `http://localhost:4321/tinta/tintamap/nodo`                        |
| Supabase caído           | `npx supabase stop`, refrescar la página del nodo.                 |

## Rotar una key de placement

Vía Edge Function admin (nunca desde el navegador):

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/rotate-node-key \
  -H "x-admin-secret: <TINTAMAP_ADMIN_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"placement_id":"A-01"}'
```

Devuelve el nuevo token en la respuesta una sola vez.
