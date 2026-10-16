"use client";

import { useState } from "react";
import { save } from "@/lib/queue";
import { addDays, AREAS, fmtPace, isoDay, paceOf, parseKm, parseTime, RPE, uuid, type Run } from "@/lib/run";

// Registrar una salida en menos de 20 segundos: distancia, tiempo y sensación. Lo demás es opcional.

type Side = "izquierda" | "derecha";

export default function Registrar({ uid, plannedId, onBack, onSaved }: {
  uid: string; plannedId?: string | null; onBack: () => void; onSaved: (run: Run, where: "nube" | "telefono") => void;
}) {
  const today = isoDay();
  const [date, setDate] = useState(today);
  const [km, setKm] = useState("");
  const [time, setTime] = useState("");
  const [rpe, setRpe] = useState<number | null>(null);
  const [pain, setPain] = useState(false);
  const [area, setArea] = useState<string | null>(null);
  const [side, setSide] = useState<Side | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const d = parseKm(km), t = parseTime(time);
  const pace = paceOf(d, t);
  const ready = !!d && !!t && !!rpe && (!pain || !!area);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setMsg("");
    const run: Run = {
      id: uuid(), date, distance_km: d!, duration_s: t!, pace_s_km: Math.round(pace!), rpe: rpe!,
      notes: notes.trim(), coach_comment: null, coach_useful: null, planned_id: date === today ? plannedId ?? null : null,
    };
    try {
      const { pace_s_km, coach_comment, coach_useful, ...row } = run; // el ritmo lo calcula la base de datos
      const where = await save("runs", { ...row, user_id: uid, client_updated_at: Date.now() });
      if (pain && area) {
        await save("discomforts", { id: uuid(), user_id: uid, run_id: run.id, date, area, side, intensity, moment: "durante" });
      }
      onSaved(run, where);
    } catch {
      setBusy(false);
      setMsg("No se pudo guardar. Revisa los datos e intenta de nuevo.");
    }
  }

  return (
    <main className="screen">
      <header className="bar-top">
        <button type="button" className="iconbtn" aria-label="Volver" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <h1 className="h2">Registrar salida</h1>
      </header>

      <form className="form" onSubmit={submit}>
        <div className="seg" role="group" aria-label="Día">
          <button type="button" aria-pressed={date === today} onClick={() => setDate(today)}>Hoy</button>
          <button type="button" aria-pressed={date === addDays(today, -1)} onClick={() => setDate(addDays(today, -1))}>Ayer</button>
        </div>

        <div className="two">
          <div className="stack-sm">
            <label className="lbl" htmlFor="km">Distancia (km)</label>
            <input id="km" className="field big" inputMode="decimal" placeholder="8,2" value={km} onChange={(e) => setKm(e.target.value)} />
          </div>
          <div className="stack-sm">
            <label className="lbl" htmlFor="t">Tiempo</label>
            <input id="t" className="field big" inputMode="numeric" placeholder="52:30" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <p className="muted" aria-live="polite">
          {pace ? <>Ritmo: <b className="ink">{fmtPace(pace)} /km</b></> : "Tiempo en minutos:segundos, o horas:minutos:segundos."}
        </p>

        <fieldset className="stack-sm">
          <legend className="lbl">¿Cómo se sintió?</legend>
          {RPE.map(([n, label]) => (
            <button key={n} type="button" className="opt" aria-pressed={rpe === n} onClick={() => setRpe(n)}>
              <span className="mono">{n}</span>{label}
            </button>
          ))}
        </fieldset>

        <fieldset className="stack-sm">
          <legend className="lbl">¿Alguna molestia?</legend>
          <div className="seg">
            <button type="button" aria-pressed={!pain} onClick={() => setPain(false)}>No</button>
            <button type="button" aria-pressed={pain} onClick={() => setPain(true)}>Sí</button>
          </div>
        </fieldset>

        {pain && (
          <div className="card stack">
            <p className="lbl">¿Dónde?</p>
            <div className="chips-pick">
              {AREAS.map(([v, l]) => (
                <button key={v} type="button" className="pill" aria-pressed={area === v} onClick={() => setArea(v)}>{l}</button>
              ))}
            </div>
            <div className="seg">
              <button type="button" aria-pressed={side === "izquierda"} onClick={() => setSide("izquierda")}>Izquierda</button>
              <button type="button" aria-pressed={side === "derecha"} onClick={() => setSide("derecha")}>Derecha</button>
            </div>
            <div className="stepper">
              <div>
                <p className="lbl">Intensidad</p>
                <p className="num xl">{intensity} <span className="muted">de 10</span></p>
              </div>
              <button type="button" className="round" aria-label="Bajar intensidad" onClick={() => setIntensity(Math.max(1, intensity - 1))}>−</button>
              <button type="button" className="round" aria-label="Subir intensidad" onClick={() => setIntensity(Math.min(10, intensity + 1))}>+</button>
            </div>
            {intensity >= 6 && <p className="alert danger">Un dolor de 6 o más es motivo para descansar y consultar a un kinesiólogo o médico.</p>}
          </div>
        )}

        <details className="more">
          <summary>Agregar una nota</summary>
          <textarea className="field" rows={3} maxLength={300} placeholder="Ej.: hacía calor, salí con el grupo…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </details>

        {msg && <p className="alert" role="alert">{msg}</p>}
        <div className="sticky-cta">
          <button className="cta" disabled={!ready || busy}>{busy ? "Guardando…" : "Guardar salida"}</button>
        </div>
      </form>
    </main>
  );
}
