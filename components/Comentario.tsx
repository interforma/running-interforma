"use client";

import { useEffect, useRef, useState } from "react";
import { callCoach } from "@/lib/coachClient";
import { flush } from "@/lib/queue";
import { supabase } from "@/lib/supabase";
import { fmtKm, fmtPace, fmtTime, relDay, rpeName, splitComment, type Run } from "@/lib/run";
import { PuntoAvatar } from "@/components/Punto";

// Después de guardar: las cifras de la salida y el comentario del entrenador, con "me sirvió" para medir si aporta.

export default function Comentario({ run, offline, onClose }: { run: Run; offline: boolean; onClose: () => void }) {
  const [text, setText] = useState(run.coach_comment || "");
  const [state, setState] = useState<"cargando" | "listo" | "sin-señal" | "error">(run.coach_comment ? "listo" : offline ? "sin-señal" : "cargando");
  const [err, setErr] = useState("");
  const [useful, setUseful] = useState<boolean | null>(run.coach_useful);
  const done = useRef(!!run.coach_comment);

  async function load() {
    setState("cargando");
    try {
      await flush(); // si la salida quedó en el teléfono, primero se sube
      const r = await callCoach<{ text: string }>("/api/comentario", { id: run.id });
      done.current = true; setText(r.text); setState("listo");
    } catch (e: any) {
      setErr(e.message); setState(navigator.onLine ? "error" : "sin-señal");
    }
  }

  useEffect(() => {
    if (run.coach_comment) return;
    if (!offline) load();
    // Si no hay señal, el comentario se pide solo cuando vuelve la conexión.
    const on = () => { if (!done.current) load(); };
    window.addEventListener("online", on, { once: true });
    return () => window.removeEventListener("online", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function rate(v: boolean) {
    setUseful(v);
    await supabase.from("runs").update({ coach_useful: v }).eq("id", run.id);
  }

  const { body, tips } = splitComment(text);

  return (
    <main className="screen">
      <header className="bar-top">
        <button type="button" className="iconbtn" aria-label="Cerrar" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div>
          <p className="eb good">{offline ? "Guardada en el teléfono" : "Salida guardada"}</p>
          <h1 className="h2">{relDay(run.date)}</h1>
        </div>
      </header>

      <div className="kpis">
        <div className="kpi"><p className="num">{fmtKm(run.distance_km)} km</p><p>Distancia</p></div>
        <div className="kpi"><p className="num">{fmtTime(run.duration_s)}</p><p>Tiempo</p></div>
        <div className="kpi"><p className="num">{fmtPace(run.pace_s_km)}</p><p>Ritmo /km</p></div>
        <div className="kpi"><p className="num">{rpeName(run.rpe)}</p><p>Sensación {run.rpe} de 5</p></div>
      </div>

      <section className="plate" aria-live="polite">
        <div className="plate-head"><PuntoAvatar size={22} /><p className="eb accent">Tu entrenador</p></div>
        {state === "cargando" && <p className="plate-sub">Mirando tu salida…</p>}
        {state === "sin-señal" && <p className="plate-sub">Sin señal. Tu salida quedó guardada en el teléfono y el comentario llega cuando vuelva la conexión.</p>}
        {state === "error" && (
          <>
            <p className="plate-sub">{err}</p>
            <button type="button" className="linkbtn on-dark" onClick={load}>Intentar de nuevo</button>
          </>
        )}
        {state === "listo" && <p>{body}</p>}
      </section>

      {state === "listo" && tips.length > 0 && (
        <section className="card stack">
          <h2 className="h3">Para recuperar</h2>
          {tips.map((t, i) => (
            <div className="tip" key={i}><span className="mono accent">{String(i + 1).padStart(2, "0")}</span><span>{t}</span></div>
          ))}
        </section>
      )}

      {state === "listo" && (
        <section className="rate" aria-label="¿Te sirvió el comentario?">
          <p className="lbl">¿Te sirvió este comentario?</p>
          <div className="seg">
            <button type="button" aria-pressed={useful === true} onClick={() => rate(true)}>Me sirvió</button>
            <button type="button" aria-pressed={useful === false} onClick={() => rate(false)}>No me sirvió</button>
          </div>
        </section>
      )}

      <div className="sticky-cta">
        <button type="button" className="cta" onClick={onClose}>Volver a Hoy</button>
      </div>
    </main>
  );
}
