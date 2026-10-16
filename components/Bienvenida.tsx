"use client";

import { useState } from "react";
import { PuntoSvg, type Expr } from "@/components/Punto";

// Bienvenida: Punto entra rodando, se asienta y cambia a la expresión del día. Una vez por día.
// Lo "inteligente" es la escena: sale del plan, de lo que ya corrió hoy y de las molestias (ver sceneFor en App).

export type Scene = { expr: Expr; eyebrow: string; title: string; sub: string; chips: string[]; cta: string; alt?: string };

export default function Bienvenida({ scene, onGo, onAlt }: { scene: Scene; onGo: () => void; onAlt?: () => void }) {
  const [k, setK] = useState(0); // tocar a Punto repite la animación
  const moving = scene.expr === "vamos";
  return (
    <main className="splash" key={k}>
      <p className="eb f1">{scene.eyebrow}</p>
      <div className="stage">
        <span className="p-shadow" aria-hidden="true" />
        {moving && (
          <svg className="p-lines" aria-hidden="true" width="70" height="90" viewBox="0 0 70 90">
            <path d="M66 14H24M66 45H6M66 76H30" stroke="#BEB8AE" strokeWidth="6" strokeLinecap="round" />
          </svg>
        )}
        <button type="button" className="p-btn" aria-label="Tocar a Punto" onClick={() => setK(k + 1)}>
          <div className="p-bob"><div className="p-roll"><div className="p-squash"><div className={moving ? "p-lean" : ""}>
            <PuntoSvg expr={scene.expr} from="atento" />
          </div></div></div></div>
        </button>
      </div>
      <div className="splash-text">
        <h1 className="f2">{scene.title}</h1>
        <p className="f3">{scene.sub}</p>
        {scene.chips.length > 0 && (
          <div className="chips f3">{scene.chips.map((c) => <span key={c}>{c}</span>)}</div>
        )}
      </div>
      <div className="splash-actions f4">
        <button type="button" className="cta" onClick={onGo}>{scene.cta}</button>
        {scene.alt && onAlt && <button type="button" className="linkbtn on-dark" onClick={onAlt}>{scene.alt}</button>}
      </div>
    </main>
  );
}
