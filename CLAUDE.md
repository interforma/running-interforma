# Running Interforma: notas para Claude

- App de running de Sergio (Interforma), **separada** de Libreta de Fierros: no comparte código en vivo, cuentas ni base. Interfaz y textos en **español de Chile**, tuteando, tono directo y cálido.
- Público: corredores con experiencia, muchos de 40 o 50 años y más. Letra grande, alto contraste, botones de al menos 48 px y pocos pasos.
- Stack: Next.js 15 App Router + Supabase (proyecto `vunivhsljivkmdqvoehr`, sa-east-1) + Vercel. Cliente Supabase solo en navegador (`lib/supabase.ts`); en el servidor, `userDb(req)` con el token del usuario para que aplique RLS.
- Lógica pura en `lib/run.ts` (leer distancia y tiempo, formatos chilenos, fechas locales). Pantallas en `components/`; `App.tsx` decide la vista y arma la escena de la bienvenida (`sceneFor`).
- Diseño: sistema de diseño Interforma (piedra, Umbra #281F18, un solo naranja Energía #EE6E43; Outfit 500 en títulos, Manrope en texto, JetBrains Mono en etiquetas). Texto sobre Energía siempre en Umbra.
- Punto (`components/Punto.tsx`): círculo Energía con dos ojos Umbra, sin boca ni brazos. Expresiones aquí: atento, vamos (nueva), uy, celebra. Animación una vez y reposo vivo; con `prefers-reduced-motion` queda quieto.
- Uso sin señal: toda escritura del corredor pasa por `save()` de `lib/queue.ts` con id generado en el teléfono.
- IA del entrenador en `lib/coach.ts` y `app/api/`: los números se calculan en el servidor y Claude solo redacta. Modelo rápido `ANTHROPIC_MODEL_FAST`. Los modelos 5.5 piensan antes de responder: `max_tokens` mínimo 4000.
- Salud: orientar, nunca diagnosticar. Molestia de 6/10 o más → descansar y consultar a un kinesiólogo o médico.
- Cambios de esquema: nueva migración en `supabase/migrations/` y aplicarla al proyecto. Toda tabla nueva lleva RLS por `user_id = auth.uid()`.
- Criterio de producto: la app propone o avisa en el momento justo; no agrega datos que nadie pidió.
