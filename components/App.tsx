"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { flush, pending } from "@/lib/queue";
import { areaName, fmtKm, fmtPace, fmtDay, isoDay, type Run } from "@/lib/run";
import { Entrar, Consentimiento } from "@/components/Acceso";
import Bienvenida, { type Scene } from "@/components/Bienvenida";
import Hoy, { type Mood, type Pain, type Planned } from "@/components/Hoy";
import Registrar from "@/components/Registrar";
import Comentario from "@/components/Comentario";

type View = { v: "bienvenida" } | { v: "hoy" } | { v: "registrar" } | { v: "comentario"; run: Run; offline: boolean };

export default function App() {
  const [auth, setAuth] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuth(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setAuth(s));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => data.subscription.unsubscribe();
  }, []);

  if (auth === undefined) return <main className="screen center" aria-busy="true" />;
  if (!auth) return <Entrar />;
  return <Corredor uid={auth.user.id} />;
}

function Corredor({ uid }: { uid: string }) {
  const today = isoDay();
  const [loaded, setLoaded] = useState(false);
  const [consented, setConsented] = useState(false);
  const [name, setName] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [plan, setPlan] = useState<Planned | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [pains, setPains] = useState<Pain[]>([]);
  const [view, setView] = useState<View>({ v: "hoy" });
  const [queued, setQueued] = useState(0);

  const load = useCallback(async () => {
    await flush();
    setQueued(pending());
    const [c, p, r, pl, ck, d] = await Promise.all([
      supabase.from("consents").select("kind").eq("user_id", uid).is("revoked_at", null),
      supabase.from("profiles").select("name").eq("user_id", uid).maybeSingle(),
      supabase.from("runs").select("id,date,distance_km,duration_s,pace_s_km,rpe,notes,coach_comment,coach_useful,planned_id").eq("user_id", uid).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(30),
      supabase.from("planned_workouts").select("id,kind,title,distance_km,zone,pace_min_s,pace_max_s,notes").eq("user_id", uid).eq("date", today).limit(1).maybeSingle(),
      supabase.from("checkins").select("mood").eq("user_id", uid).eq("date", today).maybeSingle(),
      supabase.from("discomforts").select("id,date,area,side,intensity").eq("user_id", uid).eq("resolved", false).order("date", { ascending: false }),
    ]);
    const kinds = new Set((c.data || []).map((x: any) => x.kind));
    setConsented(kinds.has("terminos") && kinds.has("datos_salud"));
    setName(p.data?.name || "");
    setRuns((r.data || []).map((x: any) => ({ ...x, distance_km: Number(x.distance_km) })));
    setPlan((pl.data as Planned) || null);
    setMood((ck.data?.mood as Mood) || null);
    setPains((d.data as Pain[]) || []);
    setLoaded(true);
  }, [uid, today]);

  useEffect(() => {
    load().then(() => {
      // La bienvenida se ve una vez al día.
      try {
        if (localStorage.getItem("ri.bienvenida") !== today) { localStorage.setItem("ri.bienvenida", today); setView({ v: "bienvenida" }); }
      } catch {}
    });
    const on = () => load();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [load, today]);

  if (!loaded) return <main className="screen center" aria-busy="true" />;
  if (!consented) return <Consentimiento onDone={(n) => { setName(n); setConsented(true); setView({ v: "bienvenida" }); }} />;

  if (view.v === "bienvenida") {
    const scene = sceneFor({ name, runs, plan, pains, today });
    return <Bienvenida scene={scene} onGo={() => setView({ v: "hoy" })} onAlt={() => setView({ v: "registrar" })} />;
  }
  if (view.v === "registrar")
    return (
      <Registrar uid={uid} plannedId={plan?.id} onBack={() => setView({ v: "hoy" })}
        onSaved={(run, where) => { setRuns([run, ...runs]); setQueued(pending()); setView({ v: "comentario", run, offline: where === "telefono" }); }} />
    );
  if (view.v === "comentario")
    return <Comentario run={view.run} offline={view.offline} onClose={() => { setView({ v: "hoy" }); load(); }} />;

  return (
    <Hoy uid={uid} name={name} runs={runs} plan={plan} mood={mood} pains={pains} pendingCount={queued}
      onMood={setMood} onRegister={() => setView({ v: "registrar" })} onOpenRun={(run) => setView({ v: "comentario", run, offline: false })} />
  );
}

/** La escena de la bienvenida según el día: molestia fuerte, ya corrió, descanso, carrera o salida planificada. */
function sceneFor({ name, runs, plan, pains, today }: { name: string; runs: Run[]; plan: Planned | null; pains: Pain[]; today: string }): Scene {
  const day = fmtDay(today);
  const eyebrow = day[0].toUpperCase() + day.slice(1);
  const who = name || "corredor";
  const strong = pains.find((p) => p.intensity >= 6);
  if (strong)
    return { expr: "uy", eyebrow, title: "Hoy, mejor descansar", sub: `La ${areaName(strong.area).toLowerCase()} marcó ${strong.intensity} de 10. Si no baja en unos días, consulta a un kinesiólogo o médico.`, chips: [], cta: "Ir a Hoy" };
  const done = runs.filter((r) => r.date === today);
  if (done.length) {
    const km = done.reduce((a, r) => a + Number(r.distance_km), 0);
    return { expr: "celebra", eyebrow, title: "Ya corriste hoy", sub: "Ahora toca recuperar: agua, algo de comer y un poco de movilidad.", chips: [`${fmtKm(km)} km`], cta: "Ver mi día" };
  }
  if (plan?.kind === "descanso")
    return { expr: "atento", eyebrow, title: "Hoy descansas", sub: "El descanso también entrena. Toma agua y estira un rato.", chips: [], cta: "Ir a Hoy" };
  if (plan?.kind === "carrera")
    return { expr: "vamos", eyebrow, title: "¡Llegó el día!", sub: "Desayuna lo de siempre y sal tranquilo los primeros kilómetros: el trabajo ya está hecho.", chips: plan.distance_km ? [`${fmtKm(plan.distance_km)} km`] : [], cta: "Vamos" };
  if (plan)
    return {
      expr: "vamos", eyebrow, title: `¡Vamos, ${who}!`,
      sub: pains.length ? `Hoy toca ${plan.title.toLowerCase()}. Con la molestia activa, sal suave.` : `Hoy toca ${plan.title.toLowerCase()}.`,
      chips: [plan.distance_km ? `${fmtKm(plan.distance_km)} km` : "", plan.zone ? `Zona ${plan.zone}` : "", plan.pace_min_s && plan.pace_max_s ? `${fmtPace(plan.pace_min_s)}–${fmtPace(plan.pace_max_s)} /km` : ""].filter(Boolean),
      cta: "Vamos", alt: "Ya corrí: registrar",
    };
  return {
    expr: "vamos", eyebrow, title: `¡Vamos, ${who}!`,
    sub: runs.length ? "¿Sales hoy? Cuando vuelvas, anota tu salida y te comento cómo te fue." : "Registra tu primera salida y te cuento cómo te fue.",
    chips: [], cta: "Vamos", alt: "Ya corrí: registrar",
  };
}
