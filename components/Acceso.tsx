"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { PuntoSvg } from "@/components/Punto";

/* ---------- entrar: lista cerrada, sin contraseña ---------- */
// shouldCreateUser: false → solo entra quien Sergio invitó desde Supabase (Authentication › Users › Invite).
// Se puede entrar con el enlace del correo o con el código de 6 dígitos (útil con la app instalada en el teléfono).

export function Entrar() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      const notListed = /signup|not allowed|not found/i.test(error.message);
      setMsg(notListed ? "Este correo no está en la lista de la prueba. Pídele acceso a Sergio." : "No pudimos enviar el correo. Revisa la conexión e intenta de nuevo.");
      return;
    }
    setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setMsg("El código no coincide o ya venció. Revisa el último correo o pide uno nuevo.");
  }

  return (
    <main className="screen center">
      <PuntoSvg expr="atento" size={96} />
      <h1 className="h1">Tu asistente para correr</h1>
      {!sent ? (
        <form className="form" onSubmit={send}>
          <p className="muted">Escribe tu correo y te enviamos un enlace para entrar. No necesitas contraseña.</p>
          <label className="lbl" htmlFor="email">Correo</label>
          <input id="email" className="field" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="cta" disabled={busy || !email}>{busy ? "Enviando…" : "Enviarme el enlace"}</button>
        </form>
      ) : (
        <form className="form" onSubmit={verify}>
          <p className="muted">Te enviamos un correo a <b>{email}</b>. Abre el enlace, o escribe aquí el código de 6 dígitos que viene en el mensaje.</p>
          <label className="lbl" htmlFor="code">Código</label>
          <input id="code" className="field big" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button className="cta" disabled={busy || code.length < 6}>{busy ? "Revisando…" : "Entrar"}</button>
          <button type="button" className="linkbtn" onClick={() => { setSent(false); setCode(""); }}>Usar otro correo</button>
        </form>
      )}
      {msg && <p className="alert" role="alert">{msg}</p>}
    </main>
  );
}

/* ---------- primera vez: nombre y consentimientos ---------- */

export const CONSENT_VERSION = "prueba-2026-10";

export function Consentimiento({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const by = Number(year);
    const prof = await supabase.from("profiles").upsert({ name: name.trim(), birth_year: by >= 1920 && by <= 2015 ? by : null, updated_at: new Date().toISOString() });
    const cons = await supabase.from("consents").insert([
      { kind: "terminos", version: CONSENT_VERSION },
      { kind: "datos_salud", version: CONSENT_VERSION },
    ]);
    setBusy(false);
    if (prof.error || cons.error) { setMsg("No se pudo guardar. Revisa la conexión e intenta de nuevo."); return; }
    onDone(name.trim());
  }

  return (
    <main className="screen">
      <p className="eb">Antes de empezar</p>
      <h1 className="h1">Bienvenido a la prueba</h1>
      <form className="form" onSubmit={submit}>
        <label className="lbl" htmlFor="name">¿Cómo te llamas?</label>
        <input id="name" className="field" autoComplete="given-name" required value={name} onChange={(e) => setName(e.target.value)} />
        <label className="lbl" htmlFor="year">Año de nacimiento <span className="muted">(opcional, ayuda al entrenador)</span></label>
        <input id="year" className="field" inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} />

        <div className="card stack">
          <p className="body-sm">Esta es una versión de prueba para un grupo pequeño de corredores. La app te orienta con tu entrenamiento, pero <b>no reemplaza a un médico ni a un kinesiólogo</b>. Si algo duele de verdad, para y consulta.</p>
          <label className="check"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> <span>Acepto usar la app como prueba y entiendo que sus consejos son orientación general.</span></label>
          <label className="check"><input type="checkbox" checked={health} onChange={(e) => setHealth(e.target.checked)} /> <span>Autorizo que se guarden mis salidas, sensaciones y molestias para darme orientación. Solo yo las veo, y puedo pedir que se borren cuando quiera.</span></label>
        </div>
        <button className="cta" disabled={busy || !name.trim() || !terms || !health}>{busy ? "Guardando…" : "Empezar"}</button>
      </form>
      {msg && <p className="alert" role="alert">{msg}</p>}
    </main>
  );
}
