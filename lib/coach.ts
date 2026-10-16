// Apoyo del entrenador con Claude: solo en el servidor (rutas de /api).
// Los números se calculan aquí y se le pasan a Claude ya resueltos, para que el texto se apoye en hechos y no invente cifras.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-5-5";

/** Cliente con el token del usuario: Supabase aplica RLS, así que solo ve sus propios datos. */
export function userDb(req: Request): SupabaseClient | null {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
}

// Los modelos Claude 5.5 piensan antes de responder y ese razonamiento cuenta dentro de max_tokens.
// Con un límite chico no queda espacio para el texto: el largo se controla en el prompt y max_tokens lleva holgura.
const MIN_TOKENS = 4000;

export async function askClaude(opts: { model: string; system: string; content: string; maxTokens: number }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new CoachError("El entrenador aún no está activado (falta la clave de la API de Claude en Vercel).", 503);
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: Math.max(opts.maxTokens, MIN_TOKENS),
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
    }),
  });
  if (!r.ok) {
    console.error("anthropic", r.status, (await r.text()).slice(0, 300));
    throw new CoachError("El entrenador no respondió. Intenta de nuevo en un momento.", 502);
  }
  const j = await r.json();
  const text = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
  if (!text) {
    console.error("anthropic sin texto", opts.model, j.stop_reason);
    throw new CoachError("El entrenador no devolvió una respuesta. Intenta de nuevo.", 502);
  }
  return text;
}

export class CoachError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
