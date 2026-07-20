-- ============================================================
-- CHRIST KINGDOM CONNECT — Migration 004: Video Stories
-- Run this AFTER 001, 002, and 003.
-- ============================================================

alter table public.stories
  add column media_type text not null default 'image' check (media_type in ('image', 'video')),
  add column duration_seconds numeric;  -- video length; null for images

-- Story videos are capped client-side at 15s (see lib/uploads.js
-- MAX_VIDEO_DURATION_MS) to keep the story format fast and keep
-- storage costs predictable — enforce server-side too so a modified
-- client can't bypass the limit:
alter table public.stories
  add constraint story_video_duration_check
  check (media_type = 'image' or duration_seconds <= 20);
