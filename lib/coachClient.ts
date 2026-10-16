"use client";

import { supabase } from "@/lib/supabase";

/** Llama a una ruta del entrenador con el token de la sesión (el servidor aplica RLS con él). */
export async function callCoach<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "No se pudo conectar con el entrenador.");
  return j as T;
}
