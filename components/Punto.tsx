// Punto, la mascota de Interforma: el círculo Energía con dos ojos Umbra. Sin boca ni brazos.
// Modelo de 200u: círculo r 72 en (100,108). El viewBox se recorta al círculo para que gire sobre su centro.
// "vamos" es la expresión nueva de esta app: ojos mirando hacia adelante, levemente entrecerrados.

export type Expr = "atento" | "vamos" | "uy" | "celebra";

const INK = "#281F18";

function Eyes({ expr }: { expr: Expr }) {
  if (expr === "vamos")
    return (
      <g className="p-blink">
        <ellipse cx="94" cy="98" rx="9" ry="13" fill={INK} transform="rotate(-10 94 98)" />
        <ellipse cx="128" cy="98" rx="9" ry="13" fill={INK} transform="rotate(-10 128 98)" />
      </g>
    );
  if (expr === "uy")
    return (
      <>
        <ellipse cx="82" cy="114" rx="8" ry="12" fill={INK} />
        <ellipse cx="118" cy="114" rx="8" ry="12" fill={INK} />
      </>
    );
  if (expr === "celebra")
    return <path d="M70 102l12-14 12 14M106 102l12-14 12 14" stroke={INK} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  return (
    <g className="p-blink">
      <ellipse cx="82" cy="100" rx="9" ry="16" fill={INK} />
      <ellipse cx="118" cy="100" rx="9" ry="16" fill={INK} />
    </g>
  );
}

/** Solo el cuerpo. `from` muestra unos ojos que cambian a `expr` cuando termina la entrada. */
export function PuntoSvg({ expr, from, size = 200 }: { expr: Expr; from?: Expr; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="28 36 144 144" aria-hidden="true">
      <circle cx="100" cy="108" r="72" fill="#EE6E43" />
      {from && from !== expr ? (
        <>
          <g className="p-eyes-out"><Eyes expr={from} /></g>
          <g className="p-eyes-in"><Eyes expr={expr} /></g>
        </>
      ) : (
        <Eyes expr={expr} />
      )}
    </svg>
  );
}

/** Avatar pequeño de Punto para el comentario del entrenador. */
export function PuntoAvatar({ size = 28 }: { size?: number }) {
  return <PuntoSvg expr="atento" size={size} />;
}
