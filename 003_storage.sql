-- ============================================================
-- CHRIST KINGDOM CONNECT — Migration 003: Media Storage
-- Run this AFTER 001_initial_schema.sql and 002_moderation.sql
--
-- One public bucket, three folders by convention:
--   media/avatars/{user_id}/...
--   media/posts/{user_id}/...
--   media/stories/{user_id}/...
--
-- The folder-based path (rather than three separate buckets) keeps
-- policy logic in one place: "you can only write inside your own
-- user_id folder," regardless of content type.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Public read — images need to load in the app without a signed URL
-- round-trip. This is standard for social-app media; it does NOT
-- bypass your table-level RLS, since the image URL is only ever
-- handed out via API responses that already respect post/profile
-- visibility (removed content, blocks, etc.) — the file itself
-- being fetchable by URL is no different from any CDN-hosted image.
create policy "media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'media');

-- Upload — only into your own folder, in one of the three
-- recognized top-level folders.
create policy "users upload only into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('avatars', 'posts', 'stories')
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Replace/delete — same folder rule, so you can only touch your own files.
create policy "users update only their own files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "users delete only their own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- Housekeeping: expired stories' rows should be cleaned up
-- periodically. This function deletes rows past expires_at;
-- schedule it with pg_cron (Supabase supports this as an add-on)
-- or call it from a daily Edge Function / cron job.
-- Note: this clears the DATABASE ROW, not the underlying storage
-- file — pair with a storage cleanup pass if disk usage matters,
-- or just accept some orphaned files early on and revisit later.
-- ------------------------------------------------------------
create or replace function public.purge_expired_stories()
returns void as $$
begin
  delete from public.stories where expires_at < now();
end;
$$ language plpgsql security definer;

-- Example (run manually or via pg_cron once enabled):
-- select cron.schedule('purge-stories-daily', '0 3 * * *', 'select public.purge_expired_stories()');
