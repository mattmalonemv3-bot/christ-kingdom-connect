-- ============================================================
-- CHRIST KINGDOM CONNECT — Migration 005: Push Notifications
-- Run this AFTER 001, 002, 003, 004.
--
-- Two halves:
--   1. In-app notifications (this migration, pure SQL) — reliable,
--      shows up in the bell icon regardless of push delivery.
--   2. Actual push delivery (Edge Function + Database Webhook,
--      set up separately after this runs — see README section 11) —
--      best-effort, since push delivery always is.
-- ============================================================

alter table public.profiles
  add column expo_push_token text;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,  -- recipient
  type text not null check (type in ('like', 'comment', 'follow', 'prayer_response', 'event_reminder')),
  actor_id uuid references public.profiles(id) on delete cascade,          -- who caused it (null for system notifications)
  target_type text,   -- 'post' | 'comment' | 'prayer_request' | 'profile' | 'event'
  target_id uuid,
  body text not null, -- precomputed display text, e.g. "Grace Okafor liked your post"
  is_read boolean default false,
  created_at timestamptz default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "users see only their own notifications"
  on public.notifications for select to authenticated using (auth.uid() = user_id);

create policy "users mark their own notifications read"
  on public.notifications for update to authenticated using (auth.uid() = user_id);

-- No insert policy for regular users — notifications are only ever
-- created by the trigger functions below, which run as security
-- definer and bypass RLS. This means a modified client can't spoof
-- a notification for someone else.

-- ------------------------------------------------------------
-- TRIGGER: new like -> notify the post's author (unless you liked
-- your own post)
-- ------------------------------------------------------------
create or replace function public.notify_on_like()
returns trigger as $$
declare
  post_author_id uuid;
  actor_name text;
begin
  select author_id into post_author_id from public.posts where id = new.post_id;
  if post_author_id is null or post_author_id = new.user_id then
    return new; -- don't notify yourself
  end if;

  select display_name into actor_name from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, type, actor_id, target_type, target_id, body)
  values (post_author_id, 'like', new.user_id, 'post', new.post_id, actor_name || ' liked your post');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_post_like_notify
  after insert on public.post_likes
  for each row execute procedure public.notify_on_like();

-- ------------------------------------------------------------
-- TRIGGER: new comment -> notify the post's author
-- ------------------------------------------------------------
create or replace function public.notify_on_comment()
returns trigger as $$
declare
  post_author_id uuid;
  actor_name text;
begin
  select author_id into post_author_id from public.posts where id = new.post_id;
  if post_author_id is null or post_author_id = new.author_id then
    return new;
  end if;

  select display_name into actor_name from public.profiles where id = new.author_id;

  insert into public.notifications (user_id, type, actor_id, target_type, target_id, body)
  values (post_author_id, 'comment', new.author_id, 'post', new.post_id, actor_name || ' commented on your post');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_post_comment_notify
  after insert on public.post_comments
  for each row execute procedure public.notify_on_comment();

-- ------------------------------------------------------------
-- TRIGGER: new follow -> notify the person being followed
-- ------------------------------------------------------------
create or replace function public.notify_on_follow()
returns trigger as $$
declare
  actor_name text;
begin
  select display_name into actor_name from public.profiles where id = new.follower_id;

  insert into public.notifications (user_id, type, actor_id, target_type, target_id, body)
  values (new.following_id, 'follow', new.follower_id, 'profile', new.follower_id, actor_name || ' started following you');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_follow_notify
  after insert on public.follows
  for each row execute procedure public.notify_on_follow();

-- ------------------------------------------------------------
-- TRIGGER: someone prays for your request -> notify the requester
-- ------------------------------------------------------------
create or replace function public.notify_on_prayer_response()
returns trigger as $$
declare
  requester_id uuid;
  actor_name text;
begin
  select author_id into requester_id from public.prayer_requests where id = new.prayer_id;
  if requester_id is null or requester_id = new.user_id then
    return new;
  end if;

  select display_name into actor_name from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, type, actor_id, target_type, target_id, body)
  values (requester_id, 'prayer_response', new.user_id, 'prayer_request', new.prayer_id, actor_name || ' prayed for your request');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_prayer_response_notify
  after insert on public.prayer_responses
  for each row execute procedure public.notify_on_prayer_response();
