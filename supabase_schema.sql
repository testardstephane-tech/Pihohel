-- ═══════════════════════════════════════════════════════════════
-- PIHOHEL — Schéma Supabase complet
-- Colle ce SQL dans : Supabase > SQL Editor > New Query > Run
-- ═══════════════════════════════════════════════════════════════

-- ─── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── PROFILES ─────────────────────────────────────────────────
-- Créé automatiquement à chaque inscription
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles visibles par les deux utilisateurs"
  on public.profiles for select using (auth.role() = 'authenticated');

create policy "Chacun modifie son profil"
  on public.profiles for update using (auth.uid() = id);

-- Trigger : crée un profil automatiquement à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── WATCHLIST ────────────────────────────────────────────────
create table if not exists public.watchlist (
  id uuid default uuid_generate_v4() primary key,
  external_id text,
  type text not null check (type in ('series', 'movie', 'game', 'actor', 'drama', 'show')),
  title text not null,
  poster_url text,
  synopsis text,
  total_episodes int,
  current_episode int default 0,
  duration_minutes int,
  release_year text,
  status text not null default 'to_watch'
    check (status in ('to_watch', 'watching', 'completed', 'dropped')),
  added_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.watchlist enable row level security;

create policy "Watchlist partagée — lecture"
  on public.watchlist for select using (auth.role() = 'authenticated');

create policy "Watchlist partagée — insertion"
  on public.watchlist for insert with check (auth.role() = 'authenticated');

create policy "Watchlist partagée — mise à jour"
  on public.watchlist for update using (auth.role() = 'authenticated');

create policy "Watchlist partagée — suppression"
  on public.watchlist for delete using (auth.role() = 'authenticated');

-- ─── NOTES ────────────────────────────────────────────────────
create table if not exists public.notes (
  id uuid default uuid_generate_v4() primary key,
  watchlist_id uuid references public.watchlist(id) on delete cascade,
  user_id uuid references public.profiles(id),
  scenario numeric(4,1) default 0 check (scenario >= 0 and scenario <= 10),
  music numeric(4,1) default 0 check (music >= 0 and music <= 10),
  actors numeric(4,1) default 0 check (actors >= 0 and actors <= 10),
  text text,
  duration_minutes int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(watchlist_id, user_id)
);

alter table public.notes enable row level security;

create policy "Notes — lecture partagée"
  on public.notes for select using (auth.role() = 'authenticated');

create policy "Notes — chacun écrit les siennes"
  on public.notes for insert with check (auth.uid() = user_id);

create policy "Notes — chacun modifie les siennes"
  on public.notes for update using (auth.uid() = user_id);

-- ─── PHOTO RECAPS ─────────────────────────────────────────────
create table if not exists public.photo_recaps (
  id uuid default uuid_generate_v4() primary key,
  watchlist_id uuid references public.watchlist(id) on delete cascade,
  user_id uuid references public.profiles(id),
  photo_url text not null,
  storage_path text,
  caption text,
  episode_number int,
  created_at timestamptz default now()
);

alter table public.photo_recaps enable row level security;

create policy "Photos — lecture partagée"
  on public.photo_recaps for select using (auth.role() = 'authenticated');

create policy "Photos — chacun ajoute les siennes"
  on public.photo_recaps for insert with check (auth.uid() = user_id);

create policy "Photos — chacun supprime les siennes"
  on public.photo_recaps for delete using (auth.uid() = user_id);

-- ─── LEGENDS ──────────────────────────────────────────────────
create table if not exists public.legends (
  id uuid default uuid_generate_v4() primary key,
  list_type text not null check (list_type in ('GOAT', 'VIP')),
  name text not null,
  type text not null default 'real_person' check (type in ('real_person', 'fictional')),
  photo_url text,
  role text,
  description text,
  external_id text,
  added_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.legends enable row level security;

create policy "Legends — partagées"
  on public.legends for all using (auth.role() = 'authenticated');

-- ─── CAPSULES TEMPORELLES ─────────────────────────────────────
create table if not exists public.capsules (
  id uuid default uuid_generate_v4() primary key,
  watchlist_id uuid references public.watchlist(id) on delete cascade,
  user_id uuid references public.profiles(id),
  before_text text,
  after_text text,
  unlocked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(watchlist_id, user_id)
);

alter table public.capsules enable row level security;

create policy "Capsules — lecture partagée"
  on public.capsules for select using (auth.role() = 'authenticated');

create policy "Capsules — chacun gère les siennes"
  on public.capsules for insert with check (auth.uid() = user_id);

create policy "Capsules — mise à jour"
  on public.capsules for update using (auth.uid() = user_id);

-- ─── TROPHÉES ─────────────────────────────────────────────────
create table if not exists public.trophies (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  trophy_id text not null,
  earned_at timestamptz default now(),
  unique(user_id, trophy_id)
);

alter table public.trophies enable row level security;

create policy "Trophées — lecture partagée"
  on public.trophies for select using (auth.role() = 'authenticated');

create policy "Trophées — insertion système"
  on public.trophies for insert with check (auth.role() = 'authenticated');

-- ─── NOTIFICATIONS ("Je pense à toi") ─────────────────────────
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  from_user uuid references public.profiles(id),
  to_user uuid references public.profiles(id),
  type text default 'thinking_of_you',
  read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

create policy "Notifs — chacun voit les siennes"
  on public.notifications for select using (auth.uid() = to_user or auth.uid() = from_user);

create policy "Notifs — envoi"
  on public.notifications for insert with check (auth.uid() = from_user);

create policy "Notifs — marquer comme lu"
  on public.notifications for update using (auth.uid() = to_user);

-- ─── REALTIME ─────────────────────────────────────────────────
-- Active le realtime sur les tables importantes
alter publication supabase_realtime add table public.watchlist;
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.photo_recaps;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.trophies;
alter publication supabase_realtime add table public.legends;

-- ─── STORAGE (Photo Recaps) ────────────────────────────────────
-- À créer manuellement dans Supabase > Storage :
-- Nom du bucket : "photo-recaps"
-- Public : NON (privé)
-- Puis dans Policies du bucket, ajouter :
--   SELECT : authenticated users
--   INSERT : authenticated users
--   DELETE : owner only (auth.uid() = owner)

-- ─── CITATIONS ────────────────────────────────────────────────
create table if not exists public.citations (
  id uuid default uuid_generate_v4() primary key,
  watchlist_id uuid references public.watchlist(id) on delete cascade,
  user_id text not null,
  text text not null,
  created_at timestamptz default now()
);
alter table public.citations enable row level security;
create policy "Citations — partagées" on public.citations for all using (auth.role() = 'authenticated');

-- ─── WHEEL ITEMS (Roue du Destin perso) ───────────────────────
create table if not exists public.wheel_items (
  id uuid default uuid_generate_v4() primary key,
  label text not null,
  created_at timestamptz default now()
);
alter table public.wheel_items enable row level security;
create policy "Wheel — partagée" on public.wheel_items for all using (auth.role() = 'authenticated');

-- ─── SPECIAL DATES ────────────────────────────────────────────
create table if not exists public.special_dates (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  date date not null,
  emoji text default '🌸',
  created_at timestamptz default now()
);
alter table public.special_dates enable row level security;
create policy "Dates — partagées" on public.special_dates for all using (auth.role() = 'authenticated');

-- ─── Ajouter colonnes manquantes sur watchlist ─────────────────
alter table public.watchlist add column if not exists photo_recap_enabled boolean default false;

-- ─── Realtime sur nouvelles tables ────────────────────────────
alter publication supabase_realtime add table public.citations;
alter publication supabase_realtime add table public.wheel_items;
alter publication supabase_realtime add table public.special_dates;

-- ─── LISTES PERSONNALISÉES ─────────────────────────────────────
create table if not exists public.custom_lists (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  created_by text,
  created_at timestamptz default now()
);
alter table public.custom_lists enable row level security;
create policy "Custom lists all" on public.custom_lists for all using (true);

create table if not exists public.custom_list_items (
  id uuid default uuid_generate_v4() primary key,
  list_id uuid references public.custom_lists(id) on delete cascade,
  text text not null,
  done boolean default false,
  added_by text,
  created_at timestamptz default now()
);
alter table public.custom_list_items enable row level security;
create policy "Custom items all" on public.custom_list_items for all using (true);

-- ─── LIST ITEMS (pour les listes custom avec recherche) ────────
create table if not exists public.list_items (
  id uuid default uuid_generate_v4() primary key,
  list_id uuid references public.custom_lists(id) on delete cascade,
  type text default 'free',
  title text not null,
  poster_url text,
  synopsis text,
  total_episodes int,
  current_episode int default 0,
  status text default 'to_watch',
  added_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.list_items enable row level security;
create policy "List items all" on public.list_items for all using (true);

-- ─── Colonnes saisons ─────────────────────────────────────────
alter table public.watchlist add column if not exists season_number int default 1;

-- ─── MEDIA (photos galerie, vidéos, vocaux) ───────────────────
create table if not exists public.media_items (
  id uuid default uuid_generate_v4() primary key,
  watchlist_id uuid references public.watchlist(id) on delete cascade,
  user_id text not null,
  type text not null check (type in ('photo', 'video', 'audio')),
  url text not null,
  storage_path text,
  duration_seconds int,
  caption text,
  created_at timestamptz default now()
);
alter table public.media_items enable row level security;
create policy "Media all" on public.media_items for all using (true);
alter publication supabase_realtime add table public.media_items;

-- ─── Colonne submitted sur photo_recaps ───────────────────────
-- Pour savoir si l'utilisateur a "soumis" ses 4 images (révèle celles de l'autre)
alter table public.photo_recaps add column if not exists submitted boolean default false;
alter table public.photo_recaps add column if not exists episode_submitted_at timestamptz;

-- ─── Durée d'épisode (pour calcul temps de visionnage) ────────
alter table public.watchlist add column if not exists episode_duration int default 45;

-- ─── episode_duration sur watchlist ───────────────────────────
alter table public.watchlist add column if not exists episode_duration int default 45;
