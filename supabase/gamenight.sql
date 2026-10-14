-- Game Night backend, inside the figgg Supabase project (swjqlfcqvcrnydpyjyog).
-- Everything lives in its own schema `gamenight`, which PostgREST does not expose,
-- so figgg's public-schema export/wipe (user_data_tables()) never sees it.
-- The app reaches it only through the public.gn_* functions below (security definer,
-- input-checked). Live play (rooms, phones, TV) uses Realtime broadcast and needs no tables.

create schema if not exists gamenight;
revoke all on schema gamenight from public, anon, authenticated;

create table gamenight.players (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  name text not null check (char_length(name) between 1 and 24),
  color text not null default '#8790B6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_core boolean not null default false,
  created_at timestamptz not null default now()
);

create table gamenight.seasons (
  id int primary key,
  name text not null,
  started_on date not null default current_date,
  ended_on date
);

create table gamenight.nights (
  id uuid primary key,
  season_id int not null references gamenight.seasons(id),
  room_code text not null check (room_code ~ '^[A-Z]{4}$'),
  mode text not null default 'together' check (mode in ('together', 'apart')),
  status text not null default 'live' check (status in ('live', 'done')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  player_ids text[] not null default '{}' check (coalesce(array_length(player_ids, 1), 0) <= 12 and pg_column_size(player_ids) < 1024),
  standings jsonb check (standings is null or pg_column_size(standings) < 8000),
  winner_ids text[] check (winner_ids is null or pg_column_size(winner_ids) < 1024)
);
create index nights_season_idx on gamenight.nights (season_id, started_at desc);

create table gamenight.results (
  id uuid primary key,
  night_id uuid not null references gamenight.nights(id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z0-9-]{1,32}$'),
  played_at timestamptz not null default now(),
  placements jsonb not null check (jsonb_typeof(placements) = 'array' and pg_column_size(placements) < 8000),
  details jsonb check (details is null or pg_column_size(details) < 64000)
);
create index results_night_idx on gamenight.results (night_id);

create table gamenight.hall (
  id uuid primary key default gen_random_uuid(),
  night_id uuid references gamenight.nights(id) on delete cascade,
  result_id uuid references gamenight.results(id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z0-9-]{1,32}$'),
  player_id text not null check (player_id ~ '^[a-z0-9-]{1,40}$'),
  kind text not null check (kind in ('answer', 'drawing', 'moment')),
  label text check (label is null or char_length(label) <= 200),
  content jsonb not null check (pg_column_size(content) < 60000),
  created_at timestamptz not null default now()
);
create index hall_created_idx on gamenight.hall (created_at desc);

-- RLS on with no policies: no role reaches these tables directly. Only the
-- security definer functions (owned by postgres) read and write them.
alter table gamenight.players enable row level security;
alter table gamenight.seasons enable row level security;
alter table gamenight.nights enable row level security;
alter table gamenight.results enable row level security;
alter table gamenight.hall enable row level security;

insert into gamenight.seasons (id, name) values (1, 'Season 1');
insert into gamenight.players (id, name, color, is_core) values
  ('dixxx', 'Dixxx', '#3CCB72', true),
  ('johnnyboy', 'Johnnyboy', '#6A9BFF', true),
  ('torii', 'Torii', '#B67CFF', true);

-- Hard cap on game night's total storage, so nobody can fill figgg's database through these functions.
create or replace function gamenight.assert_room()
returns void
language plpgsql
set search_path = ''
as $$
begin
  if (select sum(pg_catalog.pg_total_relation_size(c.oid)) from pg_catalog.pg_class c
      where c.relnamespace = 'gamenight'::regnamespace and c.relkind = 'r') > 50 * 1024 * 1024 then
    raise exception 'game night storage full';
  end if;
end;
$$;

-- Open a night (or refresh its player list while it is live).
create or replace function public.gn_start_night(p_id uuid, p_room_code text, p_mode text, p_player_ids text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season int;
begin
  perform gamenight.assert_room();
  select id into v_season from gamenight.seasons where ended_on is null order by id desc limit 1;
  if v_season is null then
    raise exception 'no open season';
  end if;
  insert into gamenight.nights (id, season_id, room_code, mode, player_ids)
  values (p_id, v_season, upper(p_room_code), coalesce(p_mode, 'together'), coalesce(p_player_ids, '{}'))
  on conflict (id) do update
    set player_ids = excluded.player_ids
    where gamenight.nights.status = 'live' and gamenight.nights.started_at > now() - interval '18 hours';
end;
$$;

-- Record one finished game. Idempotent on p_id, so a retried call never doubles a result or its highlights.
create or replace function public.gn_record_result(
  p_id uuid,
  p_night_id uuid,
  p_game_id text,
  p_placements jsonb,
  p_details jsonb default null,
  p_hall jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted uuid;
  h jsonb;
begin
  perform gamenight.assert_room();
  if not exists (select 1 from gamenight.nights where id = p_night_id and status = 'live' and started_at > now() - interval '18 hours') then
    raise exception 'night is not live';
  end if;
  if jsonb_typeof(p_placements) is distinct from 'array' or jsonb_array_length(p_placements) > 12 then
    raise exception 'bad placements';
  end if;
  if p_hall is not null and (jsonb_typeof(p_hall) <> 'array' or jsonb_array_length(p_hall) > 6) then
    raise exception 'bad highlights';
  end if;

  insert into gamenight.results (id, night_id, game_id, placements, details)
  values (p_id, p_night_id, p_game_id, p_placements, p_details)
  on conflict (id) do nothing
  returning id into v_inserted;

  if v_inserted is null or p_hall is null then
    return;
  end if;

  for h in select value from jsonb_array_elements(p_hall) loop
    -- A malformed highlight is skipped, never allowed to sink the result it rides with.
    continue when jsonb_typeof(h) <> 'object'
      or coalesce(h ->> 'player_id', '') !~ '^[a-z0-9-]{1,40}$'
      or coalesce(h ->> 'kind', '') not in ('answer', 'drawing', 'moment')
      or char_length(coalesce(h ->> 'label', '')) > 200
      or pg_catalog.pg_column_size(coalesce(h -> 'content', '{}'::jsonb)) >= 60000;
    insert into gamenight.hall (night_id, result_id, game_id, player_id, kind, label, content)
    values (p_night_id, p_id, p_game_id, h ->> 'player_id', h ->> 'kind', h ->> 'label', coalesce(h -> 'content', '{}'::jsonb));
  end loop;
end;
$$;

-- Close a night with its final standings. Done nights are frozen.
create or replace function public.gn_end_night(p_night_id uuid, p_standings jsonb, p_winner_ids text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update gamenight.nights
     set status = 'done', ended_at = now(), standings = p_standings, winner_ids = p_winner_ids
   where id = p_night_id and status = 'live' and started_at > now() - interval '18 hours';
end;
$$;

-- Add (or reuse) a guest player. Returns the guest's id.
create or replace function public.gn_add_guest(p_name text, p_color text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(p_name), 24);
  v_id text;
begin
  perform gamenight.assert_room();
  if v_name is null or v_name = '' then
    raise exception 'name required';
  end if;
  v_id := 'g-' || left(btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-'), 30);
  if v_id = 'g-' then
    v_id := 'g-guest';
  end if;
  insert into gamenight.players (id, name, color, is_core)
  values (v_id, v_name, coalesce(p_color, '#8790B6'), false)
  on conflict (id) do nothing;
  return v_id;
end;
$$;

-- Everything the season, history and records screens need, in one call.
create or replace function public.gn_data(p_season int default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select coalesce(p_season, (select max(id) from gamenight.seasons)) as id
  )
  select jsonb_build_object(
    'season_id', (select id from s),
    'seasons', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from gamenight.seasons x), '[]'::jsonb),
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'color', p.color, 'is_core', p.is_core) order by p.is_core desc, p.created_at) from gamenight.players p), '[]'::jsonb),
    'nights', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'room_code', n.room_code, 'mode', n.mode, 'status', n.status,
        'started_at', n.started_at, 'ended_at', n.ended_at, 'player_ids', n.player_ids,
        'standings', n.standings, 'winner_ids', n.winner_ids,
        'results', coalesce((
          select jsonb_agg(jsonb_build_object('id', r.id, 'game_id', r.game_id, 'played_at', r.played_at, 'placements', r.placements) order by r.played_at)
          from gamenight.results r where r.night_id = n.id
        ), '[]'::jsonb)
      ) order by n.started_at desc)
      from gamenight.nights n
      where n.season_id = (select id from s)
        and (n.status = 'done' or n.started_at < now() - interval '12 hours')
        and exists (select 1 from gamenight.results r where r.night_id = n.id)
    ), '[]'::jsonb)
  );
$$;

-- The Hall of Fame, newest first.
create or replace function public.gn_hall(p_limit int default 60)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc), '[]'::jsonb)
  from (
    select id, night_id, game_id, player_id, kind, label, content, created_at
    from gamenight.hall
    order by created_at desc
    limit least(greatest(coalesce(p_limit, 60), 1), 100)
  ) h;
$$;

revoke all on function gamenight.assert_room() from public;
revoke all on function public.gn_start_night(uuid, text, text, text[]) from public;
revoke all on function public.gn_record_result(uuid, uuid, text, jsonb, jsonb, jsonb) from public;
revoke all on function public.gn_end_night(uuid, jsonb, text[]) from public;
revoke all on function public.gn_add_guest(text, text) from public;
revoke all on function public.gn_data(int) from public;
revoke all on function public.gn_hall(int) from public;
grant execute on function public.gn_start_night(uuid, text, text, text[]) to anon, authenticated;
grant execute on function public.gn_record_result(uuid, uuid, text, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.gn_end_night(uuid, jsonb, text[]) to anon, authenticated;
grant execute on function public.gn_add_guest(text, text) to anon, authenticated;
grant execute on function public.gn_data(int) to anon, authenticated;
grant execute on function public.gn_hall(int) to anon, authenticated;
