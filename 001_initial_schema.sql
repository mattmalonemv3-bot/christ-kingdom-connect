-- ============================================================
-- KINGDOM APP — Supabase / Postgres schema
-- Single-church model: Christ Kingdom Community Church (CKCC) is
-- the one featured church with live stream / sermons / official
-- events. Everything else (profiles, posts, follows, groups,
-- prayer wall) is a fully open global social network for any
-- believer, not scoped to a church.
-- Run in the Supabase SQL editor, top to bottom.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- CHURCH PROFILE — singleton row for CKCC (not a multi-tenant table)
-- ------------------------------------------------------------
create table public.church_profile (
  id int primary key default 1,
  name text not null default 'Christ Kingdom Community Church',
  logo_url text,
  city text,
  state text,
  about text,
  check (id = 1)   -- enforces exactly one row ever exists
);

insert into public.church_profile (id, name) values (1, 'Christ Kingdom Community Church');

-- ------------------------------------------------------------
-- PROFILES  (every believer worldwide, 1:1 with auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  bio text,
  avatar_url text,
  country text,                      -- self-reported, for the global-network feel
  is_church_admin boolean default false,  -- can post official CKCC content
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', 'New Member')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- FOLLOWS
-- ------------------------------------------------------------
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- ------------------------------------------------------------
-- POSTS + LIKES + COMMENTS  (the global feed)
-- ------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  image_url text,
  scripture_ref text,          -- e.g. "Philippians 4:13"
  scripture_text text,
  is_church_official boolean default false,  -- true = posted as CKCC, not a personal post
  created_at timestamptz default now()
);

create table public.post_likes (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- STORIES (24h ephemeral)
-- ------------------------------------------------------------
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  media_url text not null,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);

-- ------------------------------------------------------------
-- EVENTS  (CKCC's own events only — admin-authored)
-- ------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_featured boolean default false,
  cover_image_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table public.event_registrations (
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (event_id, user_id)
);

-- ------------------------------------------------------------
-- GROUPS + MEMBERSHIP  (open — any believer can start/join a group)
-- ------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member',   -- 'member' | 'leader'
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- ------------------------------------------------------------
-- PRAYER WALL  (global — any believer can post/pray)
-- ------------------------------------------------------------
create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  is_anonymous boolean default false,
  is_answered boolean default false,
  created_at timestamptz default now()
);

create table public.prayer_responses (
  prayer_id uuid references public.prayer_requests(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (prayer_id, user_id)
);

-- ------------------------------------------------------------
-- WATCH: CKCC's LIVESTREAM, SERMONS, LIVE CHAT
-- Only CKCC broadcasts — no church_id needed, admin-gated writes.
-- ------------------------------------------------------------
create table public.streams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  playback_url text,          -- HLS URL from your streaming provider (Mux, IVS, etc.)
  is_live boolean default false,
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

create table public.stream_chat_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid references public.streams(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);

create table public.sermons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  speaker text,
  video_url text,
  duration_seconds int,
  published_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.church_profile enable row level security;
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.stories enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.prayer_responses enable row level security;
alter table public.streams enable row level security;
alter table public.stream_chat_messages enable row level security;
alter table public.sermons enable row level security;

create policy "church profile viewable by anyone signed in"
  on public.church_profile for select to authenticated using (true);

create policy "profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

create policy "posts are viewable by authenticated users"
  on public.posts for select to authenticated using (true);
create policy "users can create personal posts"
  on public.posts for insert to authenticated
  with check (
    auth.uid() = author_id
    and (
      is_church_official = false
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true)
    )
  );
create policy "users can delete their own posts"
  on public.posts for delete to authenticated using (auth.uid() = author_id);

create policy "likes are viewable by authenticated users"
  on public.post_likes for select to authenticated using (true);
create policy "users can like as themselves"
  on public.post_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "users can unlike their own like"
  on public.post_likes for delete to authenticated using (auth.uid() = user_id);

create policy "comments are viewable by authenticated users"
  on public.post_comments for select to authenticated using (true);
create policy "users can comment as themselves"
  on public.post_comments for insert to authenticated with check (auth.uid() = author_id);

create policy "follows are viewable by authenticated users"
  on public.follows for select to authenticated using (true);
create policy "users can follow as themselves"
  on public.follows for insert to authenticated with check (auth.uid() = follower_id);
create policy "users can unfollow as themselves"
  on public.follows for delete to authenticated using (auth.uid() = follower_id);

create policy "events are viewable by authenticated users"
  on public.events for select to authenticated using (true);
create policy "church admins manage events"
  on public.events for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true));

create policy "registrations viewable by authenticated users"
  on public.event_registrations for select to authenticated using (true);
create policy "users register themselves"
  on public.event_registrations for insert to authenticated with check (auth.uid() = user_id);

create policy "prayer requests viewable by authenticated users"
  on public.prayer_requests for select to authenticated using (true);
create policy "users submit their own prayer requests"
  on public.prayer_requests for insert to authenticated with check (auth.uid() = author_id);
create policy "prayer responses viewable by authenticated users"
  on public.prayer_responses for select to authenticated using (true);
create policy "users respond as themselves"
  on public.prayer_responses for insert to authenticated with check (auth.uid() = user_id);

create policy "streams viewable by authenticated users"
  on public.streams for select to authenticated using (true);
create policy "church admins manage streams"
  on public.streams for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true));
create policy "church admins update streams"
  on public.streams for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true));

create policy "stream chat viewable by authenticated users"
  on public.stream_chat_messages for select to authenticated using (true);
create policy "users chat as themselves"
  on public.stream_chat_messages for insert to authenticated with check (auth.uid() = user_id);

create policy "sermons viewable by authenticated users"
  on public.sermons for select to authenticated using (true);
create policy "church admins manage sermons"
  on public.sermons for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true));

create policy "groups viewable by authenticated users"
  on public.groups for select to authenticated using (true);
create policy "users create groups"
  on public.groups for insert to authenticated with check (auth.uid() = created_by);
create policy "group members viewable by authenticated users"
  on public.group_members for select to authenticated using (true);
create policy "users join groups as themselves"
  on public.group_members for insert to authenticated with check (auth.uid() = user_id);
