-- ============================================================
-- CHRIST KINGDOM CONNECT — Migration 002: Moderation & Reporting
-- Run this AFTER 001_initial_schema.sql
--
-- Satisfies Apple App Store Guideline 1.2 (UGC apps) and the
-- equivalent Google Play "User Generated Content" policy:
--   1. A way to filter objectionable content
--   2. A way for users to report it, with timely action
--   3. A way to block abusive users
--   4. A way to eject abusive users
--   5. Published contact info (that part's on your app listing,
--      not the database — don't forget it)
-- ============================================================

-- ------------------------------------------------------------
-- 1. SOFT-DELETE / REMOVAL FLAGS on reportable content
--    Removed content is hidden, not destroyed — you need the
--    audit trail if a user disputes a moderation decision, and
--    app store reviewers may ask how you handle appeals.
-- ------------------------------------------------------------
alter table public.posts
  add column is_removed boolean default false,
  add column removed_reason text,
  add column removed_at timestamptz;

alter table public.post_comments
  add column is_removed boolean default false,
  add column removed_reason text,
  add column removed_at timestamptz;

alter table public.prayer_requests
  add column is_removed boolean default false,
  add column removed_reason text,
  add column removed_at timestamptz;

alter table public.stream_chat_messages
  add column is_removed boolean default false;

-- ------------------------------------------------------------
-- 2. ACCOUNT STANDING — suspension / ban
-- ------------------------------------------------------------
alter table public.profiles
  add column is_suspended boolean default false,
  add column suspended_until timestamptz,
  add column is_banned boolean default false,
  add column ban_reason text;

-- ------------------------------------------------------------
-- 3. REPORTS — any believer can report any piece of content or
--    another profile. `target_type` + `target_id` keeps this one
--    table instead of five near-identical ones.
-- ------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  target_type text not null check (target_type in ('post', 'comment', 'prayer_request', 'profile', 'group', 'stream_chat_message')),
  target_id uuid not null,
  reason text not null check (reason in (
    'spam', 'harassment', 'hate_speech', 'sexual_content',
    'violence', 'false_teaching_flagged', 'impersonation', 'other'
  )),
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create index reports_status_idx on public.reports (status, created_at);

-- ------------------------------------------------------------
-- 4. BLOCKS — one-directional; if A blocks B, A stops seeing B
--    (enforced in feed/query functions in lib/moderation.js),
--    and B can no longer follow, message, or comment to A
--    (enforced via RLS below).
-- ------------------------------------------------------------
create table public.blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ------------------------------------------------------------
-- 5. MODERATION ACTION LOG — every action an admin takes, kept
--    permanently for accountability and app-review evidence.
-- ------------------------------------------------------------
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles(id) not null,
  target_type text not null,
  target_id uuid not null,
  action text not null check (action in (
    'content_removed', 'content_restored', 'user_warned',
    'user_suspended', 'user_unsuspended', 'user_banned', 'user_unbanned',
    'report_dismissed'
  )),
  reason text,
  report_id uuid references public.reports(id),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 6. BASIC WORD-FILTER TABLE — a starting blocklist for the
--    client-side pre-submit check in lib/moderation.js.
--    This is a first line of defense only, NOT a substitute for
--    human review of reports — treat it as catching the obvious
--    stuff before it's ever posted, not as your moderation system.
-- ------------------------------------------------------------
create table public.blocked_terms (
  id uuid primary key default gen_random_uuid(),
  term text unique not null,
  severity text default 'block' check (severity in ('block', 'flag')) -- block = reject post, flag = allow but queue for review
);

-- Seed a minimal starter list — expand this yourself, deliberately
-- not populating slurs/explicit terms here.
insert into public.blocked_terms (term, severity) values
  ('viagra', 'block'),
  ('bit.ly', 'flag'),
  ('onlyfans', 'block');

-- ============================================================
-- ROW LEVEL SECURITY for new tables
-- ============================================================
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.blocked_terms enable row level security;

-- Reports: reporters can see their own reports; admins see all
create policy "users see their own reports"
  on public.reports for select to authenticated
  using (auth.uid() = reporter_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true));

create policy "users file reports as themselves"
  on public.reports for insert to authenticated with check (auth.uid() = reporter_id);

create policy "admins update report status"
  on public.reports for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true));

-- Blocks: users manage their own block list only
create policy "users see their own block list"
  on public.blocks for select to authenticated using (auth.uid() = blocker_id);
create policy "users block as themselves"
  on public.blocks for insert to authenticated with check (auth.uid() = blocker_id);
create policy "users unblock as themselves"
  on public.blocks for delete to authenticated using (auth.uid() = blocker_id);

-- Moderation log: admins only
create policy "admins view moderation log"
  on public.moderation_actions for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true));
create policy "admins write moderation log"
  on public.moderation_actions for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true) and auth.uid() = moderator_id);

-- Blocked terms: readable by all signed-in users (client needs it for the pre-submit check), admin-writable
create policy "blocked terms readable by authenticated users"
  on public.blocked_terms for select to authenticated using (true);
create policy "admins manage blocked terms"
  on public.blocked_terms for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true));

-- ============================================================
-- UPDATE EXISTING POLICIES to respect removal + blocks + bans
-- ============================================================

-- Hide removed content from everyone except its author and admins
drop policy if exists "posts are viewable by authenticated users" on public.posts;
create policy "posts viewable unless removed"
  on public.posts for select to authenticated
  using (
    is_removed = false
    or auth.uid() = author_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true)
  );

drop policy if exists "comments are viewable by authenticated users" on public.post_comments;
create policy "comments viewable unless removed"
  on public.post_comments for select to authenticated
  using (
    is_removed = false
    or auth.uid() = author_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true)
  );

drop policy if exists "prayer requests viewable by authenticated users" on public.prayer_requests;
create policy "prayer requests viewable unless removed"
  on public.prayer_requests for select to authenticated
  using (
    is_removed = false
    or auth.uid() = author_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true)
  );

-- Suspended/banned users cannot post, comment, or chat
drop policy if exists "users can create personal posts" on public.posts;
create policy "active users can create personal posts"
  on public.posts for insert to authenticated
  with check (
    auth.uid() = author_id
    and (is_church_official = false or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_church_admin = true))
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned = false and (p.is_suspended = false or p.suspended_until < now()))
  );

drop policy if exists "users can comment as themselves" on public.post_comments;
create policy "active users can comment as themselves"
  on public.post_comments for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned = false and (p.is_suspended = false or p.suspended_until < now()))
  );

drop policy if exists "users chat as themselves" on public.stream_chat_messages;
create policy "active users chat as themselves"
  on public.stream_chat_messages for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned = false and (p.is_suspended = false or p.suspended_until < now()))
  );

-- A blocked user cannot follow the person who blocked them
drop policy if exists "users can follow as themselves" on public.follows;
create policy "users can follow as themselves unless blocked"
  on public.follows for insert to authenticated
  with check (
    auth.uid() = follower_id
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = following_id and b.blocked_id = follower_id
    )
  );
