# Running Interforma

Asistente para corredores con experiencia: qué toca hoy, registro de salidas en 20 segundos, comentario del entrenador con Claude, molestias y recuperación. No compite con el reloj ni con Strava: los complementa guiando.

Versión de prueba cerrada para un grupo pequeño de corredores (ver el plan en el proyecto «APP RUNNING INTERFORMA»).

**Stack:** Next.js 15 (App Router) · Supabase (Postgres, Auth, RLS) · Vercel · app web instalable que funciona sin señal.

## Puesta en marcha

```bash
cp .env.example .env.local   # agrega ANTHROPIC_API_KEY para el comentario del entrenador
npm install
npm run dev
```

## Qué hace hoy

| Pantalla | Qué hace |
|---|---|
| Bienvenida | Punto entra rodando una vez al día. La escena cambia según el día: salida planificada, descanso, carrera, ya corriste o molestia fuerte |
| Hoy | Qué toca, «¿Cómo amaneciste?», molestias activas, última salida con su comentario y las anteriores |
| Registrar | Hoy o ayer, distancia, tiempo, sensación del 1 al 5, molestia opcional y nota |
| Comentario | Cifras de la salida, comentario del entrenador, «para recuperar» y «¿te sirvió?» |

## Acceso: lista cerrada

Solo entra quien está invitado. No hay registro abierto (`shouldCreateUser: false`).

1. En Supabase: **Authentication › Users › Invite user** con el correo del probador.
2. El probador abre la app, escribe su correo y entra con el enlace o con el código de 6 dígitos.
3. La primera vez acepta los términos de la prueba y el uso de sus datos de salud (tabla `consents`).

Para que el correo traiga también el código de 6 dígitos (útil con la app instalada en el iPhone, donde el enlace abre Safari), en **Authentication › Emails › Magic Link** agrega `{{ .Token }}` al mensaje.

## Datos (Supabase, proyecto `running-interforma`, región sa-east-1)

| Tabla | Qué guarda |
|---|---|
| `profiles` | Nombre, año de nacimiento, ritmo de zona 2 y lo que el corredor quiera contar |
| `consents` | Términos y consentimiento de datos de salud, con versión y fecha |
| `runs` | Cada salida: distancia, tiempo, ritmo (lo calcula la base), sensación, nota, comentario y si sirvió |
| `checkins` | Una fila por día: cómo amaneció y vasos de agua |
| `discomforts` | Molestias: zona, lado, intensidad, si se resolvió |
| `cycles`, `planned_workouts`, `strength_logs` | Plan y fuerza (se usan en la semana 2) |
| `clubs`, `club_members`, `club_groups`, `group_members`, `invitations` | Para más adelante; la prueba no las usa |

Todas las tablas tienen RLS: cada corredor lee y escribe solo lo suyo. Las migraciones viven en `supabase/migrations/`.

## Uso sin señal

Cada salida se guarda con un id generado en el teléfono. Si no hay conexión, queda en cola (`localStorage`, `lib/queue.ts`) y se sube al volver la señal; el comentario del entrenador se pide en ese momento. El service worker (`public/sw.js`) deja abrir la app sin conexión.

## Entrenador con Claude

`/api/comentario` calcula en el servidor el ritmo, la comparación con salidas parecidas de las últimas 6 semanas, los kilómetros de la semana y las molestias activas, y Claude solo redacta el comentario y tres acciones para recuperar.

Variables en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY` (obligatoria para el comentario) y `ANTHROPIC_MODEL_FAST` (opcional).

## Medir la prueba

```sql
-- salidas por corredor y semana, y cuántos comentarios sirvieron
select p.name, date_trunc('week', r.date)::date as semana, count(*) as salidas,
       round(sum(r.distance_km), 1) as km,
       count(*) filter (where r.coach_useful) as sirvio,
       count(*) filter (where r.coach_useful = false) as no_sirvio
from runs r join profiles p using (user_id)
group by 1, 2 order by 1, 2;
```
