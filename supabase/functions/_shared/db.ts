// Cliente Supabase administrativo para Edge Functions.
// NUNCA se expone al navegador.
//
// Reglas:
//   - Usa SUPABASE_SERVICE_ROLE_KEY (inyectada automáticamente por
//     `supabase functions serve` y por la plataforma en producción).
//   - Nunca hereda el Authorization del navegador: no toma nada del
//     Request entrante; se construye a partir del entorno del proceso.
//   - Nunca usa SUPABASE_ANON_KEY ni claves PUBLIC_*.
//   - Import `npm:@supabase/supabase-js@2` (esquema recomendado por
//     Supabase para el runtime Deno de Edge Functions). El esquema
//     `https://esm.sh/...` que usaba antes producía un cliente cuyo JWT
//     efectivo NO era el de service_role al llegar a PostgREST, y toda
//     consulta caía sujeta a RLS → 42501 "permission denied for table".

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Logging seguro: sólo presencia, nunca valores.
console.log(
  "[tintamap] boot supabaseAdmin",
  JSON.stringify({
    has_SUPABASE_URL: !!supabaseUrl,
    has_SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey,
  }),
);

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing server-side Supabase environment variables (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
  );
}

export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      // Blindaje explícito: sólo enviamos apikey/Authorization con la
      // service role. Ningún header proveniente del cliente se propaga.
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  },
);

// Alias retro-compatible para no romper llamadas viejas.
export function getDb(): SupabaseClient {
  return supabaseAdmin;
}

export type { SupabaseClient };
