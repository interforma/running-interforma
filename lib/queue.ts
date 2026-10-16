"use client";

import { supabase } from "@/lib/supabase";

// Uso sin señal: cada cambio se intenta subir; si falla, queda en el teléfono y se reintenta al volver la conexión.
// Las filas llevan su id generado en el teléfono, así reintentar nunca duplica.

type Job = { table: string; row: Record<string, unknown>; onConflict?: string };
const KEY = "ri.queue";

const read = (): Job[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const write = (q: Job[]) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch {} };

export const pending = () => read().length;

async function send(job: Job) {
  const { error } = await supabase.from(job.table).upsert(job.row, job.onConflict ? { onConflict: job.onConflict } : undefined);
  if (error) throw error;
}

/** Guarda una fila. Devuelve "nube" si llegó a Supabase o "telefono" si quedó en cola. */
export async function save(table: string, row: Record<string, unknown>, onConflict?: string): Promise<"nube" | "telefono"> {
  const job = { table, row, onConflict };
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("offline");
    await send(job);
    return "nube";
  } catch (e: any) {
    // Un error de datos (por ejemplo, un valor fuera de rango) no se arregla reintentando.
    // Sin señal, supabase-js devuelve un error sin código; los errores de datos traen el código de Postgres.
    if (e?.code) throw e;
    write([...read(), job]);
    return "telefono";
  }
}

let flushing = false;
export async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    const q = read();
    const left: Job[] = [];
    for (const job of q) {
      try { await send(job); } catch { left.push(job); }
    }
    write(left);
  } finally { flushing = false; }
}
