"use client";

import { supabase } from "@/lib/supabase";
import { save } from "@/lib/queue";
import { areaName, fmtDay, fmtKm, fmtPace, fmtTime, greeting, isoDay, relDay, rpeName, splitComment, type Run } from "@/lib/run";
import { PuntoAvatar } from "@/components/Punto";

export type Mood = "bien" | "normal" | "cansado";
export type Planned = { id: string; kind: string; title: string; distance_km: number | null; zone: number | null; pace_min_s: number | null; pace_max_s: number | null; notes: string };
export type Pain = { id: string; date: string; area: string; side: string | null; intensity: number };

export default function Hoy({ uid, name, runs, plan, mood, pains, pendingCount, onMood, onRegister, onOpenRun }: {
  uid: string; name: string; runs: Run[]; plan: Planned | null; mood: Mood | null; pains: Pain[]; pendingCount: number;
  onMood: (m: Mood) => void; onRegister: () => void; onOpenRun: (r: Run) => void;
}) {
  const today = isoDay();
  const ranToday = runs.filter((r) => r.date === today);
  const last = runs[0];
  const weekKm = runs.filter((r) => r.date >= mondayOf(today)).reduce((a, r) => a + Number(r.distance_km), 0);
  const worst = pains.reduce<Pain | null>((a, p) => (!a || p.intensity > a.intensity ? p : a), null);

  async function pickMood(m: Mood) {
    onMood(m);
    await save("checkins", { user_id: uid, date: today, mood: m }, "user_id,date");
  }

  async function resolvePain(p: Pain) {
    await supabase.from("discomforts").update({ resolved: true }).eq("id", p.id);
    location.reload();
  }

  return (
    <main className="screen">
      <header className="hello">
        <div>
          <p className="eb">{fmtDay(today)}</p>
          <h1 className="h1">{greeting()}, {name || "corredor"}</h1>
        </div>
        {pendingCount > 0 && <span className="badge warn">{pendingCount} sin subir</span>}
      </header>

      <section className="plate">
        <p className="eb accent">{ranToday.length ? "Hoy ya corriste" : plan ? "Hoy toca" : "Hoy"}</p>
        {ranToday.length ? (
          <h2 className="h1 on-dark">{fmtKm(ranToday.reduce((a, r) => a + Number(r.distance_km), 0))} km</h2>
        ) : plan ? (
          <>
            <h2 className="h1 on-dark">{plan.title}</h2>
            <div className="chips">
              {plan.distance_km ? <span>{fmtKm(plan.distance_km)} km</span> : null}
              {plan.zone ? <span>Zona {plan.zone}</span> : null}
              {plan.pace_min_s && plan.pace_max_s ? <span>{fmtPace(plan.pace_min_s)}–{fmtPace(plan.pace_max_s)} /km</span> : null}
            </div>
          </>
        ) : (
          <h2 className="h2 on-dark">¿Sales a correr? Cuando vuelvas, anótalo en 20 segundos.</h2>
        )}
        {worst && !ranToday.length && <p className="plate-sub">Con la molestia en {areaName(worst.area).toLowerCase()}, sal suave y corta si duele más.</p>}
        <button type="button" className="cta" onClick={onRegister}>{ranToday.length ? "Registrar otra salida" : "Registrar salida"}</button>
      </section>

      <section className="card stack" aria-label="Cómo amaneciste">
        <h2 className="h3">¿Cómo amaneciste?</h2>
        <div className="seg three">
          {(["bien", "normal", "cansado"] as Mood[]).map((m) => (
            <button key={m} type="button" aria-pressed={mood === m} onClick={() => pickMood(m)}>{m[0].toUpperCase() + m.slice(1)}</button>
          ))}
        </div>
      </section>

      {pains.map((p) => (
        <section key={p.id} className={`card stack ${p.intensity >= 6 ? "danger-soft" : "warn-soft"}`}>
          <div className="row">
            <p className="strong">{areaName(p.area)}{p.side ? ` ${p.side}` : ""} · {p.intensity} de 10</p>
            <span className={`badge ${p.intensity >= 6 ? "danger" : "warn"}`}>{p.intensity >= 6 ? "Crítico" : "Mejorable"}</span>
          </div>
          <p>{p.intensity >= 6 ? "Hoy, mejor no correr. Si no baja en unos días, consulta a un kinesiólogo o médico." : `Desde ${relDay(p.date).toLowerCase()}. Si sube a 6 o más, para y consulta.`}</p>
          <button type="button" className="linkbtn" onClick={() => resolvePain(p)}>Ya no me molesta</button>
        </section>
      ))}

      {last && (
        <button type="button" className="card stack tap" onClick={() => onOpenRun(last)}>
          <div className="row">
            <p className="eb">Última salida · {relDay(last.date)}</p>
            <span className="muted">Esta semana {fmtKm(weekKm)} km</span>
          </div>
          <p className="num xl">{fmtKm(last.distance_km)} km <span className="muted">· {fmtTime(last.duration_s)} · {fmtPace(last.pace_s_km)} /km</span></p>
          <p className="muted">{rpeName(last.rpe)}</p>
          {last.coach_comment && (
            <div className="quote"><PuntoAvatar size={20} /><span>{splitComment(last.coach_comment).body}</span></div>
          )}
        </button>
      )}

      {runs.length > 1 && (
        <section className="stack-sm">
          <h2 className="h3">Antes</h2>
          {runs.slice(1, 6).map((r) => (
            <button key={r.id} type="button" className="line" onClick={() => onOpenRun(r)}>
              <span>{relDay(r.date)}</span>
              <span className="num">{fmtKm(r.distance_km)} km</span>
              <span className="muted">{fmtPace(r.pace_s_km)} /km</span>
            </button>
          ))}
        </section>
      )}

      <footer className="foot">
        <button type="button" className="linkbtn" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </footer>
    </main>
  );
}

function mondayOf(iso: string) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDay(d);
}
