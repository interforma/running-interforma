import { NextResponse } from "next/server";
import { askClaude, CoachError, MODEL_FAST, userDb } from "@/lib/coach";
import { addDays, areaName, fmtKm, fmtPace, fmtTime, rpeName, weekStart } from "@/lib/run";

// Comentario tras cada salida. El servidor calcula las cifras; Claude solo redacta.

const SYSTEM = `Eres el entrenador de una app de running para corredores con experiencia, muchos de más de 40 o 50 años.
El corredor acaba de registrar una salida. Escribe en español de Chile, tuteando, tono directo y cálido, en texto plano (sin markdown, sin emojis, sin signos de exclamación).

Formato exacto:
1. Un párrafo de máximo 3 frases y 55 palabras:
   - Una observación concreta sacada de los DATOS, con la cifra tal como aparece (no la redondees ni la conviertas).
   - Qué significa para lo que viene: mantener, bajar la intensidad o cuidar algo. Si hay una molestia activa, tenla en cuenta.
2. Luego una línea que diga exactamente RECUPERAR: y debajo 2 o 3 líneas que empiecen con "- ", cada una de máximo 14 palabras, con acciones simples para las próximas horas (comida, agua, movilidad, descanso), adaptadas al esfuerzo y la duración.

Reglas: no inventes datos que no estén abajo, no felicites de forma genérica, no hagas diagnósticos.
Si una molestia está en 6 o más de 10, o empeoró, di con calma que conviene descansar y consultar a un kinesiólogo o médico.`;

export async function POST(req: Request) {
  const db = userDb(req);
  if (!db) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") return NextResponse.json({ error: "Falta la salida." }, { status: 400 });

  const { data: run } = await db.from("runs").select("*").eq("id", id).maybeSingle();
  if (!run) return NextResponse.json({ error: "No encontré la salida guardada. Revisa la conexión e intenta de nuevo." }, { status: 404 });

  const from = addDays(run.date, -42);
  const [{ data: prof }, { data: hist }, { data: dis }, { data: chk }, { data: plan }] = await Promise.all([
    db.from("profiles").select("name,birth_year,running_since,z2_pace_min_s,z2_pace_max_s,conditions").maybeSingle(),
    db.from("runs").select("id,date,distance_km,duration_s,pace_s_km,rpe").gte("date", from).lte("date", run.date).order("date", { ascending: false }),
    db.from("discomforts").select("date,area,side,intensity").eq("resolved", false).order("date", { ascending: false }).limit(10),
    db.from("checkins").select("mood,sleep").eq("date", run.date).maybeSingle(),
    run.planned_id ? db.from("planned_workouts").select("kind,title,distance_km,zone,pace_min_s,pace_max_s").eq("id", run.planned_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const others = (hist || []).filter((r: any) => r.id !== run.id);
  const km = Number(run.distance_km);
  const pace = run.pace_s_km;

  // Salidas parecidas: distancia dentro de ±30 % y sensación a un punto de diferencia.
  const similar = others.filter((r: any) => Math.abs(Number(r.distance_km) - km) <= km * 0.3 && Math.abs(r.rpe - run.rpe) <= 1);
  const simAvg = similar.length >= 2 ? similar.reduce((a: number, r: any) => a + r.pace_s_km, 0) / similar.length : null;

  const wk = weekStart(run.date), prevWk = addDays(wk, -7);
  const sumKm = (rs: any[]) => rs.reduce((a, r) => a + Number(r.distance_km), 0);
  const thisWeek = (hist || []).filter((r: any) => r.date >= wk);
  const lastWeek = others.filter((r: any) => r.date >= prevWk && r.date < wk);
  const longest = others.reduce((a: number, r: any) => Math.max(a, Number(r.distance_km)), 0);

  const age = prof?.birth_year ? new Date().getFullYear() - prof.birth_year : null;
  const lines = [
    `CORREDOR: ${prof?.name || "sin nombre"}${age ? `, ${age} años` : ""}${prof?.running_since ? `, corre desde ${prof.running_since}` : ""}.` +
      (prof?.z2_pace_min_s && prof?.z2_pace_max_s ? ` Su zona 2: ${fmtPace(prof.z2_pace_min_s)}–${fmtPace(prof.z2_pace_max_s)} /km.` : "") +
      (prof?.conditions ? ` Contó: ${prof.conditions}.` : ""),
    `SALIDA DE HOY (${run.date}): ${fmtKm(km)} km en ${fmtTime(run.duration_s)}, ritmo ${fmtPace(pace)} /km, sensación ${run.rpe} de 5 (${rpeName(run.rpe)}).` +
      (run.notes ? ` Nota del corredor: "${String(run.notes).slice(0, 200)}".` : ""),
    plan ? `PLANIFICADO: ${plan.title}${plan.distance_km ? `, ${fmtKm(Number(plan.distance_km))} km` : ""}${plan.zone ? `, zona ${plan.zone}` : ""}${plan.pace_min_s && plan.pace_max_s ? `, ritmo ${fmtPace(plan.pace_min_s)}–${fmtPace(plan.pace_max_s)} /km` : ""}.` : "",
    simAvg
      ? `COMPARACIÓN: en ${similar.length} salidas parecidas de las últimas 6 semanas su ritmo promedio fue ${fmtPace(simAvg)} /km (hoy ${fmtPace(pace)}).`
      : others.length ? `COMPARACIÓN: aún hay pocas salidas parecidas para comparar el ritmo.` : `Es su primera salida registrada en la app.`,
    `SEMANA: lleva ${fmtKm(sumKm(thisWeek))} km en ${thisWeek.length} salidas desde el lunes; la semana anterior hizo ${fmtKm(sumKm(lastWeek))} km.` +
      (longest && km > longest ? ` Es su salida más larga de las últimas 6 semanas (antes ${fmtKm(longest)} km).` : ""),
    chk ? `CÓMO AMANECIÓ: ${chk.mood || "sin dato"}${chk.sleep ? `, sueño ${chk.sleep} de 5` : ""}.` : "",
    (dis || []).length
      ? `MOLESTIAS ACTIVAS: ${(dis || []).map((d: any) => `${areaName(d.area)}${d.side ? " " + d.side : ""} ${d.intensity}/10 (${d.date})`).join("; ")}.`
      : "Sin molestias activas.",
  ].filter(Boolean).join("\n");

  try {
    const text = await askClaude({ model: MODEL_FAST, system: SYSTEM, content: lines, maxTokens: 300 });
    await db.from("runs").update({ coach_comment: text, coach_comment_at: new Date().toISOString() }).eq("id", run.id);
    return NextResponse.json({ text });
  } catch (e) {
    const err = e as CoachError;
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
