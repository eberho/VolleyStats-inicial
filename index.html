-- ============================================================
-- VolleyStats · Esquema de base de datos para Supabase
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase.
-- ============================================================

-- EQUIPOS
create table if not exists equipos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nombre text not null,
  created_at timestamptz default now()
);

-- JUGADORES
create table if not exists jugadores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  equipo_id uuid references equipos(id) on delete cascade not null,
  nombre text not null,
  numero int not null,
  posicion text not null check (posicion in ('colocador','opuesto','central','punta','libero')),
  created_at timestamptz default now()
);

-- PARTIDOS
create table if not exists partidos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  equipo_local_id uuid references equipos(id) on delete set null,
  equipo_visitante_id uuid references equipos(id) on delete set null,
  nombre_local text not null,
  nombre_visitante text not null,
  fecha date not null,
  formato int not null check (formato in (3,5)),
  estado text not null default 'en_curso' check (estado in ('en_curso','finalizado')),
  sets_local int default 0,
  sets_visitante int default 0,
  created_at timestamptz default now()
);

-- SETS
create table if not exists sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  partido_id uuid references partidos(id) on delete cascade not null,
  numero int not null,
  puntos_local int default 0,
  puntos_visitante int default 0,
  cerrado boolean default false,
  created_at timestamptz default now()
);

-- ACCIONES ESTADISTICAS
create table if not exists acciones_estadisticas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  partido_id uuid references partidos(id) on delete cascade not null,
  set_id uuid references sets(id) on delete cascade not null,
  set_numero int not null,
  jugador_id uuid references jugadores(id) on delete set null,
  jugador_nombre text,
  jugador_numero int,
  equipo_lado text not null check (equipo_lado in ('local','visitante')),
  tipo text not null,        -- saque | recepcion | ataque | bloqueo | defensa
  resultado text not null,   -- ace, error, normal, perfecta, etc.
  punto_para text,           -- local | visitante | null
  orden bigint not null,     -- para deshacer en orden
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security: cada entrenador solo ve sus datos
-- ============================================================
alter table equipos enable row level security;
alter table jugadores enable row level security;
alter table partidos enable row level security;
alter table sets enable row level security;
alter table acciones_estadisticas enable row level security;

create policy "own_equipos"  on equipos  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_jugadores" on jugadores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_partidos" on partidos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_sets"     on sets     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_acciones" on acciones_estadisticas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
