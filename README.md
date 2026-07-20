# Kingdom App — Backend Setup

This is the real backend for the app: a Postgres schema plus a client
library your Expo app calls directly. It's not deployed anywhere yet —
you deploy it in about 15 minutes by following the steps below.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project.
2. Once it's provisioned, go to **SQL Editor** → paste the entire
   contents of `database/schema.sql` → **Run**.
3. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key (NOT the `service_role` key — never ship that
     in the app)

## 2. Wire it into your Expo project

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill lucide-react-native react-native-svg
```

Create a `.env` file at your project root:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Copy the four files from `lib/` into your project's `lib/` folder.

## 3. Make yourself a church admin

Official CKCC content (events, the livestream, sermons) can only be
created by a profile with `is_church_admin = true`. Sign up in the app
once, then in the Supabase SQL Editor run:

```sql
update public.profiles set is_church_admin = true where username = 'your_username';
```

## 4. How this maps to the five screens

| Screen  | Backend calls |
|---|---|
| Feed | `getFeed()`, `createPost()`, `likePost()` / `unlikePost()` |
| Explore | `getSuggestedPeople()`, `followUser()`, `getGroups()`, `getPrayerWall()` |
| Events | `getEvents()`, `registerForEvent()` |
| Watch | `getLiveStream()`, `getSermons()`, `getStreamChat()` + `subscribeToStreamChat()` for the live chat |
| Me | `getProfile()`, `updateProfile()`, `signOut()` |

## 5. What's deliberately NOT here yet

Being upfront about the gap between this and "app store ready":

- **Livestream video itself.** `streams.playback_url` expects an HLS
  URL from an actual streaming provider (Mux, AWS IVS, or even
  YouTube Live's embed). Supabase doesn't do video ingest — you'll
  pick a streaming provider separately and just store its URL here.
- **Image/story uploads.** Use Supabase Storage (a few lines of code)
  for `avatar_url`, `image_url`, and `media_url` — not covered in
  this pass, ask if you want it next.
- **Push notifications.** Needs Expo push tokens stored per profile
  and a scheduled/triggered function to send them (e.g. "someone
  liked your post," "livestream starting soon").
- **Content moderation.** For a public social app with a faith-based
  audience, you'll want report/block functionality and probably a
  moderation queue before this is safe to open to the public app
  stores. This is worth its own pass — flag when you're ready.
- **Search.** Postgres full-text search on posts/profiles, or
  Supabase's built-in `pg_trgm` — straightforward to add later.

## 6. Moderation & Reporting (migration 002)

Run `database/002_moderation.sql` in the SQL Editor after the initial
schema. It adds:

- **`reports`** — any believer can report a post, comment, prayer
  request, profile, group, or live chat message, with a reason.
- **`blocks`** — one-directional blocking; blocking someone also
  severs any existing follow between you, both directions.
- **`moderation_actions`** — a permanent audit log of every action an
  admin takes (content removed, user suspended/banned, report
  dismissed) — keep this even if you never show it in the app, since
  reviewers or a disputing user may ask "what happened and why."
- **`blocked_terms`** + `checkContent()` in `lib/moderation.js` — a
  client-side pre-submit filter. This catches the obvious stuff
  before it's posted; it is **not** your moderation system, just a
  courtesy first pass. Expand the seed list yourself — deliberately
  left minimal here.
- **Suspension/ban fields on `profiles`** — a suspended or banned
  user is blocked from posting, commenting, or live-chatting at the
  database level (RLS), not just hidden in the UI, so it can't be
  bypassed by a modified client.

### What you still need to build in the app itself

Good news — this is now built. Four new files:

- **`components/ReportModal.js`** — the report sheet with reason
  picker. Mount `<ReportModal />` once near your app root via the
  `useReportModal()` hook, call `openReport({ targetType, targetId })`
  from anywhere.
- **`components/ContentOptionsMenu.js`** — the "···" menu on a post
  or comment: shows Report for others' content, Delete for your own.
- **`components/BlockButton.js`** — drop into any profile screen
  (not your own). Handles its own confirm dialog and state.
- **`screens/ModerationQueueScreen.js`** — the admin review queue.
  Gate this route behind `is_church_admin` in your navigator; RLS
  also blocks it server-side so a modified client can't bypass this.
  One caveat inside: for non-`profile` reports, the suspend action
  needs the content's author_id resolved first (e.g. join back to
  `posts.author_id`) — the handler has a note where to wire that in
  once you tell me which content type to prioritize.

Still on you:

1. A way to **appeal** — even a "contact us" email is enough at
   launch; both stores care more that a channel exists than that it's
   sophisticated.

### Non-technical pieces both stores will ask about

- **Published contact info** — a support email or contact form
  visible in the app, not buried on a website. Apple checks for this
  specifically under 1.2.
- **Community guidelines** — a short, plain-language page describing
  what's not allowed (harassment, spam, explicit content, etc.). You
  can write this in an afternoon; both review teams look for it.
- **Response time** — you don't need instant moderation, but you do
  need to show reports get *looked at*. Even a same-day manual check
  of the `reports` table is enough to start; automate later.

## 7. Images & Stories (migration 003)

Run `database/003_storage.sql` after 001 and 002. It creates one
public `media` storage bucket with three folders (`avatars/`,
`posts/`, `stories/`), each locked so a user can only write inside
their own `user_id` subfolder — enforced by Supabase Storage's RLS,
separate from the table-level RLS in the earlier migrations.

```bash
npx expo install expo-image-picker expo-image-manipulator
```

New files:

- **`lib/uploads.js`** — `pickImage()` / `takePhoto()` open the
  native picker or camera, `compressImage()` resizes to a max 1600px
  edge and re-encodes as JPEG before upload (keeps posts fast to
  load on slow connections), `uploadMedia()` pushes to the right
  folder and returns a public URL. `pickAndUploadImage()` chains all
  three for the common case.
- **`lib/stories.js`** — `getActiveStories()` returns non-expired
  stories grouped by author (your own group always first, matching
  the story bar's "Your Story" convention), `createStory()`,
  `deleteStory()`.
- **`components/ComposerImageAttach.js`** — photo button + preview
  for the post composer.
- **`components/StoryBar.js`** — replaces the mock avatar row on the
  Feed screen with real data; tapping your own slot opens the viewer
  if you have an active story, or the picker if you don't.
- **`components/StoryViewer.js`** — full-screen tap-to-advance
  viewer with per-story progress bars, auto-advances every 5s.

**Expiration**: stories older than 24 hours won't show up in
`getActiveStories()` regardless (it filters `expires_at`), but the
database rows themselves stick around until something cleans them
up. `003_storage.sql` includes a `purge_expired_stories()` function
— call it from a daily scheduled job once you have `pg_cron` enabled
on your Supabase project, or just leave it and revisit when row
count actually matters.

**Video stories**: run `database/004_video_stories.sql` after 003.
Install `expo-av` (`npx expo install expo-av`) for playback. Stories
now carry `media_type` ('image' | 'video') and `duration_seconds`.
Video is capped at 15 seconds client-side (`lib/uploads.js`) and
enforced again at the database level so a modified client can't
bypass it. Deliberately no client-side video compression this
pass — that needs a native module or server-side processing, both
heavier than fits here; the 15s cap keeps raw files small enough
(typically a few MB) to launch without it. `components/AddStorySheet.js`
is the new "+" flow: camera photo, camera video, library photo, or
library video, all funneling into the same `createStory()` call.
`StoryViewer.js` now plays video stories with real playback progress
instead of a fixed timer, and a mute toggle.

**Not covered here**: avatar-specific upload UI (the upload function
already supports the `avatars` folder, just needs a picker button on
the profile edit screen, a five-minute add whenever you want it).

## 9. Connected: real screens, wired to everything above

`App.js` is now the real app shell — auth gate, bottom tab
navigation, and the five screens rebuilt against live Supabase data
instead of the original mockup's hardcoded arrays, in the same
visual language (colors now live in `theme.js` so every screen stays
consistent).

```bash
npx expo install expo-av
```

(needed for livestream and story video playback — everything else
was already installed in earlier steps)

| Screen | What's real now |
|---|---|
| **Feed** | Live posts, real like/unlike, real story bar + full-screen viewer (photo and video), composer posts with an optional photo, delete-your-own-post, report others' posts |
| **Explore** | Real "suggested for you" people with working follow/unfollow, real groups list, Prayer Wall opens a full real screen (submit request, anonymous toggle, tap to mark "prayed") |
| **Events** | Real CKCC events from the database, registration that actually writes a row, This Month / Upcoming filters computed from real dates |
| **Watch** | Real live status (falls back to a friendly "nothing's live" state when CKCC isn't broadcasting), real video playback via `expo-av`, **realtime** live chat — messages appear instantly across all viewers via Supabase's realtime subscription |
| **Me** | Real stats (post/follower/following counts), sign out, and — only if `is_church_admin` is true — a direct link into the Moderation Queue screen built earlier |

The Report flow is mounted once at the app root (`<ReportModal />`
in `App.js`) and triggered from anywhere via the `openReport()`
function threaded down through props — that's why `FeedScreen`
receives `openReport` and passes it into each post's
`ContentOptionsMenu`.

### What's still a placeholder

Good news — comments and avatar upload are now built:

- **`screens/CommentsScreen.js`** — real thread view, opened by
  tapping the comment count on any post. Post, delete your own,
  report others'. `lib/posts.js` gained `deleteComment()` to support
  this.
- **`screens/EditProfileScreen.js`** — real avatar upload (tap the
  photo, picks from library, uploads to the `avatars` folder,
  replaces the old file), display name, and bio, wired from `Me` →
  "Edit Profile".

Still open:

- **Groups** — Explore lists them, but there's no "create a group"
  or "group detail/chat" screen yet; `lib/social.js` has
  `createGroup()` / `joinGroup()` ready to call.
- **Push notifications** — not built (see the gap list in section 5).

## 11. Groups (create, join, leave, view members)

No new migration needed — this uses tables already in 001. New this
pass:

- **`lib/social.js`** gained `getGroupDetail()` (group info + member
  list + whether you're in it) and `leaveGroup()`.
- **`screens/CreateGroupScreen.js`** — name + description, creator
  auto-joins as leader (already handled by `createGroup()`).
- **`screens/GroupDetailScreen.js`** — info, member list with a
  crown next to leaders, Join/Leave button.
- Wired into `ExploreScreen.js`: "Start a Group" button atop the
  Groups tab, tapping any group card opens its detail screen.

**Not built**: a group-specific feed or chat. Right now a group is a
membership list, not yet a place to post *within*. If you want that,
it needs a `group_id` column on `posts` (or a separate
`group_posts` table) plus a filtered feed view — a clean follow-up
whenever you're ready.

## 12. Push Notifications (migration 005)

This is two halves, because push delivery is inherently best-effort
and you don't want your in-app notification bell to depend on it.

**Half 1 — in-app notifications (reliable).** Run
`database/005_notifications.sql`. It adds a `notifications` table
and four triggers that fire automatically: someone likes your post,
comments on it, follows you, or prays for your request. These are
plain SQL triggers — no external service involved, so they never
fail silently. `screens/NotificationsScreen.js` reads this table,
and the bell icon on the Feed screen shows a live unread dot via a
realtime subscription (`subscribeToNotifications()` in
`lib/notifications.js`).

**Half 2 — actual push delivery (best-effort).**

```bash
npx expo install expo-notifications expo-device expo-constants
```

1. `lib/notifications.js`'s `registerForPushNotifications()` runs
   automatically once someone's signed in (`App.js`), asks
   permission, and saves their Expo push token to
   `profiles.expo_push_token`. Push notifications only work on a
   physical device, not the simulator.
2. Deploy the Edge Function:
   ```bash
   supabase functions deploy send-push
   ```
3. In the Supabase Dashboard → Database → Webhooks, create a webhook
   on the `notifications` table, **Insert** event, pointing at the
   `send-push` function. Now every new notification row triggers an
   actual push to the recipient's phone.
4. For a standalone (non-Expo-Go) build, you'll also need an EAS
   project set up for push credentials — see
   [Expo's push notification setup guide](https://docs.expo.dev/push-notifications/push-notifications-setup/)
   when you get to that point; this is genuinely a "come back to
   this later" step, not something to solve today.

If step 2 or 3 never happens, nothing breaks — people just don't get
a phone notification; they still see everything in the bell icon
next time they open the app. That's why it's built this way.

## 13. App Store considerations this data model already sets you up for

- RLS means even if someone got your anon key, they can't read or
  write data they shouldn't — this satisfies Apple/Google's basic
  data-protection review questions.
- `is_anonymous` on prayer requests gives you a real answer when
  reviewers ask how you handle sensitive user content.
- Every table that needs it has `created_at`, so building a "delete
  my account and data" flow (required by both app stores) is a
  straightforward cascade delete on `auth.users`.
