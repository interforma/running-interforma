// Lógica pura de salidas: leer lo que escribe el corredor y mostrar cifras en formato chileno.

export type Rpe = 1 | 2 | 3 | 4 | 5;
export const RPE: [Rpe, string][] = [[1, "Muy fácil"], [2, "Fácil"], [3, "Justo"], [4, "Duro"], [5, "Muy duro"]];
export const rpeName = (n: number | null | undefined) => RPE.find((r) => r[0] === n)?.[1] || "";

export type Run = {
  id: string; date: string; distance_km: number; duration_s: number; pace_s_km: number | null; rpe: number;
  notes: string; coach_comment: string | null; coach_useful: boolean | null; planned_id?: string | null;
};

export const AREAS: [string, string][] = [
  ["rodilla", "Rodilla"], ["tibia", "Tibia"], ["gemelo", "Gemelo"], ["aquiles", "Aquiles"],
  ["planta_pie", "Planta del pie"], ["tobillo", "Tobillo"], ["cadera", "Cadera"], ["isquio", "Isquiotibial"], ["espalda_baja", "Espalda baja"],
];
export const areaName = (a: string) => AREAS.find((x) => x[0] === a)?.[1] || a;

/** "8,2" o "8.2" → 8.2. Devuelve null si no es una distancia razonable. */
export function parseKm(s: string): number | null {
  const n = Number(s.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 400 ? Math.round(n * 100) / 100 : null;
}

/** "52:30", "1:05:30" o "52" (minutos) → segundos. */
export function parseTime(s: string): number | null {
  const parts = s.trim().replace(/[.,]/g, ":").split(":").map((p) => p.trim());
  if (!parts.length || parts.some((p) => !/^\d+$/.test(p))) return null;
  const n = parts.map(Number);
  let secs: number;
  if (n.length === 1) secs = n[0] * 60;
  else if (n.length === 2) secs = n[0] * 60 + n[1];
  else if (n.length === 3) secs = n[0] * 3600 + n[1] * 60 + n[2];
  else return null;
  if (n.length > 1 && n[n.length - 1] >= 60) return null;
  return secs > 0 && secs < 72 * 3600 ? secs : null;
}

export const pad = (n: number) => String(n).padStart(2, "0");

/** 3150 → "52:30"; 3930 → "1:05:30". */
export function fmtTime(secs: number) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.round(secs % 60);
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Ritmo en segundos por km → "6:24". */
export function fmtPace(sPerKm: number | null | undefined) {
  if (!sPerKm || !Number.isFinite(sPerKm)) return "–";
  const t = Math.round(sPerKm);
  return `${Math.floor(t / 60)}:${pad(t % 60)}`;
}

export const paceOf = (km: number | null, secs: number | null) => (km && secs ? secs / km : null);

/** 8.2 → "8,2"; 10 → "10". */
export function fmtKm(km: number) {
  return (Math.round(km * 10) / 10).toLocaleString("es-CL", { maximumFractionDigits: 1 });
}

/** Fecha local del teléfono en formato YYYY-MM-DD (no UTC: en Chile la noche cambiaría de día). */
export function isoDay(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return isoDay(d);
}
/** Lunes de la semana de esa fecha. */
export function weekStart(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const dow = (d.getDay() + 6) % 7;
  return addDays(iso, -dow);
}

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
/** "2026-10-16" → "viernes 16 oct". */
export function fmtDay(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function relDay(iso: string, today = isoDay()) {
  if (iso === today) return "Hoy";
  if (iso === addDays(today, -1)) return "Ayer";
  const s = fmtDay(iso);
  return s[0].toUpperCase() + s.slice(1);
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? "Buenas noches" : h < 13 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

/** El comentario se guarda como texto: un párrafo y, opcionalmente, "RECUPERAR:" con líneas "- …". */
export function splitComment(text: string | null | undefined) {
  if (!text) return { body: "", tips: [] as string[] };
  const [body, rest = ""] = text.split(/\n?\s*RECUPERAR:\s*/i);
  const tips = rest.split("\n").map((l) => l.replace(/^\s*[-•·]\s*/, "").trim()).filter(Boolean).slice(0, 3);
  return { body: body.trim(), tips };
}

export function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
