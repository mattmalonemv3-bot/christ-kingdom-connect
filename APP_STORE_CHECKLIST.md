# App Store Readiness Checklist — Christ Kingdom Connect

Honest framing: the code (backend, moderation, screens) is the part
that takes the longest to build and is now largely done. Everything
below is real work too, but it's mostly configuration, assets, and
paperwork rather than engineering — a different kind of effort, not
a smaller one. Budget a few days for this even once the app itself
works.

## 1. One-time setup

- [ ] **Apple Developer Program** — $99/year, apple.com/developer.
      Takes up to 48 hours to be approved if you're enrolling as an
      organization (you'll want to, as a church) rather than an
      individual.
- [ ] **Google Play Console** — $25 one-time, play.google.com/console.
- [ ] **EAS account** (free tier is fine to start) — `npx eas login`
      after `npm install -g eas-cli`.
- [ ] Move `app.json` and `eas.json` from this `app-store/` folder to
      your actual project root — Expo expects them there, not nested.
- [ ] Run `eas init` to create a real EAS project and replace the
      `REPLACE_WITH_YOUR_EAS_PROJECT_ID` placeholder in `app.json`.

## 2. App identity & assets

- [ ] **Bundle identifier / package name** — `app.json` has
      `com.christkingdomconnect.app` as a placeholder. This must be
      unique across the entire App Store and Play Store; check
      availability before you're locked in (you can't change it after
      first submission without effectively creating a new app listing).
- [ ] **App icon** — 1024×1024px, no transparency, no rounded corners
      (both stores apply their own mask). This needs actual design
      work — a crown mark in your gold-on-black palette would be
      consistent with what's already built. I can help design this
      when you're ready; it's a distinct task from what's in this
      folder.
- [ ] **Splash screen image** — referenced in `app.json`, simple is
      better (logo centered on your `#0A0A0E` background).
- [ ] **Adaptive icon** (Android) — foreground layer only, Android
      applies the background color from `app.json`.
- [ ] **Screenshots** — required for both stores, per device size
      (iPhone 6.7", 6.5", iPad if `supportsTablet` stays true; Android
      phone + optional tablet). Easiest path: build the app, run it in
      a simulator, and screenshot the real screens once they're
      populated with realistic content — don't ship stock/empty-state
      screenshots.

## 3. Store listing content

- [ ] **App name** — "Christ Kingdom Connect" (App Store: 30 char
      limit; Play Store: 30 char limit — this fits).
- [ ] **Subtitle/short description** — one line, e.g. "Connect,
      encourage, and grow with believers everywhere."
- [ ] **Full description** — what the app does, who it's for, and
      that Christ Kingdom Community Church is the featured church.
- [ ] **Category** — Social Networking (primary candidate) or
      Lifestyle.
- [ ] **Support URL** and **support email** — required by both
      stores, and this is also your Guideline 1.2 published-contact
      requirement from the moderation work. Get a real inbox or
      contact page live before submitting, not a placeholder.
- [ ] **Privacy policy URL** — host `PRIVACY_POLICY.md` (after legal
      review) somewhere public — a simple page on your church website
      works fine. Both stores require this URL in the listing.

## 4. Age rating

Because this app has user-generated content, unmoderated user-to-user
communication (chat, comments), and no age gate, expect:

- **Apple**: likely a 12+ or 17+ rating depending on how you answer
  Apple's UGC questionnaire during submission — answer honestly based
  on what's actually possible in the app (any UGC content type pushes
  the floor up regardless of your actual community's tone).
- **Google Play**: complete the **Data Safety** form and the content
  rating questionnaire (IARC) — both ask directly about
  user-generated content and in-app communication.

This is a "does not block moderate readiness" item, but it does mean
don't market this as suitable for young children — the mechanism for
strangers to message/comment openly is what drives the rating up,
regardless of your community's actual character.

## 5. Data safety / privacy nutrition labels

Both stores now require you to declare, in their dashboards (not just
your privacy policy), exactly what data you collect and why. Base
your answers on the actual schema:

| Data type | Collected? | Purpose |
|---|---|---|
| Email address | Yes | Account creation |
| Name / username | Yes | Profile, identifies you to others |
| Photos/videos | Yes | Posts, stories, avatar |
| User content (posts, comments) | Yes | Core app function |
| Precise location | No | — |
| Contacts | No | — |
| Financial info | No | — |
| Device ID / push token | Yes | Push notifications |

Apple: App Store Connect → App Privacy. Google: Play Console → App
Content → Data Safety. Fill both out truthfully — this is one of the
most common rejection reasons, and mismatches between your declared
data use and what the app actually does get caught in review.

## 6. Guideline 1.2 (UGC) compliance — status check

Already built, from earlier work in this project:

- [x] Content filter (pre-submit word blocklist)
- [x] Report mechanism on every content type
- [x] Block functionality
- [x] Ability to eject users (suspend/ban, enforced at the database level)
- [ ] **Published contact info** — needs a real URL/email live before
      submission (see section 3)
- [ ] **Community Guidelines page** — `COMMUNITY_GUIDELINES.md` is
      drafted; host it publicly alongside your privacy policy

## 7. Build & submit

```bash
# Development build to test on your own device first
eas build --profile development --platform ios
eas build --profile development --platform android

# Preview build for TestFlight / internal testing track
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all

# Submit to both stores (after filling in the placeholders in eas.json)
eas submit --platform ios
eas submit --platform android
```

For iOS specifically: submitting creates a build in App Store
Connect, but you still manually fill in the listing (screenshots,
description, age rating, privacy) and hit "Submit for Review" there
— `eas submit` doesn't do that last step for you.

## 8. Before you hit submit — final honesty pass

Things that will get you rejected if you submit today without
addressing them:

- **Livestream video** — `streams.playback_url` is a placeholder
  field until you pick an actual streaming provider (Mux, AWS IVS,
  YouTube Live embed). An app that advertises live streaming but has
  no working stream will fail review.
- **Empty states** — if you submit with zero real posts/events/
  sermons in the database, reviewers may see the same "No posts yet"
  screens from your original mockup. Seed some real content first.
- **Test account** — both stores' reviewers need a way to sign in.
  Provide a demo account's email/password in the App Store Connect
  / Play Console review notes.
- **Contact info and Community Guidelines actually live** — not just
  drafted in this folder.

## 9. What's not covered here

- Legal review of the privacy policy and terms of service
- App icon / splash screen graphic design
- Choosing and integrating a video streaming provider
- Apple Developer Program enrollment as an organization (requires a
  D-U-N-S number for the church, which can take time to obtain if
  you don't already have one — check this early, it's often the
  longest lead-time item in this whole checklist)
