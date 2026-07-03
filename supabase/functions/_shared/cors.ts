// Shared CORS helper for Tinta estuvo aquí Edge Functions.
// Reads allowed origins from ALLOWED_ORIGINS (comma-separated).

const rawAllowed = Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:4321";
const ALLOWED = rawAllowed.split(",").map((s) => s.trim()).filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin =
    origin && ALLOWED.includes(origin) ? origin : ALLOWED[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req.headers.get("origin")),
    });
  }
  return null;
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req.headers.get("origin")),
    },
  });
}
