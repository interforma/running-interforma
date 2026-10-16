-- App de running · esquema inicial (proyecto Supabase propio, separado de Libreta de Fierros)
-- Paso 2: un corredor usa la app solo. Paso 3: clubes, entrenadores y grupos ya caben sin migrar datos.
-- Convención: cada fila es de user_id = auth.uid(); el entrenador solo LEE a sus corredores.

-- ============ Perfil y consentimientos ============

create table public.profiles (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  name           text not null default '',
  birth_year     smallint check (birth_year between 1920 and 2015),
  sex            text check (sex in ('hombre','mujer','otro')),
  weight_kg      numeric check (weight_kg between 25 and 300),
  height_cm      numeric check (height_cm between 100 and 250),
  running_since  smallint,                          -- año en que empezó a correr
  z2_pace_min_s  smallint,                          -- ritmo zona 2 más rápido, segundos por km
  z2_pace_max_s  smallint,                          -- ritmo zona 2 más lento, segundos por km
  conditions     text not null default '',          -- lo que la persona quiera contar; lo usa la orientación
  font_scale     numeric not null default 1 check (font_scale between 0.9 and 1.6),
  updated_at     timestamptz not null default now()
);

-- Con terceros hay que guardar el consentimiento para tratar datos de salud (Ley 19.628 / nueva ley de datos).
create table public.consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('terminos','datos_salud','compartir_con_entrenador')),
  version     text not null,
  accepted_at timestamptz not null default now(),
  revoked_at  timestamptz
);

-- ============ Clubes, roles y grupos (se usan desde el piloto) ============

create table public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  city       text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.club_members (
  club_id    uuid not null references public.clubs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin','entrenador','corredor')),
  joined_at  timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table public.club_groups (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references public.clubs(id) on delete cascade,
  name      text not null,                          -- "Iniciación", "21K", "Máster 50+"
  coach_id  uuid references auth.users(id)
);

create table public.group_members (
  group_id uuid not null references public.club_groups(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  primary key (group_id, user_id)
);

create table public.invitations (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  group_id   uuid references public.club_groups(id) on delete set null,
  role       text not null default 'corredor' check (role in ('entrenador','corredor')),
  code       text not null unique default substr(md5(gen_random_uuid()::text), 1, 12),
  created_by uuid not null default auth.uid() references auth.users(id),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by    uuid references auth.users(id),
  used_at    timestamptz
);

-- ============ Ciclo y plan ============

create table public.cycles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name             text not null,                   -- "Media maratón diciembre"
  race_name        text not null default '',
  race_date        date,
  race_distance_km numeric check (race_distance_km between 1 and 300),
  start_date       date not null,
  weeks            smallint not null default 12 check (weeks between 1 and 30),
  deload_weeks     smallint[] not null default '{}',
  status           text not null default 'activo' check (status in ('activo','terminado','pausado')),
  created_at       timestamptz not null default now()
);

-- Una sesión planificada es de un corredor (user_id) o de un grupo (group_id), nunca de ambos.
create table public.planned_workouts (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid references public.cycles(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  group_id     uuid references public.club_groups(id) on delete cascade,
  date         date not null,
  kind         text not null check (kind in ('rodaje','series','tempo','tirada_larga','fuerza','movilidad','descanso','carrera')),
  title        text not null,
  distance_km  numeric,
  duration_min smallint,
  zone         smallint check (zone between 1 and 5),
  pace_min_s   smallint,
  pace_max_s   smallint,
  items        jsonb not null default '[]',         -- series o ejercicios de fuerza
  notes        text not null default '',
  created_by   uuid not null default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now(),
  check ((user_id is null) <> (group_id is null))
);
create index on public.planned_workouts (user_id, date);
create index on public.planned_workouts (group_id, date);

-- ============ Registro diario ============

create table public.runs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  planned_id        uuid references public.planned_workouts(id) on delete set null,
  date              date not null default current_date,
  distance_km       numeric not null check (distance_km > 0 and distance_km < 400),
  duration_s        integer not null check (duration_s > 0),
  pace_s_km         integer generated always as ((round(duration_s / distance_km))::integer) stored,
  rpe               smallint not null check (rpe between 1 and 5),  -- 1 muy fácil … 5 muy duro
  avg_hr            smallint,
  elevation_m       smallint,
  source            text not null default 'manual' check (source in ('manual','gpx','fit','strava')),
  file_path         text,                          -- Storage: runs/<user_id>/<id>.fit
  notes             text not null default '',
  coach_comment     text,                          -- lo redacta Claude con cifras del servidor
  coach_comment_at  timestamptz,
  client_updated_at bigint not null default 0,      -- uso sin señal: gana el cambio más reciente
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on public.runs (user_id, date desc);

create table public.strength_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  planned_id        uuid references public.planned_workouts(id) on delete set null,
  date              date not null default current_date,
  items             jsonb not null default '[]',    -- ejercicio, series, repeticiones, peso
  client_updated_at bigint not null default 0,
  created_at        timestamptz not null default now()
);

-- "¿Cómo amaneciste?" y el agua del día: una fila por día.
create table public.checkins (
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date          date not null default current_date,
  mood          text check (mood in ('bien','normal','cansado')),
  sleep         smallint check (sleep between 1 and 5),
  water_glasses smallint not null default 0 check (water_glasses between 0 and 30),
  primary key (user_id, date)
);

create table public.discomforts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  run_id     uuid references public.runs(id) on delete set null,
  date       date not null default current_date,
  area       text not null check (area in ('rodilla','tibia','gemelo','aquiles','planta_pie','tobillo','cadera','isquio','espalda_baja','otro')),
  side       text check (side in ('izquierda','derecha','ambos','centro')),
  intensity  smallint not null check (intensity between 0 and 10),
  moment     text check (moment in ('al_empezar','durante','despues','dia_siguiente','reposo')),
  note       text not null default '',
  resolved   boolean not null default false,
  advice     text,
  advice_at  timestamptz,
  created_at timestamptz not null default now()
);
create index on public.discomforts (user_id, date desc);

-- ============ Permisos ============

-- ¿El usuario actual entrena a este corredor? (mismo club, rol entrenador o admin,
-- y el corredor aceptó compartir sus datos con su entrenador).
create or replace function public.is_coach_of(runner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from club_members c
    join club_members r on r.club_id = c.club_id and r.user_id = runner and r.role = 'corredor'
    where c.user_id = auth.uid() and c.role in ('entrenador','admin')
  ) and exists (
    select 1 from consents
    where user_id = runner and kind = 'compartir_con_entrenador' and revoked_at is null
  );
$$;

create or replace function public.is_member_of(club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from club_members where club_id = club and user_id = auth.uid());
$$;

create or replace function public.is_staff_of(club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from club_members where club_id = club and user_id = auth.uid() and role in ('entrenador','admin'));
$$;

-- Tablas del corredor: él lee y escribe; su entrenador solo lee.
do $$
declare t text;
begin
  foreach t in array array['profiles','cycles','runs','strength_logs','checkins','discomforts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "propio" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "entrenador lee" on public.%I for select using (public.is_coach_of(user_id))', t);
  end loop;
end $$;

alter table public.consents enable row level security;
create policy "propio" on public.consents for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.clubs enable row level security;
create policy "miembros leen" on public.clubs for select using (public.is_member_of(id));
create policy "crear club" on public.clubs for insert with check (created_by = auth.uid());
create policy "staff edita" on public.clubs for update using (public.is_staff_of(id));

-- Quien crea un club queda como admin de ese club.
create or replace function public.add_club_creator()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into club_members (club_id, user_id, role) values (new.id, new.created_by, 'admin');
  return new;
end $$;
create trigger clubs_add_creator after insert on public.clubs
  for each row execute function public.add_club_creator();

alter table public.club_members enable row level security;
create policy "miembros leen" on public.club_members for select using (public.is_member_of(club_id));
create policy "staff gestiona" on public.club_members for all using (public.is_staff_of(club_id)) with check (public.is_staff_of(club_id));

alter table public.club_groups enable row level security;
create policy "miembros leen" on public.club_groups for select using (public.is_member_of(club_id));
create policy "staff gestiona" on public.club_groups for all using (public.is_staff_of(club_id)) with check (public.is_staff_of(club_id));

alter table public.group_members enable row level security;
create policy "miembros leen" on public.group_members for select
  using (exists (select 1 from club_groups g where g.id = group_id and public.is_member_of(g.club_id)));
create policy "staff gestiona" on public.group_members for all
  using (exists (select 1 from club_groups g where g.id = group_id and public.is_staff_of(g.club_id)))
  with check (exists (select 1 from club_groups g where g.id = group_id and public.is_staff_of(g.club_id)));

alter table public.invitations enable row level security;
create policy "staff gestiona" on public.invitations for all using (public.is_staff_of(club_id)) with check (public.is_staff_of(club_id));
-- Canjear un código se hace con una función del servidor (service role), no desde el cliente.

alter table public.planned_workouts enable row level security;
create policy "corredor lee lo suyo" on public.planned_workouts for select
  using (user_id = auth.uid()
      or exists (select 1 from group_members m where m.group_id = planned_workouts.group_id and m.user_id = auth.uid()));
create policy "corredor planifica lo propio" on public.planned_workouts for all
  using (user_id = auth.uid() and created_by = auth.uid())
  with check (user_id = auth.uid() and created_by = auth.uid());
create policy "entrenador planifica" on public.planned_workouts for all
  using ((user_id is not null and public.is_coach_of(user_id))
      or exists (select 1 from club_groups g where g.id = planned_workouts.group_id and public.is_staff_of(g.club_id)))
  with check ((user_id is not null and public.is_coach_of(user_id))
      or exists (select 1 from club_groups g where g.id = planned_workouts.group_id and public.is_staff_of(g.club_id)));

-- ============ Migración 2 · funciones_privadas ============
-- Las funciones de permisos salen de la API pública (las policies siguen apuntando a ellas).
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_coach_of(uuid) set schema private;
alter function public.is_member_of(uuid) set schema private;
alter function public.is_staff_of(uuid) set schema private;
alter function public.add_club_creator() set schema private;
revoke execute on function private.is_coach_of(uuid), private.is_member_of(uuid), private.is_staff_of(uuid) from public, anon;
grant execute on function private.is_coach_of(uuid), private.is_member_of(uuid), private.is_staff_of(uuid) to authenticated;
revoke execute on function private.add_club_creator() from public, anon, authenticated;
