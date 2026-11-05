# CLAUDE.md

> **The app is called Pinged** (the owner's rebrand, 2026-10-31). Every
> user-facing string says Pinged; the repository, the package id
> (`com.nomicoprod.gamelog`), the Expo slug, the deep-link scheme, query keys
> like `'gamelog'`, the `GameLog` row type and the many "GameLog" in these notes
> are the old name and were left alone on purpose — changing the package id
> would install a second app, and changing the scheme would break sign-in
> redirects. See § Pinged.

Working notes for AI agents (and humans) in this repo. For what the product *is*
and where it is going, read [PROJECT.md](PROJECT.md). For how it should **look**
— tokens, type scale, surfaces, the game case — read [DESIGN.md](DESIGN.md); its
YAML frontmatter mirrors `src/constants/theme.ts` and is the normative layer.
The conventions below are the code-level rules that follow from it.

> **One design system, and DESIGN.md is it.** For a period this file pointed at
> a light, boxy, 2010-era spec ("Social Playback") that the app never
> implemented — its `scheme` was `light-only` against a hard-coded dark
> `APP_SCHEME`, and 17 of the 18 token names the two shared held different
> values. Anyone following the pointer built for the wrong app. That spec is
> archived, unimplemented, at
> [DESIGN_SOCIAL_PLAYBACK.md](DESIGN_SOCIAL_PLAYBACK.md); it is a record of a
> direction that was considered, and nothing in it describes this codebase.

## Expo SDK 57 has changed — check the docs

This project is on **Expo SDK 57 / React Native 0.86 / React 19.2**, which is
newer than most training data. Before writing navigation, routing or Expo-module
code, check the versioned docs: https://docs.expo.dev/versions/v57.0.0/

Things that are genuinely different from older tutorials:

- `ThemeProvider`, `DarkTheme`, `DefaultTheme` come from `expo-router`, **not**
  `@react-navigation/native`.
- Route protection uses `<Stack.Protected guard={...}>`, not a redirect effect.
- `StyleSheet.absoluteFillObject` is gone from the RN types. Write the four
  offsets out, or use `StyleSheet.absoluteFill`.
- Routes live in `src/app/`, not a top-level `app/`.

## Commands

```bash
npm start          # Expo dev server (scan the QR code with Expo Go)
npm run android    # dev server targeting an Android device/emulator
npm run web        # browser — see the Steam/CORS caveat below
npx tsc --noEmit   # typecheck
npx eslint src     # lint
npx prettier --write "src/**/*.{ts,tsx}"
npm test           # node:test — pure modules only: the M3 scheme generator, the
                   # genre reach order, barcodes, progress choices, review filters,
                   # the report reasons against 0031's CHECKs, the Commons
                   # logo licence check, SimpMusic's scrim ramp (lib/scrim),
                   # the PNG decoder (against
                   # Node's zlib and a real Commons thumbnail), the RSS
                   # lightening (parsed before and after, field for field),
                   # the pager's page numbers and the count-by-probing search,
                   # the release calendar's months and date precision, game
                   # sorting, the legal pages against their text
                   # (constants/legal), "Games for you"'s rounds — seeds drawn by
                   # score, no repeats (lib/games/recommend-rules), the game
                   # labels against 0034's CHECK, how a
                   # logo is drawn from its pixels (lib/logo-ink), what the
                   # saved query cache keeps and evicts (lib/query-persist-rules),
                   # the seen-records store (lib/seen), the "12h ago" time
                   # (lib/format), the card's colour against the page, the
                   # inks on it, the whole surface ladder's climb and that
                   # every card has the review card's corner
                   # (constants/review-card), Search's Top 1000 — its
                   # length, its pages of twenty, what a score is made of
                   # (lib/top-chart), and
                   # the copy showcase: its camera against the projection it
                   # stands in for, the idle turn and the lamp
                   # (lib/stage-geometry), how large a case stands, how deep it
                   # is, its disc's size and which cases open
                   # (constants/copy-stage), the 1080p cover
                   # (lib/games/sharp-cover), the SoundCloud matcher
                   # (lib/soundcloud/match.test, which loads the Edge
                   # Function's own _shared/soundcloud-match.ts), which song
                   # Surprise Me picks and how long a soundtrack runs
                   # (lib/soundtrack-pick), which of a game's images is its
                   # hero, against IGDB's real records (lib/games/hero-art),
                   # the player's arithmetic and
                   # the routes the mini player stays off, read against the
                   # root layout and the route files (lib/player-queue), and
                   # the game page's masthead: its cover's size, the hero's
                   # dissolve and where the row sits in it, the cover's halo
                   # and the synopsis's fade, each against the reference it
                   # was measured from (constants/game-masthead), the profile's margin, face
                   # and four-cover rows (constants/profile-layout), a row of
                   # covers — the cover's size and how many are in view,
                   # against the reference (constants/cover-rail),
                   # Search's slider — its parallax, that the art always
                   # covers its card (constants/search-spotlight),
                   # which games the slider opens on and what each says
                   # about its date (lib/games/spotlight), and the top bar:
                   # its size against Material 3's, the frost, how far the
                   # glass discs go with the page, where the bar comes in
                   # after the artwork, and Home's fold (constants/top-bar),
                   # and which drawing stands for a score, against the five
                   # scores the owner named and the files on disk
                   # (constants/score-figure), and discovery: which language
                   # a review is written in, against sentences in every
                   # language it names and several it does not, and which
                   # languages a reader reads (lib/language); a chart's
                   # periods, why somebody is in one, which review a game
                   # leads with — and that 0038 creates the functions the
                   # app calls, by the names it calls them (lib/discovery),
                   # and the poster screens: onboarding's rules — who still
                   # has to be onboarded (read against 0001's trigger), what
                   # a handle may be, the typing's rhythm, which steps show,
                   # what IGDB is asked for the last page (lib/onboarding);
                   # every poster ink at AA and the seven progress pills'
                   # colours and grid (constants/poster, constants/progress);
                   # and where an event is in its life (lib/event-phase);
                   # where a game is sold — IGDB's store links and which
                   # ITAD price goes with which store, against IGDB's real
                   # records (lib/games/storefronts) — and its Steam page:
                   # the Awards section and the events, read by the Edge
                   # Function's own _shared/steam-store.ts out of real page
                   # excerpts (lib/games/steam-store.test); and a game's
                   # genres, themes, engines… as ways to more games — the
                   # clause each is asked by, the fixed vocabularies, name
                   # matching (lib/games/facets); and a review in one
                   # sentence — its lines and marks, the closing mark always
                   # at the far right of the last line (lib/quote-layout), its
                   # length against Inter's own advance widths on Surprise
                   # Me's card, which half a card shows, 0040's CHECK
                   # (lib/review-quote), where the drawn marks stand against
                   # the words (constants/pull-quote), the share cards' inks
                   # on every swatch and what its eight lines hold
                   # (constants/share-card), and the share sheet's
                   # highlighter — words laid out, a finger to a word, a
                   # pick's lines on the card, dragging an end to the card's
                   # limit (lib/review-highlight); and a review's own
                   # page — every line of it and its composer against the
                   # owner's phone screenshot (constants/review-page) and
                   # how a run is said in a
                   # sentence (lib/review-details); and the community score
                   # — entropy, leave-one-out deviation, the percentile, the
                   # weight and its ramp, the weighted mean and its range,
                   # new members, inactivity, no review bonus, and that 0041
                   # holds the same parameters (lib/community-rating), and the
                   # breakdown's weighted groups (lib/review-facets), and
                   # animated covers — which file of a SteamGridDB grid each
                   # platform plays (the full animation before the preview),
                   # the size cap, IGDB's shapes and its WebP
                   # (lib/animated-cover) — no joke grids, the most liked
                   # first, and which file a phone falls back to when one will
                   # not play (pickPlayable); the rating graph's eleven rows,
                   # their colours and which are drawn (lib/rating-distribution); Surprise
                   # Me's card — its shape, still
                   # or animated, and what is fetched ahead within a byte
                   # budget (lib/surprise-prefetch); and how tall a
                   # collection's and a review's header art is
                   # (constants/header-art); Home's glow — its tone, the 25°
                   # line, the eased stops (lib/home-glow) — and its moods:
                   # the vocabulary, the floor, the shelves' dedupe, Quick
                   # picks and the studio pick (lib/games/moods) and a
                   # genre's shelves and the clock in them
                   # (lib/games/genre-feed); RAWG's tags matched onto IGDB's
                   # games (lib/games/rawg-match); Home's "Games for you" —
                   # BitChord's lead shelf: a card's width, its height, the
                   # step it snaps by (constants/discover-carousel); a mood's and a genre's
                   # block at the foot of Home — the reference's measurements,
                   # the gradient from the item's own hue, and the name white
                   # at AA on all ten of them, with every name measured
                   # against Poppins' own advance widths
                   # (constants/mood-tile); and a copy's art — GameTDB's
                   # title lists and regions, a sleeve's back, ScreenScraper's
                   # answers, image sizes (lib/copy-art, which loads the Edge
                   # Function's own _shared/copy-art.ts); and the pinned
                   # hero's scroll — its drift, its blur whole as the title
                   # reaches the top, its drain, its stretch, a shelf
                   # arriving (lib/scroll-motion), and its row-by-row blur —
                   # Convx's curve and its shader, compiled in CanvasKit
                   # (lib/progressive-blur); and the cover viewer's
                   # page — SimpMusic's Apple Music mesh from the cover's
                   # pixels, its blur, its seam, its washes (lib/artwork-mesh);
                   # and the copy stage in 3D — each format's track pitch and
                   # whether it shows a rainbow head on, the disc's rings, a
                   # PlayStation disc's black plastic, the shaders' Fresnel
                   # against the plastics' indices, the studio's light on a
                   # printed face, the rock, and the 3D camera against the
                   # flat stage's own arithmetic, and the globals three.js
                   # is lent on Hermes (lib/copy-scene); and Pings — every
                   # vocabulary and limit against 0046's text, what counts as
                   # played, the familiarity line, the cursor, suggestions by
                   # game, and that every ping opens a route (lib/pings);
                   # and Apple TV's pages — the cover's height and the words
                   # placed so the Log pill is where the blur begins
                   # (constants/game-header), Explore's hero and its
                   # big cards (constants/explore), and Explore's portraits
                   # (lib/games/spotlight)

node scripts/discovery-sql.mjs   # 0038's functions on a real Postgres
                   # (PGlite, in-process) over every migration, with seven
                   # people who do known things. Needs PGlite, which is not
                   # a dependency: npm install --no-save @electric-sql/pglite
node scripts/community-rating-sql.mjs   # 0041 on PGlite, over ratings
                   # given before it ran: every weight and score against the
                   # TypeScript reference, the triggers, RLS, retries, the
                   # large-app path. Same PGlite as above
node scripts/account-safety-sql.mjs   # 0045 on PGlite: blocking both
                   # ways, the new reports, and an account deleted with no
                   # uuid column anywhere still naming it. Same PGlite
node scripts/pings-sql.mjs   # 0046 on PGlite: who may ping whom, the
                   # For You tiers and their cursor walked a row at a time,
                   # the counts and guards on suggestions, blocks, reports,
                   # and a deleted account leaving nothing. Same PGlite
node scripts/favourites-sql.mjs   # 0047 on PGlite: Favourites holds ten,
                   # Favourites and the wishlist can be emptied and not deleted,
                   # and a deleted account still takes both. Same PGlite
node --import ./scripts/esm-register.mjs scripts/legal-pages.mjs
                   # writes public/legal/*.html from constants/legal.ts
node scripts/community-rating-report.mjs [--out f.md]   # a read-only dry
                   # run over the LIVE ratings (anon key from .env): who
                   # would be adjusted, which games move, a sensitivity sweep
```

`npm test` runs the `*.test.ts` files under plain Node, so a module under test
may only import neighbours by **relative** path (`scripts/esm-extensionless.mjs`
resolves an extensionless `./x` to `x.ts`, as Metro does; nothing resolves `@/`),
and nothing it imports may reach React Native or `constants/platform-cases.ts`,
which `require()`s the case artwork. That is why `lib/review-facets.ts` takes the
platform-family resolver as an argument instead of importing it.

Node is a portable install at `~/.local/node-v24.18.0-linux-x64/bin`, already on
PATH via `~/.profile`. SDK 57 needs Node ≥ 22.13.

## Setup that is not optional

1. `cp .env.example .env` and fill in the Supabase URL + anon key.
   `src/lib/supabase.ts` throws a clear error at import time if these are
   missing, so the app will not start without them.
2. Run every migration in `supabase/migrations/` in order, in the Supabase SQL
   editor. Nothing works before this: there are no tables and every query 404s.
   `0001`–`0011` are already applied to the current project; `0012` onwards are
   not — without `0013` the Reviews/Collections/People tabs 404 on their RPCs
   and collections cannot be liked, without `0015`+`0016` an Award show
   cannot be created at all, and without `0018` posting a comment on a
   collection fails the CHECK on `comments.target_type`.
   `0022`–`0026` are progress, physical copies, community similarity and review
   stats. The log form writes `completion` and `coop`, so **without `0023` no log
   can be saved at all**; without `0024` scanning and copies fail, without `0025`
   the Similar tab's community section errors, and without `0026` the reviews
   sheet loses its breakdown and its platform filter. `0028` is the library's
   stats: without it the profile's digital / physical line never appears and the
   head of a library says its stats did not load. `0031` is reports on
   suggestions and reviews: without it the report form fails for those two (a
   pick still reports, through 0025) and the moderation queue's Suggestions and
   Reviews tabs error. **Run `0032` straight after it**: 0031 alone makes every
   query that embeds a log's author fail (PGRST201 — see the gotcha on join
   tables), which is every list of reviews in the app. `0033` added
   `lists.cover_style` — four covers or one — and **the app no longer reads or
   writes it** (the mosaic it chose was removed), so nothing depends on it
   having run. `0034` is
   labels on games — Must Play: without it no cover wears the badge, the Must
   Play list says the migration is missing, and a moderator's toggle fails with
   the same sentence. `0035` is the OpenCritic answer cache and is optional —
   see step 7. `0036` is SoundCloud — see step 8, and **read its header before
   running it: it deletes every starred song and drops `game_soundtracks`**.
   `0037` is "Beloved by the community" — one function, `beloved_games`, and
   nothing else: without it that one row is absent from Search's Discover and
   nothing errors. The app is on SoundCloud's shape already, so until 0036 runs
   a star cannot
   be saved (the old table still requires a title and an artist).
   `0038` is discovery — a column (`logs.review_lang`), three functions and
   three indexes; it drops nothing and is safe to re-run. **Nothing breaks
   without it**, by design: Search's Reviews and People tabs are what they
   were (every like there has ever been, no period control, no friends
   section), reviews are saved without a language, and no chart is narrowed by
   one. See § Discovery.
   `0039` is the Steam store page cache and is optional — see step 9.
   `0040` is a review's one sentence: one column, `logs.review_display`
   ('text' or 'quote', what its cards show), and nothing dropped. **Nothing
   breaks without it**: `saveLog` reads the PGRST204 and saves without the
   column, and every card shows the review's text as before — the log form
   says so under the choice. See § A review in one sentence.
   `0041` is the weighted community score: three derived tables, the
   triggers that keep them current, and `game_review_stats` / `beloved_games`
   redefined weighted. It reads `logs` and writes nothing canonical, and
   weights every existing rating as it runs. **Nothing breaks without it**:
   `getRatingBreakdown` reads the PGRST205 and shows the plain mean, worked
   out on the phone as before. See § The community score.
   `0006`, `0015`, `0019` and `0022` each add an enum value and must run
   **alone** — see the notes in those files.
   Moderators are rows in `public.moderators`, which no client can write; make
   one in the SQL editor with
   `insert into public.moderators (user_id) select id from public.profiles where username = '…';`
3. Env vars are **inlined at build time**. After editing `.env`, restart with
   `npx expo start --clear` — a hot reload will not pick up the change.
4. Deploy the IGDB Edge Function — it is now the app's **only** game source, so
   nothing game-shaped works without it:
   `supabase secrets set TWITCH_CLIENT_ID=… TWITCH_CLIENT_SECRET=…` then
   `supabase functions deploy igdb`. `EXPO_PUBLIC_IGDB_ENABLED=false` no longer
   degrades search to other providers — it disables search. **Redeploy it after
   pulling a change to its allowlist**: `games/count` is the newest entry, and
   until the deployed function has it a platform's page counts its games with
   a dozen small requests instead of one (it still works — see § Search).
5. Optional: deploy the ITAD Edge Function for storefront prices —
   `supabase secrets set ITAD_API_KEY=…` then `supabase functions deploy itad`.
   Only the **API key** is used; ITAD's OAuth client id and secret are for
   user-scoped endpoints this app does not call. See
   `supabase/functions/README.md`. Without it the game page's "Where to buy"
   still lists the official stores IGDB links the game to, without prices.
6. Optional: deploy the ScanDex Edge Function so a scan identifies boxes nobody
   has added yet — run migration `0027`, then
   `supabase secrets set SCANDEX_API_TOKEN=…` and
   `supabase functions deploy scandex`. The token is the one on your ScanDex
   developer account, pasted as issued (no `Bearer `). Without it, scanning
   still works against Gamelog's own releases and ends at "unknown" otherwise.
7. Optional: deploy the OpenCritic Edge Function for the game page's **Critic
   reviews** rail — `supabase secrets set OPENCRITIC_API_KEY=…` (a RapidAPI
   key for OpenCritic's listing) then `supabase functions deploy opencritic`,
   and run migration `0035`. Without the function the rail is absent; with a
   deployment older than the rail (scores, no snippets) it is also absent,
   because it has nothing to quote. Without `0035` it works and asks OpenCritic
   every time — three upstream requests per game against a quota metered per
   day — so run it.
8. Optional: deploy the SoundCloud Edge Function for soundtracks —
   `supabase secrets set SOUNDCLOUD_CLIENT_ID=… SOUNDCLOUD_CLIENT_SECRET=…`,
   `supabase functions deploy soundcloud`, and run migration `0036`. **The
   project had no SoundCloud credentials when this was built**, so nothing in
   it has run against the live API: without the function, or without its
   secrets, the Soundtrack tab, the soundtrack screen and Surprise Me say that
   soundtracks are not connected yet, and nothing breaks.
   `supabase/functions/README.md` lists the five things to check on the first
   run with keys. `EXPO_PUBLIC_SOUNDCLOUD_FIXTURE=true` shows a sample
   soundtrack in a dev build, so the screens can be seen before then.
9. Optional: deploy the Steam store Edge Function for the game page's
   **Awards** card and its **Events & announcements** rail —
   `supabase functions deploy steam-store`, and run migration `0039`. No
   secrets: both are public Steam pages. Without the function both sections
   are simply absent; without `0039` it works and fetches Steam's page on
   every request. See § Where to buy, awards and Steam news.
10. Optional: a physical copy's real back cover and disc label — run migration
   `0042`, then `supabase functions deploy copy-art`. GameTDB needs no keys;
   for ScreenScraper as well, `supabase secrets set SCREENSCRAPER_DEV_ID=…
   SCREENSCRAPER_DEV_PASSWORD=…`. Without them a copy draws its own back and
   the box-art disc. See § A copy's back cover and disc.
11. Optional: RAWG's tags — a free key from rawg.io/apidocs in `.env` as
   `EXPO_PUBLIC_RAWG_API_KEY`, then restart with `--clear`. Without it no tag
   control is shown. See § RAWG tags.
12. Store release: blocking, reports on comments / wall posts / profiles, and
   account deletion — run migration `0045`. Without it Block says the update
   is missing, the new report kinds say nothing was sent, the moderation tab
   says it is not set up, and Delete account sends people to the contact
   email. Check it with `node scripts/account-safety-sql.mjs`. Before
   publishing, set `LEGAL_CONTACT_EMAIL` in `src/constants/legal.ts`, run
   `node --import ./scripts/esm-register.mjs scripts/legal-pages.mjs`, host
   `public/legal/`, and give Play the URLs of `privacy.html` and
   `delete-account.html`. See § Store-release compliance.
13. Pinned games — run migration `0043`. Without it a library has no pins
   and pinning says the migration is missing; nothing else breaks. See § The
   library.
14. PlayStation, Xbox and GOG by username — run migration `0044`, then
   `supabase functions deploy game-accounts`. GOG needs nothing else. For
   PlayStation, `supabase secrets set PSN_NPSSO=…` (the NPSSO cookie of an
   account the project owns: sign in at playstation.com, then open
   https://ca.account.sony.com/api/v1/ssocookie); for Xbox,
   `supabase secrets set OPENXBL_API_KEY=…` (xbl.io, free tier 150 requests an
   hour). Without a service's secret its Connect says it is not connected yet.
   See § Linked gaming accounts.
15. Pings — run migration `0046`. It adds one enum value
   (`notification_kind.ping_suggestion`) used only inside a trigger body, so it
   runs whole, as 0005 does. Without it the Pings tab, a request's page, the
   send sheet and Settings → Pings each say pings arrive with the next update,
   the inbox's Pings tab is empty, and nothing else breaks. Check it with
   `node scripts/pings-sql.mjs`. See § Pinged.
16. A Top 10 — run migration `0047`. Two triggers: Favourites refuses an
   eleventh game, and Favourites and the wishlist refuse a DELETE sent
   directly (a cascade from a deleted account passes). Nothing breaks
   without it — the app checks the ten itself and hides Delete on both.
   Check it with `node scripts/favourites-sql.mjs`. See § reacticx, second
   batch.

## Adding a route

Typed routes are generated into `.expo/types/router.d.ts` **by the dev server**,
not by `expo export`. A brand-new route file will fail typecheck until you run
`npx expo start` once. This is expected, not a bug in your code.

## Architecture

```
src/
  app/               Expo Router routes (file = route)
    (tabs)/          home, explore, pings, profile — and search, drawn as its
                     own round key beside the bar's pill (§ Apple TV)
    ping/[id]        one request to the community: what was asked, its games,
                     every suggestion grouped by game; the owner's controls
    new-ping         ask the community, or ?edit= a request (modal)
    suggest-game/[id]  answer a request: pick a game, say why (modal)
    send-ping        ping something to people — every Ping button opens it
                     (?kind=&target=&title=&subtitle=&image=) (modal)
    news             News and Events, opened from Home's two sections
    notifications    the inbox behind Home's bell: Pings, then Notifications
    game/[id]        a game's page: the cover pinned, Apple TV's words on its
                     foot, three tabs, an Overview without cards (§ Apple TV)
    log/[id]         create/edit a log (modal)
    achievements/[id]  per-game achievement list
    list/[id]        a list / tier list / award show
    add-to-list/[id]   pick a game to add to that list (modal)
    award-game/[id]    pick the winner of one award (modal)
    award-edit/[id]    name an award, or say why it won (modal)
    comments/[type]/[id]  comment thread for a post or log
    game-stats/[user]/[game]  one person's record of one game — their log plus
                     Steam's measured playtime. Opened from a library cover or a
                     profile's Steam rail, never from the game page
    playthroughs/[game]  your runs of one game; playthrough/[id] edits one (modal)
    library/[id]     a person's games. No ?tab= is Apple Music's Library:
                     pinned games, rows (Logged, Favourites, Backlog, Physical,
                     then Steam, PlayStation, Xbox and GOG when linked),
                     Recently added. ?tab= is one list on
                     its own page — Physical is Cover Flow (§ The library).
                     Its grids are four across, one line under each — the
                     one screen whose covers are
    pin-game         pick a game to pin to your library (modal, 0043)
    copies/[user]    a physical collection as a plain list; copy/[id] one copy
                     on a stage of its own — its case as a box that turns by
                     itself and by hand, is opened, and has its disc taken out,
                     under a lamp the phone's tilt moves — then the game's
                     name, the owner's notes as a field, and their review of
                     the game; add-copy the copy form (modal)
    scan             barcode camera (full-screen modal), with typed entry as the
                     fallback for a denied or missing camera
    add-release      submit or edit a barcode's release claim (modal)
    submissions      your release claims and what became of them
    moderation       moderators only: release claims, and reports on picks,
                     suggestions and reviews
    suggest-similar/[id]  recommend a game like this one, with reasons (modal)
    similar/[id]     one community pick (?game= the side you came from): agree
                     or disagree, and every suggestion behind it, upvotable
    report/[kind]/[id]  report a pick, a suggestion (?author=), a review,
                     or (0045, ?author=) a comment, a wall post or a profile
                     (modal). Every `<ReportFlag>` in the app opens it
    blocked          the people you blocked, with Unblock (0045)
    delete-account   deleting your account, the username typed to confirm
    legal/[doc]      privacy, terms, delete-account — the same text as
                     public/legal/*.html; open signed out
    profile/[id]     someone else's profile
    new-list, edit-list/[id], edit-profile (modals)
    settings         game colours (a game's screens in its box art's Material
                     3 colours, or the app's own), animated artwork (covers
                     that move by themselves, or still), physical copies in
                     3D or flat (where the build can draw 3D), review
                     languages, how
                     ratings work, the games hidden from Surprise Me, a link
                     to the moderation queue for moderators, and Sign out.
                     Opened from
                     the profile tab's bar. It was deliberately empty for a long
                     time and the argument in its docblock still stands —
                     nothing goes here until it works
    how-ratings-work how the GameLog score is weighted, the reader's own
                     weight and why, and — for moderators — the weighting
                     across the app in aggregate. From the reviews sheet and
                     Settings. See § The community score
    ratings/[id]     everyone who gave a game a score — with a review or a log
                     alone — twenty to a page, newest or by score; a row opens
                     the review, or that person's record of the game. From the
                     reviews sheet, under the GameLog score (?title= the
                     heading, so it is there at once)
    quick-log        the profile's +: pick a game, then ?mode=review replaces
                     this with the log form and ?mode=log raises the game
                     page's progress sheet over it (modal)
    surprise         Surprise Me: one dealt game, one song from it
    now-playing      the music full screen, opened from the mini player (modal)
    studio-games/[id]  every game a studio made, three across, sorted — its
                     page's "All games ›"
    platform/[id]    every game on one platform, ten to a page, with the pager
                     over them. Opened from Search's Platforms
    event/[id]       one showcase or award show, laid out as the owner's race
                     reference: the art, the name, where it streams and a
                     phase tag, then the date, the start and how many are
                     watching in bigger type, the faces, and the games shown
                     — only once it is over. Its one action is pinned to the
                     foot. Opened from News's Events. See § The poster screens
    top-chart        the Top 1000 (GameLog's or the critics'), twenty to a
                     page — from Discover's button. See § Search
    calendar         a year of releases, a month at a time: five rows of
                     numbered days, then the month's games as covers — or a
                     chosen day's as a list. Top releases behind today, most
                     anticipated ahead of it. Opened from the Calendar
                     button at the top of Search
    must-play        every game a moderator has labelled Must Play (0034); the
                     badge's cell in a game's stats strip opens it. Moderators
                     add from here (label-games, a modal) and hold a cover to
                     take the label off
    soundtrack/[id]  a game's soundtrack from SoundCloud ([id] is the *game's*
                     id): the disc, whose upload it is, every track, and the
                     player docked at its foot. Opened by "Listen" on the game
                     page's Soundtrack tab, a song in Surprise Me, and the mini
                     player. See § Soundtracks
    welcome          signed out: the typed pitch, the email, the password (log
                     in, or make an account), "check your inbox" — one route,
                     the owner's onboarding reference. Replaced the old
                     welcome carousel, sign-in-options, sign-in and sign-up
    onboarding       signed in and not onboarded: fourteen steps at most, from
                     a name to six games to start with — game colours and
                     animated artwork asked over real examples among them. The root layout routes
                     here and nowhere else until it is done. See § The poster
                     screens
  components/        shared UI; components/ui/ is the primitive layer
                     ui/frosted-top-bar the top bar — SimpMusic's: a 64dp row
                                        (chevron, the page's name, its controls)
                                        that is clear at the top of a page and
                                        frost once it scrolls; over artwork,
                                        glass discs that leave with the art and
                                        a bar that comes in after it.
                                        `<FoldingTopBar>` is Home's. See § The
                                        top bar
                     ui/shimmer         `<Shimmer>`: SimpMusic's
                                        `Modifier.shimmer()` — a flat fill
                                        with one soft light sweeping it, a
                                        Reanimated CSS animation on the UI
                                        thread. `<Skeleton>` (ui/surface) is
                                        this, so every placeholder in the app
                                        wears it. See § Loading
                     ui/arrive          `<Arrive>`: a band that has loaded
                                        rising into its skeleton's place
                                        (SimpMusic's `AnimatedVisibility`,
                                        300ms), and `stagger` for a run of
                                        them. See § Loading
                     ui/artwork-mesh-page  SimpMusic's Apple Music page
                                        under the cover viewer: the cover's
                                        blurred mesh hung from its foot. See
                                        § Animated covers
                     ui/pinned-hero     the hero of a game's, a studio's and
                                        a collection's page: pinned behind
                                        the page as `<Screen backdrop>`,
                                        nearly still, blurring and draining
                                        into the page's M3 colour as the page
                                        slides over it — and `<PageFill>`,
                                        `MASTHEAD_FADE`. See § One colour
                                        method
                     ui/screen          `<Screen>`: the page shell
                     ui/reveal          `<Reveal>`: a shelf rising into place
                                        as it scrolls into view, inside a
                                        `<RevealScope>` only. `<Section>`,
                                        `<HomeSection>` and `<Panel>` are built
                                        on it
                     ui/page-scroll     `<PageScrollView>`, `<PageFlatList>`,
                                        `<PageSectionList>`: a page's main
                                        scroller, which is how its bar learns
                                        the page moved. A pushed screen that
                                        scrolls uses one
                     app-tab-bar        the bottom navigation: expo-glass-tabs'
                                        floating glass bar (Home, Explore, Pings,
                                        Profile; Search a round glass key of
                                        its own beside it, Apple TV's) — a
                                        sliding highlight, scrub,
                                        minimized on scroll — floating over the
                                        page (§ reacticx and glass tabs). Tab screens pad their
                                        scroll content by `useTabBarClearance()`
                                        — a new tab screen must too
                     game-overview      the game page's Overview, the
                                        community's half in Apple's layouts:
                                        Ratings & Reviews (score, graph, a
                                        rail of reviews) and Played by as faces
                     game-header        the game page's header words: name,
                                        genres, the Log pill and ⋯ menus, the
                                        synopsis with MORE, the facts line,
                                        "Developed by"
                     game-information   Apple TV's Information box: the one
                                        filled block on the game page
                     explore/           Explore's hero (the Store screen's,
                                        a carousel of portraits) and its big
                                        cards (Home's "Severance" block)
                     search/search-browse  the Search tab at rest: two-across
                                        landscape tiles
                     award-show / award-slot  an award ballot, and one row of it
                     game-filter-bar    genre / platform / studio / year pills
                     game-lineage       original game / editions & extras
                     game-insights      the head of a game's Overview — the
                                        Ratings card, "On GameLog" (how many
                                        wishlisted / are playing / played it),
                                        the two Played by squares, the most
                                        liked review. (Time to beat was a card
                                        here; the owner had it removed)
                     game-awards        the Awards card: the publisher's graphic
                                        from the Steam page's Awards section,
                                        and the Steam Awards it won
                     steam-events       the Steam page's recent events and
                                        announcements, as a rail
                     score-summary      GameLog's verdict on a game: the word,
                                        the score as its drawing and number,
                                        the rating graph. The Ratings card's
                                        and the reviews sheet's, one component
                     rating-distribution  the rating graph: a row for 100 and
                                        each ten below it, a bar as long as
                                        its count, in the score ramp — a
                                        game's (the summary) and a person's
                                        (ratings-widget, on their profile)
                     review-breakdown   the sheet's averages by how people
                                        played, as rows of score bars
                     ui/cover-fan       three covers fanned — Surprise Me's
                                        way in, and the Top 1000's
                     search/top-chart-entry  Discover's button to the Top
                                        1000: its top three, fanned
                     score-method-note  "How the GameLog score works ›", under
                                        the sheet's summary
                     ui/score-figure    a score as a drawing: a little man and
                                        his gaming chair, in five states. Drawn
                                        in the ratings graph (with the number,
                                        `<FiguredScore>`) and on a review's own
                                        page, and nowhere else. See § Score
                                        figures
                     member-review-card a member's review on a game's own
                                        screens: face, name, score and replies,
                                        the words, the likes. The Overview's
                                        card, every row of the reviews sheet,
                                        and Surprise Me's (three lines, through
                                        top-review-card)
                     ui/card-material   every card's material, the review
                                        card's: `useCardMaterial()` (the fill —
                                        `surface`, or the game's dark tone on a
                                        game's page — and the hairline),
                                        `cardShape`, `CARD_INSET`, `CARD_GAP`.
                                        See § Review cards
                     ui/panel           a small card that titles itself — the
                                        Ratings card and the two Played by
                                        squares on a game's Overview. Never a
                                        row of games; see § Conventions
                     critic-reviews     what the critics wrote, from OpenCritic:
                                        the section at the head of the reviews
                                        sheet (it was a rail on the Overview)
                     game-rail          `<GameCoverRail>`: small covers in a
                                        row, nothing under them unless it is
                                        data. `<CoverRail>` is the generic one
                     activity-rail      Home's "New from friends": covers with
                                        a face, a name and a score under each
                     game-details-sheet the full IGDB record, behind a button
                     add-to-collection  pick which collection a game joins
                     store-prices       where to buy: IGDB's official stores,
                                        priced by IsThereAnyDeal where it can,
                                        then ITAD's other shops; folded to the
                                        first three, official first, under
                                        "Show all"
                     ui/soft-glow       a radial glow — a native CSS gradient,
                                        no Skia; Surprise Me's bloom and edges
                     list-tile          a collection in a list: a mosaic of
                                        four covers, its name, "12 GAMES" and
                                        "BY ADA", a hairline to the next
                                        (`<CollectionSeparator>`)
                     profile-section    `<ProfileWidget>`: a hairline, a small
                                        heading and its content — the profile's
                                        favourites, games and pinned song. Not
                                        a card
                     reply-composer     the reply field docked at the foot of
                                        a review's page: bold, italic, the
                                        count against 500, send
                     profile-actions    the profile head's actions: the big
                                        white pill (Follow; Edit profile in
                                        grey) and the glyph keys beside it
                     library-home       the head of a library (§ The library)
                     home/              Home's SimpMusic parts: discover-carousel
                                        (Games for you as BitChord's lead
                                        shelf), home-header
                                        (All / Mood / Genre chips, Create,
                                        the bell), mood-chips,
                                        home-glow (the first block's glow),
                                        mood-feed (a mood's lead shelf and
                                        the rest), quick-picks, mood-tiles
                                        ("Let's pick a mood for you": the
                                        moods and genres as the reference's
                                        search-screen blocks — a gradient of
                                        the item's hue with a game's cover
                                        tilted into the corner),
                                        band-error. See § Home
                     ui/anchored-menu   a menu dropped from its trigger, in
                                        a Modal: Home's avatar and Create
                     surprise-card-art  a dealt card's art: square or portrait,
                                        still or animated (`chooseCardShape`),
                                        kept in the shape it was first drawn
                     surprise-bloom / -page-wash
                                        the room's light behind the card and
                                        the page's colour transition. The art
                                        is a plain pager (DESIGN.md § 4.2);
                                        that screen only
                     ui/square-art / ui/round-action / ui/marquee-text
                                        the square cover, the round keys beside
                                        its title (a review's like and share),
                                        and the title that scrolls — shared by
                                        Surprise Me and a review. The square
                                        can move (`animation`)
                     ui/animated-cover-image  a cover that moves when it can:
                                        the still, and the animated file over
                                        it once found — expo-image for WebP /
                                        APNG / GIF, expo-video (lazily,
                                        ui/animated-cover-video) for WebM / MP4.
                                        See § Animated covers
                     cover-viewer       the game page's cover full size at the
                                        top of the screen, SimpMusic's Apple
                                        Music blur of it under it, and
                                        Static / Animated — see § Animated
                                        covers
                     onboarding/look-previews  a game's page and a Surprise Me
                                        card, drawn small, for onboarding's
                                        two look questions
                     ui/tonal-key       the game page's action key — M3
                                        filled-tonal, in a connected group —
                                        and Surprise Me's Backlog and Next,
                                        the same object
                     ui/multi-pick-sheet  a checklist in a sheet: Surprise
                                        Me's genres, themes, platforms…
                     ui/stats-strip     a row of figures with rules between;
                                        the game page's strip and a review's,
                                        and `size="compact"` on a review card
                     review-cells       a review's playthrough as strip cells,
                                        shared by the review page and the card
                     review-quote       a review as a card of its words: the
                                        text, the writer bottom-left, the score
                                        bottom-right. The critics' card and — on
                                        the game page and in the reviews sheet —
                                        the member's
                     log-card           the review card in every list — Home, a
                                        profile, Search, the most-liked page: a
                                        flat card a shade under the page, who
                                        and when across the top, the art with
                                        the title, developer · year and the
                                        square score beside it, then three lines
                                        of the review. See § Review cards
                     copy-coverflow     the Physical shelf as Cover Flow, and its
                                        hand-off to a copy's stage (§ The library)
                     cd-disc            a game's art printed on game_cd.png
                     copy-showcase      a copy on its stage: the object, its
                                        gestures and its idle turn. The case is
                                        this screen's own box — copy-case-front
                                        / -back / -edge / -inside — and each
                                        side of it a copy-stage-face, placed by
                                        lib/stage-geometry. copy-stage-floor is
                                        the lamp and the shadow, copy-stage-tilt
                                        the phone's sensor, copy-stage-key the
                                        keys under it. The back is the only
                                        place a copy's edition is printed. See
                                        § Progress, physical…
                     cd-disc-underside  the disc's mirrored side; the showcase
                                        alone turns a disc over
                     copy-stage-gl      the copy's stage in 3D: three.js on
                                        expo-gl, drawn over the flat stage once
                                        it has a frame, and the flat stage left
                                        in place if it never does. Lazily
                                        imported. See § Progress, physical…
                     copy-stage-sheet   the case's printed faces (its back,
                                        spine, edge, edition band) laid out
                                        under a page-coloured cover and
                                        captured with view-shot, for the 3D
                                        stage to print with
                     studio-identity    a studio's name, or its Commons logo in
                                        its place; see § Studio pages, collection pages and studio logos
                     ui/smooth-scrim    SimpMusic's artworkScrimBrush: artwork
                                        melting into a page colour
                     ui/section         SimpMusic's artist-page sections: the
                                        heading + More, the description card,
                                        the art rail, and `useSectionMetrics`
                                        (its sizes as fractions of the display)
                     ui/expandable-text text in a card that opens in place, the
                                        window's height animating (the
                                        reference's DescriptionView) — or, with
                                        `fade`, text standing on a page: its
                                        last lines dissolving, itself the thing
                                        you press (the game page's synopsis)
                     ui/cover-halo      the soft round shadow behind the game
                                        page's cover: a native radial gradient,
                                        that page only
                     ui/dropdown-button SimpMusic's DropdownButton: an outlined
                                        pill holding the current choice, and a
                                        menu that opens *from* it (anchored,
                                        computed, CSS keyframes). One option
                                        draws a metadata chip instead
                     game-platforms     the Overview's Platforms section: the
                                        case (and its turn-over) for the chosen
                                        platform, the dropdown — no price
                     search/            what the Search tab looks through:
                                        search-scopes (`SEARCH_SCOPE_INFO`, the
                                        seven tabs' vocabulary), a results list
                                        per scope — reviews, people,
                                        collections, studios, events, and the
                                        platform directory — and
                                        spotlight-slider, the slider at the
                                        head of Discover; top-chart, its Top
                                        1000 (GameLog's or the critics',
                                        twenty to a page). logo-tile is a
                                        platform or a
                                        studio as a square with its name under
                                        it. facet-search is "Search by", the
                                        facet picker, the chosen facet's bar
                                        and the suggestions over a title
                                        search. discover-sections is the
                                        untyped Reviews and Collections tabs'
                                        headings, "See all" and per-section
                                        loading and failure. See § Search
                     ui/pager           previous / next / the pages around you /
                                        go to a number, for a list in pages
                     ui/logo-mark       somebody else's logo — a platform's, a
                                        studio's in a list — drawn on the page:
                                        as it is, as a light silhouette, or on a
                                        plate of its own ground. See § Search
                     must-play-badge    the Must Play mark: a green disc, a dark
                                        ring, a grinning face giving a thumbs
                                        up. Two PNG layers, tinted; see § Must
                                        Play
                     game-moderation    a moderator's card at the foot of a
                                        game's Overview: the Must Play box
                     game-grid-tile     a cover with its title under it, for a
                                        grid that is read (Must Play, an event)
                     app-error-boundary what is drawn when a screen throws while
                                        rendering — the root layout's
                                        `ErrorBoundary`. Also empties the saved
                                        query cache; see § Loading
                     player/            the app's one music player, as drawn:
                                        player-host (owns the native audio
                                        object; in the root layout, draws
                                        nothing), player-bar (docked on the
                                        soundtrack screen: scrub, transport,
                                        Keep playing), mini-player (the bar at
                                        the foot of the app while music is kept
                                        playing) and soundcloud-mark
                                        (SoundCloud's logo, unmodified). See
                                        § Soundtracks
                     soundtrack-section the game page's Soundtrack tab: a
                                        summary and the Listen button
                     quote-block        a review's one sentence between a
                                        blocky 66 and 99: the closing one at
                                        the far right of the last line. Cards,
                                        the review page (typing itself out)
                                        and both shared images
                     review-podium-card the second shared image ("Rating"):
                                        the owner's music-app reference
                     review-share-sheet / review-share-card  Share on a review:
                                        pick the words, choose a background,
                                        Save image or Share — and the card it
                                        captures
                     review-highlighter the whole review with a highlight over
                                        the part that goes on the card: tap a
                                        word, hold an end and drag
                     review-chart-head  the heading over the Reviews chart:
                                        its name, the period at the far end,
                                        the languages it is in
                     reading-note       one quiet line under a chart's heading
                                        saying which languages it is in; opens
                                        Settings
                     reading-languages  Settings' "Review languages": a
                                        disclosure — automatic, every
                                        language, or the ones ticked. See
                                        § Discovery
  constants/         theme tokens, log-status vocabulary, the identity ramp
                     (identity.ts: genre → hue), rarity bands,
                     game-editions.ts (remake/remaster/DLC labels),
                     stores.ts (storefront brand marks), progress.ts (the seven
                     progress choices), physical.ts (region / completeness /
                     condition words), platform-media.ts (disc, cartridge…),
                     copy-stage.ts (the copy showcase's measurements: how large
                     a case stands, how deep it is, its disc's size, which
                     cases open),
                     game-masthead.ts (the game page's masthead, measured off
                     the owner's reference: the cover's width, the hero's
                     dissolve, where the row sits in it, the halo, the
                     synopsis's fade — pure, tested),
                     profile-layout.ts (the profile's margin of ten, its
                     face, the head's rhythm and the four covers of a widget
                     — pure, tested),
                     similarity.ts (the twelve reasons), reports.ts (what a
                     report can say, per kind), wikidata.ts (the five Wikidata
                     properties the studio logo is found by),
                     mood-tile.ts (a mood's or a genre's block at the foot of
                     Home: the reference's measurements, the gradient from the
                     item's hue and the name's ink at AA — pure, tested; see
                     § Home),
                     cover-rail.ts (a row of covers — pure, tested), search-spotlight.ts (Search's carousel, its parallax
                     and where it moves next — pure, tested),
                     game-labels.ts (the labels a moderator can set — must_play),
                     list-window.ts (how much of a long list is mounted at once;
                     see § Gotchas, performance traps), player.ts (the mini
                     player's measurements, shared by the bar, the tab bar's
                     clearance and `<Screen>`),
                     header-art.ts (a collection's and a review's header art:
                     half the display tall — pure, tested),
                     top-bar.ts (the top bar: its row, its controls, the glass
                     discs, the frost, and the arithmetic of how each moves
                     with the page — pure, tested; see § The top bar),
                     score-figure.ts (which of the five drawings stands for a
                     score — pure, tested; see § Score figures),
                     poster.ts (onboarding's page colours: which token is the
                     page, the ink, the pill — pure, tested; see § The poster
                     screens),
                     pull-quote.ts (a quote's four fixed sizes and where its
                     marks go — pure, tested), share-card.ts (SimpMusic's share
                     card, measured; its swatches and inks — pure, tested),
                     review-page.ts (a review's own page, measured off the
                     owner's phone screenshot at 2px a dp, and where Android
                     puts a Poppins line's baseline — pure, tested)
  theme/
    dynamic-color.ts    Material 3 (Monet): one seed hex → 23 M3 roles, via
                        DynamicScheme + TONAL_SPOT. Pure; `npm test` covers it
    dynamic-theme-provider  <DynamicThemeProvider> + useDynamicTheme()
  hooks/
    use-accent          the accent in force: house blue, or a game's own colour
    use-album-art-color the seed for the above — native extractor on a dev build,
                        pure-JS JPEG decoder in Expo Go. Never import
                        react-native-image-colors statically; see § Conventions
    use-screen-chrome   what a page publishes to its top bar: the Android
                        blur target, the modal flag, the page's fill, whether
                        it reserves the bar's row, and `scrollY` — its scroll
                        offset on the UI thread, written by its page scroller
    use-header-height   `useHeaderHeight()`: the bar's row and the inset, what
                        `<Screen insetHeader>` reserves. `useDiscRoom()`: the
                        four dp less a page that opens on artwork keeps clear
                        for its discs
    use-steam-artwork   Steam CDN URLs + the hashed-path fallback, cached 7 days
    use-pulse           `usePulse()`: a value that changes on every render, so
                        a scroll-driven animated style is re-applied after one.
                        See § Gotchas, the lost end value
    use-theme           `useTheme()`: the palette
    use-studio-catalogue  a studio's company (identity + game ids) and its
                        games — the one company request the logo shares
    use-studio-banner   the studio's banner URL, remembered per device so a
                        return visit paints art and colour before IGDB answers
    use-studio-logo     a studio's verified public-domain logo, or null;
                        stored on the device (a month; "none" a week). No
                        IGDB request of its own
    use-animated-cover  a game's animated cover in one shape (square /
                        portrait), "none" included, kept a month on the
                        device; `useCoverPlayback` — one plays at a time;
                        `prefetchAnimatedCover` / `peekAnimatedCover` for
                        Surprise Me's next cards
    use-animated-artwork  whether covers move by themselves — Settings and
                        onboarding's switch, read by `useAnimatedCover`
    use-square-cover    a game's 1:1 cover from SteamGridDB, persisted to
                        AsyncStorage. Returns `resolved` — do not draw the IGDB
                        cover before it is true; that is the swap it prevents
    use-game-prices     `useGameStorefronts` (a game's official stores and
                        Steam appid, from the page's own `['game-extras']`) and
                        `useGamePrices` (its ITAD prices). Where to buy, the
                        Awards card and the events rail
                        all read these, so each is one request
    use-game-labels     which games carry a label, as one shared list of ids:
                        a module store, because `<Poster>` asks for every cover
    use-logo-ink        what an IGDB logo is made of (cut out? dark? its own
                        ground?), measured once and kept on the device. Returns
                        `resolved` — draw nothing before it is true
    use-game-colours    whether the screens about one game wear its colours —
                        Settings' switch, read by `<AccentProvider>` and
                        `useGameAccent`. `<GameColoursWarmup>` in the root
                        layout reads it before the first game page opens
    use-game-soundtrack a game's soundtrack on SoundCloud: the one query the
                        Soundtrack tab, the soundtrack screen and Surprise Me
                        share. Never persisted
    use-reading-languages  which languages the signed-in person reads reviews
                        in: the app's, the phone's, the ones they write in —
                        or what they chose. Returns `ready`; a chart waits
                        for it
    use-review-chart    the Reviews chart for a period, in those languages:
                        the one query Search's Reviews tab and `/reviews` share
    use-event-attendance  somebody's attendance at one event and the reminder:
                        the one record `<EventRsvp>` and the event page's foot
                        bar both write through
  lib/
    color.ts         contrast, mixing (sRGB, and Compose's Oklab
                     `mixOklab`), luminance-preserving tint, readable ink
    artwork-color.ts the M3 seed's fallback in Expo Go: a cover's dominant
                     hue, decoded from its 90×90 thumbnail
    games/           IGDB (the catalogue) + Steam/RAWG/itch id lookup only,
                     steam-artwork.ts for Steam CDN covers (preferred over IGDB),
                     sort.ts for in-memory ordering, recommend.ts for
                     "Games for you" (your logs → IGDB similarity),
                     itad.ts for storefront prices,
                     facets.ts for a game's genres, themes, modes,
                     perspectives, engine, series, franchises, languages and
                     age ratings as ways to more games: the clause, the fixed
                     lists, the route params. Pure, tested.
                     storefronts.ts for which official stores a game is on
                     (IGDB's websites and external_games) and which ITAD
                     price goes with which store. Pure, tested.
                     steam-store.ts for a game's Steam page — its awards and
                     its events — through the steam-store function,
                     steamgriddb.ts for square (1:1) cover art and animated
                     grids — artwork only, never a catalogue; see the note
                     below. animated-covers.ts finds a game's animated cover:
                     SteamGridDB, then IGDB.
                     browse.ts for what is browsed rather than searched by
                     title: the platform directory and a platform's games by
                     page, studios by name, events, a year of releases.
                     paging.ts (page numbers, counting by probing) and
                     calendar.ts (months, days, date precision) are its pure
                     halves, under `npm test`.
                     critics.ts for OpenCritic's review snippets and scores.
                     sharp-cover.ts for a cover at 1080p — the copy showcase
                     only, the one slot that draws it that large.
                     hero-art.ts for which of a game's images is its hero.
                     Pure, tested.
                     spotlight.ts for which games Search's slider opens on and
                     what each says about its date. Pure, tested.
                     release.ts for whether a game is out yet and its date as
                     words — what keeps an unreleased game from every way of
                     starting a review.
                     moods.ts for Home's ten moods as IGDB clauses, the
                     shelves' dedupe, Quick picks and the mood's studio. Pure,
                     tested; genre-feed.ts a genre as the same kind of feed;
                     mood-feed.ts sends either, paced. See § Home.
                     rawg-tags.ts for RAWG's tags — the vocabulary, a game's,
                     a tag's games as IGDB's — and rawg-match.ts, its pure
                     half. See § RAWG tags
    wikidata/        the studio logo, and nothing else any more: commons.ts
                     (the licence check — pure, tested), studio-logo.ts
                     (finding the file), claims.ts and client.ts (reading a
                     statement; the Action API). The game's "Additional
                     information" lived here too and was scrapped — see
                     § Studio pages, collection pages and studio logos
    copy-scene/      the copy stage in 3D, platform-free: optics.ts (each
                     disc format's track pitch, the disc's rings, the studio,
                     the rock, the lens — pure, tested), shaders.ts (the
                     case's plastic and print, the disc's label, playing side
                     and edge, in GLSL), renderer.ts (three.js on expo-gl's
                     context), three-globals.ts (what Hermes lacks, lent per
                     call) and scene.ts (the three.js scene,
                     posed from the flat stage's own numbers — tested against
                     them)
    artwork-mesh.ts  SimpMusic's Apple Music page under the cover viewer:
                     the cover's pixels as a blurred, shuffled mesh, and the
                     washes over it. Pure, tested (hooks/use-artwork-mesh
                     decodes the thumbnail)
    scroll-motion.ts how the pinned hero answers the scroll, and a shelf
                     arriving: the curves, as worklets. Pure, tested
    progressive-blur.ts  Convx's row-by-row blur: the curve, the SkSL it is
                     drawn by, the cover rect. Pure, tested (and compiled in
                     CanvasKit); components/ui/progressive-blur draws it
    scrim.ts         SimpMusic's `artworkScrimBrush` as stops, and a foot
                     fade over part of a frame. Pure, tested
    retired-colour-stores.ts  deletes, once, the device stores of the colour
                     methods Material 3 replaced
    logo-luminance.ts   how light a logo's ink is, from a 250px thumbnail
                     decoded in JavaScript — and `measureLogoInk`, the same for
                     an IGDB logo's `t_cover_small`
    logo-ink.ts      what a logo's pixels say and how to draw it for them: as
                     it is, a light silhouette, or a plate — and whether a
                     studio's Commons logo needs a light silhouette on its
                     page. Pure, tested
    png.ts           a PNG decoder (inflate after puff.c), for the above. Pure,
                     tested against Node's zlib
    stage-geometry.ts  the copy showcase's camera: how a flat view is drawn to
                     be one side of a turning box, the idle turn's pace, the
                     lamp. Pure, tested. See § Progress, physical copies…
    news/feed-lighten.ts  RSS article bodies cut out before parsing. Pure,
                     tested
    barcode.ts       GTIN check digits, UPC-E expansion, normalising to GTIN-14
    review-facets.ts what the review list filters and tallies by. Pure
    postgrest.ts     `inList()`, the safe `in` filter for strings people typed
    query-client.ts  the app's one QueryClient and its defaults. A module, not
                     a value in the root layout: the auth store and the saved
                     cache both need it. See § Loading
    query-persist.ts the query cache kept on the device between launches — a
                     row per query, per account — and its pure half,
                     query-persist-rules.ts (what is written, in what
                     envelope, evicted when; under `npm test`)
    seen.ts          `createSeen()`: complete records remembered as a list
                     downloads them, so their page opens without a request.
                     games/seen-games.ts, api/seen-logs.ts and
                     api/seen-copies.ts are its three users
    platform-options.ts  a game's platforms as picker options
    soundcloud/      SoundCloud through its Edge Function: api.ts (a game's
                     soundtrack, a stream for one track, one track's details),
                     types.ts, and legacy.ts (deletes what the Apple Music
                     version left on the device). Nothing from here may be
                     stored — see § Soundtracks
    soundtrack-pick.ts  which song Surprise Me plays, and lengths as text.
                     Pure, tested
    player-queue.ts  the player's arithmetic: next and previous, what the
                     transport shows, what a failed play says, and the routes
                     the mini player stays off. Pure, tested
    language.ts      which language a review is written in (a detector: the
                     script, then the words), and which languages a reader
                     reads. Pure, tested. See § Discovery
    discovery.ts     a chart's periods, the line that says why somebody is in
                     one, which review a game leads with, the reviews sheet's
                     language choices. Pure, tested — and its test reads 0038
    community-rating.ts  the community score's method as a TypeScript
                     reference: entropy, deviation, the weight, the weighted
                     mean, the parameters, and a weight in words. Pure,
                     tested; the SQL in 0041 is the authority, this is what
                     it is checked against. See § The community score
    device-locale.ts the languages the phone is set to, from React Native's
                     own modules (no `expo-localization`)
    reading-languages.ts  the reader's choice of languages, kept on the device
    onboarding.ts    onboarding's rules as data: the fallback username, handles,
                     the typing, the steps, the answers and the picks clause.
                     Pure, tested. games/onboarding-picks.ts sends it to IGDB
    event-phase.ts   upcoming / live / over, whether the games are shown, the
                     countdown. Pure, tested
    review-quote.ts  a review's one sentence: its cap (QUOTE_MAX), what a card
                     shows (`cardShows`), `hasWriting`. Pure, tested
    review-details.ts  how a review's run was played, as the sentence under
                     it on its page, and "16th October 2026". Pure, tested
    quote-layout.ts  a quote's lines and its marks, placed. Pure, tested
    review-highlight.ts  the share sheet's highlighter as data: the
                     review's words and breaks, their layout, the word under a
                     finger, a pick's lines on the card. Pure, tested
    font-advance.ts  Inter Regular's, Bold's and ExtraBold's advance widths, read from the
                     font files: text laid out before it is drawn
    review-colour.ts whether a review's page wears its game's colours, kept
                     on the device per account (`useReviewColour`)
    game-colours.ts  whether every game screen does — Settings → Game
                     colours — kept the same way (`useGameColours`)
    animated-artwork.ts  whether covers move by themselves — Settings →
                     Animated artwork — kept the same way
                     (`useAnimatedArtwork`)
    surprise-prefetch.ts  Surprise Me's media rules: a card's shape, and what
                     is fetched ahead within a byte budget. Pure, tested
    home-view.ts     what Home shows — All, a mood or a genre — and its feed
    home-glow.ts     SimpMusic's Home glow as numbers: the tone (the first
                     game's M3 primary × 0.45), the
                     25° line, the eased stops. Pure, tested. See § Home
    top-chart.ts     Search's Top 1000 as rules: a thousand at most, pages of
                     twenty, the critics' floor of seven, what a score is made
                     of. Pure, tested
    typing.ts        the letter-at-a-time clock onboarding and a review's
                     quote share (`lib/onboarding` re-exports it)
    testkit/         node-only helpers for tests (Inter's advance widths read
                     from the font file). Excluded from tsc; never imported by
                     the app
    api/             everything that talks to Supabase, split by domain
      core.ts        games cache, logs, profiles, follows, achievements,
                     the reviews sheet
      engagement.ts  likes and comments (was posts.ts)
      lists.ts       lists, tier lists, favourites, wishlist
      awards.ts      award shows: the ballot and its slots
      progress.ts    progress writes and playthroughs
      ratings.ts     the community score: `getRatingBreakdown` (one row of
                     0041's `game_ratings`, or the plain mean before it), the
                     reader's own influence, the moderators' report, and
                     `invalidateCommunityRatings`
      physical.ts    releases, barcode lookup, claims, moderation, copies
      similarity.ts  community similar games: pairs, votes, reports
      reports.ts     reports on suggestions and reviews, and their queues
      labels.ts      labels on games (Must Play): who has one, and a
                     moderator's set and unset
      pins.ts        a library's pinned games (0043)
      notifications.ts
      songs.ts       the one starred track per profile — a SoundCloud URN
                     and the game, nothing else
      storage.ts     image upload
    supabase.ts      client + session persistence
  store/auth.ts      zustand auth state
  store/onboarding.ts  whether the signed-in account is onboarded, where a
                     halfway flow resumes, and where its last page sends them
  store/player.ts    the app's one music player: the queue, what it is doing,
                     and the commands (`player.play`, `toggle`, `next`,
                     `release`…). Holds SoundCloud's words in memory only
supabase/
  migrations/        0001 core, 0002 media+achievements, 0003 social,
                     0004 0-100 reviews, 0005 friends+wall, 0006 article kind,
                     0007 events+articles, 0008 review metrics,
                     0009 gaming accounts, 0010 collection tags, 0011 diary,
                     0012 starred song, 0013 collection likes + ranking fns,
                     0014 chosen collection cover, 0015 awards list kind,
                     0016 award categories, 0017 game editions,
                     0018 comments on collections,
                     0019 captioned list kind, 0020 soundtrack cache,
                     0021 review spoilers, 0022 paused status,
                     0023 completion + co-op + playthroughs,
                     0024 releases, barcodes, claims, copies, moderators,
                     0025 community similarity, 0026 review stats,
                     0027 ScanDex answer cache, 0028 a person's game stats,
                     0029 sortable similar picks + upvotes on suggestions,
                     0030 each pick's top suggestion + suggester/agreer counts,
                     0031 reports on suggestions and reviews,
                     0032 those report tables keyed on their own id,
                     0033 a collection's artwork: four covers or one
                     (unused: the mosaic was removed; the column stays),
                     0034 labels on games (Must Play), moderators only,
                     0035 the OpenCritic answer cache,
                     0036 SoundCloud: the app's token, which upload matched a
                     game (ids only) — and it EMPTIES starred_songs and DROPS
                     game_soundtracks,
                     0037 beloved_games(): GameLog's own top-rated games over a
                     period, a damped average,
                     0038 discovery: logs.review_lang, circle_of(),
                     review_popularity() and member_popularity() — activity
                     in a period, among everybody or the reader's circle,
                     0039 the Steam store page cache (awards, events),
                     0040 logs.review_display — a review's cards show its text
                     or its one sentence,
                     0041 the weighted community score: rater_stats,
                     game_ratings, community_rating_state, the triggers on
                     logs, and 0026's and 0037's functions weighted,
                     0042 a physical copy's art: the copy_art cache and the
                     public copy-art bucket (written by the function alone),
                     0043 library_pins: six pinned games a person,
                     0044 gaming_accounts.linked_by and gaming_service_tokens:
                     PlayStation, Xbox and GOG linked by username,
                     0045 blocks, user_content_reports, delete_my_account(),
                     0046 pings: ping_preferences, direct_pings, pings,
                     ping_reference_games, ping_suggestions, ping_feed()
                     (0006, 0015, 0019 and 0022 each add an enum value and must
                      run alone — see those files)
  functions/igdb/    Edge Function proxying IGDB
  functions/opencritic/  what critics wrote and scored (snippets, per outlet);
                     IGDB has none. Caches its answers in 0035
  functions/itad/    Edge Function proxying IsThereAnyDeal (prices)
  functions/steam-store/  a game's Steam store page: the Awards section out of
                     its HTML, and its events & announcements. Caches in 0039
  functions/_shared/steam-store.ts  the parser for both. No imports, so
                     `npm test` loads it against real page excerpts
  functions/copy-art/  a physical copy's back cover and disc label, from
                     GameTDB and ScreenScraper, kept in the copy-art bucket
  functions/_shared/copy-art.ts  how a game is found in each and which
                     picture is which. No imports; `npm test` loads it
  functions/scandex/ Edge Function proxying ScanDex (barcode → IGDB game)
  functions/game-accounts/  PlayStation, Xbox and GOG imported from a public
                     username, RAWG's way; _shared/game-accounts.ts its pure
                     half (no imports; `npm test` loads it)
  functions/soundcloud/  a game's soundtrack on SoundCloud, and a stream for
                     one track. Holds the client secret and the app's token
  functions/_shared/soundcloud-match.ts  the matcher: which upload is a
                     game's soundtrack. No imports, so `npm test` loads it too
```

**Data flow.** Game metadata comes from external providers (`lib/games/`), but
anything social lives in Supabase (`lib/api.ts`). The join between them is the
`games` table: when a user logs a game we copy its metadata into Postgres, so
the feed can render 50 items with one query instead of 50 Steam calls.

**Game identity.** A game's app-wide id is `` `${source}:${sourceId}` `` — e.g.
`steam:367520`. Build it with `makeGameId()`, take it apart with `parseGameId()`.
Never assume a bare numeric id.

**One catalogue: IGDB.** `PROVIDERS` in `lib/games/index.ts` holds `igdbProvider`
and nothing else, so every game that enters the app — search, charts, franchise,
studio, recommendations — has one identity, one cover and one id. Steam, RAWG and
itch.io survive only in `LOOKUP_PROVIDERS`, which `getGameById()` uses so rows
logged before the cutover (and games matched out of a linked Steam library) still
open. Nothing may put a non-IGDB game *into* the app again.

**Artwork.** `coverUrl` is portrait box art (2:3); `heroUrl` is landscape key
art. IGDB publishes both, so a missing cover means the game genuinely has none —
`<Poster>` still falls back to the hero, and chart queries filter on
`cover != null` rather than rendering placeholders. Never stretch a hero into a
poster slot; that is what the fallback is for.

**The hero is chosen, not `artworks[0]`.** IGDB's `artworks` is every piece of
art anybody uploaded, in upload order, and the first is as often an icon or a
wordmark as key art: of the 120 most-rated games (verified live), 46 had a first
artwork that was not landscape at all and only 28 had a 16:9 one. The Witcher
3's is a 128×128 icon, which IGDB's `t_1080p` *upscales* to 1080×1080 — that was
the game page's hero, and what the owner called "cropped and in low quality".
`chooseHero` (`lib/games/hero-art.ts`, pure and tested against those records)
reads each artwork's `artwork_type` and size, which `GAME_FIELDS` now asks for:
key art, then artwork, then concept art; landscape; at least 1000px across; a
sharp widescreen screenshot before soft art **and before a 3.1:1 banner**
(Steam's 1920×620, which the 38%-tall hero cuts to its middle third and
enlarges); **never a logo, a cover or an icon**. The fifteen type ids are a
literal there (`artwork_types` is not on the function's allowlist; the table
was read off 4,726 live artworks). A query that asks for neither sizes nor
kinds — `similar_games` — still gets the first artwork, and nothing draws that
as a hero.

**Steam CDN artwork is a preference over IGDB, never a replacement.** Where a
game has a Steam listing, `<Poster steamAppId>` and `<HeroArt steamAppId>` show
the publisher's own store assets instead — see the Steam CDN section below. The
ladder is always **Steam → IGDB → lettered placeholder**, and the middle rung is
load-bearing: half this catalogue is console-exclusive and has no appid at all.

**SteamGridDB is the square rung, and it is artwork only.** IGDB publishes
nothing at 1:1, so every square slot was cropping 2:3 box art — which is composed
for 2:3, so the crop cuts the logo. `lib/games/steamgriddb.ts` is not a provider
and must never become one: nothing there may put a game *into* the app, only art
onto a game already in it.

**The game page's name is the game's logo again, on trial** (2026-11-03,
the owner: "try and see how it looks on the game page"). It was removed on
2026-10-22 ("I don't think it fits in any screen") when it came from Commons
and SteamGridDB; now it is IGDB's own — an artwork whose `artwork_type` is a
logo (white, then colour, then black drawn white), already in `GAME_FIELDS`'
answer, so it costs no request (`chooseLogo`, `lib/games/logo-art.ts`, pure
and tested; `Game.logo`). `<TitleMark>` in `game-header` draws it, measuring
it first (`useLogoInk`, which now also reads `bounds` — where the drawing is
in its file; cache `logo-ink:v2`): the file is cropped to its ink (Kingdom
Come II's fills half its canvas, Phantom Blade Zero's is a strip on 16:9),
and every logo is drawn at one area, Red Dead Redemption 2's, which the owner
called "decent" (`logoBox`, `LOGO_AREA`). Drawn as it is unless dark all over
(`gameLogoLook` — the platform logos' silhouette rule turned Disco Elysium
into a white blob); the name in type for one with its own ground or a file
that fails. Nowhere else draws a logo.

**Its static square has three surfaces**, all through `useSquareCover()`: Surprise Me,
a review's own page — the square as the hero at its top, full width and
fading into the page, the landscape art or the cover cropped in its place
when there is no square (`app/review/[id].tsx`, § A review in one sentence) —
and **the hero at the top of a
collection's own screen**: the one cover `<CollectionHeader>` draws. Its
**animated** grids are a separate lookup with surfaces of their own (§ Animated
covers): the square on Surprise Me and a review's page, the portrait on
Surprise Me and in the game page's cover viewer, and both on onboarding's
example cards.

**A collection is square in exactly one place — the hero you see after tapping
in — by the owner's decision, the fourth one on this.** The picture used
SteamGridDB first, was taken back to cropped IGDB covers, and the *inside* of
the collection went square instead; the owner then reversed both: "the list of
games is still portrait, but the image used for the thumbnail at the top with
the fade should be square". That was read as the collection's picture
everywhere — its row in a list included — and it was wrong: the owner meant the
header and nothing else, and said so in capitals. So:

- **Outside** — `<ListTile>` in every list of collections, the rows of the
  add-to-collection picker — is box art: a stack of up to five `<Poster>`s on
  the tile, one small `<Poster>` on a picker row. Neither asks SteamGridDB for
  anything.
- **The hero** — the art at the top of `list/[id]`, where it fades into the
  page — is square art: `<CollectionHeader>` calls `useSquareCover` for the
  collection's one cover. It is the only caller in a collection.
- **Inside**, under the header — the grid, the rows, a tier list's rows, a
  captioned board's tiles and an award's winner — is `<Poster>`s.

Do not "finish the job" in any direction, and do not square the stack so that
"the small one matches the big one": they are meant to differ. One detail that
is easy to undo:

- **The page colour is still read from the box art.** The M3 seed's extractor
  (`useAlbumArtColor`) decodes in JavaScript in Expo Go and only takes a
  thumbnail; SteamGridDB's smallest is 400×400 (verified live:
  `…/thumb/<hash>.jpg`), four times what it will read. Same game, nearly
  always the same palette.

**There is no per-platform lookup, and rebuilding one against this API will not
work.** The game page briefly asked for the selected platform's own box front.
`/grids/{platform}/{id}` takes *store* slugs — `steam`, `gog`, `egs`, `origin`,
`eshop` — not console families, so `playstation` and `xbox` had no endpoint to
resolve against and every console tap spent a request to fall back to the cover
it already had. The switcher — the Overview's Platforms section — re-draws the
case; the artwork is IGDB's.

Resolution is Steam appid, then a title search, because `games.source_id` is an
IGDB id and SteamGridDB does not index IGDB; the title path is a string match and
its docblock says what that costs. Everything returns `null` on a miss and
**every caller must have an IGDB fallback** — `null` is the normal answer, not an
error. No `EXPO_PUBLIC_SGDB_API_KEY` means no requests at all and every slot keeps
the IGDB cover. Requests are capped at four in flight (`MAX_CONCURRENT`): the
square lookup is per *cover*, and a 429 is indistinguishable from "no art" once
it has been cached. The cap was written for a Collections tab that mounted
eighty square tiles at once; nothing is that dense now — a Surprise Me deck is
the busiest caller — and it stays as the guard that makes a new one safe.

**`useSquareCover()` returns `{ uri, resolved }` and callers must honour
`resolved`.** Drawing the IGDB cover while the answer is unknown is what made
every square slot paint a portrait and then swap it for a square, on every mount,
forever — a query cache does not survive a cold start. The hook is a module store
persisted to AsyncStorage (mirroring `use-steam-artwork`) and **caches the misses
too**, so a game resolves before its first paint on every sighting after the
first. While `resolved` is false, show a skeleton or the container's own fill —
anything that is not a *different piece of artwork*.

## Steam CDN artwork

Base: `https://shared.steamstatic.com/store_item_assets`. **Not**
`shared.cloudflare.steamstatic.com`, which 301s here — using it costs a redirect
on every image.

| Slot | Filename | Size |
| --- | --- | --- |
| `library` | `library_600x900.jpg` | 600×900, exactly `PosterAspectRatio` |
| `header` | `header.jpg` | 460×215 |
| `hero` | `library_hero.jpg` | 1920×620 |
| `logo` | `library_logo.png` | transparent wordmark |

`steam/apps/<appid>/<filename>` is right for roughly 95% of appids. The rest put
their assets behind a content hash and 404 on the plain path — verified live:
`730` (CS2) serves directly, `2623190` (Oblivion Remastered) does not and needs
`…/apps/2623190/b52322f…/library_600x900.jpg`.

**The capsule is the 1× file, never `_2x`.** `library_600x900_2x.jpg` is
1200×1800 — four times the pixels for a slot no wider than 200dp (600px at 3×):
CS2's is 120 KB against 38 KB. A linked library is hundreds of tiles, so the 2×
file was most of what filled the image cache for anyone with Steam linked. The
hashed fallback asks `GetItems` for `library_capsule` for the same reason, and
`use-steam-artwork`'s cache is versioned (`v2`) so stored 2× URLs were dropped.

**`steamAppId` is null on every IGDB game today, so all of this is inert for
them.** IGDB renamed `external_games.category` to `external_game_source` (same
numbers; Witcher 3's appid 292030 comes back as `external_game_source: 1`), and
`GAME_FIELDS` still requests `category`, so `steamAppIdOf` never matches. Only
legacy `steam:` rows and a linked Steam library carry an appid. Fixing the field
changes covers app-wide, so it is its own decision.

Three things that are easy to get wrong, all verified against the live API:

- **`asset_url_format` is a template, not a prefix.** It comes back as
  `steam/apps/2623190/${FILENAME}?t=1786648304` — substitute the filename with
  `.replace('${FILENAME}', name)`. Splitting on `${FILENAME}` and keeping the
  left half drops the `?t=` cache token, so a re-uploaded capsule keeps serving
  the stale image.
- **The template is relative to `store_item_assets/`, not to the host.**
  Prepending the bare CDN host yields `…steamstatic.com/steam/apps/…`, which
  404s for every game — the missing segment is the difference between the
  fallback working and never working.
- **`GetItems` returns no `logo` key.** Assets are `main_capsule`,
  `small_capsule`, `header`, `library_capsule`, `library_hero` and their `_2x`
  variants. A logo can only ever be the direct URL, so a hashed app has none.

`IStoreBrowseService/GetItems/v1` needs **no API key** and is called as a GET
with a URL-encoded `input_json` blob, not a POST body.

**Do not hand a `<Poster>` the capsule twice.** `steamAppId` is what draws the
portrait capsule, and a `<Poster>` reaches `heroUrl` only when `coverUrl` is
null. Passing the capsule as `coverUrl` as well (the same file, on Steam's
other host) means that where it is missing it is missing twice: the header is
never tried and the tile stays blank. Verified live — appids 2520, 3170, 18700
and 26300 answer 404 for `library_600x900.jpg` on both hosts and 200 for
`header.jpg`; older and smaller games never got a portrait capsule. The
library's Steam entries pass `steamAppId` and the header alone (`fromOwned`),
which matters there because a library tile no longer prints the game's name.
**Four callers still do it the old way** — the profile's shelf (`lib/games/shelf`),
`<GameTile>` on the Steam tab's rails, `library-widget` and the achievements
screen pass the capsule as `coverUrl` with no `steamAppId` — so a game with no
capsule is a blank tile in each. Not changed: nobody asked, and the shelf's
would need an appid carried through to its covers.

**No HEAD probe, ever.** The direct URL costs nothing to build, so it is used
optimistically and `<Image onError>` is what triggers the hashed lookup —
one round trip per game per week, versus fifty probes to discover that
forty-eight were already right. `hooks/use-steam-artwork` batches those failures
into one call and persists the result for 7 days.

## Wikidata: the game screen is gone

A game's **Additional information** screen — awards, nominations, cast, budget
and credits read from the game's Wikidata item (`game-info/[id]`) — was
**scrapped at the owner's direction** (2026-10-09: "remove that from the code
itself, I want that feature scrapped"). The route, its door on the Overview,
its sections, its hook, the item lookup, the claim normaliser and their tests
are deleted. **Do not rebuild it**, and do not read "IGDB has no cast or
credits" as a gap to fill from somewhere else: that was this, and it was
removed.

What is left under `lib/wikidata/` is the **studio logo** (next section), which
the owner did not ask to remove: `client.ts` (the Action API), `claims.ts`
(reading a statement), `commons.ts` (the licence rule) and `studio-logo.ts`.
`constants/wikidata.ts` is the five properties it is found by. Three things
about the API still matter to it:

- **Anonymous traffic is rate-limited per IP, and it bites.** A burst of test
  calls got `429 text/plain` with `retry-after: 25`. A 429 is surfaced, not
  retried. Space out anything you script against it.
- **API errors are HTTP 200 with an `error` object**, and a missing entity is
  `{"missing": ""}`, not an error.
- `origin=*` is what makes the API answer CORS, so the same requests work on
  `npm run web`; browsers cannot set `User-Agent`, so the client also sends
  `Api-User-Agent`, which the preflight allows.

## Studio pages, collection pages and studio logos

A **collection** and the **studio page** take their page colour from their
artwork through Material 3, as a game's page does (§ One colour method): a
collection from its one cover's box art — the game its screen opens on
(`collectionCover`), so every collection with a game in it has one; an empty
collection stays on the app's page — and a studio from its banner game's art.
Both wear the scheme on their controls too (`<AccentProvider>`), and both pin
their art behind the page (`<PinnedHero>`). Their geometry is SimpMusic's
(`AlbumScreen.kt`, `ArtistScreen.kt`, `artworkScrimBrush` in `lib/scrim`):

- **Collections**: artwork half the display, the scrim over its bottom 70%.
- **Studio**: a square banner (≤ half the display), 5% black veil, the same
  scrim, the name or logo centred over the bottom with one meta line under it.

The **studio logo** replaces the name with the studio's logo from Wikimedia
Commons — only ever a verified public-domain or CC0 file:

- **The licence rule lives in `lib/wikidata/commons.ts` and nowhere else.** It
  reads `extmetadata.License` (the licence template's *code*: `pd`, `cc0`,
  `cc-by-sa-4.0`…) and cross-checks `Copyrighted`, `LicenseShortName`,
  `LicenseUrl` and `NonFree`. `pd` requires `Copyrighted: False`; CC0 says
  `True` and is fine. "No known copyright restrictions" and enwiki fair-use
  files have **no** `License` code, so the allowlist rejects them without a
  special case. Never infer a licence from a title or description.
- **Which file**: the studio's Wikidata item, found by IGDB slug (P9650, fetched
  from IGDB's `companies`) or — failing that — by an exact label/alias match
  among video game companies, then its P154 (logo image) at best rank, never an
  ended one. Only when Wikidata names no logo is Commons searched, and a searched
  file's title must be the studio's name plus "logo" and nothing that names
  something else. Two false positives this already caught, verified live:
  Commons' "depicts Valve" data returns the **Steam** logo, and a title search
  for "Valve" returns **"Valve Index logo.svg"**. Neither is Valve's logo.
- **Commons' media host 403s a generic client.** `thumb.wikimedia.org` /
  `upload.wikimedia.org` answer Android's default `okhttp/4.x` with "Please set a
  user-agent". Every Wikimedia image is loaded with `USER_AGENT` in its source
  headers (`<StudioIdentity>`, `measureLogoLuminance`).
- **A logo's ink is measured, not assumed.** Commons logos are drawn for white
  pages — FromSoftware's is pure black. `measureLogoLuminance` reads the logo's
  pixels once and caches the number with the logo; `logoNeedsLightInk` draws
  the logo as a light silhouette only when its ink is under 3:1 on the page
  (Mojang's white-on-red block stays as it is). **It measures a 250px thumbnail
  of the same file, decoded in JavaScript** (`lib/png.ts`, `jpeg-js` for a JPEG
  logo): Commons serves any standard width at the same path
  (`…/960px-X.svg.png` → `…/250px-X.svg.png`), a mean is a mean at either size,
  and decoding the drawn 960px file in JS would be ~300k pixels on the JS
  thread. This was Skia's job — it decoded the drawn file out of expo-image's
  disk cache — and it was the last thing Skia did; see § APK size and speed.
  The 250px file costs one ~3 KB request per studio per month.
- **The studio page asks IGDB twice, and never by involvement.** `companies`
  (`developed` + `published`, plus the name and slug the logo needs), then
  `games where id = (…)`: 1.5–2.2s for every studio measured, Nintendo's 2,953
  ids included. `games where involved_companies.company = X` — what it used to
  ask — took 3.1–5.5s for Naughty Dog, Rockstar and FromSoftware, and the
  payload was not why: the same query with a third of the fields was as slow.
  `STUDIO_FIELDS` is the studio's own field list (a third of `GAME_FIELDS`, with
  artwork sizes so a wordmark strip is never downloaded as a banner). The
  involvement query survives only for a company with no games of its own.
- Everything fails to the name: no item, no free logo, a rate limit, no
  network, an image that will not load.

**The studio page is the banner game's Material 3 page, not near black** —
the owner's (2026-10-22): "Make the background color for that page back to
normal m3, don't darken it", and "for a studio who doesn't have a logo image,
paint the text of their name with the m3 color". `useGameAccent(bannerUrl,
genres)` gives the page (`accent.page`) and the name's ink
(`accent.onSurface`), and the controls the same scheme's — the owner's
(2026-10-27): "integrate all of this into the other pages that had the same
thing, studio and collection screen". With game colours off it is the app's
page and the name the text ink. **A
trailer's letterbox bars now show against the page** — near black was chosen
on 2026-10-17 for exactly that, and the owner overrode it. Its sections, top to
bottom: Latest releases, Best rated (four rated originals, was six), Most
popular (`total_rating_count`), Coming soon, a rail per franchise with three or
more games (three at most, strapline "Franchise"), Remakes & remasters,
Special editions, All games. `STUDIO_FIELDS` asks for franchises, genres and
the rating count for them (`StudioGame`, optional fields).

**The artwork plays its game's trailer** — SimpMusic's animated artist artwork
(`ArtistScreen.kt`, `artistMotion`), at the owner's direction (2026-10-17): on
the studio page's banner (the banner game's) and on the game page's hero. The
game's official trailer from its Steam listing loops silently under the art
(`<TrailerBackdrop>`, `<TrailerVideo>`, `lib/games/steam-trailer.ts`,
`use-game-trailer`):

- **Steam, not IGDB**: IGDB's trailers are YouTube ids, playable only in
  YouTube's own player. Steam serves plain H.264 HLS, no key, CORS open. A
  console exclusive has no Steam listing and keeps its still art.
- **The app picks the rendition** (SimpMusic's rule): H.264, the cheapest at
  least 720 tall — and the *video's own playlist*, never the master, so the
  separate audio track is never downloaded. About 1.1 Mbps measured, ~17 MB
  for a two-minute pass.
- **The art stays on top until the first frame**, then fades over 500ms; a
  slow or failed stream leaves the picture. The video dissolves into the page
  under the pinned hero's foot fade, a gradient *to the page's colour* — a
  video surface does not render inside a mask on Android — and drifts, blurs
  and drains with the art.
- **The player exists only while its page is in front**: a covered page
  unmounts it, releasing the decoder — a stack of game pages holds one player,
  not one each (phones have a handful of hardware decoders). It pauses once
  the art is scrolled away, stops itself in the background, and is never
  mounted under Reduce Motion. Muted, `mixWithOthers`, a 6s buffer.
- **`surfaceType="textureView"`, never the default `surfaceView`**: a
  SurfaceView is a hole punched through the window, and Android 12's stretch
  overscroll moved the page without it — the video flickered over the UI and
  parts of the page vanished at the end of a scroll. A TextureView is drawn
  inside the page and moves with it.
- **The answer is kept a day** (the owner's), "no trailer" included, on the
  device like any query; a failure is not. The appid rides on the game page's
  own `['game-extras']`, so it costs no IGDB request.
- **One switch for both pages**, the disc at the top right, kept per account
  on the device (`lib/trailers.ts`, `NEVER_PERSIST`). Drawn only when the game
  has a trailer.
- **`expo-video` is a native module and is imported only through
  `React.lazy`**: it calls `requireNativeModule` on import, so a build made
  before it was added draws the still art instead of crashing. Expo Go has
  it; a sideloaded APK needs a new build. Not seen on a phone.

## Animated covers

The owner's request (2026-10-20): where a game has an animated cover, show it
— the square on Surprise Me and a review's page, the portrait on the game page
once its cover is tapped. Then (2026-10-21): higher quality ("like 720p"),
animated portraits on Surprise Me too, a viewer redesigned round the cover,
the choice asked at sign-up, and Surprise Me's loading planned by media type.
The still is always on screen first; the animation crossfades in (200ms)
once it has a frame.

- **Sources, both verified live**: SteamGridDB's v2 grids with
  `types=animated`, the shape's sizes (`SGDB_DIMENSIONS`) and nothing NSFW or
  flagged for epilepsy (`getAnimatedGrids`) — `/api/public/files`, which the
  request named, is a 404 — then IGDB's `covers` where `animated = true` and
  the shape matches (portrait: taller than wide; square: within 1%). IGDB has
  **51** animated covers in its whole catalogue, mostly small and landscape,
  so it is a rare second chance. `covers` was already on the function's
  allowlist; no deploy.
- **Which file plays: the full animation, every grid's, before any preview**
  (`sgdbCandidates`). A SteamGridDB animated grid is the animation as a WebP
  or an APNG (`url`) *and* a WebM (`thumb`) — and the WebM is a **267×400
  preview** (ffprobe, live), which Android played until 2026-10-21 and which
  is the "low quality" the owner saw. Now every grid's full file (600×900 for
  a portrait, 512 or 1024 square) is HEAD-checked against
  `MAX_ANIMATED_BYTES` (**12 MB**, up from 8) and the first that fits wins;
  only when none does is the preview played (never on iOS, which has no
  WebM). Measured over twenty well-known games' portraits, the walk finds a
  full file for nineteen. The HEAD's size rides on the answer (`bytes`), and
  whether it is `full` or a `preview`. IGDB's is its **`.webp`** at `t_720p`:
  its `.png` is the first frame only.
- **No joke covers, the most liked first** (2026-10-21, the owner: "Remove
  humorous animated ones… or maybe get the most liked one"): `humor=false` in
  the request, and `rankGrids` drops a `humor` grid and orders the rest by
  upvotes less downvotes, then SteamGridDB's score, then its own order.
- **An answer is a short list, and a file that will not play gives way**
  (`MAX_ALTERNATES` 4, `pickPlayable`). Red Dead Redemption 2's first file —
  a valid 8 MB, 95-frame 600×900 animated WebP — failed on the owner's phone
  with Glide's generic "Failed to load resource"; the cause cannot be read
  from that message. So the lookup keeps up to four playable files, the
  first preview among them, and a failure passes over that file **and every
  full-size one at least as heavy** for the session (likelier the phone's
  limit than the file's, and each attempt is a whole download), then plays
  the next; previews are never skipped for weight. The log names the file,
  its size and what it tries next. The cache is `animated-cover:v3`.
- **No new dependencies.** expo-image already decodes APNG, animated WebP and
  GIF on both platforms and expo-video is linked for trailers (§ APK size).
  expo-video is imported through `React.lazy` only (`ui/animated-cover-video`).
- **Asked once per game and shape, and remembered** — the owner's rule: "If
  the user has already seen that no animated cover exists for this game… the
  animated query is not done every time." `use-animated-cover` is a module
  store kept in AsyncStorage for a month, **"none" included**. What would
  not play is the session's alone, never written to disk.
  `enabled: false` holds the lookup but still reads a known answer.
  **Only an answer is remembered, never a failure** (2026-11-03): a lookup
  that could not ask — no key in the build, a 429, a 5xx, no network, a
  file's HEAD unreachable — throws `SgdbUnavailable`, is `unavailable` for
  the session and is not written. Before, each was stored as "none" for a
  month, and the 21 October APK was built without the SteamGridDB key, so
  every game opened on it read "no animated cover" on every later build.
  The cache is `animated-cover:v4`, which dropped those.
- **Animated artwork is a setting** (`useAnimatedArtwork`, Settings and
  onboarding; on by default, kept per account on the device). Off, Surprise
  Me and a review's hero are still and look nothing up. The game page's
  Animated button is `explicit` — somebody asking by hand — and works either
  way.
- **Never under Reduce Motion**, **only while the screen is focused**, and
  **one at a time** (`useCoverPlayback`). Either kind is mounted only while
  its cover is the one playing — a covered cover holds no decoder and its
  download is cancelled; `paused` holds it on its frame (Surprise Me, under a
  finger).
- **The review page draws it subdued**: at 0.6 over the page's colour, under
  the hero's own veil and fade — about 0.4 of full strength.
- **The game page's viewer** (`<CoverViewer>`, 2026-10-21): "the artwork
  must be full-size zoomed in to the edges of the screen… a button for
  'static' or 'animated'. Only fetch animated when the user taps on the
  animated button… text alone, in bold. Not inside a pill or a container.
  Static above and Animated below." For one day (2026-10-28) BitChord's
  orbiting blobs in the game's M3 colours stood behind it; the owner had them
  taken out the same day: "Bring back simpmusic's apple music now playing
  blur on the zoomed in version and remove the mesh blob." **Do not bring
  the blobs back.**
  - **The cover runs edge to edge from the top of the display**, at its own
    2:3, always the display's full width; a display too short to leave room
    for the two words under it trims the cover's height, never its width
    (the owner, 2026-10-21: covers "leave small gaps at the edges"). Its
    shape is the poster's 2:3, not the masthead cover's measured box.
  - **Under it is SimpMusic's Apple Music page**, ported from
    `AppleMusicMeshBackdrop.kt` (`lib/artwork-mesh.ts`, `<ArtworkMeshPage>`,
    `use-artwork-mesh`): the cover's ~5 KB thumbnail decoded in JavaScript,
    averaged to a 6×6 grid read bottom-up, lifted, rows shifted and mirrored
    by a seed, smoothed and blurred into a 64×64 texture drawn as a BMP data
    URI and hung from the cover's foot — its first row *is* the cover's foot,
    so there is no join. The page is drawn again over the cover's last eighth
    inside a mask, so the cover dissolves into it (the one method that works
    over a video). Ink is white unless the page is too light for it; the wash
    under the status bar is as dark as the cover's top is bright (16–65%).
    Until the mesh is read the viewer stands on the game page's colour.
    `['artwork-mesh', thumb]`, never persisted. This is a blur *of the
    picture*, not a colour picked from it, and is the one exception to
    § One colour method, by the owner's word.
  - **Static / Animated**: bold `h2` words on the page, nothing round them,
    the chosen one at full ink. Nothing is looked up until Animated is
    pressed; a line under it says "Looking for one…", "Loading the
    animation…" until its first frame, or "This game has no animated cover"
    — which a known answer says before anybody presses. Unavailable under
    Reduce Motion, and it says so.
  - A copy of the cover in a modal, transformed from the masthead cover's
    measured place and transitioned (Reanimated CSS, 300ms) to rest, its
    corner going to none; the close key, back and a tap on the page reverse
    it. The cover is the 1080p one over the page's `t_cover_big`.
- **Surprise Me plays portraits too** (`<SurpriseCardArt>`,
  `chooseCardShape`): an animated square, then an animated portrait, then
  the still square, then the box — full-size animations before previews, so
  Hades' sharp portrait beats its soft square. The card waits up to 1.2s for
  the answers, then draws what is known, and keeps that shape for the session.
- **Surprise Me loads by media type** (`lib/surprise-prefetch.ts`, the
  owner's brief): what the next two cards are is looked up first (the
  metadata — square, animations, their weight); stills for up to five cards
  ahead are prefetched within a 2.5 MB budget; a light animated image (≤ 1.5
  MB) only with the next card; a heavy one or a video only once its card is
  in front and the deck has rested 200 ms; nothing while a finger is on the
  deck; and a card swiped away drops its animation and its download.
  `<SquareArt>` caches under its own address so a prefetch lands where it
  reads.
- `<AnimatedCoverImage showNotFound>` draws "No animated cover found" over
  the cover; no screen passes it.

**Not seen on a phone.** Types, lint, `npm test` (`lib/animated-cover`,
`lib/artwork-mesh`, `lib/surprise-prefetch`) pass; the sources and sizes were
checked live. To judge on a device: the 600×900 WebP's decoding cost, the mask
over the cover's foot, and the zoom's feel.

## Search: six tabs under one field, and three pages behind it

> **Superseded in part (2026-11-03, § Apple TV).** Everything below about
> Search *untyped* — Discover, its slider, its rows, the Reviews and
> Collections tabs' charts — now lives in the **Explore** tab, and the slider
> is Explore's portrait hero. Search at rest is a grid of tiles, and its tabs
> appear only with a search. The typed scopes, facets and IGDB notes below
> still hold.

The Search tab is **a field with six tabs under it** (`<TabBar>`): Games,
Reviews, People, Collections, Studios, Platforms — always on screen,
with Games chosen when the tab opens. `SEARCH_SCOPE_INFO`
(`components/search/search-scopes.ts`) is the single statement of those six:
the tabs, the field's placeholder and the history's "in Studios" all read it, so
a seventh scope is an entry there plus a results component.

**Events is not a scope any more: it is the News tab's Events section**, at
the owner's direction (2026-10-14). The same list (`<EventResults>`, untyped:
coming up, then recent, each opening `event/[id]`) replaced the event cards
News drew from a feed of its own. A stored search in Events is dropped when the
history is read. The bullets below that describe the Events scope describe that
list.

- **There is no menu in front of it, at the owner's direction.** For one pass
  the tab rested on a "hub" — eight large buttons, one per scope and one for the
  calendar, with the pills appearing only after a choice. The owner had it
  removed: "just have them as tabs in the search screen that the user can cycle
  between". Do not bring back a screen of buttons, and do not hide the tabs in
  any state — they are there over Discover and over the recent searches too.
- **Games untyped is Discover, and it is Letterboxd's home** — the owner's
  reference (2026-10-09), in the app's materials (`<DiscoverFeed>`). Top to
  bottom: the slider, then four rows of games — Popular this month, Similar to
  (the game you reviewed last), Beloved by the community, Highly rated — then
  the Top 1000. ("Browse by genre" ended the page until 2026-10-22, when the
  owner moved genres onto Home as feeds — § Home. Do not bring it back.)
  Every one is a heading on the page with its content under
  it, thirty-two apart. Typed, it is the results. **No collections here**: a
  band of the most-liked ones closed the page and the owner had it removed
  from the Games tab — the Collections tab shows the same list. Three owner
  rulings from the same day:
  - **Field, tabs, then slider.** The field and the seven tabs stay pinned
    exactly as they were; the slider is the first thing *under* them. Offered
    the field as glass over the art, or the tabs under the slider, they chose
    neither.
  - **"Popular this month", not "this week"**, though the reference says week:
    the chart is IGDB's and it is the month's (`/top-games` says why a week of
    it moves too little). A heading states what the data is.
  - **"Similar to <game>", not "For you".** Home has "Games for you"; two rows
    with one name and different games would look broken.
- **The slider is Home's carousel now** (`<SpotlightSlider>`,
  `constants/search-spotlight`, `lib/games/spotlight` — pure and tested):
  the two biggest games out this month, the most followed game still to come
  with its countdown as the badge, and the release calendar, as "Games for
  you"'s cards (`discoverGeometry`) under the heading "Out now and coming
  soon" — the owner's (2026-11-02, with a reference: "will go like the home
  carousel… scroll automatically with this kind of animation"). The motion
  is reacticx's `ParallaxCarousel`: the art inside each card lags the row by
  `k` = 0.35 of a card, drawn `1 + 2k` wide so it covers the card at every
  offset; every six seconds the row glides (900ms, a Reanimated `scrollTo`
  on the UI thread, so the parallax runs) to the next card and from the last
  to the first. The calendar card is drawn and does not drift. It was a
  full-bleed 3:2 slider with four timer segments until then.
  **The header is the reference's too**: "Search" in `largeTitle` at the
  top left, a capsule of two keys (the calendar, the scanner — which left
  the field's trailing slot) at the right, the field, then the tabs. The
  title and the field fold together (`<CollapsingField>`); the tabs never
  move.
  - **Which games is `getSpotlight`**: two requests — the forty most-followed
    games from the start of the window to the end of this month, and the eight
    most-followed with a date ahead — ranked as the calendar ranks
    (`calendarWeight`), so the slider and the screen its last slide opens agree.
    "This month" is the calendar month; a game from it goes ahead of a bigger
    one from the thirty days before, which the window reaches back to so the
    2nd of a month is not empty. Verified live on 2026-10-09: Gears of War:
    E-Day, End of Abyss, and Grand Theft Auto VI at "41 days".
  - **A countdown only where IGDB knows the day.** A month-precise game's badge
    is the month, a year-precise one's the year (`countdownLabel`).
  - **Art is the hero rule's, at `t_720p`, and never a cover.** A game whose
    chosen art is a banner, a portrait or a wordmark (`usableArt`) gives its
    slide to the next one.
  - **The calendar slide is drawn, and always there.** The month as the
    calendar screen draws one, the days a notable game is out on lit — from the
    spotlight's own request, so it costs nothing. It needs no request to exist,
    so the slider is never empty.
  - **It moves by itself until it is touched.** Every six seconds. One drag stops it for as long as the screen
    stays up; it is still under Reduce Motion, for a screen reader, in the
    background, on another tab, and once scrolled past.
  - **The badge is near-black with white type**, as the word on a cover is. The
    reference's is orange; colour on artwork belongs to the game.
- **There is no glow on Search. Do not add one.** The owner asked for "a glow
  like the one in the home page… like a neon light above a door" under the
  slider, saw it on a phone twice in one day — hung from the slider's top
  edge, then lying along its foot and fixed there — and then: "Remove the glow
  from the search screen." `<DoorLight>` and its numbers are deleted. Home
  keeps its own glow (`<HomeGlow>`, § Home).
- **"Beloved by the community" is GameLog's own scores** (`getBelovedGames`,
  migration 0037's `beloved_games`), where the band of most-liked reviews was.
  The period — week, month, year — is a small `<DropdownButton>` at the far end
  of the heading; the score under each cover is the real average, in the score
  ramp. The order is a *damped* average (three imaginary ratings at the
  period's mean), so one 100 does not top thirty 94s and a week with four
  ratings still has a row. `null` from the query means the database has not
  run 0037 and the row is absent; an empty period says so and keeps the control.
- **The Top 1000** (`<TopChart>`, `lib/top-chart`, pure and tested) — the
  owner's request (2026-10-20): "a chart widget on the search home screen and
  show a ranking of best reviewed games on gamelog and a toggle for critic
  review sorting. Use pages and show 20 per page. It's a top 1000 games."
  **It is a screen of its own since 2026-10-21** (`app/top-chart.tsx`,
  `<TopChart standalone>`): "Move the top games chart into its own screen.
  Make a widget, like a button for opening the chart. Add the top 3 games in
  the button as cards, similar to the Surprise Me graphic." Discover shows
  `<TopChartEntry>` where the chart was — Surprise Me's button with the top
  three in the fan (`<CoverFan>`), ranks on them; GameLog's three, the
  critics' while GameLog has fewer than three rated. On the screen: a line
  saying what ranks it, two pills (GameLog / Critics), twenty
  ranked rows — rank, box, title, developer · year, the score in the ramp's
  colour over "3 ratings" / "27 critics" — and `<Pager>` under them; a page
  turn brings the heading back to the top of the screen. Each ranking keeps
  its own page. Things that are easy to get wrong:
  - **GameLog's is "Beloved" over all time**: `beloved_games` (0037, weighted
    by 0041 when it runs) with `p_since` at 1970 and `p_limit` 1,000 — one
    request for the order (`getGameLogRanking`), and the page's boxes from
    `games` for its twenty ids (`getGameLogChartPage`). The damped order is
    deliberate: one 100 does not top thirty 94s. The live project has 55
    rated games, so it is three pages today. `null` (no 0037) says the chart
    arrives with the database's next update; none rated says so.
  - **The critics' is IGDB's `aggregated_rating`**, the number the reviews
    sheet shows when OpenCritic has nothing to quote — OpenCritic is a
    request per game and cannot rank a thousand. A game needs seven critics'
    scores (`CRITIC_FLOOR`) and a cover, and must be a game as a platform's
    page counts one. 1,635 qualified, live, on 2026-10-20; page 50 answers.
    Its length is `games/count`, capped at 1,000 and kept a day.
  - **Rows on the page, hairlines between them — not a card.** "Widget" is
    the owner's word for a profile section, which is not a card either, and
    Discover's bands stand on the page by their ruling.
  - **Ties at IGDB are ordered by IGDB.** APIcalypse takes one sort field, so
    two games on 75.3 may swap between requests; a page boundary between
    them could show one twice or skip one. Not seen; not guarded.
- **The field folds away as the page is read; the tabs never move**
  (`<CollapsingField>`) — the owner's direction (2026-10-15), after SimpMusic's
  Home, whose top bar is an `AnimatedVisibility(visible = isScrollingUp)` over
  a chip row that stays. Reading down 24dp folds the field's height to nothing
  and the tabs rise into its place; scrolling up 24dp, or reaching the top,
  unfolds it; a focused field stays out. It reads `scrollY` on the UI thread,
  so **every list Search shows is the page's scroller** (`ui/page-scroll`) —
  Discover, the history and all seven scopes' results. A new body that is a
  plain `ScrollView` or `FlatList` leaves the field stuck where it was.
- **Recent searches take the body while the field is focused** and nothing is
  typed — never over Platforms, which records nothing. A tap on the Search tab
  while it is open returns it to Games with the field empty.
- **A tab can be tapped with the keyboard up** because `<TabBar>`'s scroller is
  `keyboardShouldPersistTaps="handled"`; without it the first tap only closed
  the keyboard.
- **Reviews is a scope because the field can filter it.** It was a tab here
  once and was taken out as a popularity chart the field ignored. Typed, it is
  `searchReviews` — the game a review is about, its headline, or a word in it,
  as **three requests merged**, never one `.or()`: user text inside PostgREST's
  filter grammar is a 400 waiting for a comma (the same reason `searchProfiles`
  is two). The game-title filter only narrows the logs because the embed is
  `games!inner` — verified live. Untyped, it is the chart: the reviews people
  responded to in a period (§ Discovery). **Typed, nothing is narrowed by
  language** — a search is somebody asking for a thing by name.
- **Untyped, Reviews and Collections are two sections each** — the owner's
  request (2026-10-20): "Latest reviews on review tab and most popular
  collections + latest collections". Reviews: the chart's first three
  (`CHART_PREVIEW`) under its own heading and period, "See all popular
  reviews" to `/reviews?period=…` (the same chart, opened on the same
  period), then **Latest reviews** — everything with writing, newest by
  `created_at` (the time the card prints), a page of twenty at a time as the
  list scrolls (`getLatestReviews`, keyset on `created_at`), **in the
  reader's languages** with its own `<ReadingNote>`, because it is a list
  the app picks. Collections: **Most popular**'s first three and "See all"
  (`/collections`), then **Latest collections** — authored kinds with a game
  in them, newest first (`getLatestCollections`: `list_items!inner` drops the
  empty ones, verified live). Each section loads and fails on its own; a
  section with nothing in it says so in a sentence and keeps its heading.
  Keyed `['latest-reviews', languages]` (the log form and a moderator's
  removal invalidate it) and `['lists', 'latest']` — under `['lists']` so
  the eight places that already invalidate that prefix cover it.
- **A facet's games are the Games tab's, and a facet is in the route** — the
  owner's request (2026-10-16). A game's details card makes every value — a
  genre, a theme, a mode, a perspective, the engine, a series, a franchise, a
  language, an age rating — a bold link, and pressing one `navigate`s to
  `/search?facet=theme&facetId=20&facetName=Thriller`; "Search by" sets the
  same params (`facetParams`, `facetFromParams`, `lib/games/facets.ts`). The
  Games tab then shows **every game that facet holds** — not only the
  most-rated: the owner (2026-10-16), "all, even the most obscure games and a
  game released a minute ago" — through `<CatalogueResults>`, which is the
  platform page's system: ten to a page, an exact count, the pager, and
  menus for the order (`CATALOGUE_SORT_OPTIONS`, shared with `platform/[id]`,
  including "Recently added", IGDB's `created_at`), the platform
  (`PLATFORM_GROUPS`) and rows or a grid. Typing narrows it to names holding
  the word (`name ~`, not `search`, which refuses a `sort` and a count).
  `getCatalogueGamesPage` / `getCatalogueGameCount` (`lib/games/browse.ts`)
  are the platform functions over any clause. Things that are easy to
  break:
  - **`navigate` pops the game page**: the Search tab is under it in the root
    stack. Back from the results does not return to the game. A pushed copy
    of Search would keep it, at the price of a second tab navigator in the
    stack; that was not done.
  - **What is typed and "Search by"'s choice belong to a facet** (`owner`), so
    a facet arriving from a game's page starts on its own games and not on
    whatever was left in the field — without an effect, which the React
    Compiler rules forbid for this.
  - **Four vocabularies are literals** — themes (22), game modes (6),
    perspectives (7), languages (28) — because their endpoints are not on the
    `igdb` allowlist; they were read off the live catalogue through `games`.
    Genres are fetched. Engines are searched *through `games`*
    (`game_engines.name ~ *"…"*`, tallied), series and franchises through
    their own allowed endpoints.
  - **A series is `collections`, plural.** IGDB no longer answers the
    singular: `collection = 106` is empty, `collections = (106)` is Zelda.
    `getGameExtras` and `getCollectionGames` still ask for the singular, so
    the game page's series rail has been falling back to the franchise all
    along. Left as it is — fixing it changes which games that rail shows.
  - **Facet answers are under `['search', …]`**, so they are never written
    to the device (`NEVER_PERSIST`).
  - **The only floor is what a "game" is** (`PLATFORM_GAMES`: no repackages,
    DLC, bundles, mods, episodes or updates) — the same as a platform's page.
    No cover or rating is required, so obscure entries come with blank art.
- **"Search by" answers the field being touched** in the Games tab: Game,
  Genre, Theme, Perspective, Game mode, Engine, Series, Franchise, Language
  (`<SearchBy>`), over the recent searches. A kind chosen shows its values
  matching what is typed (`<FacetPicker>`); a title typed in plain Games mode
  offers the genres, themes, perspectives and modes whose names it matches,
  as pills over the games (`<FacetSuggestions>`).
- **Every scope is its own component and takes the settled query** — except
  Platforms, which takes the field's text as it stands, because it filters ~220
  names already in memory.
- **Verified against the deployed `igdb` function**, and each of these bit:
  - `search "…"` works on five endpoints only — characters, collections, games,
    platforms, themes. **Companies and events answer a 400**; both are matched
    with `name ~ *"…"*`, which is unranked. `searchStudios` therefore ranks
    itself: exact name, then prefix, then by how many games the company made,
    over the fifty *lowest-id* matches that have any games ("naughty" returned
    eight companies before Naughty Dog; ids are insertion order, and the studios
    anyone means were added long ago).
  - **`platforms.category` is now `platform_type`**, and a `where` on the old
    name matches nothing instead of failing — `getPlatforms()` had been
    returning an empty list to the award picker. Same rename as
    `external_games.category` (§ Steam CDN artwork).
  - **`offset` holds to at least 250,000** at the latency of offset 0.
  - Nearly every event has an `event_logo` now; `youtubeThumbnail` is a second
    rung, not the supply.
- **Logos sit on the page, not on a plate** (`<LogoMark>`), at the owner's
  direction — it was a light plate under every one. Platform and company logos
  are drawn for white pages, so each is **measured once** (`useLogoInk`: a
  ~2 KB `t_cover_small` PNG decoded in JavaScript, at most 8,100 pixels, kept
  on the device for two months) and drawn one of three ways (`logoTreatment`,
  pure and tested): as it is (Windows' blue), as a light silhouette (PS4's
  black ink, the Series X's charcoal), or — when it is not cut out at all — on
  a plate of its *own* ground (PS5's white-on-black rectangle gets a black
  plate; nothing can make that one transparent). **In the Platforms and Studios
  grids each is a `<LogoTile>`** — SimpMusic's library grid, read from
  `GridLibraryPlaylist.kt` and `HomeItemContentPlaylist`: the logo on a square
  tile (`<LogoMark tile>`, the app's control surface or the logo's own ground),
  the name in `itemTitle` under it in up to two lines, then one quiet line. For
  a studio that line is how many games it made, which its search already
  returns. **For a platform it is the year it came out, not a count**: the year
  rides in the directory's one request (`versions.platform_version_release_dates`),
  and a count is `games/count` once per platform — 220 requests to fill a
  directory against IGDB's four a second, shared by every user of the app.
  All verified against the live catalogue, and three things there bit:
  - **IGDB's `alpha_channel` flag is wrong often enough to ignore**: it says
    "no alpha" of Windows' and Linux's logos, which are both cut out.
  - **Measure `t_cover_small`, never `t_thumb` or `t_micro`.** Those are square
    crops that cut a wordmark's ends off — and with them the corners the
    "has its own ground" test reads. `t_cover_small` is fitted, not cropped.
  - **Ask for `.png`** (`t_logo_med` to draw): IGDB flattens the alpha to black
    in a JPEG.
  Nothing is drawn until the measurement is known (`resolved`), for the reason
  a square cover waits; an unmeasured logo falls back to the light plate
  (`logoPlate`). The studio *page's* Commons logo is the same idea, older and
  separate (§ Studio pages, collection pages and studio logos).
- **A platform's games are pages of ten, not a scroll** (`platform/[id]`,
  `<Pager>`). The PC has a quarter of a million games; an endless list of that
  has no middle. The pager shows first, last and the neighbours
  (`pagerSlots`), takes any page by number, and a plain second one closes the
  page. The previous ten stay on screen, dimmed, while the next arrive.
- **The page count is `games/count`, with a fallback that needs no deploy.**
  `countGames` asks the count endpoint and, when the deployed function refuses
  it (an allowlist entry is inert until `supabase functions deploy igdb`), works
  the same number out through `games` — `fields id` windows, doubling then
  halving the offset (`countByProbing`): exact, about a dozen requests for ten
  thousand games, kept for a day and keyed on the *clause*, since several
  orderings share one set. "Top rated", "Newest", "Upcoming" and "Oldest" are
  different sets and have their own counts (`platformQuery`).
- **The calendar ranks by `hypes + total_rating_count`.** Follows before
  release, ratings after: one number that reads as "most anticipated" ahead of
  today and "top releases" behind it. The year is the union of the top of both
  rankings — a third of the most-rated are not among the most-followed.
- **A month is five rows of numbered days, not weeks** (`monthRows`): 1–7,
  8–14 and so on, each square under its number, no weekday header and no
  offset for the weekday the 1st falls on. The owner's direction — a release
  calendar is read by date, and dropping the sixth row and the header is what
  lets the squares be larger. Under it the month's games are **covers three
  across** (`<GameGridTile>`, dated underneath); **touching a day turns that
  into a list** of the day's games. Do not put the weekdays back.
- **A release date has a precision, and IGDB does not put it in the date.** A
  game known only as "2026" is stored as 31 December and one known as "November"
  as the 30th. `precisionOf` reads `release_dates.date_format` (0 day, 1 month,
  anything else no month) off the release row carrying the same timestamp:
  only day-precise games go on a square, month-precise ones are in the month's
  list, and year-only ones are in "No date yet". All calendar dates are read in
  **UTC** — IGDB stores midnight UTC, and local time moves every game west of
  Greenwich back a day.

## Discovery: Letterboxd's counting, and the language a review is in

The owner's brief (2026-10-13): "Understand how letterboxd uses algorithms and
code to recommend users, new people to discover, new things to watch, what
reviews get displayed in the user's feed, the language in which they appear,
how it knows the user's language… Show me the evidence, and build a similar
feature for my project."

**What the evidence says is that there is very little algorithm.** It was read
from Letterboxd's own words, not from its screens — its help centre (all 126
articles, through the public Zendesk API), its API's documentation as an
open-source client transcribes it (`erunion/letterboxd-client`, regenerated
June 2024; the docs site itself refuses automated readers), its App Store
release notes and its policies:

- **It says so itself.** "While we view the whole of Letterboxd as one big,
  organic recommendation engine, we don't have a section specifically labeled
  as such." The one personal ordering it has is "based on your watched and
  liked films… this method doesn't consider your ratings", and its similar
  films are a partner's (Nanocrowd, from the text of reviews).
- **The feed is the people you follow, in order.** "Letterboxd works like
  X/Twitter: when you follow other people, you'll see the films they add or
  review, the stuff they like…" One throttle: a diary entry dated more than
  two weeks back reaches followers at "a maximum of one item per hour".
- **Popularity is counting, in a window.** The API's sort orders are
  `ReviewPopularity`, `…ThisWeek`, `…ThisMonth`, `…ThisYear` — "reviews with
  more activity (likes/comments) first" — the same four for films, lists and
  members, and a `…WithFriends` twin of each that "consider[s] popularity
  amongst the signed-in member's friends". `filter=NoDuplicateMembers` returns
  "only the first log entry for each member".
- **The rating is damped and secret.** "A film with only a handful of
  five-star ratings has its average weighted down"; "we do not disclose the
  specifics". (`beloved_games`, 0037, is already that idea here.)
- **Language: nothing.** The interface is English only (App Store listing). A
  review has no language in the API — `language` there is a *film's* spoken
  language. Film data is imported "from the English translations". The one
  feature is translation, on the phone, for Patrons (4.6.0, July 2025: "on-device
  review translation… requires a one-time download for each translated
  language"). People build browser extensions to hide reviews they cannot read.

So the feature is those rules, and one Letterboxd does not have:

1. **A chart has a period, and counts activity inside it** (migration 0038,
   `review_popularity` / `member_popularity`; `lib/discovery.ts`). Likes plus
   the *people* who commented — not comments, so two people arguing for thirty
   replies weigh what two people weigh — and, for a person, new followers. All
   from somebody else: liking your own review ranks nothing. The control is
   "Beloved by the community"'s `<DropdownButton>`, with All time added, and
   **a chart opens on This month**, not Letterboxd's week: a week of an app
   this size is a handful of likes.
2. **One review a member, first.** Every author's best comes before anybody's
   second (`turn`, a `row_number()` per author). Among enough authors the
   first screen is one each — `NoDuplicateMembers` — and among two it is still
   a full list, where a hard one-a-member rule would have turned the live
   project's 47 reviews by two people into a chart of two rows.
3. **The same count, among your circle** — "Popular with friends" on the
   People tab: who the people you follow follow, like and reply to, that you
   do not follow yet. `circle_of()` is follows and accepted friends, the set
   `getCircleIds` builds on the phone.
4. **A review carries the language it is written in** (`logs.review_lang`),
   worked out by the app as the review is saved — there is no detector in
   Postgres — and a list that *chooses* for the reader is asked for the
   languages they read.
5. **The reader's languages are the app's, the phone's, and the ones they
   write in** (`useReadingLanguages`), unless they chose for themselves in
   Settings → Review languages.

What follows from them, and is easy to get wrong:

- **Unknown is readable, everywhere, and that is a rule in two languages.**
  `canRead(null)` is true, and both SQL functions keep `review_lang is null`.
  "10/10" has no language, and every review written before 0038 is unlabelled
  until it is next saved. `discovery.test.ts` reads the migration for the
  clause, because a chart that hid unlabelled reviews would be empty on the
  day the migration ran.
- **A chart chooses by language; a game's own reviews and a search do not.**
  Search's Reviews and People charts and the one review a game's page leads
  with (`getTopGameReview` → `leadReview`: the most liked one the reader can
  read, else the most liked outright) are narrowed. The reviews sheet shows
  everything and gains a fifth filter, Language, offered only when a game's
  reviews are in two or more (`languageFacets`). A typed search is never
  narrowed. Do not "finish the job" by filtering Home's "New from friends" or
  a profile — those are people somebody chose to follow.
- **A filter has to say so where it filters.** `<ReadingNote>` is one quiet
  line under a chart's heading — "In English and Spanish ›" — and pressing it
  opens Settings. Without it a narrowed chart looks like a chart of
  everything.
- **English is always in `auto`, and that is an argument, not an assumption.**
  The interface is English only, so whoever is using it reads it
  (`APP_LANGUAGE`). Without it a phone set to Spanish would have hidden most
  of what is written here — and **Android reports one language, not the
  list**: `I18nManager.localeIdentifier` is the app's locale and there is no
  ordered list short of a native module. iOS's list comes from
  `Settings.get('AppleLanguages')`. `expo-localization` was not added, for
  § APK size's reasons; which is why the Settings control exists.
- **`review_lang` is optional in the type, not just nullable**
  (`review_lang?: string | null`): a database without 0038 has no such column,
  so the field is *absent* from its rows. And **`saveLog` tries the label and
  drops it**: PostgREST refuses the whole row for one unknown column
  (`PGRST204`, verified against the live project), so sent unconditionally no
  log could be saved until the migration ran — what 0023 did to this form
  once. The first refusal is remembered for the session (`languageColumn`).
- **Old reviews are not labelled in the background, deliberately.** A repair
  pass would be an UPDATE per review, and 0001's trigger sets `updated_at` on
  every update — which is what `beloved_games` reads as "scored in this
  period". Labelling a person's old reviews would have filed all their old
  scores under this week. They are labelled when next saved; until then they
  are unknown, and shown to everybody.
- **The function's order is kept, never re-derived.** `review_popularity`
  answers ids in order, and that order is *not* the order of its `activity`
  column — an author's second review comes after everybody's first, whatever
  it scored. `getReviewChart` places rows by their index in the answer;
  sorting by the number would undo rule 2.
- **A chart waits for `ready`.** The reader's stored choice is one
  AsyncStorage read; asked before it, a chart fetches for the wrong
  languages, draws, and swaps its rows. So those queries are `enabled: ready`
  and their screens guard on `isPending`, not `isLoading` — a query that is
  waiting is not fetching, and is still not empty.
- **Languages are a device preference** (`lib/reading-languages`, keyed by
  user, in `NEVER_PERSIST`): `profiles` is readable by everyone, and which
  languages a person reads is theirs to say.
- **0013's functions stay, and the app falls back to them.** On a database
  without 0038 `getReviewChart` answers `windowed: false` from
  `popular_reviews` and the People tab shows "Most liked" from
  `popular_users`: no period control it could not honour, no friends section,
  no language note. A renamed RPC parameter is a `PGRST202` the app reads as
  "not migrated" and quietly falls back on — `discovery.test.ts` checks every
  `.rpc()` argument against 0038's signatures for that reason.

**The detector** (`lib/language.ts`) is the script first — Hangul is Korean
whatever the words are — and then, for Latin and Cyrillic, the words every
sentence is held together with, plus the few a review of a game cannot avoid
("juego", "jeu", "Spiel"). Thirty-nine languages; about 5,400 words in thirty
lists, 58 KB of source. What makes it work:

- **A word counts for less the more languages have it** ("de" is in twelve
  lists; "juego" in one), and **two near languages are compared on the words
  they do not share**, counted in words: Norwegian's "av" against Danish's
  "af" is one word, whatever Swedish also thinks of it. Counted the first
  way — every hit equal, the lead a share of the total — Danish and Norwegian
  tied on nine sentences in ten.
- **A word spelled with a letter one language owns is that language's word**
  whether or not the list has it (`OWN_LETTERS`): "префектуры" is Russian for
  its ы. That is what finds the inflected languages. Letters something
  *unnamed* shares are not in that table — Polish's ą and ę are Lithuanian's.
- **The cure for a neighbour mistaken for a language is to name the
  neighbour.** Estonian came back Finnish, Afrikaans Dutch, Slovenian
  Croatian, Galician Portuguese, Azerbaijani Turkish; each is in the detector
  now, and each addition moved its own errors to "unknown". Malay is the
  exception and is labelled Indonesian on purpose: reading one is reading the
  other (`READS`).
- **It answers `null` far more readily than it guesses**, because a wrong
  label hides a review from the people who could read it and a missing one
  hides nothing. Two words of evidence (a one- or two-letter Latin word is
  half of one), 15% of the text recognised, a lead of one word over every
  rival.
- **Japanese is hiragana, not kana.** A sentence that is nine tenths kanji
  still has its は; Chinese that quotes a Japanese title has katakana and
  characters only Chinese writes (`CHINESE_ONLY`). Two kanji alone (最高) are
  not labelled at all.
- **The game's own title is read past** (`ignore`): "The Last of Us" is four
  English words in a Spanish sentence. Whole phrases only — a review of
  *Rain* still says "training".
- **No `\p{…}`.** A Unicode property escape the engine does not know is a
  syntax error while the module loads, on a phone. Scripts are code point
  ranges. `ə` is filed under phonetics (U+0259) and is in the Latin ranges by
  name: without it Azerbaijani's commonest vowel split every word it was in.

**Measured, on prose nobody here wrote**: sentences from Wikipedia, in every
language it names and six it does not. Three sets, because a detector tuned on
a set is flattered by it:

| Set | Sentences | Right | "Unknown" | Wrong |
| --- | --- | --- | --- | --- |
| A — articles on video games; the lists were tuned on it | 1,415 | 90.7% | 8.8% | 0.4% |
| B — Nintendo, football, cats, music; seen once | 1,615 | 87.3% | 12.3% | 0.4% |
| C — chess, dogs, water, Japan; never looked at first | 1,545 | 86.8% | 12.9% | 0.3% |

B read 83.2% / 16.0% / 0.7% when first measured; two rules changed because of
it (kanji-heavy Japanese was coming back Chinese, and Russian's one-letter
words were being counted as half), so its second reading is no longer blind.
**C is the honest one**: thirty-four of the thirty-nine languages (Persian,
Azerbaijani, Afrikaans, Estonian and Norwegian were still downloading at
Wikipedia's rate limit when it was run). Its four errors are two quotations —
Chinese spelling out a Japanese reading in hiragana, Arabic naming something
in Persian letters — and two between neighbours: a Slovak and a Slovenian
sentence read as Croatian.

- **Short text is mostly "unknown", not wrong.** The first eight words of a
  sentence: 73% right, 0.3% wrong. The first four: 49% right, 51% unknown,
  0.3% wrong (set C). A two-word review usually goes unlabelled, and is shown
  to everybody.
- **A language it does not name is left alone 97% of the time** (set B):
  Lithuanian, Latvian and Icelandic 0 wrong of 124; Swahili and Tagalog 5 of
  77. Malay is labelled Indonesian on purpose.
- **Recall is uneven and that is where the lists are thin**: on set C Slovak
  51%, Turkish 59%, Danish 61%; on set B Azerbaijani 44%, Estonian 36%.
  Agglutinating languages, whose words a list of function words mostly cannot
  hold, and near neighbours (Slovak and Czech, Danish and Norwegian), which
  tie. They fail to "unknown".
- An encyclopedia is not a review. Reviews are shorter and chattier, which
  cuts both ways; nothing here has been measured on real reviews, because the
  live project has forty-seven and most are test strings.

**What was not built, and why:**

- **No new row on Home or on Search's Discover.** Letterboxd's
  `FilmPopularityWithFriends` — games popular among your circle — is the one
  mechanism of its that is missing here, and it has no surface: Home's four
  bands and Discover's four rows are the owner's rulings, and "Popular with
  friends" beside "New from friends" is a second helping of the same band. If
  it is wanted, it is one function and one row.
- **No translation.** Letterboxd's is the operating system's, on the phone;
  here that is a native module, for a feature that the language filter makes
  mostly unnecessary.
- **No blocking, and no feed throttle.** Both are real parts of how
  Letterboxd's feed behaves; neither was asked for and each is a feature of
  its own.
- **"Games for you" and "Similar to" were left alone.** They are already
  Letterboxd's two personal mechanisms — your own highly rated games,
  extended by similarity, with what you have logged left out.

**Run `node scripts/discovery-sql.mjs` after touching 0038.** It loads every
migration into an in-process Postgres and checks the functions against seven
people whose likes, replies and follows were worked out by hand. `npm test`
has no database and cannot.

**Not seen on a phone, and 0038 has not been run on the live project.** Types,
lint, `npm test` and a Metro bundle are clean; the SQL was run on Postgres 18
(PGlite) over the real migrations. What is unverified is everything a device
decides: what `deviceLocales()` actually returns on the owner's phone, how
the period control and the language note sit in the People tab's headings,
and the Settings panel with thirty-nine chips in it.

## The community score: a weighted average (0041)

The owner's brief (2026-10-20, a long specification pasted with the Search
request): a game's GameLog score becomes a **weighted average of every rating**,
after analyses of Phish.net's show ratings — some rating patterns carry less
information about how one game compares with another, and a weighted mean
can give them a little less influence without discarding anything. The brief
named its parameters (10 and 30 ratings, 0.15, 97.5, 0.15 / 0.30, 0.70) and
its non-negotiables; the Phish.net posts themselves answered automated
readers with 403 and were **not read**, so nothing here claims to restate
them.

**The method** is `lib/community-rating.ts`'s docblock, in eight steps; in
one breath: a person's weight is 1.00 unless their ratings rarely vary
(normalised Shannon entropy over five fixed 20-point bands under 0.15: up to
0.85) or rarely vary *and* sit further from everybody else's than 97.5% of
comparable people's (leave-one-out, on games with 3+ other raters, once 40
people have 10 such games: up to 0.70); the adjustment grows linearly from
nothing at 10 ratings to all of it at 30; the score is Σ r·w / Σ w.

**The authority is the SQL; the TypeScript is the reference.** Migration 0041
computes everything in Postgres from `(user_id, game_id, rating)` and the
parameters in `community_rating_params()`; `lib/community-rating.ts` is the
same algorithm, which `npm test` holds to the brief and
`scripts/community-rating-sql.mjs` holds the SQL to — every statistic, weight
and score, on a database seeded *before* 0041 ran. Nothing on the phone
computes a score.

What is easy to break:

- **The parameters live twice and must agree.** The JSON literal in
  `community_rating_params()` and `COMMUNITY_RATING`;
  `community-rating.test.ts` parses the one and compares it with the other,
  and reads the `weight between 0.70 and 1.00` CHECK. A change to any number
  is a new migration that bumps `version`, then both scripts.
- **No time, no reviews, no counts of anything else are inputs.** Never a
  date, a login, account age, a review, followers. `RatingRecord` has three
  fields; the test scans 0041's weighting SQL for `created_at`, `updated_at`,
  `interval` and `review`, and for any `cron.schedule`. Beloved's *period*
  is a chart's window (0037), not anybody's weight.
- **Ten ratings or fewer is always 1.00, and nothing is ever 0.** The signals
  only exist past ten ratings; the floor is 0.70 in the function and in the
  table's CHECK. High deviation alone costs nothing — the harness has a
  contrarian who is the most different person in the room and counts in full.
- **Statistics are rounded to six decimals before a threshold or a rank reads
  them**, in both implementations, and the SQL sums in `numeric` (exact,
  order-independent) — so a recalculation is deterministic and the two
  implementations agree except within 1e-12 of a sixth-decimal boundary. The
  TS reference sorts its records first (`canonicalOrder`): a floating-point
  sum depends on order, which is what its determinism test caught.
- **The score is never rounded until it is drawn** (`clampScore`), and the
  verdict word, its colour and its figure are read off the *rounded* number:
  an unrounded 54.6 beside the "55" it prints would otherwise read "Mixed".
  `RatingBreakdown.average` is the unrounded weighted score.
- **Consistency.** Statement-level triggers on `logs` (insert / update /
  delete, with transition tables) fire on a change to who rated what, or how
  much — a status edit does nothing. Up to 5,000 ratings a change recalculates
  everything inside the save, so after it commits no screen can read a stale
  number; above that, the changed games at once and the weights within 15
  minutes (the next save after that, or a pg_cron job — 0041's header has the
  line). An advisory transaction lock serialises recalculations against lost
  updates. Measured in PGlite: one save 0.3 s at 10k ratings and 0.9 s at 25k
  on the full path, 23 ms on the per-game path — which is where 5,000 came
  from.
- **The client caches every score as one family**: a rating write calls
  `invalidateCommunityRatings` (the eight roots under § Conventions, query
  keys). The progress sheet's delete did not refresh the score at all before.
- **Who sees what.** `game_ratings` is public except `weight_sum` and
  `effective_raters` (column grants: on a one-rater game the weight sum *is*
  that person's weight) — so it is selected by named columns, never `*`.
  `rater_stats` is its owner's alone (`my_rating_influence()`), moderators get
  aggregates only (`community_rating_report()`), and no client can write any
  of the three tables or call the recalculation (moderators have
  `recalculate_community_ratings()`). The breakdown's groups carry a weighted
  mean and, for platforms, a share of the game's weight — never a weight sum.
  Weighted means over public ratings do let a determined reader infer weight
  *ratios* on a game with two or three raters; that is inherent, and said in
  0041's header.
- **Words.** The explanation never describes a person: "ratings that rarely
  vary", never "unreliable". `explainInfluence` writes the personal part and
  its test checks for a list of judging words.

**What it changed on the live data: nothing, today.** A read-only dry run
(`scripts/community-rating-report.mjs`, 2026-10-20): 59 ratings by 3 raters of
55 games; no rater has a comparable rating (no game has 3+ other raters), so
the deviation signal is unavailable; nobody's ratings are concentrated enough
for the entropy signal (0.688, 0.491, and one rater with a single rating); so
every weight is 1.00 and every score equals its plain mean — under the
configured parameters and every variation in the script's sweep. The method
starts to matter as the community grows; until then it is the plain mean, by
construction.

**Not applied to the live project, and not seen on a phone.** Types, lint,
`npm test` and the PGlite harness pass. Still to do on the owner's side: run
0041 in the SQL editor (it weights every existing rating as it runs). Concurrent
saves were not exercised — PGlite has one connection; the lock is argued in
0041's header.

## Loading: SimpMusic's rules, on TanStack Query

How the app loads was rebuilt after reading how SimpMusic does it — its source,
not its screens: `HomeViewModel.kt`, `ArtistViewModel.kt`,
`core/data/repository/HomeRepositoryImpl.kt`, `core/domain/utils/Resource.kt`,
`SimpMusicApplication.kt` (its image loader) and `HomeScreen.kt`. SimpMusic is
Compose and view models; this app is React Native and TanStack Query, so what
was taken is the rules, each restated in this stack. Five of them:

1. **A screen that has been seen opens with what it showed last; the network
   overwrites it.** SimpMusic's Home serves its cached copy and then emits the
   network's — "a stale frame costs nothing while a spinner does". Here every
   query a screen loads is written to AsyncStorage and read back **before the
   first screen mounts** (`lib/query-persist`), so a cold start is the feed that
   was on screen last time, refetching behind itself, instead of a spinner on
   every tab. A restored query keeps the time its data really arrived, so
   `staleTime` decides whether it is refetched exactly as it does for any other.
2. **An error never replaces content.** The same function, on failure: "Already
   showing the cached copy — surfacing an error over it would replace working
   content with an error state." A query's `isError` is true after a *refetch*
   fails while its `data` is still there, so `if (query.isError) return
   <ErrorState/>` threw away a loaded page on one bad request — and, with rule 1,
   would do it on every launch without signal. **Guards on a query read
   `isLoadingError`** (failed with nothing to show); eighty-two were moved.
   `isError` is right only on a *mutation*, which has no `isLoadingError` — the
   typechecker says which is which.
3. **State outlives the screen.** SimpMusic's screens hold nothing; a view model
   that outlives them holds the page, so going back is a re-draw. Here that is
   `gcTime`: thirty minutes instead of TanStack's five (`lib/query-client`), so
   a page left a while ago is still in memory when you return to it.
4. **Never download the same record twice.** A list is fetched as whole records
   and drawn as rows; the page a row opens then asked for that record again and
   waited on a spinner for it. `lib/seen.ts` keeps complete records as lists
   download them, and the page starts from one (`initialData` +
   `initialDataUpdatedAt`): the **game page** from any list fetched with
   `GAME_FIELDS` (`toFullGame` in `igdb.ts` → `games/seen-games.ts`), the
   **review page** from any list of reviews (`rememberLogs` → `api/seen-logs.ts`),
   and a **copy's screen** from the copies list or the game page
   (`getCopies` → `api/seen-copies.ts`).
   Each is on screen in the frame it opens, with no request when the list was
   loaded inside the page's `staleTime`.
5. **The cache belongs to an account.** Rows are namespaced by user id, restored
   only once the session is known (the auth store does it, and holds
   `isRestoring` — and so the splash screen — until they are in), and **memory
   and disk are both emptied whenever the account changes**. `['feed']` and
   several other keys do not say whose they are; signing out used to leave the
   last person's feed in memory for the next.

What follows from them, and is easy to get wrong:

- **Query data must be plain JSON, or it is not kept.** `isPlainJson` refuses a
  `Date`, a `Map`, a `Set`, a class instance, `NaN`, and an `undefined` inside
  an array — each comes back from disk as something else, and the screen that
  reads it would throw at launch. Such a query still works; it just starts cold.
  Return ISO strings and arrays from a `queryFn`.
- **Bump `CACHE_VERSION` when a query's shape changes incompatibly** (a field
  renamed, an array that became an object). Rows of another version are dropped
  unread. Adding a field needs no bump. It is 4 (the fourth bump is the
  community score's: § The community score). The first bump was not for
  shape but for *content* — every saved game named the old hero image (see
  § Artwork), and its page would have opened on an upscaled icon until the
  fresh record arrived. **The second is what forgetting this rule costs:** a
  collection's summary lost `mosaic` and gained `stack`, nothing was bumped, and
  every saved list of collections came back without the field its tile maps
  over. The owner's first launch after that change opened the collections on
  "cannot read property 'map' of undefined"; the error boundary emptied the
  cache, which is why "Try again" worked. **A rename is a removal.** When a
  field a component reads off query data changes name, bump the version in the
  same change — typecheck and `npm test` both pass without it, because neither
  has an old row to restore.
- **What is never written** is in `NEVER_PERSIST` (`query-persist-rules.ts`):
  answers to something typed (`search`, `barcode`), queries that only *read* a
  store the device already keeps (`search-history`, `log-draft`, the colour and
  logo caches), sync status, and everything whose key starts with `surprise` —
  a restored deal is last time's games. A new query of one of those kinds goes
  in that list.
- **One row per query, never one blob.** TanStack's own persister writes the
  whole cache as a single value. Android reads a row through a 2 MB window — a
  larger one is unreadable and takes the cache with it, silently — and
  AsyncStorage's database is 6 MB in total, shared with every other store here.
  So: a row per query (≤ 400 KB), 120 rows and 2 MB at most, oldest data evicted
  first, written 1.5s after a query settles and at once when the app is left.
- **Three things stop a bad row from becoming a crash loop.** Everything written
  is checked and versioned; a launch that finds the previous one died within
  four seconds of restoring drops the cache instead of restoring it again
  (`BOOT_KEY`); and a render error anywhere reaches `<AppErrorBoundary>`, which
  empties the cache before offering "Try again". There was no error boundary at
  all before — a render error closed a release build.
- **Only a complete record may be remembered** (rule 4). `STUDIO_FIELDS` and the
  `similar_games` expansion ask for a third of a game's fields; remembering one
  would hand the game page a game with no description and tell it that was
  everything. A list of reviews selected with fewer columns than
  `LOG_WITH_RELATIONS` must not go through `rememberLogs`.
- **The first render of a page opened from a list is now the whole page**, not a
  spinner — the same path a revisit already took. Anything that assumed a
  loading frame first (an arrival animation, a measured layout) should be
  checked against a revisit, which is the case that already existed.

What SimpMusic also does and this app already did — left as it was: one image
cache with explicit keys and a crossfade (`<Poster>`: `memory-disk`,
`recyclingKey`, a 220ms transition; Glide's 250 MB disk cache), stable keys and
windowed lists (§ Gotchas, list windows), requests in parallel and cancelled
when superseded (`signal` through the IGDB `queryFn`s), negative answers cached
with a TTL (the square-cover, Steam-artwork and logo stores), and ABI filters on
the sideloaded build (§ APK size).

**One thing it does that was deliberately not copied yet:**

- **Screens that are not on top stop working.** Compose stops collecting state
  for a destination that is not started; here every screen in the stack and all
  four tabs stay subscribed and re-render when their queries change. The
  equivalent is `freezeOnBlur: true` on the Stack and the Tabs. It was left out
  because it cannot be seen working from this machine and it detaches refs
  while a screen is frozen — `<Screen>`'s Android blur target is a ref held in
  state (§ Gotchas), which is exactly what a freeze would disturb. It is two
  lines; try it on a phone, alone, and open a screen with a frosted top bar
  after returning to it.
**And one that is copied now** (2026-10-22, the owner: "use simpmusic way of
loading things, animations and skeletons, animations of things arriving on
screen too. The smoothnes of it"):

- **A skeleton shimmers, and content rises into its place.** SimpMusic's
  placeholders (`Shimmer.kt`) are blocks of `shimmerBackground` wearing
  `Modifier.shimmer()` (`UIExt.kt`): a gradient `[background, line,
  background]` swept from `-2 × width` to `+2 × width` on
  `infiniteRepeatable(tween(1000))`, clamped outside that span — so a flat
  block with one soft light passing over it and no seam where the light
  begins. `components/ui/shimmer` is that, and **`<Skeleton>` is it now**, so
  every one of the app's ~forty placeholder call sites got it without being
  edited. Two things about it:
  - **It reverses the old rule, and the old rule was right at the time.**
    `<Skeleton>` was static because "a shimmer across a whole search list
    costs more in dropped frames than it gains in perceived speed" — a cost
    paid on the JS thread. This is a **Reanimated CSS animation**
    (`animationName` on a React prop), declared once and run on the UI
    thread, so a list of thirty neither slows the JS thread nor is slowed by
    it; and it has no end value to lose (§ Gotchas), because it never ends
    and the pose React holds is the plain fill.
  - **The travel is dp from a measured width**, not the `'200%'` a CSS
    transform would accept: a percentage transform is interpolated natively
    and nothing here can be run on a phone to confirm it. One extra render
    per block on mount, nothing after.
  - **`skeletonSweep` is measured, not picked.** The reference's background
    composites to a relative luminance of 0.0178 over its own `#121212`
    panel and `skeleton` here is 0.0177; its line stands at 1.72:1 on that,
    and `skeletonSweep` is the colour at the same ratio on `skeleton`.
- **A band that has loaded arrives** (`components/ui/arrive`): `<Arrive>` is
  SimpMusic's `AnimatedVisibility(enter = fadeIn() + expandVertically())`,
  at Compose's own `DefaultDurationMillis` of 300, on Home's five bands and
  on every shelf of a mood or a genre. `stagger(index)` holds a run of
  equal-looking cards back 100ms each (capped at four) so a band fills from
  the top rather than appearing as a slab. **It is a fade in, not the
  reference's `Crossfade`**, and that is deliberate: the reference swaps its
  whole page, where overlapping two full-page states costs nothing, while a
  band here is one item in a column and Reanimated keeps an *exiting* view
  mounted — so cross-dissolving a skeleton with its content would hold both
  in the column for 300ms and shove everything below down a band's height
  and back. The content takes the skeleton's place in the same frame and
  rises into it, which only reads as a cross-dissolve because this app
  already requires a skeleton to be the height of what is coming.
- **Still under Reduce Motion**, both of them.

## Review cards

**Two styles, and where each goes is the rule.** A review in a *list of
reviews about many games* is `<LogCard>`; a review on *a game's own screens* is
`<MemberReviewCard>`.

- **`<LogCard>` is every list**: a profile's Reviews tab, Search's Reviews, the
  most-liked page. It began on Home alone, as the owner's new look; they then
  had it "replace the rest of the review cards in the app". It took the place
  of the Letterboxd-style card `log-card.tsx` used to hold and of the profile's
  square-art rows (`review-list-row`, deleted — which is why SteamGridDB has
  three surfaces now, not four). Cards stack `Spacing.x12` apart everywhere.
  **Home no longer has one**: its band of reviews became "New from friends", a
  row of covers (§ Conventions, rows of games).
- **`<MemberReviewCard>` is a game's own screens**: the one card on the game
  page's Overview (the most liked review) and every row of the reviews
  sheet. **Its layout is the owner's second reference** (2026-10-20, "for the
  review sheet: look at the second image" — a music app's review card): the
  words first and alone (`reviewExcerpt`, `proseInk`), **a rule under them**,
  then the writer along the foot — a 28dp face, the name in `text` (the
  brightest thing in the row, as the reference measures it: ~#D0D5DD against
  the writing's ~#99A3AE), and the score as **the number and its verdict word**
  (`<ScoreLine>`) where the reference sets stars. The likes and the replies sit
  at the far right of that row, where the reference puts a chip. The fill is
  still the caller's — the game's dark tone on its page, the app's neutral
  `surface` in the sheet — and the corner is now `Radius.review`, shared with
  `<LogCard>`. A spoiler notice takes the words' place. Twelve above the rule
  and eight below, measured off the reference. It replaced the Letterboxd
  arrangement of 2026-10-09 (face at the left of the words, name and score
  across the top, the likes on a line of their own); nothing it carried was
  dropped, only reordered. Three things that are not in it:
  - **No stars.** A score is 0–100, the number in the score ramp's colour.
  - **No orange heart beside the score.** In the reference it means the writer
    marked the film as liked; GameLog records no such fact about a game. The
    heart is on the likes line and lights (`liked`) when *you* liked the review.
  - **No count of nothing.** "0 likes" and "0 replies" are not drawn.
  The likes and replies were already in the sheet's query; `getTopGameReview`
  carries `comments` now for the Overview's.
- **`<ReviewQuote>` is what it began as**: the critics' card — a quote and a
  score, the outlet printed under it by its rail — and the card a copy's screen
  shows its owner's review in. It was the member's card too ("text, a name and
  a score, and nothing else") until the change above; do not put a member's
  review back in it. **Surprise Me draws `<MemberReviewCard>` too**, at three
  lines, the owner's "literally the same one" (2026-10-16); `<ReviewCard>` was
  deleted with that.
- **A flat card, one step above the page** (2026-10-20). One solid fill —
  `surface`, the owner's `#1B1F28` on their `#14171C` page, 1.089:1 — the
  corner measured off their references (`Radius.review`, 12), **a 1dp hairline
  edge in `border`** as both references draw one, and the card shadow. Nothing
  else is drawn on it.
  It was the other way round for several months: its own near-black
  `reviewCard` (#020306 by the end), a shade *under* the page, with no edge.
  That token is deleted — the owner gave one colour for every card — and the
  "a block of content never takes an edge" rule is lifted for this card and
  this card only (§ Conventions, actions and choices).
- **A collection's card is this card**, at the owner's direction ("the same
  card as the review card in the home page"): `<ListTile>` restates the fill,
  the corner, the inset, the twelve between parts and the shadow. Change one
  and change the other. See the bullet on collections under § Conventions.
- **Every card in the app is this card** — the owner's direction
  (2026-10-20): "make all the cards in the app with that style of the review
  ones, with the same size and corner ratio and stuff. Even the ones in the
  game page." The material is `components/ui/card-material.ts`, once:
  `cardShape` (`Radius.review`'s corner, the 1dp hairline's width, the card
  shadow), `CARD_INSET` (15), `CARD_GAP` (12) and `useCardMaterial()` for the
  fill and the edge. `<Card>`, `<SectionCard>` / `<InfoCard>` (every section
  card on a game's Overview), `<Panel>` (Ratings, On GameLog, Played by),
  `<MemberReviewCard>`, `<ReviewQuote>` (the critics' card), Surprise Me's
  review shell, the game page's own-log block, an award slot, the log form's
  and Surprise Me's cards of rows, and the screens' own content cards
  (moderation, playthroughs, copies, submissions, the scan and release forms'
  game rows, the library's two ends, the captioned board's tiles, the genre
  tiles) all read it. `Radius.card` *is* 12 now, so anything card-shaped that
  is not a content card (a notice, a selection card, a menu row) has the same
  corner; `cardLarge` (18) and the section metrics' scaled 8 / 16 are gone.
  `review-card.test.ts` holds the two radii equal and fails by file if a card
  is drawn with the old metrics again.
  - **The fill follows the page, as this card's always has.** `surface` on
    the app's own pages; on a game's page — built from the game's Material 3
    colours — the game's dark tone, its `primaryContainer` at half
    brightness, which is what the Overview's cards and its review card were
    already filled with. A blue-grey card on a red game's page would be the
    one foreign object there. With game colours off (Settings) a game's page
    is the app's room and its cards are `surface` (`AccentRoles.tonal` is
    what tells them apart). **This was a reading of "even the ones in the
    game page", not a quote**: the shape, edge and inset moved; the colour
    stayed the game's. If the owner meant `#1B1F28` on every game's page
    too, it is the one line in `cardMaterialFor`.
  - **A card that clips (`overflow: 'hidden'`) takes the corner and the edge
    but not the shadow**: Android clips a view's elevation with its
    contents. `<Card>` keeps two views for that reason; a card of rows drops
    the shadow.
  - **Not cards, and left alone**: rows of covers (never in a card — the
    owner's ruling), the actions drawn as filled grey rows (Settings' rows,
    the add-to-collection picker's), choices (`<SelectionCard>`, outlined),
    sheets, menus, the Top 1000's rows (a list on the page) and the protected
    game case.
- **It was "black chrome" for one pass, and the owner took it off. Do not
  rebuild it.** The first build was a plate of near-black metal with a
  spotlight at its top centre, a sideways streak and a violet fringe, as one
  native gradient background (`ui/chrome-plate`, `lib/chrome-plate` — both
  deleted), with the review on a darker strip sunk into it. Two directions
  followed, in order: "make the color closer to the background color, almost
  the same but ever so slightly different", then "remove the chrome from it,
  make it only a solid background color. Also, remove the black box that the
  review text has." So: no gradient, no light, no rim, no hairline edge, and no
  box behind the words.
- **The colour follows the page.** The card is on Home (`homeBackground`, the
  colour the owner tries things on) and everywhere else (`background`); the two
  are the same hex today. `review-card.test.ts` holds `surface` to one
  perceptible step above *both* pages (1.05–1.15), checks every ink on it at
  AA, and — since the card moved up past where the ladder's middle used to be —
  that the whole ladder still only ever climbs.
- **The layout is the owner's reference** (2026-10-20, the three small cards:
  "look at the round corner ratio of the card, the color, where the information
  is at, the stars are gamelog's 71 + label score"). Three blocks, twelve
  apart:
  1. **The art and the billing**, side by side. 56×84 box art
     (`ART_HEIGHT`/`ART_WIDTH`, as tall as a two-line title plus the credit
     line plus the score, so the row never changes height with the title); then
     the title (bold, two lines at most), developer · year, and **the score as
     `<ScoreLine>` — "92 OUTSTANDING"**, the number and its verdict word in the
     score ramp, where the reference sets five stars. The square
     (`<ScoreTile>`) that was here is gone, as the score's *drawing* went
     before it (§ Score figures). A log with no score shows its status word
     there instead, which is the only thing that slot can say about it.
  2. **The writing**, across the card's **full width** — it was beside the art.
  3. **The writer**: a 24dp picture, `@username`, the badge slot, and the time
     at the far end ("now", "12h ago", then a date after a week:
     `timeAgoPosted`). The reference has no time there; the card has carried
     one since the owner asked for it, so it kept its corner of the row.
  **The card hugs the writing**: "when the review ends, immediately under is
  the username" — the owner's one correction to their reference, whose cards
  are a rail and stand equal-height. Nothing in the card grows to fill space,
  so cards in a list are no longer all one height (`LOG_CARD_HEIGHT` is gone
  with that; nothing read it since Home stopped drawing the card).
- **Type**: `text` for the title and the review; `textSecondary` for the
  developer line and the `@username`; `textMuted` for the time, the quietest
  thing on the card. All four match the reference's own inks, measured (title
  ~#E1E4EB, credit and handle ~#697581). Bold is the title and the score only.
  Upright, with no quotation marks of its own — a quote brings its own drawn
  marks, and three lines of 13sp italic are harder to read than the same three
  upright.
- **The badge slot is real and empty.** `badges` is a prop that renders between
  the name and the time; nothing is drawn today and no space is visibly
  reserved — the gap is what pushes the time to the far end.
- **The writing may be the review's one sentence**, between drawn marks,
  when its writer chose that for their cards (§ A review in one sentence).
- **It carries a time, and nothing else about the response to it.** No like,
  headline, playthrough strip or report flag — those are on the review's page.
- **Three targets**: picture and name open the person, the art opens the game,
  the billing and the writing open the review. A spoiler notice takes the
  review's place and is its own button.
- **Not yet seen on a phone.** Both cards were checked on a still rendered
  from the real tokens and Poppins' real advance widths, and the references
  were measured pixel by pixel (their page is `#14171C` and their card
  `#1B1F28` exactly, which is where the owner's two hexes come from). Nothing
  about either has been judged on a device.

## A review in one sentence, and its image

The owner's direction (2026-10-16), with three mock-ups: the review's headline
became **"Describe the game in one word or sentence"** — a quote — drawn
between large quotation marks; the review page lays the score beside it; the
writer chooses whether their cards show the quote or the text; and a review can
be made into an image to save or send, after SimpMusic's lyrics card.

- **The quote is `logs.review_title`, reused.** It already held one line of the
  writer's words and every reader, search and report read it; 0040 adds only
  `review_display`. A review is now the sentence, the text, or both — the
  form's old "a headline and a body, all or nothing" is gone. **Whether a log
  "has a review" is `hasWriting`**, never `review` alone: the top review, the
  reviews sheet, Search, a profile's Reviews tab, Home's activity and the
  "Similar to" seed all ask that now, and a query spells it
  `.or('review.not.is.null,review_title.not.is.null')` (`HAS_WRITING`). A
  second `.or()` on the same request is ANDed with it — verified live.
- **85 characters** (`QUOTE_MAX`): the owner asked for "no more than 3 lines…
  in the surprise me screen". It was measured with Inter's own advance widths
  (`lib/testkit/app-font.ts` reads the TTF): Surprise Me's card holds about
  ninety, a list's card — beside its art, the narrowest — about eighty-five,
  and the owner's own example is eighty-one. An 85-character quote can take a
  fourth line in a list's card, which then grows by a line; 0004's CHECK still
  allows 140, so an old headline is kept, and the form asks for it shortened.
- **The marks are drawings, not letters, and blocky.** Inter's “ ” are two
  slanted bars that read the same either way round; the owner asked for "the
  upside and upside-down ones", then — shown round teardrops — for blocky ones
  like their mock-up's. `assets/images/quotes/quote-marks.svg` is a 66 and a 99
  as heavy slabs with a wedge,
  rasterised by `node scripts/quote-marks.mjs`, each PNG exactly its ink and
  tinted where it is drawn. They are React Native's `<Image>`, not expo-image:
  the shared image is captured on a software canvas (below).
- **The layout, the owner's third pass** (2026-10-16), from their examples:
  `“ This game is the / best          ”` — the opening mark before the first
  word, the lines under it, flush left, and **the closing mark always at the
  far right of the last line**, whatever its length; so the last line keeps
  room for it and a last word that would run into it goes down. One fixed
  size a place (`PULL_QUOTE`: 12 on cards, 15 on the page, 16 on the classic
  image, 14 on the Rating one), all in Inter ExtraBold — onboarding's headline
  weight, measured from its own font file (`lib/font-advance.ts`) so the lines
  break where the phone breaks them — the marks a little taller than the
  capitals, a gap of about two spaces from the words.
  - **The page's quote was fitted to the score's row for one pass** — every
    length sized until its ink touched the square's top and foot — and the
    owner took it back: "The text size should be fixed, and it should be much
    smaller." Do not bring the fitting back. Justification went the pass
    before ("just have it regular").
  - **`<QuoteBlock>` lays the lines out itself** (`lib/quote-layout.ts`, from
    Inter's advance widths in `lib/font-advance.ts`) and draws each as a
    one-line text where it was put: a first-line indent is not something
    React Native's text can do, and the closing mark's room can only be kept
    by a layout that knows where the lines break. A mark stands a little above
    the capitals — as high as the closing one can go without touching the line
    above (tested). Without a `width` it measures its place first, so a card
    draws its quote a frame after the card.
  - On the page the square's number and word are white (`ScoreTile ink`), the
    review's text is white, and the writer is a face and a name, no pill. The
    page's three parts — the game, the verdict, the writing — stand forty
    apart, at the owner's "everything is too clustered".
- **The review page is the owner's phone screenshot, 1:1** (2026-10-17, the
  third pass: "FOLLOW THE SCREENSHOT, THE EXACT SAME STYLE, SIZES, GAPS"). A
  music app's review at 720px across a 360dp phone — two pixels a dp — and
  `constants/review-page.ts` is its pixels halved; its test lays the page out
  with Android's line-height rule and holds every line to within a dp of the
  screenshot. Top to bottom: **the game's square art as the hero** (SteamGridDB,
  else the landscape art or the cover, cropped), full width and **half the
  display tall — a collection's header art's size** (`constants/header-art`,
  the owner's 2026-10-21: "like the collection's screen size-wise"; it was the
  screenshot's 263dp, and everything under it is still the screenshot's,
  measured from its foot), dimmed and faded
  into the page by the screenshot's own ramp (`HERO_FADE`) — there is no small
  art beside the title any more; a row of **the writer's 72dp face**, their
  name with **the score and its word at the far end of its line** ("87
  AMAZING", where the screenshot has stars), the game's name in Poppins
  ExtraBold 22, "by" its developer — no year; **the quote, centred, in
  quotation marks, typing itself out** (`<QuoteBlock>`), or nothing; the date;
  the review at 14 on 18; **how it was played** (`lib/review-details.ts`)
  under its progress glyph where the screenshot says "Translate to English";
  **the platform** under its mark, right-aligned, where it has the track the
  listener liked; the like and share (and the report flag); "Replies"
  (`<CommentSection docked>`); and **the reply composer docked at the foot of
  the screen** (`<ReplyComposer>`): bold and italic keys that write
  `<RichText>`'s marks, the count against 500, a round send. Two earlier
  passes are gone: a line of white type over the art (an Instagram caption on
  the first screenshot, not the reference) and the game page's masthead as
  the header. The quote is not covered by a spoiler flag — it was the
  headline, and the headline never was — but on a card the flag covers
  whichever half is shown. **Replies render through `<RichText>`** now, here
  and on the thread screen, so the keys' marks show as bold and italic.
- **Cards** — `<LogCard>`, `<MemberReviewCard>` (the game page, the reviews
  sheet, Surprise Me) and the copy screen's `<ReviewQuote>` — show what
  `cardShows` says: the writer's choice when it can be honoured, else whichever
  half exists. The form draws a `<LogCard>` from its own values as they change,
  **at the very bottom of the form** with the choice beside it (the owner's).
- **The log form was compacted, as Surprise Me's settings were**: played on,
  hours, solo or co-op, players and the platinum are rows in one card, each
  with its control at the end (`<DropdownButton>`, a narrow number field, the
  pouring toggle). The progress pills and the score are untouched.
- **The shared image is SimpMusic's, measured from `ShareLyricsCard.kt` /
  `ShareLyricsSheet.kt` / `ShareLyricsSelection.kt`** (`constants/share-card.ts`):
  340 at most, 24 in, a ramp 28% to black, the words bold 22 on 30 and eight
  lines at most, the signature (a controller in a disc — there is no GameLog
  logo yet) opposite the score. The owner changed three things: the art (56)
  and the title (17) are bigger, the writer is on a row of their own under
  them, and the score is in its colour — lifted to 3:1 on the chosen ground.
  Then the backgrounds (the game's own colour, then SimpMusic's four), Save
  image and Share.
- **Two shared images**: "Words" (SimpMusic's, above) and **"Rating"**
  (`<ReviewPodiumCard>`, `SHARE_PODIUM`) — the owner's reference, a music
  rating app's card, its layout replicated: the writer's face, handle and time
  across the top with the app's mark at the right; the art, the game and its
  credit, and the score — the app's square, not the reference's ring — in a
  row; the words under them, the quote between its marks or the excerpt in
  italic. Its ground is the Words card's — the chosen background as the same
  ramp, the type by its luminance; the reference's light frosted wash was
  tried and the owner had it match the first card. Chosen with two chips
  under the card.
- **The words are picked with a highlighter, not SimpMusic's list of lines** —
  the owner's correction, after Instagram's slider for a song in a story
  (`<ReviewHighlighter>`, `lib/review-highlight.ts`). The whole review is shown
  with its line breaks; the first six words are highlighted as it opens; a tap
  moves the highlight to one word; **holding an end and dragging** stretches or
  shrinks it, a word at a time, and it stops at the last word the card's eight
  lines hold — counted as the card wraps it, line breaks included, which the
  card prints. Things that are easy to break:
  - **An end drags only after it is held** (`activateAfterLongPress`, 220ms),
    so a finger that moves at once scrolls; once one is dragging, the scroll is
    switched off. A tap fails as soon as the finger moves. The view is
    react-native-gesture-handler's `ScrollView`, which is what lets the drag
    take the touch from it.
  - **Every word is laid out by the app** from Inter's advance widths and drawn
    where it was put, one text a word (only the lines near the screen are
    mounted). That is how a finger becomes a word and the highlight sits
    exactly round its words. Draw them in the weight they were measured in.
  - **The ends are a rule at the highlight's edge and a knob on its corner**
    — the start's above the line, the end's below — standing in the gap
    between lines (hence lines of 32 on 17). Tabs beside the words covered the
    very words somebody is deciding whether to take.
  - The gestures are rebuilt every render, as the app's others are, and call
    plain functions through `runOnJS`; the React Compiler's rules refuse refs
    read in gesture callbacks built during render.
- **The review page's colours can be switched off** — a disc at the top right,
  where a collection keeps its menu (the owner's). Off, the page is the app's
  own room and every control the house white: `<AccentProvider neutral>`,
  which keeps the provider mounted so the page changes colour without
  remounting (its scroll, its typed quote and its uncovered spoiler stay). The
  choice is the reader's for every review they open, kept on the device per
  account (`lib/review-colour.ts`, `['review-colour', userId]`, in
  `NEVER_PERSIST`); the page waits for that one read before it draws.
- **Three native modules came with it**: `react-native-view-shot`,
  `expo-media-library` and `expo-sharing` — all in Expo Go. **They are imported
  when a pill is pressed, never at the top of a file**, so an APK built before
  them still opens the review page and says it cannot save. A new preview build
  is needed for the image on a sideloaded APK; it is this change's one native
  step. **A build can have the media library's old module and not its new
  one** — seen on the owner's dev client: "Cannot find native module
  'ExpoMediaLibraryNext'". Saving tries the current API, then
  `expo-media-library/legacy`, then hands the image to the system's share
  sheet, which can save it. Saving asks for **write-only** photo access with no media kinds (no
  `READ_MEDIA_*` in the manifest: `granularPermissions: []`) — and in Expo Go
  on Android asking for `photo` throws, which is the other reason it is `[]`.
- **What the image cannot hold**: anything expo-image draws. Glide hands its
  views hardware bitmaps, and view-shot draws into a software canvas, which
  cannot draw one. Art and faces on the card are React Native's `<Image>`.

**Not seen on a phone.** Types, lint, `npm test` (the measurements above), an
Android bundle, and a still of the three sizes rendered from the same geometry
with Inter were checked here. Still to judge on a device: where the marks land
against the words (the geometry assumes both platforms centre a line's font as
measured), the typing, the capture on Android, saving in Expo Go, and the form's
rows. 0040 is not applied to the live project.

## Soundtracks: SoundCloud, and one player

A game's music comes from SoundCloud and plays in the app's own player — never
SoundCloud's widget, at the owner's direction. It replaced "Apple Music" (the
keyless iTunes Search API and its thirty-second previews), which is gone:
`lib/soundtracks.ts`, the device mirror and the shared `game_soundtracks`
table.

- **Built without credentials, and nothing here has run against SoundCloud.**
  The project had no API keys. Everything was written from SoundCloud's guide
  and OpenAPI document, and every screen has a "not connected yet" state that
  is the one it ships in (`unconfigured`: the function is not deployed, or has
  no secrets). `supabase/functions/README.md` lists the five things to settle
  on the first run with keys — which way a stream address answers, above all.
  Do not report any of it as verified until it has been.
- **Where it shows.** The game page keeps its **Soundtrack tab**, the owner's
  choice: a summary (`<SoundtrackSummary>`) and a **Listen** button that opens
  `soundtrack/[id]`. Surprise Me plays one song per card. A profile pins one
  starred song. Nothing on the tab plays; the player is on the screen.
- **SoundCloud's terms shape the code, and four rules follow from them.**
  1. **Nothing of SoundCloud's is stored** — not a title, a name, artwork, a
     stream address. Postgres holds ids only (`soundcloud_matches`,
     `starred_songs.track_id`); the two queries are in `NEVER_PERSIST`; artwork
     is drawn through `<PlayerArtwork>` with `cachePolicy="memory"`
     (expo-image writes to disk by default); the player's queue is memory, and
     is emptied on stop and on a change of account. A new query key or image
     that holds SoundCloud data follows all of that.
  2. **Every track shown carries three things**: its uploader's name,
     SoundCloud's logo, and a link to it on soundcloud.com. `<SoundCloudMark>`
     is the last two. Do not shorten a row past them.
  3. **The logo is not ours to restyle**: SoundCloud's own white files, never
     tinted, recoloured or redrawn. It has no `color` prop on purpose.
  4. **One uploader's playlist is preferred to tracks gathered from several**
     (`choosePlaylist` before `matchTracks`). Two clauses of the terms sit
     close to a per-game soundtrack screen; whether it is acceptable is
     SoundCloud's call when the app is registered, and the README says so.
- **A stream is asked for when Play is pressed, and at no other time.** Each
  one spends one of 15,000 plays a day for the whole app. Nothing preloads the
  next track, warms a stream on mount or retries by itself; a 429 on a play is
  shown with the time it lifts and not asked again until then
  (`limitLiftsAt`).
- **The matcher is one pure file, loaded twice**:
  `supabase/functions/_shared/soundcloud-match.ts` has no imports, so the Edge
  Function deploys it and `npm test` imports it by relative path. It must stay
  that way. A candidate has to *name the game* as its own phrase (so *Hades II*
  is not *Hades*), covers, remixes, lofi and "best of" mixes are refused, and
  duplicates are folded by title and length. The owner's tags — `videogame`,
  `videogames`, `games` — are searched one request each, because the API does
  not say whether several tags mean all or any. Bump `MATCHER_VERSION` when its
  judgement changes.
- **There is one audio object in the app** (`<PlayerHost>`, root layout), and a
  second `useAudioPlayer` anywhere is a second song. The soundtrack screen,
  Surprise Me and the starred song each had their own. Everything plays through
  `player` in `store/player.ts`; the store holds what is drawn, the commands
  are plain functions, and a component that only presses Play does not
  re-render with the position.
- **Leaving stops the music; Keep playing is the exception** — the owner's
  rule, in their words: "by default when the user leaves the screen it stops
  playing, but there should be a button for playing in the background while in
  the app. A mini player, like a bar, should be placed on the bottom of the
  screen." So a screen calls `player.release(owner)` on its way out, which
  stops only a queue that screen started. The soundtrack screen passes
  `honourKeepPlaying`; a dealt song and a pinned song end with their screens
  regardless. **"In the app" is meant**: `shouldPlayInBackground` is false and
  must stay false unless the owner asks for the other thing.
- **Release on blur where a screen is not unmounted.** Your own profile is a
  tab and Surprise Me stays mounted under whatever opens over it; an unmount
  cleanup alone left their songs playing behind screens with nothing to stop
  them. Both use `useFocusEffect`. Surprise Me skips it for one destination —
  the song's own soundtrack, which takes the song over.
- **A queue is adopted, not restarted.** Pressing the track that is already
  loaded pauses or resumes it whoever started it (`player.play`), so a song
  Surprise Me began shows as playing in its soundtrack's list and is not
  loaded — and paid for — twice.
- **The mini player is a sibling of the navigator, and pages make room for
  it.** `<MiniPlayer>` is drawn after `<Stack>` in the root layout. A tab's
  content ends by `useTabBarClearance()`, which grows by the capsule; every
  other page gives up a band of its foot inside `<Screen>`. So nothing is ever
  under it, and no screen was edited to know it exists. It is not drawn on the
  routes in `MINI_PLAYER_HIDDEN_ROUTES` (`lib/player-queue.ts`): the soundtrack
  screen, Surprise Me, the scanner and **every modal** — on iOS a modal is a
  sheet the system draws over the whole app. A modal's `<Screen modal>` keeps
  no band; the other three pass `miniPlayer={false}`. **A new modal route goes
  in that list**, and `npm test` reads the root layout and fails by name if one
  is missing.
- **`<Screen>` does not read the route, deliberately.** `useSegments()` there
  would re-render every mounted screen on every navigation. The flag is a prop.
- **The audio player sends its headers to every host.** Android's sets them as
  default request properties: the playlist on our function, then each segment
  on SoundCloud's media host. So when a stream goes through the function's
  relay the player is given the project's *public* key and the relay is
  authorised by a ticket signed into the address — never the listener's
  session, which would be handed to a third party a hundred times a song.
- **Android knows a stream is HLS by `.m3u8` at the end of its path**
  (`Util.inferContentType`) and by nothing else. The function relays any
  stream whose address does not end that way.
- **Android reports a playback error as a status holding `error` and nothing
  else.** `onStatus` reads every field as optional; reading a missing
  `currentTime` as a number put `undefined` in the store.
- **A starred song is an id.** Its title is asked of SoundCloud when a profile
  is shown, and the widget draws nothing when SoundCloud has no answer — the
  track is gone, nothing is connected, or the row predates 0036.

## Labels: Must Play (0034)

A label is a mark a moderator puts on a game by hand. `must_play` is the first;
`constants/game-labels.ts` is the vocabulary and must match 0034's CHECK
(`npm test` reads the migration).

- **Who can set one is the database's rule, not the app's.** `game_labels` is
  readable by everyone and its insert and delete policies admit
  `public.moderators` alone (`is_moderator()`), so a control shown to the wrong
  person fails at the table. The app hides the controls from everyone else as
  tidiness. Make a moderator in the SQL editor — the `insert into
  public.moderators …` line under § Setup.
- **Where a moderator sets it**: a card at the foot of any game's Overview
  (`<GameModeratorCard>`, drawn for moderators only), and the Must Play list
  itself — its "+" opens a picker that stays open (`label-games`), and holding
  a cover removes the label after asking. Settings links to the list for
  moderators.
- **Where it shows**: as a badge in the top-right of the game's cover
  (`<Poster gameId>`), and as the last cell of the game page's stats strip,
  *in place of the age rating*, where it is a door to `must-play`. A game
  without the label keeps the age rating.
- **`<Poster>` wears the badge only when it is given `gameId`.** That is how a
  surface opts out, and two do by the owner's rule: **collections** (every
  tile, row and stack) and **reviews** (the card, the review page, a profile's
  Reviews tab, the wall, Home's "New from friends"). Do not pass `gameId` there. **The profile's
  Favourites and Games rows** opt out too, at the owner's direction
  (2026-10-15). It is also withheld on
  Surprise Me's dealt card and on the Must Play list, where it would be on
  every cover.
- **The badge is the one coloured thing on box art.** A green disc (`mustPlay`,
  an alias of `identityJade` — it was ember until the owner asked for green), a
  ring and a face in `readableInk` of it, and the face's teeth in the opposite
  ink. The face — a quiff, stars for eyes, a grin full of teeth, a thumb up on
  its left — is two PNG layers in `assets/images/badges/`, each one colour on a
  transparent ground and tinted at draw time: `must-play.png` (the lines) over
  `must-play-teeth.png` (the white of the grin). One SVG beside them is the
  source of both and says how to rasterise each (`rsvg-convert -s`, hiding the
  other layer); the app has no SVG renderer, so the PNGs are what ship.
  Everything else on a cover (the edition word) stays near-black, as before.
- **Which games carry it is a module store** (`use-game-labels`), not a query:
  one short list of ids shared by every cover on screen. A failed fetch or a
  database before 0034 is an empty list — no badges, no error.

## Score figures: the little man

A 0–100 score is also a **drawing**: one little man and his gaming chair, in
five states. The owner's brief (2026-10-12), with two reference sheets — the
little man a newspaper rates films with, and a magazine's version of him for
games: "design different symbols/drawings for the ratings in the app. For 0,
50, 70, 80, and 100."

```text
    0   gone       the chair, empty — he has left
   50   asleep     slumped in it, asleep, the controller still in his hand
   70   seated     sitting up, playing
   80   forward    on the edge of the seat, leaning in, smiling
  100   standing   on his feet
```

- **It is not shown at all, for now** — `SHOW_SCORE_FIGURES` is `false`
  (`constants/score-figure.ts`). The owner (2026-10-16): "remove the ratings
  drawing for now. Don't remove it from the code or app, just don't show it.
  I will replace the images later." With it off `<FiguredScore>` is its number
  alone, and `<ScoreSummary>`'s
  placeholder the number's size, so no gap is left. Everything below is how it
  is drawn when it is on.
- **It is drawn in three places, and the owner named them.** The first build
  put it everywhere a score was a square or was given room — every review
  card, the critics' number, your own log, the log form. The owner, on seeing
  it: "For review cards, leave it as the square number. Only display the
  drawing for the game page graph, review sheet graph, and full-screen
  review." So:
  - **the ratings graph**, which is one component in both of its places —
    `<ScoreSummary>`, the Ratings card on a game's Overview and the head of
    the reviews sheet: the drawing and then the number (`<FiguredScore>`);
  - **a review's own page** — it was (`<ScoreMeter>`), and the page no longer
    uses that: the score is a number and its word in the row under the hero
    now ("87 AMAZING", 2026-10-17). Where the drawing goes there if it is shown again is the
    owner's call; nothing on that page draws it today.

  **Do not put it on a card, in a form, or beside any other score.**
  `<ScoreTile>`, the square with the number in it, is what a review card and
  the critics' average draw. `score-figure.test.ts` walks `src/` and fails by
  name if a third file draws one.
- **Three rulings came with the brief.** The man on his feet is **the man
  alone — no chair**. **Nothing he could be looking at is ever drawn**: no
  screen, no television. And **the chair is a gaming chair**.
- **More came on seeing the drawings, over two rounds, and each undid
  something — two of them undid the round before:**
  1. **The chair is a silhouette, and one shape.** It was drawn with its head
     and lumbar cushions, the piping down its spine, a recline hinge with a
     hole in it, an armrest and a tilt plate: "make the drawing of the gaming
     chair simpler, with less shapes, all I want is the sillouhete… not every
     component visible". The racing back's wing, the cushion, the stem and the
     star base on casters are what make the outline a gaming chair; nothing is
     cut into it. Do not add a part back.
  2. **He has fingers.** His hand was a ball. It is the back of a hand, a
     thumb, and three fingers with a line of nothing between each.
  3. **The man at 80 leans; he is not hunched.** The owner asked for "a
     visible and exxagerated hunchback" there, got one — an arch of a back
     with a hump standing above his own head — and on seeing it: "too much. Go
     back to the old one, that was fine." A straight back at a lean, clear of
     the chair's. Do not hunch him again, by any amount.
  4. **The man on his feet has one arm.** The other was in the air, behind his
     head, and read as "a weird white block or what looks like a little pillow
     on the back of his head". Standing, holding the controller, is the pose.
  5. **The controller is seen from its side, in his hand — and it is a short
     bare slab.** "Have it face the little man, so for the user the controller
     is viewed from the side, and we would only be able to see the little
     man's hand and fingers wrapping around the side of the controller… It's
     all about perspective." It was a gamepad drawn face-on, floating at the
     end of his arm. The first side-on drawing kept too much of it — a trigger
     hooked under its far end with his first finger stretched along to it, and
     the tip of its grip showing under his fist — and the owner called it
     scuffed: "The index finger is super long and the controller is also super
     long… removing the part of the controller that pokes out of the hand
     below, on the pinky finger. And removing the trigger." So: his thumb over
     the top, three fingers the same length wrapped round, and over them the
     edge of the controller's body, clearing his fingertips by a few units.
     **One part.** No trigger, no shoulder button, no grip, and no stick — a
     stick standing on its top, tried before any of that, made it a bottle
     with a stopper. `score-figure.test.ts` counts the parts and the fingers.
- **They are this app's own drawings of that idea, not copies of the
  references.** The man has the quiff the Must Play face has. Do not redraw
  him toward either reference.
- **A score shows the drawing whose anchor it is nearest to** (`figureFor`,
  `constants/score-figure.ts`): the owner named five scores, not five ranges,
  so the boundaries are the midpoints — 25, 60, 75, 90 (the owner calls the
  last two "the 80+ one" and "90+"). All four are also boundaries the verdict
  words already have ("Bad", "Fair", "Good", "Excellent"), so the drawing
  never changes between two scores that share a word; the test holds that.
- **Two colours, and the score's is on the chair.** The chair, what shows of
  the controller and the marks round him (the z's, the sparks) are
  `scoreColor()` — the one ramp. The man is the page's ink. What a drawing
  cannot say is the exact figure, which is why the number is beside it or
  under it in every place it is drawn, and is always what a screen reader is
  told.
- **`scripts/score-figures.mjs` is the source, and the figures are built, not
  traced.** Every pose is the same parts — a head, a torso, limbs of fixed
  widths, one hand on one controller — set at different joints, which is what
  keeps him the same man in all five. It writes, into `assets/images/scores/`,
  two PNG layers a figure (`<key>-tone.png`, `<key>-ink.png`; the empty chair
  has no ink), each one colour on a transparent ground and tinted at draw
  time, as the Must Play badge's are — plus `score-figures.svg` and
  `score-figures.png`, the five on the app's card colour at the two sizes the
  app draws them, to look at. It needs `rsvg-convert`. Change a joint, run it,
  look at the sheet; `CLOSE=<key>` writes one figure large, and `CROP` a part
  of it.
- **Nothing overlaps, which is why two flat layers are the whole picture.**
  Each part is cut away under everything in front of it and under a halo round
  that, so the arm crossing the body has a line of nothing round it — whatever
  surface the figure is on. The face is the same cut, and so are his fingers:
  the gaps between them are the halo of the hand over the controller behind
  it. A new part goes in its place in the pose's list, back to front, and the
  script does the rest.
- **Each round has been judged by the owner from the sheet and the app; the
  last one has not been yet.** What is drawn now answers their second round of
  rulings and has been looked at here only on the contact sheet and in
  close-ups. To judge on a device: whether the hand and the short controller
  read at 56dp in the graph.

## The top bar: SimpMusic's

The owner's direction (2026-10-12): "look at how SimpMusic does their top bar
in the app, the animation when it scrolls, the size, how it looks, etc. And do
it for gamelog". It was read from the reference's source, not its screens —
`NotificationScreen.kt`, `SettingScreen.kt`, `AlbumScreen.kt`,
`ArtistScreen.kt`, `PlaylistScreen.kt`, `HomeScreen.kt`, `LibraryScreen.kt`,
`SearchScreen.kt` and `UIExt.kt` (`isScrollingUp`, `barBlurStyle`) — and
`constants/top-bar.ts` holds every number with the place it was read from,
under `npm test`.

**This reverses a long-standing rule, on purpose.** For months there was no bar
at all: one disc of glass pinned in the corner of every screen, no titles
("screens state their own heading in content"), and "nothing hides on scroll".
That was the answer to an older full-width frosted strip that sat over every
piece of key art. The reference solves the same problem differently, and the
owner asked for its way. Do not restore the pinned disc, and do not print a
screen's heading under its bar again.

- **What it is.** Material 3's small app bar, as every bar in the reference is:
  a row **64 high** under the status bar; a back chevron (a 24dp glyph, 48 to
  touch, its glyph 16 from the edge); the page's name in `h3` — the reference's
  `titleMedium`, 18 — starting at 56; the page's controls at the far end. It
  floats over the page with nothing behind it and **turns to the page's own
  colour, solid,** when there is something under it. **There is no blur**: it
  was frost — the page blurred, washed with its colour — and the owner had the
  blur removed (2026-10-14). Where this section still says "frost", read "the
  page's colour". The glass discs over artwork still blur; they are buttons.
  **One exception, the owner's of 2026-10-23: Apple's glass bar** on the game
  page, a studio and a collection (`glass`) — § One colour method, the glass
  bar.
- **Which of three ways it behaves is the page's, not a prop's:**
  1. **A page that opens on a list or a form** — `<Screen insetHeader>`. The
     bar is there from the start, clear while the page is at its very top and
     frost the moment it is not; the two cross-fade over 300ms. Every list
     page, every modal form.
  2. **A page that opens on artwork** — no `insetHeader`. At rest there is no
     bar: discs of glass, 48 across and 12 from the corner, and they are *part
     of the artwork* — they scroll away with it. Once the header has gone under
     where the bar sits, the bar comes in from above (a spring, half its own
     height, fading in), already frost, carrying the page's name in a marquee.
     The game page, a collection, a studio, a review, an event, the Top 10, a
     soundtrack, a copy. The page tells it how tall its header is
     (`<FrostedTopBar header={…}>`); the bar arrives as the header's foot
     reaches its own, so it never lands on the art.
  3. **Home** — `<FoldingTopBar height={56}>` holding `<HomeHeader>`: the
     first kind, **fixed at the top**. Its row folded away while the page was
     read downward and came back on the way up; the owner had that removed
     (2026-10-14): "Make the home top bar stay at the top, it should not move
     with the scroll." Do not fold it again. (For a week from 2026-10-15
     Home had no bar — its masthead scrolled with the page; SimpMusic's header
     replaced that on 2026-10-22. See § Home.)
- **A screen's name is its bar's `title`** — and, since 2026-11-02, also a
  large title at the top of its content, drawn by the page scroller from that
  same `title` (§ reacticx and glass tabs); never a heading written by hand.
  Twenty-odd screens printed an `h1`
  at the top of their content because no bar existed to carry it — several
  said so in a comment. Those headings are the bars' titles now and are gone
  from the content; what was the line *under* the heading stayed, and where it
  named the subject (the game a copy or a playthrough is of) it was promoted a
  step. A new screen does the same: `title="Settings"`, and no heading.
- **A page that opens on its own mark keeps it, and uses the artwork kind under
  an inset.** A platform opens on its logo and name and Must Play on its badge
  and name, as an artist's page opens on the artist. Their bar is
  `variant="art"` *with* `<Screen insetHeader>`: the disc while the mark is in
  sight, the named bar once it has gone — so the name is never printed twice.
  The same prop is on the loading and error states of an artwork page (a
  review, an event), so the back control does not change shape when the page
  arrives.
- **A page that scrolls uses a page scroller**, or its bar never learns it
  moved: `<PageScrollView>`, `<PageFlatList>`, `<PageSectionList>`
  (`ui/page-scroll`) — drop-in, and each writes its offset to the `scrollY`
  that `<Screen>` publishes (`use-screen-chrome`). The value is `<Screen>`'s
  and not the route's because the route is *above* `<Screen>`: it could only
  hand a value to both ends as props, which is how eleven screens once carried
  a scroll handler nothing read. Three things about them:
  - **They are plain lists**, not `Animated.FlatList` (which wraps every
    cell). `useScrollOffset` needs only a ref it can read on the UI thread; it
    registers for the native scroll event by tag, so the offset never reaches
    the JS thread and a scrolling page still renders nothing.
  - **One per page, and it is the page's** — never a rail, a sheet's list or a
    menu; they would all write the same value.
  - **A list that mounts says it is at its top**, so a screen that swaps lists
    under tabs (moderation, a library) is not left frosted over a list that
    has not moved.
- **Right-hand controls are `<TopBarDisc>`s, written once.** One is a disc of
  glass over artwork and a bare glyph in the bar; it reads which from context.
  An `<IconButton>` there would be an opaque circle beside glass.
- **Two room sizes.** `useHeaderHeight()` is the bar's row and the inset — what
  `<Screen insetHeader>` reserves. `useDiscRoom()` is four dp less: the disc
  and its distance from the corner, which is what a review's art, Surprise
  Me's card, the soundtrack's disc and a copy's stage were laid out under. They
  kept that number, so none of them moved when the row became 64.
- **The frost fades by its strength, never by anyone's opacity.** A blur
  inside a view that is itself fading is not a blur on iOS until the fade ends.
  So the blur's `intensity` and the wash's opacity are both driven by one
  value, and only a transform is ever shared with a parent. The wash is the
  page's colour — `<Screen background>`, so a game's page frosts in the game's
  tone — at 30% over a list and **85%** over a page that opens on artwork. It
  was the reference's 55% (`barBlurStyle`) there, and over a game's page the
  white title and the art scrolling under the bar made it read white; the
  owner had it made the page's colour (2026-10-14), the blur kept under it. **Below Android 12 there is no blur and the bar is that
  colour, opaque**: the reference's own rule, and the old path blurs a
  full-width strip in software on every frame of a scroll.
- **Three things expo-blur's Android view does, read from `ExpoBlurView.kt`
  after the first of them shipped.** They apply to any `<BlurView>` whose
  strength is animated or ever low, not only this one:
  - **It cannot be set up at a strength of nothing.** `configureBlurView()`
    runs when the view is handed its target and passes the radius straight to
    the platform's blur effect, which at exactly 0 throws — logged as *Cannot
    set prop 'blurTargetId' … nativePtr is null*, on every screen, because the
    bar mounted clear. (A later change *to* zero is guarded; the setup is not.)
    The frost's strength therefore has a floor (`frostStrength`,
    `FROST.floor`), and what hides a frost that is away is a `veil` that is
    opacity 0 or 1 and nothing between — so it is never a fade over a blur.
  - **It paints the material's own grey over the blur, as opaque as the
    strength is high**, and re-applies it after every prop update
    (`OnViewDidUpdateProps`), so it follows an animated strength. At 85, the
    thinnest dark material is #252525 at 47%: a lid lighter than the page,
    where the reference has only the page's colour. So Android is asked for a
    strength of 4 through a `blurReductionFactor` of 4/21 — the same radius,
    the grey at 2%. `FROST.androidIntensity` has the arithmetic, under test.
  - **`dimezisBlurViewSdk31Plus` is only honoured when the method is set.** A
    view handed its target afterwards — every one, since the target is found
    after the first render — is set up with the software blur switched on
    below Android 12. So there the frost's blur view is not mounted at all.
- **The bar is a layer, not a surface.** It has nothing of its own to show; it
  softens what the page put behind it, which is why a page's ambience
  (`<SoftGlow>`) belongs in `<Screen backdrop>` or the page and never in
  the bar. A gradient of the bar's own would be two ramps meeting at its foot —
  a seam.
- **Every animated value on it survives a re-render, and how is easy to
  break.** "Frosted or not" and "discs carried off by 340dp" are the scroll
  offset, which React never hears, so the lost-end-value gotcha cannot be
  answered here by restating a pose. The bar bumps a `pulse` on every render
  and every style reads it — the copy showcase's remedy — **but Reanimated
  re-sends a style only when it differs from the last one, key by key, and an
  opacity that settled at 1 does not.** A transform is an array, never the same
  object twice: so every style on the bar carries one, if only a transform by
  nothing, and the blur's strength, which is a prop and not a style, is moved
  by a hundredth on alternate renders. Take either out and a bar on a busy
  page can lose its frost for good.
- **Between the disc leaving and the bar arriving there is no back control on
  screen** — a hundred dp or so of scroll on a game's page. That is the
  reference's, exactly; the system's back gesture is still there. If the owner
  asks for the disc to stay until the bar takes over, it is the `discShift` in
  `<ArtBar>` and nothing else.
- **What was not changed.** Search and your own profile tab keep the rows
  they had — a field and tabs, and + / handle / Settings — because each was
  ruled on by the owner and none is a bar. **News has the bar** now, titled
  "News" with no back control, its tabs under it — the owner's direction
  (2026-10-14), "the one the app has everywhere else". The scanner and the
  sign-in options have a bar with no title: each state there prints a heading
  that is a sentence, not a name.
- **Run on a phone once, by the owner, and tuned to nothing yet.** Its first
  run logged the blur's set-up error above, on every screen; that is fixed,
  and it is all that is known about how the bar looks or behaves on a device.
  Types, lint, the measurements' tests and the UI-thread code as the worklets
  plugin ships it were checked here. Still to judge on a device: the frost's
  strength (`FROST.androidRadius`, 21; `FROST.intensity`, 85, on iOS) and its
  two washes; that a plain list really reports its offset through
  an animated ref (if a bar never frosts, that is where to look first); where
  each artwork page's bar comes in (`header`, per screen — three of them are
  estimates and say so); Home's fold; and whether the animated blur holds its
  frame rate on an older phone.

## One colour method: Material 3, under a pinned hero (2026-10-28)

The owner's ruling (2026-10-28), after a week of experiments with the game
page's colours: "I want the m3 algorithm from simpmusic back in the game page
and other places in the app. COMPLETELY REMOVE EVERY OTHER METHOD WE MADE FOR
PICKING THE COLORS OF ANYTHING… I want the cards in the game page back… The
masthead apple music transition will remain."

**Material 3 is the only way anything in the app takes a colour from a
picture.** A seed is read from the box art (`useAlbumArtColor`: the native
extractor on a dev build, `lib/artwork-color`'s hue vote in Expo Go), the
scheme is built from it (`theme/dynamic-color`, `ROLES`, `CHROMA`), and
`accentRoles(seed, { tonal: true })` names its roles for the app's components.
Where it is used:

- **The game page** — seeded by the *hero art* (`useGameAccent(heroUrl ??
  coverUrl, genres)`, `<AccentProvider artwork>`), the owner's of 2026-10-31
  ("grabs the color from the artwork hero instead of the portrait art"; it was
  the cover). The log form, achievements and the soundtrack follow it, and so
  does onboarding's game-page preview: the page is the scheme's
  background, every card its `primaryContainer` at half brightness
  (`cardMaterialFor`), the quiet type `onSurfaceVariant`, the masthead's rule
  `outlineVariant`, the review button and the chosen tab `primary`.
- **A studio** — the banner game's scheme (`useGameAccent(bannerUrl)`), page,
  name and controls.
- **A collection** — its cover's *box art* even when the header draws square
  art (a 400px square is too large to decode on the phone); an empty
  collection is the app's own page, its provider `neutral`.
- **Home's glow** — the first cover's M3 `primary` at 0.45 (§ Home).
- The review page, the log form, achievements, a soundtrack, a copy, Surprise
  Me, an award slot — as they always were.

Settings → Game colours off makes every one of them the owner's grey room.

**Removed, and not to be rebuilt** — every one of these was a second way of
picking a colour, and each was deleted with its tests, fixtures and device
stores (`lib/retired-colour-stores` sweeps the stores once; `CACHE_VERSION` 5
drops their saved queries):

- Apple Music's **key colour** (iTunes 11's edge clustering, `lib/key-color`,
  `useKeyColor`, `<KeyColorHero>`, `<Screen tone>` and the page darkening as
  it scrolled) and the unused `components/apple-music/` prototypes.
- The **page-colour brief and BitChord's page** (`lib/page-color`,
  `usePageColor`: Palette's swatches through an "anti-ugly" filter, the page
  re-lit for white type, the pale quiet ink, Celebi + `Score` seeds,
  `harmonySeed`, `buttonTone` / `primaryTone`).
- **Cards in the review button's colour** (`filledMaterial`, `filledInks`,
  `<CardInks>`, `<ThemeInks>`, `<AccentInks>`, the tab bar's `artColoured`),
  and the **game page with no cards** (`<BareCards>`, the Details card as a
  two-column grid of text). The cards are back, and Details is its card again.
- **SimpMusic's immersive page colour** (`lib/immersive-color`'s Palette port
  and Oklab darkening, `useImmersiveBackground`, the near-black studio) and
  the three-depth ramp (`useArtworkPalette`).
- The **colour field behind the game page and the studio**, which followed
  the trailer's frames, and **BitChord's blobs** (`lib/artwork-field`,
  `<ArtworkField>`), which went from there to the cover viewer for one day
  and were then removed too (2026-10-28).
- **The one exception, by the owner's word (2026-10-28)**: SimpMusic's Apple
  Music page under the cover viewer (`lib/artwork-mesh`, `<ArtworkMeshPage>`)
  was deleted with the rest and brought back the same day — "bring back
  simpmusic's apple music now playing blur on the zoomed in version and
  remove the mesh blob". It is a blur of the cover's own pixels, nothing else
  reads it, and it colours that one modal and nothing else.

What survived of them is geometry, not colour: SimpMusic's scrim ramp
(`lib/scrim`: `smoothScrimStops`, `footFade`), Compose's Oklab `mixOklab`
(`lib/color`, Home's glow gradient), and a studio logo's legibility check
(`lib/logo-ink`: `meanOpaqueLuminance`, `logoNeedsLightInk`).

### The pinned hero

> **2026-11-03 (§ Apple TV): the game page and the studio pin the *cover*
> now**, portrait, with Apple TV's words on its foot; everything below about
> the pinned hero's motion still holds.

The masthead's Apple Music transition, which the owner kept: the art is
`<Screen backdrop>`, not in the scroller (`<PinnedHero>`, `PINNED_HERO`,
`lib/scroll-motion`). At rest it is the old hero (38%, the owner's dissolve
`MASTHEAD_FADE`, the row set into it). Scrolled: the art drifts up at a fifth
of the page's speed; the masthead (spacer, row, synopsis) is transparent and
slides over it; a blurred copy comes in after a little scroll and gently (15%
→ 75% of the way — it was 15% → 45%, and the owner found it harsh); the art
drains into the page's colour from 35% of the way, slowly (`drainFrom`; it was
made the last quarter for one build, which the owner called the opposite of
what they meant: "I want it to start slower, not faster"), and is **solid once
the page is past the title and onto the developer lines — which is where the
top bar comes in**. The owner's, over three messages of 2026-10-27: "solid
when the developer names reach the top", "at the same level where the top bar
comes into screen", "I don't want it to start sooner, just that it goes
blurrier quicker". One measured point — the top of the lines under the name
reaching the bar's foot — is the bar's `header` and, through `revealOffset`,
the art's `solidAt`. No zoom. The trailer rides inside the art's box, drifts
and blurs with it, and pauses at `solidAt`. Things that are easy to break:

- **One foot fade, over both copies.** For one build the blurred copy had a
  shorter fade of its own, so as it came in the art stopped dissolving and
  read "as if it was pasted onto the page raw". The sharp art and the blur
  dissolve by the same curve, drawn once over both — a fade *to a colour*, not
  the art's alpha, because a trailer cannot be drawn inside a mask on Android.
- **Nothing has an edge at the art's foot.** The blurred copy is drawn at the
  art's own size, unclipped — it was 10% oversize and clipped, and the clip's
  edge let a sliver of it through at fractional scroll positions: a line under
  the art that moved at the art's speed, not the page's, "some kind of z
  fighting" (the owner). And a strip of page colour hangs under the art on the
  box that drifts (`footHold`, 32dp), so the foot is page colour on both sides.
- **The blur is Convx's, row by row, in Skia** (the owner's, 2026-10-31:
  "use convx's row by row blur, if you have to bring skia do it"). It was
  behind a flag for a few hours that day so the owner could see the old blur
  beside it; they chose Convx's — "keep the convx hero blur. Make it
  permanent, not a flag" — and the flag is gone. **This is the hero's blur**;
  the blurred copy in the next bullet is only what a build without Skia falls
  back to.
  `<ProgressiveBlur>` (`components/ui/progressive-blur`, `lib/progressive-blur`)
  is `ArtistHero.kt`'s variable gaussian — two 81-tap passes as Skia
  runtime-shader image filters, on a canvas a quarter of the art scaled back
  up — whose radius follows the row: nothing above 0.78 of a *side*, then
  Convx's foot curve (`207 × (f − 0.78)^1.855`, ≤ 48pt of a 402pt display),
  and a 28pt ramp that climbs from the foot to the top as `pinnedBlur` goes
  0 → 1. **Rows are counted in Convx's own unit**, a side (its square's
  width): here the art's height × 393/405, which puts the art's foot where
  Convx's square has its, so every number is Convx's unconverted. It is
  transparent where the radius is nothing and fades in over the first
  **7.5pt** (`fadeIn`, in points: Convx's ~2pt cut the art in a line, see
  `scripts/progressive-blur-render.mjs`). Until 2026-10-31 that was 5 in the
  canvas's own units, which are dp on a phone and pixels in the render, so
  the phone faded in three times slower than the render that was looked at.
  **The game page has Convx's mirrored tail and wash** (the owner's,
  2026-10-31: "Add convx's mirrored tail and color wash just like their artist
  page"; `<PinnedHero tail>`). The hero runs on past the art's foot by a fifth
  of its height (`TAIL`, 90/405), and what is there is the art turned over in
  its own foot — drawn into the layer the filters see, not reflected in the
  shader as Convx's is, because Skia may compute a filter's output only where
  its input has something drawn. It is never seen sharp: the blur there is 16
  to 48pt, and whole from 0.947 of a side, above the art's foot. Convx's wash
  (`heroWash`, `washStops`: a smoothstep from 307/393 of a side to 1.21) is the
  page's foot fade there, in place of `MASTHEAD_FADE`, as one gradient over
  every copy — not in the shader as Convx draws it, since the shader cannot
  wash a playing trailer. The blurred copy's own top fades in by *distance*, a smootherstep over
  `fadeSpan` (0.22 of a side) from the knee — the owner's "the top fades
  almost like a gradient with the blur" (2026-11-03); it was led by the
  radius, whole at 7.5pt, about 30dp, which read as an edge. The knee and
  the foot did not move. It begins where the blur begins and leaves about
  two fifths of the art at its foot, which the tail carries on from.
  **It puts art behind the game's name again** (ruling 2 of the masthead, "the
  art has gone by the title", no longer holds with Skia): measured white on
  the title's ground, brightest tenth — The Walking Dead 19:1, Celeste 12:1,
  Animal Crossing 4.8:1, a pure-white foot **2.7:1**, under the 3:1 that
  large text needs. Convx's own artist name has the same exposure. If a
  bright hero's title is reported unreadable, the levers are the wash's start
  (`washFrom`) or a shadow on the name; nothing was added unasked.
  **A studio and a collection do not take it**: their solid part starts at
  the art's foot and would cover a tail, and their names stand higher in the
  art, at 0.8–0.87, where Convx's wash has hardly begun — they would sit on
  80–95% of the art for a tail nobody sees. They keep their `fade`, as does a
  build without Skia. It fetches its own copy of the art, IGDB's `t_720p` for a
  `t_1080p` (`blurSourceUri`). `npm test` compiles both shaders in CanvasKit.
  **Gated without importing** (`TurboModuleRegistry.get('RNSkiaModule')`, then
  `React.lazy`): Skia's entry `getEnforcing`s its module, so an APK from
  before it — and the web — keep the one blurred copy below, as does a
  picture that will not load (`onFail`). It blurs the trailer's *still*, so a
  playing trailer's foot is the still's at rest. Not seen on a phone.
- **Without Skia, the blur is the full-size file, never a small copy.** expo-image's
  Android blur is `BlurTransformation(min(radius, 25), 4)` — it shrinks the
  bitmap to a quarter *before* blurring — so a 180-wide copy became a
  45-pixel smear: a flat grey, "no blur at all" on the owner's phone. The
  copy is mounted once the sharp one has loaded, so Android decodes it from
  the disk cache that load filled. Its radius never moves — every radius is a
  new bitmap; its opacity does.
- **The studio and the collection** put the art behind the page the same
  way: their name block is in a transparent spacer the height of the art, so
  it floats up over it, and the solid part (with a 40dp lip) starts under it.
  Both bars, and both `solidAt`s, are the name's foot reaching the bar's (the
  line under the name, `META_LINE` / `COLLECTION_META_LINE`). The studio's
  grid rows are opaque too, spaced by their own padding, since the list's gap
  would leave slits of the art between them.
- **The studio's rails are a memoised component** (`StudioShelves`). They
  were the list's header inline, so every render of the screen as its
  queries landed redrew seven rails of a dozen covers — on Sony's page three
  seconds of a blocked JS thread (the owner's log).
- **Every scroll-driven style reads `pulse` and carries a transform**
  (`usePulse`): without it a render two seconds after the page stopped would
  put the hero back to its first frame.
- **A worklet in `lib/scroll-motion` calls only worklets above it**
  (`smoothstep` is first) — § Gotchas.

**The glass bar** (`<FrostedTopBar glass>`), on these three pages only: the
discs stay where they are, centred in the row — there is always a way back —
and a bar of glass fades in under them (never slides), with the name centred
between them. iOS draws it on `systemChromeMaterialDark`; Android 12+ blurs
the page through the `blurReductionFactor` trick (`FROST.androidIntensity`);
below 12 it is opaque. Washed with the page's colour at 60%
(`FROST.glassTint`). The test fails if another page's bar takes `glass`, or if
the plain bar blurs.

**The glass bar is scrubbed by the scroll, and the two names hand over**
(2026-10-31, after FancyScrollView's `HeaderScrollView` and eleev's
`DrawerView`; `HANDOFF` in `constants/top-bar`). The band is the page's name
crossing the bar's foot (`handoffBand`, built from the name's measured height)
and ends at `solidAt`, as before. Across it the glass is `1 − √w`; the page's
name (`<HandoffTitle>`) fades over the first half and the bar's name in over
the second, so the two are never on screen together. Before this the bar was a
300ms fade set off at `solidAt`, and the name lay in the bar's row under 60%
glass while the bar's name faded in over it. The page never rests inside the band
(`settle` on `<PageScrollView>` / `<PageFlatList>`): a release mid-way goes the
way the finger went, else to the nearer end. **Not `snapToOffsets`**: with
`snapToEnd={false}` React Native clamps a fling that *passes through* the last
offset to it on both platforms, so every fling from the top would stop at the
bar. The award show's own scroller has no `settle` yet. Not seen on a phone.

**Shelves arrive** (`<Reveal>`, `SHELF_REVEAL`): a fade and a 16dp rise, 560ms,
once, on a game's Overview and a studio's rails — the pages that wrap their
content in `<RevealScope>`; `<Section>`, `<HomeSection>` and `<Panel>` are
built on it and are plain views everywhere else. Never wrap a section from
outside (a box round a section that renders nothing is a second `gap`); a
shelf hides only when its first layout finds it wholly below the display; it
re-reads where it is on events — every scroll, its own layout, and
`ScreenChrome.layout` — never on a timer.

**Not seen on a phone**, and the owner asked for no emulator here. Checked:
types, lint, `npm test`. To judge on a device: the M3 page under the pinned
hero — the art's foot dissolving into a page seeded by the hero itself (it was
the cover, often another hue) — the cards back in the game's tone, and the
studio's and the collection's controls in their scheme.

## Home: SimpMusic's header, glow and moods

The owner's direction (2026-10-22): "replicate simpmusic's glow on the home
page, with the same effect and size… It grabs the color from the first song
that appears in the first section… grab their exact top bar and add the tabs
with moods. Analyze how simpmusic categorizes… and translate that to
videogames… Whatever is achievable in gamelog that simpmusic has there, do it.
Even things like the quick picks or having a section for a specific artist
that fits that mood". Read from SimpMusic's source (`HomeScreen.kt`,
`HomeViewModel.kt`, `ChipGroup.kt`, `CreateSheet.kt`, `AdapterItems.kt`,
`AmbientThemeGlow.kt`, `UIExt.kt`, and the `core` submodule's
`HomeRepositoryImpl.kt` / `HomeParser.kt`), and YouTube Music's live answers.

**How SimpMusic picks a mood's songs: it doesn't.** Its ten `HOME_PARAMS_*`
strings decode (base64 → protobuf, field 48) to YouTube Music's ten home
filter chips with one marked selected; choosing a mood reloads Home from
YouTube's `FEmusic_home` with that chip pressed. YouTube's ranker decides; the
app draws the answer. Fetched for all ten chips on 2026-10-22: a strapline over
the first shelf ("FOR RELAXING" / "Unwind + explore"), five to ten themed
shelves of playlists, a four-row Quick picks grid somewhere among them, and —
signed in — shelves headed by an artist's round picture.

**How GameLog does: IGDB clauses** (`lib/games/moods.ts`, pure, tested). Each
mood is SimpMusic's name in SimpMusic's order (Sleep is "Wind down" — a game is
not something to fall asleep to), a strapline (YouTube's own where it has one)
and four to six shelves, **each shelf a `where` clause** over IGDB's genres,
themes, modes, perspectives, platforms and above all its editors' *keywords*
("relaxing", "cozy", "fast paced", "emotional", "couch co-op"). Every clause
was run against the live catalogue and tightened where it caught the wrong
games. What is easy to break:

- **Negate by id, never by `keywords.name`.** `themes != (19,39)` is "contains
  none of" and keeps a game with no themes (checked: 61 − 11 = 50). A dotted
  field's `!=` is "has some keyword not in the list" — it let Nekopara
  through. So the floor excludes IGDB's Erotic theme (42) and the keywords
  nudity / sexual content / sexual themes **by id** (`ADULT_KEYWORDS`), and
  `moods.test.ts` fails if a clause ever writes `keywords.name !=`.
- **Bare keywords and genres lie.** "farming" alone is Demon's Souls and Rome:
  Total War, "fitness" alone is GTA, IGDB's "Tactical" genre is Metal Gear and
  Call of Duty, its "Quiz/Trivia" is Banjo-Kazooie, "Racing" includes GTA.
  Calm moods shut out horror, thrillers, war, the Action theme and fighting /
  shooters / hack-and-slash (`CALM`). Re-probe a clause live before changing
  it (the scratch script for that was not kept; any `games` query through the
  `igdb` function with the anon key will do).
- **Shelves are deduplicated in order** (`distinctShelves`): a game, or a game
  of the same name (remakes keep names), shows on one shelf only; a shelf left
  under four is not drawn. Quick picks leave out the reader's logged games.
- **Quick picks are ranked by score with a 100-rating floor**; at 40, "American
  Chopper" and "Club Penguin" topped two moods.
- **The studio is a developer, never a publisher** (`moodStudio`): the most
  credited developer among the mood's 150 most-rated games, if it made three
  or more. Measured live: Amanita Design (relax, wind down, feel good), Nintendo
  EAD (energize, party), Game Freak (commute), Intelligent Systems (focus).
- **Requests are paced** (`lib/games/mood-feed.ts`, 270 ms apart): a mood is
  about nine IGDB requests and the app's credentials are shared at four a
  second. Mood queries are `['mood', key, …]`, six hours fresh, and in
  `NEVER_PERSIST`.

**The page** (`app/(tabs)/index.tsx`, `components/home/`). Built on
2026-10-22 and corrected the same day from the owner's first look — the
second round is what is described here:

- **The top bar is SimpMusic's header, less its avatar** (`<HomeHeader>` in
  `<FoldingTopBar height={72}>`): fixed, clear at the top, the page's colour
  once scrolled (no blur, the owner's rule for bars). **72, not the
  reference's 56**: "make the top bar thicker, it cuts too early". The chips
  are a scroller of their own between the margin and the keys, **clipped
  there**: the reference's chips pass over its avatar and its keys, and the
  owner had that stopped ("they go over and on top of the + and setting
  buttons… out of screen boundary"). Create (+, a 36 disc in a 48 key) drops
  an anchored menu (`ui/anchored-menu`) — log, review, new collection —
  because a sheet would be under the floating tab bar; **the bell** is the
  bare glyph beside it, with the unread count on its shoulder — where Settings
  was until the owner had it moved there (2026-10-28: "Place the notification
  button where the settings icon is, and remove the settings icon from the
  home section, it will only be in the profile tab"). **No Settings on Home.**
- **The avatar is on the page again**: the "Welcome back," row — face and
  name to the profile (the bell ended it until 2026-10-28) — on All only ("only for the home screen, not the mood tabs"). For one build it
  was the reference's avatar in the bar with a menu, and the masthead row
  (GameLog, greeting, bell) is gone for good.
- **The chips are All, Mood and Genre** (`<HomeChips>`, the reference's `Chip`
  and `ExpandableChip`): each expandable one opens into its choices in one
  pill and, picked, folds to "Mood | Relax" on primary twenty HCT tones
  darker. Opening one closes the other. Fills pour. The reference's spinning
  loading ring is not ported. What Home shows is a `HomeView` (`lib/home-view`):
  All, a mood or a genre.
- **A genre is a feed, as a mood is** (`lib/games/genre-feed.ts`, the owner:
  "dont make it so that it opens a new screen… it reloads the page you're
  on with sections tailored for the selected genre"): Best rated, New
  releases (120 days, newest first, two follows or ratings), Most played,
  Coming soon (five follows), Better with friends, Hidden gems (80+ by sixty
  people at most), Classics (before 2005), Indie picks — then Quick picks and
  the studio from the whole genre. The ten genres are `GAME_GENRES`, ids read
  live (`useHomeGenres`). Search's "Browse by genre" grid, `<GenreGrid>` and
  the `genre/[id]` screen are **deleted**.
- **The glow** (`<HomeGlow>`, `lib/home-glow.ts`, pure, tested): the first
  block's background — the bar's room, 24, and the first section — **plus
  140dp**, scrolling with the page. **The Material 3 primary** of the first
  cover of the first section (Games for you, Releases on a first run, a
  feed's lead shelf) — the scheme its box art seeds, the same seed and query
  as that game's page (`['album-art-color', cover]`) — **× 0.45 in sRGB**
  (`rgbFactor`, `AmbientThemeGlow`'s rule for a themed page), an
  `angledGradientBackground` at 25° with Compose's own line length and 24
  smoothstep stops mixed in Oklab, and the page rising over its bottom 60%.
  A new tone cross-dissolves over 500 ms; the last tone holds while the next is
  decoded. With game colours off it is the house primary × the same 0.45. No
  tone, no glow. (Until 2026-10-28 it was Palette's dominant swatch × 0.5, the
  reference's Home's own method; Material 3 is the app's only one now.) **The sections start 24 under
  the bar** (`LEAD_GAP`; the reference's 8 — "a little bit lower").
  **What is inside the first block is the glow's length**, and the block ends
  after Surprise Me. On All it used to hold four bands — the greeting,
  Surprise Me, the first-run ask and "Games for you", about 850dp against a
  mood's ~240 — and the owner (2026-10-22): "the glow in the home screen for
  the primary page is too long. it should be the same as the ones in the other
  tabs." The first-run block and "Games for you" moved *out of the measured
  view* and nowhere else: the bands are in the same order, and the scroller's
  own content gap is the same thirty-two the block used inside itself, so
  nothing shifted. A band that is games paints on the plain page. Do not put
  either back inside the lead.
- **A feed swaps everything under the first block**: lead shelf (with the
  strapline) → Quick picks (four rows of 64, columns the page less 30, snapping)
  → the next shelf → the studio (36dp round logo, "FROM THE STUDIO", its name
  linking to the studio) → the rest. Every view ends on "Let's pick a mood for
  you" (`<MoodTiles>`) — see the next section.
- **Kept from before**: All's bands, Surprise Me's entry, the footer; section
  headings stay this app's `h4` (the reference's are 20).
- Feed queries are `['home-feed', feed.id, …]`, six hours fresh, in
  `NEVER_PERSIST`.

**The moods-and-genres grid is the reference's *search* screen's**
(`<MoodTiles>`, `constants/mood-tile.ts` — pure, tested), at the owner's
direction (2026-10-22): "Make mood and genre buttons like the ones in simpmusic
search screen, being blocks in a gradient color with an image from a song." It
replaced SimpMusic's *other* moods grid, `MoodMomentAndGenre` — 144 × 34 cards
with a 10dp stripe, three rows deep, sliding sideways — which is what the
reference puts at the foot of its own Home; a 2:1 block in a three-row carousel
would be a stamp. Read from `MoodCategoryCard.kt`, `PlaylistThumbnail.kt` and
the grid in `SearchScreen.kt`:

- **A tile is a 2:1 block with a 10dp corner**, two to a row, twelve apart,
  the name in white `itemTitle` at the top-left over two lines at most, and
  **one game's cover tilted 25° off the bottom-right corner** — offset 8 right
  and 12 down *before* it is turned, so the tile's own clip cuts it into a
  diagonal rather than pasting a square inside the block. The name's 72 of
  right-hand padding is the reference's own arithmetic for the turned cover's
  bounding box (`64 × (cos 25° + sin 25°)`), not for a badge.
- **The gradient is the item's own hue, not a hash of its name.** The
  reference derives two unrelated hues from `title.hashCode()`; this app
  already has a colour that means something for exactly these items — a
  genre's identity hue, a mood's own — and inventing a hex is against the
  colour rule. So a tile is its own hue twice, the second stop turned 16°
  (half the ramp's own median step), at 45°.
- **Both stops are anchored by measured luminance**, which is what lets the
  name be white on every tile. The name's box is most of a 2:1 tile, so there
  is no band to keep clear: white has to hold *everywhere*. Fixing a
  lightness cannot do that (yellow and blue are nowhere near each other in
  luminance at one lightness), so each stop is placed at a luminance with
  `atLuminance`, which keeps the hue and the saturation. A blue tile comes out
  darker than its number asks for because a saturated blue cannot be that
  bright; that is the hue, not a bug. `mood-tile.test.ts` holds all ten at AA
  and **fails if either stop is raised**.
- **No badge.** The reference stamps each tile with a white disc carrying its
  monochrome mark at 20%, as its shareable playlist placeholders do. There is
  no GameLog logo, and twenty stand-in brand dots inside the app would tell
  somebody which app they are already in.
- **The covers arrive late, and only if you scroll this far.** The reference
  requests a category's artwork from inside the tile and says why: "a category
  the user never scrolls to never costs a browse." Twenty tiles is twenty IGDB
  requests against credentials every phone shares, so the grid asks for
  nothing until it is within a screen of the viewport — one
  `useAnimatedReaction` on the page's `scrollY` against the block's own
  `onLayout` offset, guarded on the UI thread so it fires once — and then goes
  through `mood-feed`'s existing pacer, behind whatever feed is on screen
  (`getFeedArtwork`: the feed's pool, its most-rated game, one field,
  `t_cover_small` for a 64dp slot). `['mood-art', key]`, a week fresh and
  **kept on the device**, so a cold start draws the covers it drew last time.
  A tile is finished without its cover and only ever gains one.
- **Ten moods and ten genres is ten rows of blocks**, about 900dp at the foot
  of Home. That is the reference's layout and the owner asked for the blocks;
  it is the first thing to judge on a phone.

**Not seen on a device.** Types, lint and `npm test` (`lib/home-glow`,
`lib/games/moods`, `lib/games/genre-feed`) pass; every clause, Quick picks and
the studio pick were run against live IGDB. The owner asked (2026-10-22) that
no emulator be used on this machine until they say otherwise. To judge on a
phone: the glow's strength, its seam and its new length, the chips' clipping at
the keys, the Mood and Genre pills' grow and fold (Reanimated layout
transitions), the menus' placement, and how long a feed takes to fill. And of
the grid and the loading work of 2026-10-22: whether ten rows of blocks is too
much foot for Home, where the turned cover lands in a tile's corner, whether
the shimmer's sweep holds its frame rate on a list of thirty placeholders, and
whether the bands' arrival reads as smooth or as late.

## Games for you: a new round every time the app is opened

The owner's request (2026-10-29): "The games for you section should update
every time the user opens the app, giving new recommendations that don't
repeat, based on the games they logged in the app." It was the same three
seeds (the best-rated logs) and the same twelve games, restored from disk.
The rules are `lib/games/recommend-rules.ts` (pure, tested):

- **A round** is `useAppRound()` (`lib/app-round.ts`): a cold start, a return
  to the app after fifteen minutes in the background, or a pull to refresh on
  Home (`startNewRound`). A glance at another app is not a new round.
- **Seeds are drawn, weighted by score**: any log rated 60+ or unrated; a 100
  is thirteen times as likely as a 60 to come first. Four seeds, four more only
  when the first lead to fewer than twelve unseen games. Each seed's
  `similar_games` is shuffled.
- **No repeats while unseen games last**: what was shown is kept on the device
  per account (`lib/games/recommend-history.ts`, the last 240), and a round
  puts those last, the longest-unseen first — the band is never shorter for
  having been seen. The history is read once per round
  (`['recommend-history', userId, round]`) and the round's generator is seeded
  by `userId:round`, so a refetch inside a round (a log saved) does not
  reshuffle the band.
- `['recommended', userId, seedKey, round]` and `['recommend-history', …]` are
  in `NEVER_PERSIST`: a restored round would be last time's. Home's glow
  waits for the round (no Releases colour first).
- Surprise Me's "Based on my games" calls `recommendFromLogs` without a round
  and gets the old, fixed answer.

## RAWG tags

The owner's request (2026-10-22): "Add from rawg's api their tags for games.
And include them as searchable on any screen that contains other things to
search about games." RAWG's tags are its players' words ("Atmospheric",
"Great Soundtrack", "Story Rich", "Co-op") — IGDB's genres and themes are not
that. `lib/games/rawg-tags.ts` asks RAWG; `lib/games/rawg-match.ts` (pure,
tested) decides what its answers mean.

- **Where they are searchable**: "Search by" → Tag, with RAWG's ~100 most-used
  English tags filtered as you type; the title-search suggestions; a game's
  Details card (a "Tags" row after Themes, each a link); and Surprise Me's
  "Narrow it down" (a Tags checklist, `prefs.tagIds`).
- **A tag is a facet** (`kind: 'tag'`, RAWG's tag id) **that is never a
  clause**: `facetsClause` leaves it out. A search holding a tag pages
  through RAWG's `/games?tags=…` in the catalogue's order as RAWG reads it
  (`rawgOrdering`), and each page's names become one IGDB request —
  `name = ("…","…")` with the rest of the search (other facets, a platform, a
  word) ANDed on — so tags combine with everything. RAWG never puts a game in
  the app: a row is shown as the IGDB game of its name and year
  (`inRawgOrder`), or not at all. The count is RAWG's; a page can be short.
  "Combined" keeps only rows carrying every tag (`hasEveryTag`).
- **Surprise Me with tags** draws a random page of RAWG's games with them
  (`getTagSurprisePool`) and narrows it by the rest of the settings. The live
  pool count is not shown while tags are set: IGDB cannot count RAWG's
  tagging.
- **Built without a key, and not run.** `EXPO_PUBLIC_RAWG_API_KEY` was empty
  on 2026-10-22 and RAWG answers nothing without one; everything follows its
  published API description. Without a key every tag control is absent
  (`rawgTagsAvailable`). On the first run with a key, check that `/games`
  rows carry `tags` (the description lists them on a game's own record only)
  and whether `tags=1,2` means both or either.
- `['rawg-tags']` (a week) and `['rawg-game-tags', gameId]` are kept on the
  device; a tag search is under `['search', 'catalogue-tags', …]`, never.

## A copy's back cover and disc: GameTDB and ScreenScraper

The owner's request (2026-10-22): "When someone scans a game and they add it
to their physical collection, you should fetch in the two apis below for a
back cover and CD disc to display. The front stays app-default." The sources
and how a game is found in each are `supabase/functions/_shared/copy-art.ts`
(no imports; `src/lib/copy-art.test.ts` loads it); the `copy-art` Edge
Function runs it; `useCopyArt` asks it.

- **GameTDB first**: no API — `emilydaemon/gametdb-api` is a small server over
  GameTDB's title lists — so the function does the same: the console's
  `ID = Title` list (`gametdb.com/wiitdb.txt?LANG=EN`), the IDs of the game's
  name with the copy's region first (the region is a letter of the ID), then
  `art.gametdb.com/{console}/{type}/{region}/{ID}`. Wii and GameCube: the whole
  sleeve (`coverfullHQ`, back left of the spine — cropped by `sleeveBackCrop`)
  and the disc; Wii U: `backHQ` and the disc; DS, 3DS, Switch: `backHQ` only.
  Run live on 2026-10-22 for eight games on six consoles: every back found,
  every disc where there is one.
- **ScreenScraper for the rest**: `jeuRecherche.php` by name on the system,
  then `box-2D-back` and `support-2D` / `support-texture` in the copy's region.
  It needs developer credentials, and its media URLs carry them, so **every
  image is downloaded and kept in the `copy-art` bucket** (GameTDB's too — no
  phone hot-links either source). **Not run**: no credentials yet; the
  system ids are the scraping tools' (`SCREENSCRAPER_SYSTEMS`) and are to be
  checked on the first run.
- **When**: as a copy is saved (`prefetchCopyArt` in `add-copy`), and on any
  copy page that has not asked yet. Answers are cached in
  0042's `copy_art` by platform, region and name — three months for a find, a
  week for a miss — and a day on the phone.
- **What is drawn**: the back face of the copy screen's case shows the scan
  (`<CopyCaseBack scan>`), and the edition record it printed is said under
  the stage while the back faces the reader (`copyRecordLine`) — still shown,
  still once. A disc shows its real label (`<CdDisc labelUrl>`) on the stage,
  in the open case's tray. **A cartridge's label is never
  drawn** — the stage draws no cartridge. The front stays the app's.
- **To switch it on**: run `0042_copy_art.sql`, then `supabase functions
  deploy copy-art`. GameTDB needs nothing else; for ScreenScraper,
  `supabase secrets set SCREENSCRAPER_DEV_ID=… SCREENSCRAPER_DEV_PASSWORD=…`
  (and optionally `SCREENSCRAPER_USER` / `SCREENSCRAPER_PASSWORD`). Undeployed,
  a copy draws its own back and the box-art disc, as before.

## The poster screens: onboarding, the event page, the progress pills

The owner's reference (2026-10-15): screenshots of another app's onboarding,
its race page and its "host a race" blocks. "Change the onboarding of the app
with the exact style of the images"; the event screen as the race page; the log
form's status/completion buttons as the blocks — "a pill… filled with that
solid color, it has the icon and the title… no description". DESIGN.md § 27–28
is the visual statement; these are the rules in the code.

**Onboarding is two routes.** `welcome` is signed out: four typed lines
(`INTRO_LINES`, the flirty register the owner chose) that **wait for a tap** —
the owner had the auto-advance taken out — then the email, then a password. **The owner kept passwords** over an emailed code, so the email
cannot tell a sign-in from a sign-up: the password page logs in, and "New here?
Make an account" turns it into a sign-up. Signing up asks for nothing else —
`signUp(email, password)`, no handle. With email confirmation on it ends on
"check your inbox." `onboarding` is signed in: name, welcome, what you are here
for, platforms, genres, solo or not, favourites, **game colours, animated
artwork**, notifications, Steam, photo, handle, and six games to start with
(`onboardingSteps`). The two look questions are the owner's (2026-10-21):
each is asked over three real games drawn small — a game's page in its
colours (Hollow Knight, Hades, Elden Ring), and Surprise Me's card with its
animated cover (Hollow Knight, Portal 2, Cyberpunk 2077: full-size, 1–4 MB,
only the one in view loading) — and the two pills under them write the
setting, so the examples change as they are pressed. IGDB only answers a
signed-in caller, which is why half of it comes after the account exists.

- **Only a sign-up is asked the questions; a log-in never is** — the owner's
  rule (2026-10-15). A password sign-up is known as one at the moment it
  happens: `signUp()` brackets its call with `beginSignUp` / `endSignUp`, and
  the session that arrives inside it is `needed` on the spot, with no request.
  Otherwise the database decides: `handle_new_user()` (0001) names an account
  that signed up without a handle `user_` + twelve hex digits, so an account
  still wearing that name has not finished signing up (`hasFallbackUsername`,
  tested against the migration's text) — a Google or Facebook sign-up, or the
  first log-in after confirming an email. Any account with a handle logging in
  is `done`. The device keeps `started` / `done` per account so a flow closed
  halfway resumes — and so claiming the handle one step before the end does
  not end it. Anything that fails after the retries below (no profile, a
  timeout of 9 s, storage) answers `done`: onboarding never holds anybody out
  of the app.
- **The account's own profile is read with retries** (`lib/own-profile.ts`,
  `fetchOwnProfile`: four tries over about seven seconds), by the auth store
  and by onboarding. Right after a sign-in the database's API can refuse the
  brand-new token as "JWT issued at future" — the auth server that minted it
  and PostgREST that checks it are different machines with clocks a moment
  apart. Read once, that left the profile `null` for the session: no "Welcome
  back" on Home (it draws from `useAuth.profile`), and a new sign-up's
  onboarding check answering `done`. Seen on the owner's phone after clearing
  the app's data.
- **The root layout routes by it** (`store/onboarding`): the app's group is
  `session && done`, `onboarding` is `session && !done`, `welcome` is
  `!session`. The splash is held at *launch* until the answer is known
  (`launchResolved`, which only ever turns true), so an existing account never
  sees onboarding flash past; a sign-in later is a holding page on the
  onboarding route instead, because dropping `ready` would unmount the tree.
- **The last page cannot navigate.** Finishing swaps the route group, so a push
  in the same breath lands in a stack being torn down. The destination (a review
  of the first favourite for "writing reviews", Search for "finding my next
  game") is left in the store and pushed by `<AfterOnboarding>` in the root
  layout a frame later.
- **Every step but the handle can be skipped**, and two are not shown where
  they could only fail: notifications where reminders cannot be scheduled
  (Expo Go on Android), and Steam until the project has a Steam Web API key
  (`STEAM_IMPORT_READY` in `app/onboarding.tsx` — flip it when the key exists).
- **What is kept**: name, handle, photo, favourites (the profile's four) and
  the games tapped on the last page, as Want to play logs. Platforms, genres and
  solo/co-op only choose those six games, and are deleted with the resume record
  when the flow ends. The queries start with `onboarding` and are never written
  to the device cache.
- **The last page is never empty** (`getOnboardingPicks`): IGDB's similar games
  for the favourites narrowed by the answers, then without the answers, then the
  answers alone, then the catalogue — and never a favourite back. Platform ids
  and game modes were checked against the live catalogue.
- **The typing is a letter every 20 ms, timed by the clock** (`lettersShown`,
  `<TypedText>`): each frame shows as many letters as the time since the line
  began allows, so a late frame catches up instead of stuttering. No pauses,
  no jitter and **no vibration** — the first build ticked per word, paused at
  punctuation and stepped on a chain of timers, and the owner read it as word
  by word and had the haptics removed. Reduce Motion: the line is just there.
- **The typing never reflows**: the whole line is laid out and the untyped rest
  is drawn in the ink at alpha 0 — **never `transparent`**; see § Gotchas.
- **The kit is its own** (`components/onboarding/poster-kit`): the off-white
  pill, the outlined chips that invert, the hairline field, the brackets. Do not
  use them elsewhere, and do not "fix" them toward `<Button>`.
- **One page, a step inside it** (`<PosterPage bare>`), so the colour washes
  between steps as a CSS transition on a React prop — which cannot lose its end
  value (§ Gotchas).

**The event page** reads its phase from IGDB's times (`eventPhase`: live from
the start to the end, or three hours after a start with no end) and prints the
games **only once it is over** (`showsGames`) — the owner's words. Its foot bar
is the action for the moment; going in person is a quiet line, not a button.

**Superseded (2026-11-05): the log form's progress is one Status row and a
pull-down** (`<ProgressStatus>`) — § The Apple pass. The poster hues tint its
glyphs; the rule below that a new log starts with nothing chosen stands.

**The progress pills** (`<ProgressPills>`, deleted) were the poster palette
(`PROGRESS_POSTER`) in `PROGRESS_ROWS`' grid. **Each rests as an outline in
its own colour, and the chosen one pours solid** (`<PaintFill>`) — the owner's
second rule; the first had all seven solid until one was chosen, the rest
sinking and the chosen one growing, and is gone. **A new log
starts with nothing chosen**, and saving waits for a choice: it used to default
to "Played", which recorded a claim nobody made.

**None of it has been seen running.** Types, lint, `npm test` and an Android
bundle (`expo export`) were checked here; the web dev server never finished its
first bundle on this machine, so not even a browser has drawn it. The typing's
feel, the haptics, the wash, the pills' growth, the keyboard over the fields
and the event page's foot bar are all for a device.

## Conventions

- **State**: server data → TanStack Query; auth session → the zustand store.
  Do not duplicate server data into zustand. The client is `lib/query-client`;
  how its cache is kept, restored and seeded is § Loading — read that before
  adding a query whose data is not plain JSON, or a guard on `isError`.
- **Query keys** are used for invalidation across screens — grep before renaming
  one. `['feed']`, `['my-log', userId, gameId]`, `['game-reviews', gameId]`,
  `['user-logs', userId]`, `['profile-stats', profileId]`,
  `['playthroughs', userId, gameId]`, `['copies', userId, gameId | 'all']`,
  `['community-similar', gameId, sort]`, `['similar-pair', pairId, gameId]`,
  `['similar-suggestions', pairId]`, and the reviews sheet's three:
  `['game-review-list', gameId, …]`, `['rating-breakdown', gameId]`,
  `['review-stats', gameId]` — anything that writes a log's status, completion,
  score or co-op invalidates all three. The first is two queries since the
  sheet was paged (2026-10-20): `['game-review-list', gameId, sort, filters]`
  is every matching review's id in order (`getGameReviewRanking`) and
  `['game-review-list', gameId, 'page', ids, viewerId]` the fifteen on screen
  (`getGameReviewPage`); both go with the prefix. `['top-reviews', gameId, viewerId]` is the
  game page's most liked review: the log form and a moderator's removal
  invalidate it by its first two parts. `['game-players', gameId, viewerId]` is
  the Overview's two Played by squares and `['home-activity', userId]` Home's
  "New from friends" — a follow or an unfollow invalidates both, and a
  moderator's removal the second. `['beloved-games', period]` and
  `['spotlight', day]` are Search's. Labels: `['labelled-games', label]`
  (the list screen) and `['labelled-game-ids', label]` (the picker) — a label
  write invalidates both and updates the badge store (`setGameLabelLocally`).
  Browse: `['platform-directory']`, `['platform-games', id, sort, page]`,
  `['platform-game-count', clause]`, `['events', term]`, `['event', id]`,
  `['release-calendar', year]`, `['critic-reviews', gameId]`. A game's
  shops and its Steam page: `['itad-game', gameId, appid, title]` (its ITAD
  id — it was `['itad-id', …]`, whose answers were kept for good and some of
  which were another game's), `['itad-prices', itadId]`, `['steam-awards',
  appid]`, `['steam-events', appid]`. Search's facets: `['search',
  'catalogue', clause, sort, page]` and `['search', 'catalogue-count',
  clause]` (a facet's games, paged and counted) and `['search',
  'facet-values', kind, term]` (engines, series, franchises by name) — never
  kept on the device. Surprise Me's batch and pool size key on `poolKey(prefs)`
  — every setting that changes the pool, in one string. `['game-audience', gameId]` is the
  Overview's "On GameLog" counts: the log form, the progress sheet and the
  action row's Wishlist key invalidate it. Events:
  `['event-attendance', eventId, viewerId]` (one record, `useEventAttendance`)
  and `['event-attendees', eventId, viewerId]` (the faces) — an RSVP
  invalidates both by their first two parts. Music:
  `['soundtrack', gameId]` (the tab, the screen and Surprise Me share it) and
  `['soundcloud-track', urn]` — both in `NEVER_PERSIST` — and
  `['starred-song', userId]`, which a star or an unstar invalidates.
  Discovery: `['review-chart', period, languages]` (Search's Reviews and
  `/reviews`), `['discover-people', section, …]`, `['review-languages',
  gameId]` (the sheet's language choices) and `['written-languages', userId]`
  — a saved log invalidates the first, third and fourth.
  `['reading-languages', userId]` reads a device store and is in
  `NEVER_PERSIST`; its one writer sets it. Languages go into a key through
  `readingKey()`, never as the array: the same languages in another order are
  the same question. `['top-reviews', gameId, viewerId, languages]` grew a
  fourth part and is still invalidated by its first two.
  The community score: `['rating-breakdown', gameId]` (the strip, the
  Ratings card, the sheet and the masthead share it), `['review-stats',
  gameId]`, `['beloved-games', period]`, `['rating-influence', userId]` and
  `['rating-report']`, a game's raters `['game-ratings', gameId, sort, page]`
  (`ratings/[id]`), GameLog's Top 1000 `['top-chart', 'gamelog', …]` and the
  rating graph `['rating-distribution', 'game' | 'user', id]` —
  **a rating write invalidates all eight by their first part**
  (`invalidateCommunityRatings`), not the one game's: a rating changes its
  rater's weight, and with it every other game they rated. The critics' Top
  1000 is `['critic-chart', page]` and `['critic-chart', 'length']` — its own
  root, so a rating here never refetches IGDB. Search:
  `['latest-reviews', languages]`, `['lists', 'latest']`. Settings:
  `['game-colours', userId]`, `['animated-artwork', userId]` and
  `['copy-stage-3d', userId]` read device stores and are in `NEVER_PERSIST`;
  each one writer sets its own.
  `['gaming-accounts', userId]` (the profile's platform badges; a link or
  unlink invalidates it),
  `['library-pins', userId]` (a library's pins; the picker and unpin
  invalidate it).
  `['mood-art', 'mood:relax' | 'genre:12']` is one cover for a tile at the
  foot of Home — a week fresh and kept on the device, so the grid is not blank
  on a cold start; nothing invalidates it.
  `['album-art-color', uri]` is a picture's Material 3 seed — the game page,
  a studio, a collection, Home's glow and every `<AccentProvider>` share it;
  never persisted (the extractor keeps its own store), never invalidated.
  `['onboarding-examples', 'colours' | 'animated']` is the look questions'
  games.
  Pings (0046): `['pings', 'for_you' | 'latest' | 'mine', userId, genre,
  platform, withRefs]` (the tab's three infinite lists), `['pings', 'unseen',
  userId]` (My Pings' dot), `['ping', id]` (a request — its page, the edit
  sheet and the suggest sheet share it), `['ping-suggestions', id]`,
  `['direct-pings', userId]` (the inbox), `['inbox', 'unread', userId]` (the
  bell's number: pings plus notifications), `['pingable-people', userId]`,
  `['ping-audience', userId]`. Anything that writes a request or a suggestion
  invalidates the `['pings']` prefix; a status write in the log form, the
  progress sheet or Surprise Me invalidates `['pings', 'for_you']`, because
  what you have played is For You's ranking.
- **Colours**: always `useTheme()`. Never hardcode a hex in a component; add the
  token to `Colors.dark` in `constants/theme.ts` — that object is the entire
  palette. There is no `Colors.light`: `APP_SCHEME` is `'dark'` and `useTheme()`
  returns `Colors[APP_SCHEME]`. This app is a dark room by design and a light
  counterpart would be a second product.
- **The room is dark; the light comes from the games in it.** The chrome is a
  near-black and grey — surfaces, rules, body copy — and every control
  rests on it neutral; the house accent appears only on what is selected,
  focused or primary. Separation is by surface step (`background` → `surface` →
  `surfaceElevated` → `surfaceSelected`); controls are the translucent action
  grey (`controlFill`) or, when they are choices, an `outline`.
  Colour enters from *content*, in exactly three ways. A colour that is none of
  these three is decoration and does not belong:
  1. **Identity — read from the box art, through Material 3.** The seed is
     the box art's dominant colour (`useAlbumArtColor`: the native extractor on
     a dev build; in Expo Go `lib/artwork-color.ts` fetches IGDB's `t_thumb`,
     90×90, ~3 KB, and decodes it with `jpeg-js`). Watch Dogs 2 resolves blue,
     DOOM red, Cyberpunk yellow. The scheme built from it lights the page: the
     page, the cards, the active tab, the primary button, the links. Cached in
     `AsyncStorage` — box art does not change. It is the only way a colour is
     taken from a picture (§ One colour method).
     **The ten-hue ramp (`identityEmber` … `identityMagenta`) is now the
     fallback**, used when extraction fails or when no hue dominates (Celeste's
     cover holds only 20% on its best hue, under the confidence floor). Do not
     delete `constants/identity.ts`: without it those games have no colour.
  2. **Meaning.** Score, log status, achievement rarity and tier are *data* —
     they alias onto the same ten hues rather than introducing new ones. Add a
     meaning by aliasing, never by inventing a hex.
  3. **Atmosphere.** `<Ambience>` is a *gradient*, never an image. The first
     version laid a blurred copy of the cover behind the page and it was visibly
     broken — a bitmap has edges, and its top edge cut across the key art while
     its bottom edge ended mid-screen, with the hero's own fade closing on an
     opaque background in between. Three hard horizontal seams in one screenful.
     A gradient has no edges; that is the whole argument. **Never put an image
     behind a page again to get colour out of it.**
- **`primary` is the house colour and `primaryText` is its legible twin.**
  PlayStation blue `#0070CC` is 3.94:1 on the page — correct under white on a
  filled button (5.01:1), below AA the moment it becomes a word. Blue *fills*
  use `primary`; blue *type* uses `primaryText` (`#2E93E8`, 6.07:1). Lavender
  was the house colour for one pass of the control migration and the owner took
  it back to blue; nothing else from that pass was reverted. `accentRoles()`
  computes the whole set for any hue — `color` (fill), `onSurface` (type),
  `ink`, and the state roles `wash` (selected fill), `edge` (selected/focused
  edge), `ring` (focus ring) and `pressed` (a held fill, deeper). **On the house
  accent the state roles are built from `primaryText`, not the fill:** a 14%
  wash of `#0070CC` over near-black is *darker* than a resting control, which
  would make a selected pill the dimmest one in its row. See `HOUSE_STATES`.
- **Accent shifts by screen, through context, never by prop.** `useAccent()`
  returns the accent in force and defaults to the house blue, so a shared
  primitive reads it unconditionally. `<AccentProvider genres={…}>` wraps the
  four screens that are about one game — its page, its log form, its review, its
  achievements. **The feed, search, news, profile and the bottom tab bar stay on
  the house blue on purpose**: twenty games in a list is twenty hues, and colour
  identifies a game only when you are looking at that game. **And every
  provider is the house accent while Settings → Game colours is off** — see
  the Material 3 bullet below.
- **A tinted surface is not a lighter one.** `tint()` in `lib/color.ts` mixes the
  hue in and restores the original luminance, so a tinted card measures the same
  as the grey it replaced (max drift 0.07, no AA verdict flips at any hue). Never
  reach for a plain `mix()` toward a hue for a surface — every hue in the ramp is
  far brighter than `#1C1C1C`, so a naive 7% mix reorders the surface steps.
- **Verify colour with `lib/color.ts`, not with your eyes.** `contrast()`,
  `ensureContrast()` and `readableInk()` exist so a value that is *not* ours — a
  platform's brand hex, a provider's tag — is lifted to 4.5:1 before it ships.
  Xbox's official `#107C10` is 2.0:1 on near-black; shipping it raw is an
  unreadable authenticity.
- **One score ramp.** `scoreColor()` in `constants/score.ts` returns
  `scoreHigh` / `scoreMid` / `scoreLow`. The old second ramp is gone: it used to
  return `success` / `accent` / `danger` while `<ScoreBadge>` used the score
  tokens on identical thresholds, so a 55 was amber in a metadata row and blue
  in a review. Amber won — a mixed game is mixed, and the house accent made a
  middling verdict look endorsed.
- **Colour is never the only carrier.** Every status, rarity and score ships its
  word or its glyph beside the hue (`STATUS_ICON`, `RARITY_BANDS.label`,
  `labelFor`). `statusBacklog` is deliberately pale because the dusty violet it
  replaced collapsed into `statusPlayed` under simulated protanopia. A
  *selected control* carries two non-hue signals too — its wash is lighter than
  the resting fill and its edge far brighter than the resting edge.
- **Superseded (2026-11-04): in-page tabs are reacticx's masked tab bar** —
  § reacticx, third batch. The segmented control below is gone.
- **In-page tabs are reacticx's segmented control, and there is one
  implementation** (`<TabBar>`) — the owner's (2026-11-02: "Make the tabs in
  the app look like this"), read from `organisms/segmented-control` (MIT): a
  pill track (`segmentTrack`, translucent) with a solid thumb
  (`segmentThumb`, the reference's small shadow as a `boxShadow` — elevation
  would lift it over the labels on Android) that springs, heavily
  overdamped, to the chosen segment; a tap swells the thumb to 1.3 and
  wobbles it back; a sideways drag along a row that fits scrubs through the
  tabs; hairlines between segments fade beside the thumb. Chosen label
  `text`, the rest `textSecondary`; on a game's page (`accent.tonal`) the
  scheme's `secondaryContainer` and its inks. **Two departures**: segments
  are as wide as their words, sharing the slack (Search's six scopes do not
  fit equal sixths), and a row wider than the phone scrolls, track and all,
  keeping the chosen tab in view; and **no blur flash on a tap** (Android).
  `align="spread"` is the game page's taller track, `iconOnly` the
  profile's glyphs. It replaced SimpMusic's outlined chips with a poured
  `primary` fill (2026-10-15), so a tab no longer pours.
- **A tap always answers, and icons move — Convx's** (2026-10-31, the
  owner: "on tap there is always responsiveness and even the icons have
  animations"; `constants/press-motion`, read from Convx's `ModifierExt.kt`,
  `Player_v2.kt` and `InteractiveHighlight.kt`, under `npm test`):
  - **`<PressableScale>` springs** (`bounceClick`): one spring both ways,
    Compose's medium-bouncy (ζ 0.5) at 400, so it answers at once and lands
    a little past rest. The default sink is 0.95 (was 0.98); the 244 callers
    with their own `scaleTo` kept theirs. Reduce Motion still dims instead.
  - **It tells its glyphs it is held** (`press-state`), and **`<PressGlyph>`**
    answers: `wobble` (0.86 on a loose ζ 0.38 spring — `pressWobble`), `play`
    (toward 0.2 and back), `skip` (dips, then steps 8dp the way it skips).
    Wrap the *glyph* only. On the icon button, round action, tonal key,
    engagement bar, the top bar's keys and discs, the tab bar, the player's
    and the mini player's keys, the collection's share and like, a review's
    like. Icon controls sink only to 0.95–0.96 now, so the glyph is what
    moves.
  - **A state pops** (`pop={on}`, `likePop`): 0.88 → 1.56 → 1 over 700ms with
    a blink that hides the glyph's swap — likes, Favourite / Wishlist, a tab
    being chosen, Keep playing. **Only within 1.5s of a press of that control**
    (`pressedAt`), so data arriving never pops anything.
  - **Glass lights where it is touched** (`InteractiveHighlight`): a top bar
    glass disc gets a white wash at 8% and a spot at 15% where the finger
    landed, on a ζ 0.5 spring.
  Not seen on a phone. A new icon control wraps its glyph in `<PressGlyph>`.
- **An outline that turns solid pours** (`ui/paint-fill`) — the owner's rule
  (2026-10-15): "Colored outline > fill in animation > still solid color pill",
  the colour "born and expanding from the middle to the edges… like a bucket of
  paint pouring". `<PaintFill on color>` is the pill's first child (the pill
  clips): a circle grown from its centre over 560 ms on Material's standard
  ease, **sized to stop the moment it has reached every point inside the
  shape** (`paintReach`, `lib/paint.ts`, tested — for a pill, the tips of its
  round ends; pass `cornerRadius` for anything that is not a pill), and drained
  back when the choice goes. It was 380 ms, sized to the bounding diagonal, on
  a curve that started at full speed: the circle was gone before it could be
  seen and the owner read it as "a slide that goes left and right". Its words and glyph change ink
  on a 160 ms ease (`inkTransition`, `<PaintGlyph>` — an Ionicons glyph drawn as
  text so its colour can transition). Both are **CSS transitions on React
  props**, so a pill always rests on what was last rendered and never mounts
  mid-pour. Four controls do it: the progress pills and their Story / Main
  follow-up, the log form's Platinum and Spoilers toggles, and onboarding's
  chips (`<TabBar>` did until it became a segmented control). A new control that goes from an outline to a solid fill
  uses it; one that only washes when chosen (`useSelectable`, below) does not.
- **Choices are outlined; actions are filled. Selection comes from
  `useSelectable()`.** Any control with an on/off state rests with no fill and a
  1px `outline` (16% white) and a `textSecondary` label, and when selected takes
  `accent.wash` inside, `accent.edge` around and a `text` label. Every action —
  a button, an icon key, a row that opens something — is the filled grey pill
  instead, so the two never read as the same kind of thing. `<SortBar>`,
  `<ChoiceChips>`, `<SelectionCard>`, the RSVP pills, vote buttons, segments and
  every screen-local toggle read the hook rather than restating it; a new one
  must too. **A single-choice list with words is a `<SelectionCard>`**: the
  owner's reference (SimpMusic's Server options), a 34dp circle on the
  *leading* edge that fills with the accent at 18% and holds a check when
  chosen, then the name (`optionTitle`) and its hint. Inside a selected control `textMuted`
  steps up to `textSecondary` (4.32:1 on the wash). The exceptions are
  deliberate: the log form's **progress pills** are solid poster colours that
  sink when another is chosen (§ The poster screens), the progress sheet's are
  selection cards, and the
  **platinum / spoiler toggles** light in theirs, because the colour is the
  datum; an **open disclosure** (a collapsible row) is an action, so it is
  grey-filled and brightens a step when open; and the game page's action row
  (Favourite / Wishlist / Progress / Collect) keeps its Material 3 tonal keys,
  on/off by `primaryContainer` fill, **glyph** and label.
- **Metadata chips stay grey, and have no edge.** A filter pill is the same
  shape with a 1px border, because a filter can be pressed and a fact cannot.
  Platform and genre chips are deliberately uncoloured: they were tinted once and it read as confetti under artwork that is
  already the loudest thing on the page. `<Chip color={…}>` exists for the cases
  where the colour *is* the datum — a rarity band, a status — and tints the label
  only, never the fill. A run of filled colour capsules reads as a row of buttons
  demanding to be pressed, and chips are not buttons.
- **Superseded (2026-11-03): Surprise Me is a vertical carousel of
  portrait covers** — § reacticx, second batch. The stack below is gone from
  the screen (`surprise-reveal` survives only for onboarding's preview).
- **Surprise Me's art is a filling stack, reacticx's** — the owner's
  direction (2026-11-02), reacticx's `FlingStack` (`molecules/filling-stack`,
  MIT): the card in front and three behind it, each 18 higher and 5% smaller
  and sunk under the page's colour (reacticx blurs them with expo-blur, which
  on Android needs the page as its target — so a veil instead); a dealt card
  falls a card and a quarter down as it fades. **A fling down deals, a fling
  up goes back**, and the sideways swipe still drives the deck one for one.
  Nothing about the deck changed: every card's depth is its place less
  `pageX / width` (`<StackCard>` in `surprise-reveal`), so batches, prefetch,
  the settle timer and the gestures are as they were. It replaced
  SimpMusic's plain pager (2026-10-21), which had replaced a face-down deck
  that flew off; neither comes back unasked.
- **The ambient effect belongs on a game's own page and the review, nowhere
  else.** Not on rails, grids, feeds or any screen showing several games side by
  side: one glow per screen is atmosphere, eight is a lava lamp. `<Poster>`
  deliberately has no coloured-shadow prop — it was added, it looked like a
  sticker, it was removed. (The review card carried a light for one pass — a
  "black chrome" plate with a spotlight — and the owner took it off again. See
  § Review cards.)
- **Controls follow the owner's reference, SimpMusic — read from its code, not
  traced from screenshots.** `maxrave-dev/SimpMusic` is open source:
  `ListenTogetherScreen.kt` (the name field, "Create room", the disabled "Join
  room"), `ListenTogetherSettingsScreen.kt` (the Server options) and
  `AnalyticsScreen.kt` (the typography and spacing). Go back to those files
  before changing a control's measurements. DESIGN.md § 9 is the full statement.
  In short:
  - **Superseded (2026-11-04)**: `primary` is the prominent capsule — § The Apple pass.
  - **Every action is the same grey pill** (`<Button>`): 52dp
    (`ControlHeight.medium`), `Radius.pill`, filled `controlFill` (#181818 on
    black), a small semibold label in `controlInk`. Variants change the label,
    not the object — `primary` a step brighter, `danger` red, `ghost` a bare
    text action. **Disabled** is the reference's disabled "Join room": no fill,
    a faint edge, a dimmed label. No default shadow.
  - `<IconButton>` is the round sibling: a circle in `controlFill`, no edge,
    drawn at 40/32 and touched at the floor through vertical slop.
  - **Fields** (`<TextField>`, `<SelectField>`, search, text areas) are one
    object: a soft well in `input` (#0F0F0F on black), **no border**,
    `Radius.input` (18), 54dp (`ControlHeight.field`), `fieldText` (13), a
    small `fieldLabel` above. Focus draws the accent's edge (1.5dp, as the
    reference's code boxes do); an error keeps it red.
  - **States are drawn, not faded.** `PressableScale` takes `pressedColor` (a
    fill eased in on the UI thread with the sink) and `focusRing` (a 3dp
    `accent.ring` outline for keyboard focus).
  - Filters, tabs and chips are pills. Small controls are drawn at
    `ControlHeight.small` with `SmallControlSlop`, and wrapped rows of them use
    `SmallControlRowGap` as their `rowGap` so the slop tiles and never overlaps.
  - Sheets, dialogs and menus: `Radius.sheet` (24), a hairline edge, a round
    close key.
  **What kept its own treatment:** the game page's Material 3 cluster (the vivid
  review button — `tone="vivid"`, the one `<Button>` that is not grey — the
  connected tonal action keys, platform keys), `<RoundAction>`,
  the collection header's two translucent action circles (the reference
  album's own, over a page that changes colour),
  the sign-in brand buttons (same pill shape, brand colours), meaning colours,
  and the physical objects. Do not "fix" them toward the rest.
- **Type and spacing follow the reference's Analytics screen.** Bold is for
  titles and figures only; everything that explains them is regular, smaller and
  quieter. A fact is a **quiet label over a bold value** (or a bold figure over a
  quiet line — "53" / "Songs played"), in **sentence case**: no uppercase,
  tracked micro-labels on a stat strip, a masthead fact or a notice. A row or a
  card in a list titles itself in `itemTitle` (13 semibold) with a `bodySmall`
  line under it. Sections sit ~32dp apart (`x32`) with ~16dp from heading to
  content (`<HomeSection>` uses `x12`, as cards stack); a card's inset is ~15dp. The game page's
  sections are measured from SimpMusic's artist page instead, as fractions of
  the display — see the Overview bullet below. The studio page's banner is the worked example: the name, then the
  subject on the left (a bold figure over a quiet line) and one measurement on
  the right (label over value). **The side margin is the reference's 15**
  (`Spacing.x16`) — SimpMusic's Home, Library and every row use it; its
  Analytics screen's 24 is that screen's own. It was 10 while the interface was
  zoomed out, and it moved on every screen at once, rails included. **Two
  places are not on it.** The game page's Overview tab: its sections sit at the
  artist page's 20 (to scale), rails included, so nothing inside it misaligns —
  the step is at the tab bar, between the masthead's 15 and the sections. And
  **the profile screen**, whole: ten (`PROFILE_MARGIN`), at the owner's
  direction — its top row, its head, its tabs and every list under them, so
  the screen has one left edge.
- **Ratings** are an integer 0-100 on `logs.rating`; `constants/score.ts` maps
  that to a verdict band ("Excellent", "Mixed") and a colour.
- **`logs.rating` is the only score anything reads.** A reviewer can score by
  category instead (`logs.review_metrics`, see `constants/review-metrics.ts`),
  but the client writes the mean into `rating` at the same time. Feeds, game
  averages, profile stats and share text all stay on `rating` and never need to
  know which way the score was entered.
- **No setState in effects.** The React Compiler lint rules are on and treat it
  as an error. To seed form state from a query, render a child with a `key` (see
  `app/log/[id].tsx`) rather than syncing in `useEffect`.
- **Reanimated shared values**: use `.get()` / `.set()`, never `.value =`. The
  React Compiler rules flag assignment to `.value` as mutating a captured
  binding; the accessors behave identically. See `ui/pressable-scale.tsx`.
- **Superseded (2026-11-04): the family is `Typeface` (Inter) at Apple's sizes** — § The Apple pass. The bullet below is history.
- **One family: Inter, for everything — the owner removed the review serif.**
  Source Serif 4 set reviews and nothing else (a review's title, its prose, the
  headline on a card) on the argument that a serif makes writing read as
  writing. The owner's direction: "remove the specific font for reviews and
  just use the normal one for the rest of the app". The `review*` steps in
  `Type` stayed, re-pointed to Inter — they are still the sizes of a review
  surface, and `reviewProse` went from 14/23 to 14/22 because a sans needs less
  leading than the serif did. A review is told apart now by `proseInk` (quieter
  than `textSecondary`, because a thousand words at interface brightness is a
  wall), its measure and the page it is on. **Do not bring a serif back** for
  "editorial" surfaces; the package is uninstalled and three font files (~1 MB)
  left the build. Every weight is its own family name — Android synthesises
  neither bold nor oblique from a custom font, so `fontWeight: '700'` on Inter
  silently renders regular. **Onboarding has two more, and only onboarding**:
  Inter ExtraBold for its headlines and Geist Mono for the small instruction
  over them (`FontFamily.extraBold`, `.mono`), the owner's reference. One weight
  each, by path. **A review's quote is the one other place ExtraBold is set**
  (`<QuoteBlock>`, at the owner's direction, 2026-10-16: "use the same font
  that's used in the onboarding screen for the bold text into the quote");
  nothing else sets either.
- **The fixed-colour surface ladder is the owner's two colours and the steps
  above them.** The page is `#14171C` and a card is `#1B1F28` (`surface`) —
  given on 2026-10-20 and measured out of their own reference, where those are
  the page and the card exactly. Everything above follows: `surfaceElevated`
  (`#1F2430`, the resting fill of every control), `surfaceSelected`
  (`#262C3A`) and `skeleton`; `input` and `controlFill` are translucent white
  and need no moving. **The ladder only ever climbs, and that is load-bearing**
  — a control resting on a card is drawn by being lighter than the card, so
  when the page and the card moved up, `surfaceElevated` had to move with them
  or every button inside a card would have been a dark hole. Its old middle
  (`#15171D`) is darker than the new card. `review-card.test.ts` holds the
  whole ladder monotonic and every step between 1.04 and 1.2.
  The page has been `#14171b`, then a near-black `#0B0A0D`, then `#050609`,
  and is now back where it started, one blue level up. The three text inks
  stayed neutral through all of it on purpose: the protected game case's back
  is set in them. Nothing on a game's own screens uses the ladder for surfaces
  — those derive them from the artwork through `accentRoles`.
- **Typography** goes through `<Text variant="…">` from `components/ui/text`,
  not raw `<Text>`. `Type` in `constants/theme.ts` and DESIGN.md's `typography:`
  frontmatter now agree, so either is safe to read and neither needs migrating.
  They did not agree for a long while, and the note that used to sit here sent
  new work at a *different* scale on purpose — that instruction is gone because
  the spec it pointed at is no longer the one this app is built on. Same for
  `Radius`: the frontmatter's `rounded:` block matches what ships.
- **A `fontSize` set outside `Type` brings its own `lineHeight`.** `<Text>`
  defaults to the `body` variant, so a style that overrides only `fontSize`
  keeps body's 18px line — and Android clips glyphs to their line box. The log
  form's 35px score showed only the middle band of each digit, and
  `<ScorePill size="large">` did the same at 25px. `<ScoreNumber>` and
  `<ScoreReadout>` set one now; anything else drawn larger than `Type` must too.
- **Actions are filled, choices are outlined, content takes a shadow.** An action
  is the grey `controlFill` with no edge; a choice is an `outline` with no fill
  until chosen; neither casts. A card of content takes `Elevation.card` and never
  the action grey — a review card that looked like one would read as one huge
  control. **The "never an edge" half is lifted for every card** (2026-10-20):
  both of the owner's references draw a 1dp hairline round the card, measured
  at about 7% white — which is `border`, the app's own subtle edge — and the
  owner then had every card in the app made the review card (§ Review cards,
  `card-material`). The distinction the rule protects still holds, because
  the edge that marks a *control* is `outline` at 16%, more than twice as
  bright.
- **`<Card style>` cannot lay out the card's contents.** It lands on the outer
  view (fill, edge and shadow), whose only child is the inner view holding
  `children` — so padding works there and `flexDirection`, `gap` and
  `alignItems` silently do not. This is what stacked the community sheet's text
  *under* each cover instead of beside it, and what left a suggestion card's
  byline, text and reasons flush against each other. Put a `<View>` with the
  layout inside the card.
- **`Spacing.x*` names are step names.** Every step equals its name except
  `x16`, which is the page margin and is 15, the reference's. Read the value in
  `constants/theme.ts`; never infer it from the token name, and never "fix" a
  name to match its number.
- **Sizes are SimpMusic's, read from its code, at the owner's direction.** The
  spacing ladder is 4 / 8 / 12 / 15 / 20 / 24 / 32 / 40 / 48 / 64 and `Type` is
  the reference's `Typo.kt` one style per step (`h2` 20 is Home's shelf title,
  `h4` 16 the artist page's section heading, `body` 13, `caption` 11). The
  interface had been zoomed out ~8% (type) and ~17% (spacing) for density; that
  was undone. The controls were already at the reference's sizes on the old
  ladder (52dp buttons, 54dp fields, 15 inside a field) and were re-pointed so
  they kept them — a control's padding is not a page's rhythm, so check what a
  token resolves to before reusing it in one. `ControlHeight.small` is the
  reference's 32dp chip, and `<TabBar>` is drawn at it. `h6` and `label` stay at
  10: they are badges over art. **Artwork did not move**: see the next bullet,
  which is the whole point of art not riding the ladder. Corner radii were left
  alone — several were already the reference's (16 on a selection card, 18 on a
  field) and art corners are this app's.
- **A portrait is three across — except in the library.** (A *row* of games
  is the next bullet.) Every grid of games is
  `PORTRAIT_COLUMNS` (3) wide: the inside of a collection, the studio, Must
  Play, an event's games, a month of the calendar, and Search's results when
  their toolbar's key flips them to the grid. **Somebody's library is
  `SHELF_COLUMNS` (4), eight apart (`SHELF_GAP`)** — 76×114 on a 360dp phone.
  The owner's reference for it is a Letterboxd films tab, four posters to a
  row with one quiet line under each. **The collection's grid has been ruled
  on five times and three stands**: three, four, three ("a thumbnail of the
  box"), then four again when the owner asked for the library's layout "and
  the same for the collection screen inside" — and, having seen that on a
  phone, "switch back to the 3 row games inside the collection screen. But
  keep the 4 rows for the library." Do not make the two match in either
  direction. (The owner says "rows" for columns.)
  **A library tile is the box and one line**: the person's score in the score
  ramp, else their status, else Steam's playtime. The game's name is not
  printed — the box prints it — and is the tile's spoken label; a tile with no
  page to open is labelled too. The library spreads `ShelfGridWindow`; a
  collection's grid, `CoverGridWindow`. The Steam library rail on a profile is still sized by
  `usePortraitWidth()`. The profile's four favourites stay four — a set, not a
  grid.
- **A row of games is covers under a heading on the page, and nothing is
  printed under a cover.** The owner's reference (2026-10-09) is
  Letterboxd's home; they asked for it "for the entire app… the franchise
  games in the game page, studio games, etc". `constants/cover-rail.ts` has the
  numbers, under `npm test`:
  - **The cover is the old size: 120×180 on a 360dp phone**, a third of the
    display, twenty from the next, two and a half in view — the album height
    of SimpMusic's artist page, which every rail was before. For one build the
    covers were the reference's — 82×123, nearly four in view — and the owner
    saw them on a phone: "Go back to the old sizes of game's portraits across
    the app on the rails. They are too tiny." **Do not shrink them again.**
    What the reference still gives a row is its one-line heading and the bare
    cover. One size on every screen that shows a row.
  - **The box is the label.** No title and no year under a cover; the title is
    the cover's spoken label. A row prints a line only for what the box cannot
    say (`lineOf` / `footOf`): a chart's rank, a release date on Home's
    Releases, GameLog's score under Beloved, a face, a name and a score under
    "New from friends". The owner chose this over "one line: the title" and
    over "title and a quiet line, as now". Do not add captions back.
  - **NOT IN A CARD.** The reference draws each section inside a rounded
    panel, and the first build did too — every rail in the app. The owner saw
    it on a phone: "You also placed every rail inside a card. That's not what
    I want. You should remove the cards and leave the game's rails on their
    own. They should not be inside a card." And of the game page: "Same thing
    with the game's rails." A row is its heading on the page and its covers
    under it, starting at the page's margin and running off the far edge.
    **Do not wrap a row of games in a card, a panel or a band, on any screen.**
  - **One exception: Home's "Games for you" is BitChord's lead shelf**
    (`<DiscoverCarousel>`, the owner's, 2026-10-28: "like the one in
    bitchord in the albums & singles section at the top"), read from
    `HeroShelf` / `HeroCard` in its `HomeScreen.kt` and `heroCardWidth` in
    `Common.kt`: big cards from the page's margin, each 70% of the row (320
    at most) so the next peeks in, 0.92 wide to tall (252×274 on a 360dp
    phone), 18 round with a 1dp edge of white at 15%, 14 apart, snapping to
    each card's leading edge. The game's square art (SteamGridDB, else its
    box), its name in `h2` on one line and "Similar to Hades"
    (`recommendFromLogs`' `because`) in white at 72% on two, over a scrim to
    black at 78% behind the caption alone. A card opens its game.
    `constants/discover-carousel` is the geometry (pure, tested). It was
    SimpMusic's "Your daily discover" (Material 3's centred hero carousel,
    morphing masks) for a week, and Apple Music's Top Picks for an hour
    before that. Cards and words on art here only — no other row follows it.
  - **The heading** (`<HomeSection>`; `<Section>` on a game's page) is one
    line of `h2` (the owner's "make the texts for the sections title bigger",
    2026-10-22 — it was `h4`; every `<HomeSection>` caller moved with it), no subtitle, and no "See all" — a heading that leads
    somewhere is the link, the whole line, and ends in a quiet chevron.
    `trailing` puts one small control there instead (Beloved's period).
    Sections are `x32` apart. `<HomeSection>` also heads what is not a row —
    news, the genres, collections, a studio's grid — and there it may carry
    one muted line of explanation.
  - **Who draws one**: Home (Games for you, New from friends, Releases), Search
    (four), the studio's three rails, and the game page's Franchise, Editions
    & extras and Original game. `<CoverRail>` is the generic row;
    `<GameCoverRail>` is it for games; `<ActivityRail>` for people's logs.
  - **Lines under covers are `textSecondary`, not `textMuted`**: Home's light
    and Search's are behind the page, and the muted grey falls below AA on
    them.
  - `parallax` is Home's drift, kept.
  - **`<Panel>` (`ui/panel`) is not for this.** It is the small card that
    titles itself — Ratings and the two Played by squares on a game's
    Overview — and nothing else.
- **Home ends on "Latest events"** — the last three showcases that have
  *finished*, as news stories (`<PastEventCard>`, `<ArticleCard>`'s shape: the
  key art, a byline of where it streamed and the date, the name as the
  headline, three lines of what it was, "See the 64 games shown"), each opening
  `event/[id]`. The owner's direction (2026-10-15): "only display the last 3
  events. Not upcoming, already finished." `getLatestEvents` asks IGDB for the
  ones that started more than a long showcase ago and keeps those
  `eventPhase` calls over. Keyed `['home-latest-events']`; absent when IGDB has
  none.
- **Every screen slides** — `animation: 'slide_from_right'` on the root stack,
  the owner's direction (2026-10-15: "a smooth slide animation. Not too fast and
  not too slow"). On Android it runs on the system's medium animation time,
  400 ms, eased; `ios_from_right` is the short one (200 ms) and read as a jump,
  and the platform default is a fade and zoom. Forms slide up (`SHEET` /
  `FULL_SHEET` in the root layout) — the mini player's test reads those names.
- **Home's "New from friends" is where the review cards were** (`<ActivityRail>`,
  `getHomeActivity`). Covers, and under each a face, a name and the score they
  gave — a mark beside it when there are words behind the number. A log with a
  score *or* a review is in it; your own never are. **One row, and its heading
  says whose it is**: "New from friends" when the people you follow (and your
  accepted friends — `getCircleIds`) have logged something, "New on GameLog"
  when they have not or there are none, and then it is everyone's. Never both,
  never blended — the owner chose this over "friends only" and over two rows. A
  cover opens the review when one was written, else that person's record of
  the game (`game-stats`). These covers wear no Must Play badge.
- **Search has one "Similar to **<game>**" rail, from the game you reviewed
  last.** The heading is `<HomeSection lead="Similar to" title={…}>` — the
  title bold after a regular lead. It said "Because you loved/played …", split
  on a score of 80, which guessed at a feeling the rail does not depend on.
  `recommendationSeed` (`lib/news/recommendations.ts`, pure and tested) picks
  the most recently written-about or scored IGDB log, falling back to the
  latest log, and the rail is `getSimilarTo` for that seed under the game page's
  own `['similar', gameId]` key. The seed is read from `['user-logs', userId]`,
  so saving a review moves the rail on. It was a rail for each of the four
  best-rated games, which never moved and stacked four bands on a screen meant
  to be simple.
- **Artwork does not ride the ladder.** Cover, poster and case sizes are fixed dp
  in their components (`BOX_ART_WIDTH`, `POSTER_WIDTH`, the case's `WIDTHS`) or
  derived from the display (`usePortraitWidth`), never from `Spacing` —
  precisely so retuning `Spacing` or `Type` moves the interface and
  leaves the art where it is — the art is meant to be the largest thing on any
  screen. Grid covers go through `gridItemWidth()`, which subtracts spacing from
  the viewport, so tightening the ladder makes them *bigger*, which is the
  intent. The game case is pinned twice over: its own widths, geometry,
  `Type.caseTitle`/`caseEdition`, `Radius.caseImage`/`caseSpine`, its shadow and
  even its two internal paddings are all literals.
- **`<GameCase />` is for dedicated game pages only.** Game detail, log, review
  masthead, and future collection/shelf screens. It must never appear in a feed,
  review card, search result, notification, comment, list tile or any other
  social or list context — those all use `<Poster />`. The rule is intentional:
  social surfaces stay fast and flat; the case is what makes opening a game page
  feel like picking something off a shelf. Diluting it everywhere destroys that.
- **An award show is a fourth kind of list, and the only one whose rows exist
  before there is a game in them.** `list_awards` holds the ballot — a label, a
  position, a *nullable* `game_id` and the owner's reasons — because
  `list_items`' key is `(list_id, game_id)` and cannot express an empty slot. A
  named winner is mirrored into `list_items` by a trigger in 0016, which is what
  lets the tile's stack, the item count, likes and "which lists is this game in"
  keep working without a single existing query learning that awards exist.
  **Never write `list_items` for an awards list from the client** — two
  categories may name the same game, and deciding when the last one lets go is
  the trigger's job. The eight seeded categories are a starting point, not a
  schema: every one of them, Game of the Year included, can be renamed,
  reordered and deleted, and `create_awards_list()` exists so a show can never
  arrive with half a ballot.
- **A captioned board is a fifth kind of list, and the caption is the content.**
  `kind = 'captioned'` renders three across with each cover under a line of the
  owner's own text — "Games that should… get a remake / be a TV show". The text
  lives in `list_items.note`, a 300-character column that has existed unused
  since 0003, so 0019 adds a *kind* and nothing else; see that file for why it
  reuses `note` rather than adding a `caption` column. No sort row: the
  arrangement is authored, so re-ordering it by release year is not a view of the
  same thing.
- **IGDB has no critic reviews; the "Critic reviews" at the head of the
  reviews sheet are OpenCritic's.** `aggregated_rating` is one averaged number
  and a count — nothing in the schema says "IGN gave this 90", let alone what
  IGN wrote. `<CriticReviews>` (`components/critic-reviews`) quotes each
  outlet's snippet in a card the size of a screenshot (`<ArtRail
  shape="wide">`), the quote in the review's own step and ink
  (`reviewExcerpt`, `proseInk`), the score in the score ramp, and a card opens
  the review. That card is `<ReviewQuote>`, on the sheet's neutral `surface`.
  **It is in the sheet, not on the game page**: it was a rail on the Overview
  until the owner moved it — "a section at the top for critic's reviews, and
  then below is the app's user reviews". The sheet's two sections are headed
  "Critic reviews" and "GameLog reviews". **Its filters and its breakdown
  are made to be read** (2026-10-21, "make the filters and information of
  specific review things better to read"): the breakdown is rows — the
  group, how many people, a bar as long as their average in the score
  ramp, the figure — under sentence-case headings ("How far they got",
  "Played on", "Solo or co-op"); the filters are one card of sentence-case
  questions divided by hairlines, and a line under the Filters button says
  what the list is narrowed to ("Showing reviews scored 80+ · on PC"), open
  or folded. No upper-case micro-labels there again. **GameLog's reviews are in pages of
  fifteen** (2026-10-20, "like the other search stuff in the app"): the same
  `<Pager>`, over the list with its count and under it plainly; a sort or a
  filter starts again at page one. The pages are slices of one ranking of ids
  (`getGameReviewRanking` — likes are counted on the phone, a hundred ids a
  request, because `likes` has no foreign key PostgREST could order by — up
  to a thousand reviews), so a page turn fetches fifteen reviews and nothing
  else. Under GameLog's score, **"Everyone who rated it · N"** opens
  `ratings/[id]`: every score, written or not. When OpenCritic has nothing to
  quote, the critics' section is IGDB's one averaged number, said as that;
  with neither there is no critics' section. It comes through `functions/opencritic` (`getCriticSummary`), which
  needs `OPENCRITIC_API_KEY`; undeployed, or deployed from before snippets, the
  summary has nothing to quote and the section is absent, exactly as ITAD
  prices are. Three things are easy to undo:
  - **The match is by title, so it is tight, and it checks the year.**
    OpenCritic cross-references neither IGDB nor Steam. Its own edit distance
    must be ≤ 0.15, and its release year within one of IGDB's — "Prey" is a 2006
    game and a 2017 one, and OpenCritic only has the second. A near-miss prints
    another game's reviews under this game's name.
  - **Reviews keep OpenCritic's order, quoted ones first, one per outlet.**
    Sorted by score, every well-reviewed game was a row of identical 100s.
  - **The function caches (0035) and asks for a real user.** One game is three
    upstream requests and RapidAPI meters per day; the anon key is a valid JWT
    and ships in the bundle. Same two rules as `scandex`.
- **`ratingVerdict()` grades a distribution; `labelFor()` grades one score.**
  They share a scale and make different claims, which is why the superlative
  bands ("Overwhelmingly Positive") need `CONSENSUS_FLOOR` ratings behind them.
  Three ratings of 95 is three people, not a consensus.
- **A remake is not the game, and the catalogue says so.** IGDB models this two
  ways and both are read: `game_type` for a release with its own catalogue entry
  (remake, remaster, port, DLC, expansion) and `version_parent` for a repackage
  ("Definitive Edition"), with `constants/game-editions.ts` collapsing fifteen
  IGDB categories into six words. The badge is near-black at 82% with white
  type, **never a hue** — colour on artwork belongs to the game itself, which is
  why `<Poster>` has no coloured-shadow prop either — and it is dropped under
  72dp, where a word would not fit above the 10px type floor. (The Must Play
  badge in the opposite corner is the one exception, at the owner's direction:
  see § Labels.) Franchise rails
  filter to originals (`ORIGINALS_ONLY`); the versions live on the parent's page
  under "Editions & extras", and a derivative's page swaps the franchise rail for
  its one original. `games.edition_kind` / `parent_game_id` (0017) carry the
  label into collections and feeds, where there is no IGDB response to read.
- **The profile is a centred head over the old layout, at a margin of ten.**
  The head — face, name, bio, three counts, actions — is centred on the
  screen (2026-10-17, the owner's music-app reference: "Pfp, username, follow
  count bio, etc, centered… a big white filled rounded button for follow");
  under it, unchanged: the widgets under hairlines → four glyph tabs → the
  chosen tab's rows (`<ProfileView>`, `constants/profile-layout.ts`, under
  `npm test`). **It was a Letterboxd-style
  profile for about a week** — a 20pt margin, the widgets as cards forty
  apart, a bigger name, centred counts, tabs at the top — measured off a mock
  and ruled on six times. The owner used it and went back (2026-10-12): "go
  back to the old profile page layout, remove the widgets being inside cards,
  etc. make the margins 10". What holds it now:
  1. **The head is centred, and only the head changed.** The face (22% of
     the display), the name in `h2`, the bio in `textMuted` (four lines at
     most), three counts in columns with faint rules between them (Followers
     · Logged · Following, the reference's order), then the actions
     (`components/profile-actions`): **a big white pill** — Follow, which
     turns the action grey once followed — and two glyph keys beside it, the
     friend control (one glyph per state, a dot for a request waiting on you)
     and share. Your own profile has the same row: Edit profile in the grey
     pill, and share. It was Instagram's — the face beside the name over the
     counts, two half-width buttons — until 2026-10-17. Twelve between the
     head, each widget and the tabs (`HEADER_GAP`).
  2. **The widgets are not cards.** The favourites, the games, the pinned
     song and — last before the tabs, the owner's (2026-10-21) — the
     person's rating graph (`<RatingsWidget>`, absent until they have scored
     a game) are each `<ProfileWidget>` (`components/profile-section`): a
     hairline, a small heading (`itemTitle`, the star glyph on Favourites and
     the song), then the content, spanning the page. `<ProfileBox>` is
     deleted. **Do not box them again.** The games' heading is the way into
     the library and ends in "View all".
  3. **The margin is ten** (`PROFILE_MARGIN`) — the owner's number, on this
     screen alone: the top row, the head, the tab row and every list under it.
     The old layout's was the app's 15 and the week between's was 20. A
     collection's card is told its width here (`<ListTile width>`), because it
     would otherwise start from the app's margin. **A component drawn only on
     this screen takes no horizontal inset of its own.**
  4. **Three counts: Logged, Followers, Following.** Friends was the fourth
     and the owner had it taken off the top of the page, to "keep it as a tab
     in the screen that opens up when the user taps on the following/follower
     count" — `people/[id]`, whose Friends tab is untouched; the friend
     control is the glyph beside Follow now. (I read "move the friends counter" as
     *remove*; if they meant something else, this is the ruling to revisit.)
  5. **The games are four separate covers, exactly as the favourites are** —
     an earlier ruling that survived the return (2026-10-09: "Drop the stacked
     games widget and use the 4 separated games one"). Both rows are
     `favouriteCoverWidth`: four covers eight apart from margin to margin,
     79dp each on a 360dp phone, a dashed slot where there is no fourth. The
     games come from `buildShelf()` (logs and the Steam library merged, **logs
     winning on a tie**); a cover opens its game, a Steam title with no page
     the library. Under them: the digital · physical line and the achievements
     and hours. **Not a stack** — that is a collection's, and only a
     collection's.
  6. **The tabs are under the widgets, as four glyphs**: Reviews · Collections
     · Wall · Steam, `<TabBar iconOnly>`, Reviews chosen. One list — its
     header is the profile and the tab row — so pressing a tab changes the
     rows and leaves the page where it is. **The wall is a tab.** They were at
     the top for a few days, with the wall folded into a "Profile" tab; the
     owner reversed that on 2026-10-09 ("The tabs are below the game and
     starred song"). Do not move them back.
  7. **The bar above names the person on both screens** — your own tab: +,
     your handle, Settings; someone else's: the top bar, with their handle as
     its title, centred (`profile/[id]`, the one `<FrostedTopBar centerTitle>`).
     That is from the week between and was not asked back, so the header's
     first line is the name alone.
- **A mosaic of four is how a collection is listed** (`<ListTile>`, the
  owner's reference of 2026-10-22: "a mosaic, 4 squares with the portrait
  cover in each square. They are slightly separated, you can make out the
  squares"). A row on the page, not a card: the mosaic — four 46dp squares,
  four apart, each a cover cropped to its middle, empty squares drawn as faint
  tiles so every mosaic is one shape — then the name in `h3` (two lines at
  most) and two quiet lines in spaced capitals, "12 GAMES" and "BY ADA", with
  a hairline between rows (`<CollectionSeparator>`, every list's separator).
  The reference's second line counts likes ("206 CAKES"); likes are not on a
  collection's summary and cost a request a screenful, which the owner had
  removed once, so the line is the owner. No description on the row. It
  replaced the review card holding a stack of five covers (`<CoverStack>`,
  deleted with its constants) — the tile from 2026-10-09 to 2026-10-22.
- **A collection is one cover on its own screen and a mosaic of four where it
  is listed.** The owner removed the mosaic from the collection's *own screen*
  ("remove the mosaic feature from the app, inside the collection screen only
  have one game displayed"): `<CollectionMosaic>` is deleted, and with it the
  per-collection choice between four covers and one. The list's mosaic is a
  different thing, asked for later (above). `lists.cover_style` (0033) is still in the database —
  nothing was dropped, as with `posts` — and **nothing reads or writes it**.
  - **The cover** is `cover_game_id`, the owner's pick (the menu's "Choose the
    cover", offered whenever there is more than one game), else the first item
    with art: `resolvePreview` over a summary, `collectionCover` over the full
    list. The two must agree — it is the same game on the screen and the first
    square of the tile's mosaic, so a tile leads to the cover it was showing.
  - **On its own screen** (`<CollectionHeader>`): that one game, for every kind
    of collection, an award show included — its trophy over the artwork went
    with the mosaic, and "Award show" is the line under the title. Square art
    from SteamGridDB where there is any (see the SteamGridDB note above), else
    the box cropped to the banner and anchored a fifth of the way down, where a
    box's subject and logo sit. A collection with no games draws its initial —
    or an award show's trophy — on the app's well. **Every collection with a
    game takes the cover's page colour** now (§ Studio pages, collection pages and studio logos); it was only
    those not showing four.
  - **Where it is listed** (`<ListTile>`: Search, a profile's Collections tab,
    Discover, the game page's "In collections" sheet): the mosaic row above,
    one to a row, a hairline between. The covers are `resolveStack`'s first
    four — the cover first, then the rest in order.
  - **In the add-to-collection picker**: one small `<Poster>` of the cover, in
    the 48dp slot the mosaic had.
  The header itself is a music-app playlist hero: half the display, a long
  early fade into the page, so there is no edge where the image stops. Over the
  bottom of the art, centred, are the name and one quiet line — "Collection · 12
  games". **Under the art, on the page's solid colour, is the owner's layout** —
  do not put any of it back where it was: one row with **who made it on the
  left** (picture and name, a link; it used to be the middle line of the title
  stack, printed on the cover) and **share and like on the right**, as the
  reference album's 48dp circles filled with the ink at 12% (`AlbumScreen.kt`).
  The like draws out into a capsule to hold its count once it has one, and
  lights in `liked` with a solid heart — it was a white "Like" pill in the
  reference's Play slot, the page's one big button, and the owner had it
  changed. Then the description — three lines and a More that opens in place,
  "No description" in the same place and type when nothing is written. The
  byline, the description, the sort tools and the games share **one left edge,
  the page's margin**; the body was the reference's own column, 32 in, while its
  row was centred. **The owner's menu is not in the masthead**: it is a glass
  disc at the top right of the screen, opposite the back button, where
  SimpMusic's album keeps "more" — `<TopBarDisc>` in the screen's top bar,
  opening `<CollectionOwnerMenu>`. So `<CollectionHeader>` does not know who is
  looking, and its row is the same width for everybody. The games *inside* a
  collection are portrait box art (`<Poster>`) — the grid, the rows and a tier
  list's rows alike — and never wear the Must Play badge. The grid is three
  across; it was four for one pass (see the bullet on portraits above).
- **Removing games from a collection is a selection, started by holding one.**
  The owner long-presses a game in the grid, the rows or a tier list; from then
  on a tap ticks or unticks instead of opening, and a bar at the foot of the
  screen carries the one action — "Remove from collection (3 selected)" — and a
  cross that cancels. The mode has no flag of its own: it is on exactly while
  the set is non-empty, Android's back empties it, and picking a cover clears it
  (both change what a tap means). One request (`removeManyFromList`), no "are
  you sure" — each game was chosen by hand and the button states the count.
  **Not offered on an award show or a captioned board**: an award's
  `list_items` are the trigger's (0016), and a captioned board draws itself.
- **Three ways to show a game, and they are not interchangeable.** `<GameCase />`
  on a game's own page; `<GameListItem />` for a row that needs a surface behind
  it (search results, feeds); `<CoverTile />` for a grid where the artwork *is*
  the screen — the Top 10, the News chart. A CoverTile has no card, no pill and
  no badge on purpose: wrapping covers in the app's rounded containers turns a
  wall of art into a list of buttons with pictures on them.
- **The top bar is SimpMusic's, and § The top bar is the whole statement.**
  There is still no *native* header anywhere (`app/_layout.tsx` and
  `app/(tabs)/_layout.tsx` set `headerShown: false`); every pushed screen draws
  `<FrostedTopBar>` through `<Screen topBar={…}>`. In short: a screen's name is
  its bar's `title`, never a heading printed under the bar; a page that scrolls
  uses a page scroller; right-hand controls are `<TopBarDisc>`s.
- **`<Screen topBar>` is a slot, not a child.** The bar blurs the page, so it has
  to be a *sibling* of the content it blurs and sit outside the `<BlurTargetView>`
  that `<Screen>` wraps around everything else. A bar rendered as a child would be
  inside its own blur source. It reserves no space: screens leading with artwork
  (game, collection, review, studio, Top 10) let content run underneath, and
  everything else passes `<Screen insetHeader>` — **which is also what decides
  the kind of bar the page gets**. Modals additionally pass `<Screen modal>` —
  an iOS sheet starts below the status bar and must not be inset again; see
  `useTopBarInset`.
- **Gradients end on `withAlpha(colour, 0)`, never `'transparent'`.**
  `expo-linear-gradient` interpolates through black on Android, so fading to the
  keyword leaves a grey bruise mid-ramp. `withAlpha` is in `constants/theme.ts`.
- **Picking a game is not browsing for one.** `<GameSearchResults>` holds the
  query, sort and load states; the *caller* owns the text field and decides what
  a tap does. No `onSelect` means the row links to the game page (Search tab);
  an `onSelect` means it returns the game (`add-to-list/[id]`). Never send a
  picker flow to `/search` — it has no idea what to do with the result, which is
  exactly how "Add games" managed to do nothing at all.
- **Sorting is `<SortBar />` plus `sortGames()`** (`lib/games/sort.ts`) for lists
  already in memory — studio catalogues, collections, search results. A linked
  Steam library is the exception and sorts in Postgres via `LibrarySort`,
  because it can be nine hundred rows. Sorting is a view: never write the new
  order back, and read a ranked collection's numbers from its stored sequence.
- **A game's screens run Material 3 dynamic colour, seeded by its box art** —
  the game page included, and a studio and a collection by their art; it is
  the app's one colour method (§ One colour method).
  `theme/dynamic-color.ts` turns one seed hex into the twenty-three M3 roles via
  `DynamicScheme` + `Variant.TONAL_SPOT`. **The tones are read off the palettes,
  not off the scheme's getters** — those implement whichever M3 spec revision the
  library defaults to (2021 today, whose dark `surfaceContainer` is tone 12, not
  the 20 this app wants), so `ROLES` in that file is the single statement of what
  the colours are and survives a library upgrade.
  `accentRoles(hue, { tonal: true })` is the bridge: it renames M3's roles onto
  the app's ten so the twenty-odd components already reading `accent.card` or
  `accent.elevated` got M3 colours without being edited —
  `page`→`background`, `card`→`surfaceContainer`, `elevated`→`surfaceContainerHigh`,
  `color`→`primary`, `ink`→`onPrimary`, `quietInk`→`onSurfaceVariant`. The full
  set is on `accent.m3` for the roles the ten have no name for
  (`primaryContainer`, the secondary/tertiary families, `outlineVariant`).
  **The masthead's selected states are `primaryContainer`, not `primary`**: the
  review button is the one filled `primary` on the screen, and a lit action key
  or platform key wearing the same tone would be a second primary action.
  `tonal: false` is the **house blue** — `primary` is a chosen brand colour
  on a fixed `background`, not a measurement, so the forty screens off a game
  page never move with any game.
  `npm test` asserts every role is a valid hex and that every ink/surface pair
  clears 4.5:1, across six seeds and both modes. Run it after touching `ROLES`.
- **Game colours can be switched off, for the whole app** — Settings → Game
  colours, the owner's request (2026-10-20): "Add a setting to turn off the
  material expressive colors in the app. Adapt the app to non-material
  colors." `lib/game-colours.ts` keeps "off" on the device per account (on
  by default), `useGameColours()` reads it (`['game-colours', userId]`,
  `NEVER_PERSIST`), and **two places obey it, so nothing else has to**:
  `<AccentProvider>`, which then hands down what `neutral` does — the house
  accent, as if there were no provider — and `useGameAccent`, for the
  screens that draw a provider and colour their own page from it. Every game
  screen (the game page, log form, review, achievements, soundtrack, a copy,
  a genre, Surprise Me, an award slot) is therefore the app's room: the
  neutral page, `surface` cards, and **the owner's grey `#CACACA` as the
  accent** (`gameNeutral`, 2026-10-20 — not the house white: the review
  button, the lit keys, the selected tab), through `accentRoles`' neutral M3
  mapping (`neutralM3`). A review's own colour disc still means the house
  white. No artwork is decoded while it is off. What had to be adapted for
  it:
  - **Cards.** Every card's fill was the game's `primaryContainer` at half
    brightness, which on the neutral mapping (`surfaceSelected` halved) is
    *darker than the page*. Cards read `AccentRoles.tonal` now
    (`useCardMaterial`) and are `surface` on the house accent.
  - **Surprise Me's bloom** is the game's colour as light; on the house
    accent that is white at 50% behind the card — a torch. It is the room's
    soft grey (`glowEdge`) instead. The swipe edges, the sheen and a copy's
    lamp stay white: brief, or faint.
  - **A review's own disc** (its page's colour switch) is not drawn while
    game colours are off: it would switch on something that cannot be on.
  - `<GameColoursWarmup>` in the root layout reads the switch once there is
    an account, so the first game page finds the answer in memory and an
    "off" never opens in colour first.
  - **A collection's and a studio's page colour** (`useGameAccent`) follow
    it too, at the owner's word ("it should apply for collection and studio
    page"): off, both are the app's page.
- **`react-native-image-colors` must never be imported statically.** Its entry is
  a bare `requireNativeModule('ImageColors')` evaluated at import scope, and Expo
  Go ships only Expo SDK modules — so a static import throws while the module is
  *evaluating* and takes down everything that transitively imported it, exactly
  as `expo-notifications` did. `use-album-art-color.ts` loads it with a lazy
  `import()` behind a latching availability flag and falls back to
  `lib/artwork-color.ts` (pure-JS `jpeg-js`, works anywhere). Dev builds get the
  native extractor; Expo Go gets the decoder; neither branch is a degraded mode.
- **Superseded (2026-11-03): the game page is Apple TV's now** (§ Apple TV) —
  the masthead row, the action row, the stats strip and the Overview's cards
  described in the next bullets are gone (the pinned hero and the three tabs
  stayed); they stay here as the record of what the owner ruled on before.
- **The game page's masthead is a film's page in Letterboxd, measured.** The
  owner's second reference (2026-10-08, a screenshot of a 360dp display at 3×):
  every size and interval was read off it and is in
  `constants/game-masthead.ts`, under `npm test`. Type is matched by capital
  height — the reference is Graphik, this is Inter. Top to bottom: the hero,
  one row set into its fade (billing left, cover right), the synopsis as bare
  text, one full-width rule, the stats strip, the actions, your log. **Seven
  owner rulings hold it, and the later ones undid earlier ones — do not "restore"
  any of them:**
  1. **The hero is the backdrop hero** — 38% of the display
     (`heroHeightFor`), the art cropped to fill it, `scrim`, `fade="mask"`,
     running under the status bar. For one pass it was a picture instead: the
     art whole at its own aspect, no fade, under the status bar, the page's
     height following the image. The owner took it back — "go back to the hero
     art old aspect ratio… you have to keep the fade transition". **Do not
     re-try an uncropped hero or drop the fade.** What stayed from that pass is
     *which* image it is (§ Artwork).
  2. **The fade is soft, and the row is in it.** "The fade for the hero art
     should be softer… the title and art should sit just barely above the
     point where the fade starts. Not below it, not above it, right into it."
     The mask starts a sixth of the way down, eases at both ends and trails
     off (`dissolveAt`: `(1 − u^2.4)²`); it was full strength to 38% and then a
     straight line, which has a corner at each end. The row rises into the
     hero (`mastheadOverlap`, 11.5% of its height, ~30dp) so the top of the
     cover is on the last tenth of the art and the art has gone by the title.
     **Not with Skia since 2026-10-31**: the hero's foot is Convx's there,
     and about 45% of the art, blurred, is behind the title — § One colour
     method, the pinned hero. The fade below is what a build without Skia
     draws.
     **This replaced "under the art, twelve below its edge"**, which had
     replaced the cover rising 46% into the picture ("a boxed copy propped
     against a poster"). Neither comes back: not a gap under the hero, not a
     cover over visible art. `fade="mask"` has one caller, so the curve is
     this page's.
  3. **The cover is on the right; the billing starts at the margin and is set
     left.** The reference's arrangement. The billing was right-*aligned* for
     one pass and brought back; that ruling stands — it is the cover that
     changed sides. The row is top-aligned and the billing starts twelve under
     the cover's top, which puts the name's capitals eighteen under it — the
     reference's — on every game. It was centred against the cover for the
     first build, and a game with one line under its name dropped out of the
     fade; slack falls under the billing, beside the foot of the cover.
  4. **Everything in it is smaller than it was.** The cover is 27.8% of the
     display (`mastheadCoverWidth`: 100dp on 360; it was a third), the name
     22/27 (`billingTitle` — it was 28/34), the lines under it `body` (they
     were `h3` and 15). The name runs to four lines: a game's name is not
     truncated on its own page. **The box in Platforms kept its third**
     (`CASE_WIDTH_RATIO`) — it is the case, and was not asked to change.
  5. **Plain lines under the name — date, developer, publisher — and the
     companies are links.** Sentence case, no label, no capitals: the owner
     was offered the reference's "2017 · DEVELOPED BY" over a bold name and
     chose "keep today's three lines". Then (2026-10-09) they had the
     Overview's "Developers" card removed in favour of these lines: "have them
     be clickable from the header. The developer's names should be in bold to
     make them stand out." Then (2026-10-15): "all the studios… should be in
     bold" — a publisher was regular in the quiet ink, so a game with both had
     one bold name. **Every company line is bold in the full ink**, and each
     is a link to that company's games
     (`<CompanyLink>`), one line a company, every developer and then every
     publisher that is not also one. The ids come from `getGameExtras`, which
     the page asks for on every tab now; until it answers, and for a game
     that is not IGDB's, the two names are the record's own and not pressable.
     The lines are four apart, so a link's slop is two either side and its
     target is under the tap floor — the price of links in a stack of 19dp
     lines.
  6. **The inks are the game's own, at the reference's lightness.** Its title
     is pure white, its bold name L* 93, everything else L* 76–81, on a page
     at L* 10 — which is M3's 100 / 92 / 82 on tone 10, the ladder a game's
     page already has. So: `onPrimary` (the palette's one pure white) for the
     name, `accent.quietInk` for the rest, and Letterboxd's own blue-greys
     nowhere. The owner chose this over the literal hexes.
  7. **The synopsis is in the masthead, not in a card.** "Standalone text in
     the header": under the row, above the strip, three lines, the last line
     and a quarter fading into the page (`ABOUT_FADE`), the text itself the
     thing you tap, opening with the card's own motion
     (`<ExpandableText fade>`). No heading, no More. A game with no synopsis
     has no block. Under it one hairline runs edge to edge — the reference's,
     and the only rule in the masthead.
  Two things came with the cover. **It is a `<Poster>`**, not the case
  feature's framed cover it used to be drawn through (`<GameCaseFlip>` on a
  platform with no case): that one has a 12dp corner and its own frame, both
  protected, and the owner asked for the reference poster's corner and outline.
  No protected file was edited; the slot changed hands, the landing pose is
  `<GameCaseFlip>`'s term for term, and the case feature still draws the box in
  Platforms. **And it stands on a halo** (`<CoverHalo>`): a soft round darkening
  behind it, ~40dp past its edges, about 30% at the middle of its sides — the
  reference's is 20%, and the owner asked for one that is "medium sized", not
  small. An ellipse in the cover's proportions, drawn as the row's first child
  so it is under the billing as well as the cover. It is the one place a
  centred, offsetless shadow is right here; do not copy it to a rail.
  **Not yet seen on a phone.** Types, lint and the geometry's tests pass; the
  fade's softness, where the row lands in it and the halo's strength are the
  three things to judge on a device.
- **No portrait cover wears an outline.** Every one wore a hairline of cool
  white inside its corner for a while (`coverEdge`, the reference poster's);
  the owner had it removed (2026-10-14) and the token is deleted. Do not draw
  an edge over a cover or round a `<Poster>` again.
- **One score in the masthead: IGDB's, and only when the app has none.** The
  stats strip under the row prints the app's own average and its count
  (`['rating-breakdown', gameId]`). IGDB's `total_rating` — labelled "IGDB";
  it said "Community", which read as GameLog's own over a strip saying nobody
  here had rated it (critique, 2026-10-21) — under the billing is drawn only
  when that query has answered with no ratings
  (or failed); with one, it was a second, different number about the same game
  a line above the first. Nothing is drawn while the query is pending: a figure
  that appears and is then removed is worse than one a moment late. The page
  reads the strip's query under the strip's key and arguments, so it is one
  request — diverge and it is two.
- **The game page after its critique (2026-10-21)**, by the owner's answers:
  - **The tabs pin under the bar** once the page has scrolled them up to it
    (`<PinnedTabBar>`, `ui/pinned-tab-bar`): a second copy over the page,
    shown from the in-flow tabs' measured top on the UI thread, hidden from
    a screen reader. Choosing a tab there scrolls the new tab to its start.
  - **The progress key says "Log" until there is a log** (`TonalKey`'s
    `caption`) — the one printed word in the group, the owner's exception to
    the keys being glyphs alone. A key with no `active` (Collect) announces
    no selected state.
  - **Share is a disc at the top right**, after the trailer switch. The
    action row gave Share's slot to Collect and the page had none.
  - The review button says "Write your review" on a log with no writing;
    "Edit your review" only when there is some.
  - The empty score cell is "Unrated" over "Be the first" (a door to the
    sheet); "Based on N ratings", not reviews; Favourite and Wishlist each
    dim alone while writing, both while the lists first load; "On GameLog"
    and Achievements say they failed and offer Try again.
- **A game that is not out cannot be reviewed, anywhere** — the owner's rule
  (2026-10-14). `isUnreleased` (`lib/games/release.ts`) decides, from IGDB's
  date. Its page has no review button and no progress key (`<GameActions>`
  says when it is planned instead). Surprise Me's review card says when it can
  be reviewed and is not a door; the profile's quick log badges it "Not out
  yet" in Review mode and says when instead of opening the form; and **the log
  form refuses to open a new log for one** (`app/log/[id]`) — the backstop for
  any way in nobody thought of. An existing log still opens. Quick log's *Log*
  mode still raises the progress sheet for an unreleased game: it writes a
  status, not a review, and that was not ruled on.
- **The game page, Surprise Me and a review have no gradient.** `<ScrollAmbience>`
  is gone from all three; they fill flat with `<Screen background={accent.page}>`.
  (The review page stayed a neutral dark room for a long time; it now runs on the
  game's colour like the other two, and its prose keeps `proseInk` on M3's
  darkest tone.) The
  gradient put the page's brightest colour directly behind the masthead, so
  every control there was competing with a backdrop made of its own hue — which
  is why so many notes in those files read "this measures 2.02:1 on the
  brightest stop". A flat page is a known quantity and gives the accent seven
  tone steps of headroom. Do not reintroduce it there. Home's light is
  SimpMusic's glow (`<HomeGlow>`, § Home): the first block's background,
  coloured from the first cover of its first section, scrolling with the
  page. It replaced, on 2026-10-22, a soft field fixed in the top-left corner
  (`<AmbientLight>`, deleted), which had replaced a stronger corner
  `<SoftGlow>`. Lines set on the glow are `textSecondary`, never `textMuted`.
  `<SoftGlow>` itself survives for Surprise Me's bloom and swipe edge.
- **The game page's Overview tab is SimpMusic's artist page, section for
  section — with a head from Letterboxd** — read from `ArtistScreen.kt`,
  `AdapterItems.kt` and `DescriptionView.kt`, at the owner's direction. Every
  section is a heading on the page (`h4`, the reference's 16sp bold) with its
  content under it, and what the content is decides its shape:
  - **Screenshots are first**, then what the people here made of it. A
    screenshot opens `<ScreenshotViewer>`, where each one **pinches to zoom,
    double-taps in and out, and pans while zoomed** (2026-10-16); the swipe
    between shots is off while one is zoomed. The modal has its own
    `GestureHandlerRootView` — a modal is a window of its own on Android, and
    the app's root one does not reach it. Not tried on a phone. The
    three things below led the tab for one build, as they do on the
    reference's film page; the owner had the screenshots moved "back to the
    top of the page". The three — the owner's redesign (2026-10-09), from a
    film's page in Letterboxd — are each absent when they have nothing to show:
    1. **Ratings** (`<RatingsCard>`): a card titled inside, a hairline, then
       `<ScoreSummary>` — the verdict ("Very Positive"), **under it "Based on
       N reviews"**, the score as its drawing and number, and **the rating
       graph** (`<RatingDistribution>`): a row for 100 and for each ten below
       it, the count, a bar as long as it, in the score ramp's three colours —
       **only the rows that hold a score** (`shownBands`; the owner's,
       2026-10-28: "if there is no rating with a 0-9, dont display it").
       The count was at the far end of the title until the owner had it
       put under the verdict (2026-10-16). **The reviews sheet's own
       summary, one component in both places.** On 2026-10-09 the owner was
       offered a ten-bar histogram and kept a three-part bar; on 2026-10-21
       they asked for this graph, from a reference, for the game page —
       "both in the overview tab and sheet" — and for a person's profile.
       The rows are counted from the ratings (`getRatingDistribution`), not
       0041's histogram, whose top band holds 91–100 and cannot keep 100
       apart. **It is drawn as How ratings work's "Your ratings" spread**
       (2026-10-21, "inside a card… exactly like the one that appears in
       the how ratings work screen"): in a card of its own, a quiet band
       label, a thin pill track with the bar in it, the count at the far
       end — in the sheet and on the profile; here, already in the Ratings
       card, without a second card (`graphCard={false}`). The card is a
       door to the sheet.
    2. **Played by / From your friends** (`<PlayedBy>`, `getGamePlayers`): two
       equal squares, two faces each, each face over the score that person
       gave — or the word for where they are with it. Played is playing,
       played, paused or dropped, not backlog; friends are follows and
       accepted friends; you are in neither. A face opens that person's record
       of the game (`game-stats`). The pair is absent when nobody else has
       played it; with players and none of yours, the second square says so
       in a sentence. There is no "everyone who played this" list.
    3. **Reviews** (`<TopReview>`): the heading, its More to the sheet, and
       **one** card — the most liked review (`getTopGameReview`), as a
       `<MemberReviewCard>`. It was a rail of ten.
    Between the first two, **On GameLog** (`<GameAudienceCard>`,
    `getGameAudience`, 2026-10-16): the masthead strip's figures, three of
    them — Wishlisted (the wishlist list, not the backlog), Playing now,
    Played (played, paused or dropped, so nobody is counted twice). Everybody's
    and the viewer's too; a zero is printed. IGDB's "Want to Play / Playing /
    Played" are shares of its traffic (0.000042), not people — do not swap them
    in. After the review, **Awards** (`<GameAwards>`) — see § Where to buy,
    awards and Steam news.
    Ratings, On GameLog and the two squares are cards titled *inside*
    (`<Panel>`: `h5`, a hairline) — small labelled cards, as the profile's
    boxes are — where the rest of the tab titles on the page.
  - **Pictures → a rail, no card.** Screenshots are `<Section>` + `<ArtRail>`:
    16:9 at the reference's video height. Original game, Editions & extras and
    the franchise are `<Section>` + `<GameCoverRail>`: small covers under a
    heading on the page (the rows-of-games bullet above — and its rule that a
    row is never in a card holds here by the owner's own words). The art keeps
    the app's `Radius.image`.
  - **The critics are not on this tab.** Their quotes were a rail here; the
    owner moved them into the reviews sheet, as its first section
    (`<CriticReviews>`), over the app's own reviews. The page still asks
    OpenCritic as it opens (`useCriticSummary` in `<GameSheets>`), so the
    sheet does not grow a section after it is up.
  - **The companies are in the header, not in a card.** There was a
    "Developers" card of tappable rows; the owner had it removed — "have them
    be clickable from the header. The developer's names should be in bold to
    make them stand out." See the masthead's ruling 5.
  - **The object → on the page.** Platforms (`<GamePlatforms>`) is the one
    section that is neither: the game's box on the left — the console case for
    the chosen platform, which turns over to your record — and beside it the
    title, "is available on …" and the platform `<DropdownButton>`. **No
    price** (2026-10-21): it printed one platform's price directly above
    Where to buy, which prices every store; Where to buy is the one place a
    price is said. `components/game-availability` (`<GamePrice>`) has no
    caller since.
    No card, because its subject is an object, and the case casts its own
    shadow. **The case lives here, not in the masthead**: the masthead shows
    the plain cover (a `<Poster>`) and no price; its one gesture is a tap,
    which brings it to the middle of the screen (§ Animated covers).
    The section opens on the platform you logged, else the first with a case,
    else the first; its art slot reserves the tallest shape the game can show
    so switching PS5 → PC does not move the page, and **the box hangs from the
    slot's top, level with the title** — the owner's direction (2026-10-15); it
    stood at the foot, which sank a short box under empty space.
  - **Words and figures → a card.** Details, Awards, Where to buy, Your copy
    and Achievements are
    `<InfoCard>` (read) or `<InfoCardButton>` (a door, whose heading carries the
    reference's More and whose card is the same door). The card is every
    card's — the review card's corner, hairline and inset (§ Review cards,
    2026-10-20) — filled with `primaryContainer` at half brightness, the
    tone SimpMusic's halved dark-vibrant swatch came to. It was the
    reference's description card (8 in the corner, 16 in, scaled with the
    display) until the owner had every card made the review card.
  - **A heading's More** (`<SectionMore>`) is the reference's `TextButton`: one
    quiet word at the end of the heading row — all reviews, the copies, the
    achievements, the full IGDB record.
  - **There is no About here, and no "Featured in".** The synopsis is in the
    masthead (see the masthead's ruling 7). **Details** — the full IGDB record,
    which was About's More — took its place as a door card of its own
    (`<GameDetailsSheet trigger="card">`), so nothing reachable from the tab
    was lost in the move. ("Additional information", Wikidata's, was further
    down the same tab until the owner had it scrapped — § Wikidata.) The
    rail of showcases a game appeared at was removed by the owner, with
    `<GameEventsWidget>` and the per-game `events` query behind it; events are
    still in Search and on `event/[id]`.
  - **Sizes are fractions of the display** (`useSectionMetrics`): the
    reference's dp values over the 360dp phone it was measured on, where its
    180dp album art is exactly half the width. Type stays on `Type`. The
    Overview pads nothing sideways; `<SectionInsetProvider>` hands every
    heading, card and rail the reference's inset, so a rail runs edge to edge
    and still starts in line with its heading. Screens that pad themselves (the
    Similar tab) leave the inset at 0.
  - **A card that opens in place animates** (`<ExpandableText>`): the whole
    text is laid out and the *height of its window* moves, 250ms on
    FastOutSlowIn, the reference's own method — the clamp itself never
    changes, which is what stops the text being cut before the box catches
    up. Used by a collection's description, an event's, a similar pick's
    suggestion and an award's note — and, with `fade`, by the synopsis in this
    page's masthead, where the text stands on the page: no More, its last
    lines dissolving, the text itself what you press. The veil reads the
    window's own height, so it has no clock to drift. Lists that grow ("Show
    all 24") are not text and still step.
  Nothing here is `Radius.cardLarge` any more; the token survives for the
  `Card` panel variant and the welcome screen.
- **Selection mode: Combined or Any of** (2026-10-16), on Search's facets and
  on Surprise Me. The owner: "Combination mode makes it so it can *only* show
  a game with all the selected options… if I put RPG, isometric, comedy, Unity
  and it's on combined, it will only show games that are RPGs, isometric,
  comedy and made in Unity". Search's facets are now a list
  (`facetsParams` / `facetsFromParams`, one JSON param, `match=all|any`), joined
  by `&` or by `|` in brackets (`facetsClause`); Surprise Me's lists switch from
  `(a,b)` to `[a,b]`, and its platform families each stay any-of-their-machines
  with every family required. Both say plainly when nothing is all of them —
  the example above is 80 games on IGDB, checked live. Search defaults to
  Combined; Surprise Me to Any of, which is what it always did.
- **Surprise Me's card is the game page's** (2026-10-16): the review is
  `<MemberReviewCard>` at three lines, Backlog and Next are `<TonalKey>`s in
  the game page's connected group, and the SoundCloud card is a
  `<SectionCard>` with M3 tonal and filled keys — "the same card and button
  style as the game page and the full-screen review".
- **A review's own page** was redesigned again on 2026-10-17, to the owner's
  music-app reference — see § A review in one sentence. The 2026-10-16 layout
  (the score as words, the strip, the scorecard chart) is gone.
- **Surprise Me's settings are rows, menus and checklists** (2026-10-16): the
  owner, "make the options more friendly to look at, easier to arrange and
  pick… it's kind of a mess". A single choice — which games, released, minimum
  rating, the song — is a `<DropdownButton>` at the end of its row; a many-of
  list — genres, themes, perspective, game modes, platforms, languages — is one
  row in a card saying what it holds, opening `<MultiPickSheet>` (chosen ones
  pinned, a find field past ten, Clear and Done). **Every setting is still on
  the page**, none folded away: the standing ruling that this screen is a
  discovery tool and the options are the feature. Themes, game modes,
  platforms, languages and the release era were added then, as "any of"
  clauses in `surprisePoolQuery`; a new one goes in `SurprisePrefs`, its
  loader, `poolFiltersFor`, `activeFilterCount`, `withoutFilters` and
  `poolKey` (`lib/surprise-prefs.ts`), and nowhere else.
- **A hidden game is a promise, not a preference.** Double-tapping a cover in
  Surprise Me writes it to `lib/surprise-hidden.ts` and it never comes up again.
  **The card does not change when you hide it** — the gesture means "not in
  future", not "next please", so the game stays on screen and fully usable, a
  panel says so over the artwork for `NOTICE_MS`, and moving on stays the
  reader's choice. `excludeHidden` therefore runs inside `getSurpriseBatch` and
  **never over `batch.data` in the screen**; re-filtering there is what made the
  deck shorten under the cursor.
  `excludeHidden` is deliberately unlike `excludeLogged` beside it: that one
  abandons its filter rather than return an empty batch, which is right for
  "exclude games I've played" and wrong for an instruction given about one
  specific game. It is applied **last**, after every other filter, to every mode
  including `foryou`, and the only way back is the list in `app/settings.tsx`.
  The list is keyed `['surprise-hidden', userId]` and both writers `setQueryData`
  with the whole new list rather than invalidating — the store is a single
  AsyncStorage value, so the write already knows the answer.
- **Surprise Me's filters are catalogue filters, and `foryou` says so.** Genre,
  perspective and minimum rating become a `where` clause in `getSurprisePool`;
  "Based on my games" issues no such query, so `<SurpriseSettings>` replaces the
  whole group with one line explaining why rather than leaving it inert. Genres
  and perspectives match as **any of** (`(a,b)` in APIcalypse, never `{a,b}`) —
  ticking more boxes must widen, or a third genre silently empties the pool.
  Perspective ids are a local literal in `constants/player-perspectives.ts`
  because `player_perspectives` is **not** on the Edge Function's allowlist;
  genres are fetched, under the key Home's genre chip already uses.
- **`<Link asChild>` needs a flattened `style` on its child.** Expo Router clones
  that child and throws rather than guess precedence when `style` is an array —
  "You are passing an array of styles to a child of `<Slot>`". Wrap it:
  `style={StyleSheet.flatten([a, b])}`. A `({ pressed }) => …` function style has
  the same problem; use `PressableScale` for press feedback instead.

## Where to buy, awards and Steam news

Three things on a game's Overview, from the owner's requests of 2026-10-16,
that come from outside the app. All three were built against the live APIs
(IGDB through the deployed function, ITAD through its function, Steam's pages
directly) and none has been seen on a phone.

**Where to buy is the owner's rule, in `arrangeOffers`** (`lib/games/
storefronts.ts`, pure, tested against IGDB's real records): "display all
available links to buy the game at different official stores from IGDB. If
one of those stores has a price on the API we use for game prices, display the
price, but the link and the store is always shown and taken from IGDB (except
unofficial stores, who are taken from the prices API)."

- **Folded, it is three rows** — the first three in drawing order, so the
  official stores fill them before any other shop — and "Show all" opens
  every store, at the owner's direction (2026-10-16).
- **Official** means a platform's own shop: Steam, GOG, Epic, the Microsoft
  Store (xbox.com's), the PlayStation Store, the Nintendo eShop, the App Store,
  Google Play, Meta's, itch.io, Game Jolt. They come from IGDB's `websites`
  (`type` — IGDB renamed `category`) first and `external_games`
  (`external_game_source`) second; the ids are in `storefronts.ts` with what
  each was checked against. Amazon is never one: a retailer, by region.
- **ITAD tracks PC shops only**, so it can price four official stores (Steam
  61, GOG 35, Epic 16, Microsoft Store 48 — its link lands on the same xbox.com
  product page) and never a console or phone shop: those rows are links, with
  "Price on the store". Everything else ITAD quotes is an "Other stores" row
  with ITAD's link. An official store ITAD prices and IGDB missed is kept,
  on ITAD's link — the one case the rule does not name.
- **`constants/stores.ts` had the wrong ITAD shop ids for months** — 48 was
  filed as the PlayStation Store, and picking PS5 in Platforms printed the
  Microsoft Store's price under the PS5 box. They are ITAD's live ids now, and
  `PLATFORM_STORE_IDS` prices the PC from any shop, an Xbox from the Microsoft
  Store, and nothing else at all.
- **`getGameStores` read `external_games.category`, which IGDB no longer
  answers**, so no IGDB game ever had a Steam appid and every ITAD lookup went
  by title — through the function's fuzzy fallback, which could answer with
  another game. The appid now comes from `getGameExtras` (`pickStorefronts`),
  is sent alone, and a title match must be the same title (`sameTitle`).
  `GAME_FIELDS` still asks for `category` (§ Steam CDN artwork): this fixes the
  game page's prices, not covers.

**The Awards card** (`<GameAwards>`) is the publisher's graphic from the
Steam page's **`#awardsTable`**, and the Steam Awards the game won:

- **Server-side, in `steam-store`** (`supabase/functions/steam-store`): the
  page is ~250 KB of HTML to read one block. The parser is
  `_shared/steam-store.ts` — no imports, loaded by `npm test` against excerpts
  of seven real pages in `src/lib/games/fixtures/steam/`. Kept a week in 0039.
- **The block is in the server's HTML or nowhere**: no later request fills
  it, and a page without it has no markup for it (Half-Life, Counter-Strike,
  Vampire Survivors, Schedule I). Mature games redirect to the age check; the
  function sends the cookies a browser keeps after one, and reads only the
  Awards block. An honest `GameLog/1.0` User-Agent gets the full page.
- **What varies**: one tall strip (Disco Elysium 349×1792, Baldur's Gate 3
  794×6008), several images (Hollow Knight 3, Elden Ring 5), unquoted
  attributes, a larger copy in `data-big-src`, and **Steam Awards banners**
  — HTML text round a generic trophy — whose class names carry the year since
  2020 and not in 2018's. The trophy is not an award graphic and is left out;
  the banner is read as words. Counter-Strike 2's section is only that.
- **Images are the URLs the page names**, on Steam's hosts only, resolved and
  on https — never built from an appid — and hot-linked, not re-hosted. They
  are AVIF with alpha, drawn for Steam's dark page; expo-image decodes AVIF on
  both platforms (Glide's avif integration, SDWebImageAVIFCoder). Each is drawn
  at the width Steam draws it, at most the card's, and the card folds at
  Steam's own 400. **Baldur's Gate 3's 6,008px strip is the tallest seen and
  has not been drawn on a device** — a bitmap that tall is past some older
  GPUs' texture limit.

**Events & announcements** (`<SteamEvents>`) is the store page's own "Recent
Events & Announcements", from the endpoint that block is filled from
(`/events/ajaxgetpartnereventspageable`), read by the same function and kept
an hour. Chosen over the public `ISteamNews/GetNewsForApp`, which has no
pictures and cannot tell an event from a post; that endpoint is undocumented
and answers CORS for Steam's origin only, which is the other reason it is read
on the server. Each post is a 16:9 capsule (Steam's `_400x225`), a title and
"Update · Aug 27"; an in-game event in its window says "On now", and a post
with no capsule (Valve's patch notes) is a glyph. It opens on Steam. Kinds are
grouped coarsely (`eventKindOf`): only types 12–15, 20, 25, 28 and 34 were
seen on real posts.

**Not deployed and not seen.** `steam-store` and 0039 are new, and neither
the function's fetch, its cache, nor any of the three sections has run on a
device. Types, lint, `npm test` and an Android bundle were checked here, and
the parser was run over the live pages it was written from.

## The library: Apple Music's

The owner's reference (2026-10-22), Apple Music's Library, with GameLog's lists
for its Playlists / Artists / Albums / Songs. `library/[id]` without `?tab=` is
`<LibraryHome>`:

- **Pinned games**, three across and square (SteamGridDB's square, else the box
  cropped; `useSquareCover`'s `resolved` honoured), the name centred under
  each. **Six at most, chosen by hand** (0043, `library_pins`, `lib/api/pins`):
  the owner's library has a "+" tile while there is room (`pin-game`), and
  holding a pin asks to unpin it. Somebody else's shows their pins only.
- **Rows**: Logged (every log but the backlog), Favourites, Backlog
  (`getUserBacklog`, its own request — `['user-logs', id, 'backlog']`),
  Physical, and Steam when an account is linked. A glyph in `primaryText`, the
  name, a count when it is the whole list, a chevron, a hairline from the name
  to the edge. A row pushes the same route with `?tab=`, one list on its own
  page under its name — **no tab bar**.
- **Recently added**: the six newest logs, two across, square, the developer in
  the accent under the name.

**Physical is Cover Flow** (the owner's, 2026-11-02, after rit3zh's
`expo-coverflow-carousel`, MIT; `<PhysicalShelf>` in `components/copy-coverflow`,
numbers in `constants/copy-coverflow` under `npm test`). It replaced the zip
binder of discs (`cd-binder`, deleted). Portrait boxes at 58% of the display,
one neighbour each side turned 64° and the next faded out; drag or flick
along it, tap a side box to bring it in front. **Tapping the box in front picks
it up**: the rest fade, the page fades into the copy's colours (its mesh, as
`copy/[id]` draws it, or its plain page), and the box flies to where that
screen's case stands — `landingRect`, from `copyStage`, `useStageRoom`
(`hooks/use-copy-stage-room`, shared with the copy screen for exactly this)
and the front face's perspective. Then `copy/[id]` is pushed with
`handover=1`: the root layout fades it in instead of sliding, `<CopyShowcase
handedOver>` skips its landing, `<MeshBackdrop instant>` skips its fade.
Back, the box flies home. Reduce Motion is a plain push. The reflections are a
flipped `<Poster>` under a gradient to the page — no Skia. Not seen on a
phone: where the box lands against the case, and the fade between the two
meshes (each starts its own clock), are the things to judge.

The "All games" grid and its stats header (`library-stats`, deleted) are gone;
`?tab=all` from an old link opens the head. `['library-pins', userId]` is the
pins' key, written by the picker and the unpin.

## Linked gaming accounts

Steam is one implementation of a **generic provider**, not a special case.

**PlayStation, Xbox and GOG are linked by username, RAWG's way** (the owner's,
2026-10-22: "reverse engineer how rawg does the sync with psn and xbox and gog
… they ask for the username and they fetch the things if their profile is
public"). What RAWG does, read from its shipped web bundle
(`rawg.io/assets/client/js/client.*.js` and the `game-accounts` /
`accounts-import` chunks): the user has `psn_online_id`, `gamer_tag`, `gog` and
`steam_id`, each with `_status`, `_date`, `_confirm` and `_locked`; the client
only `PATCH`es `/api/users/current` with the name, and its server imports and
reports `process`, `ready`, `error`, `private-user`, `private-games` or
`unavailable`. Its help text says what must be public: PSN trophies ("we can
import games only with trophies info"), Xbox game and app history and profile,
GOG profile page and full library ("you can find it in your profile's URL").
The server side is not in the bundle; what it must call follows from those
requirements and was checked against open clients:

- **GOG — no key.** `gog.com/u/{name}` (404: no such user; the HTML carries
  `"userId"`), then `gog.com/u/{name}/games/stats?sort=…&order=…&page=N`, the
  endpoint GOG's own profile script builds and Playnite's GOG plugin reads.
  403 for a private profile, 404 for hidden games — both observed live. **No
  public profile was found, so a successful answer has not been seen**; its
  shape is Playnite's model (`_embedded.items[].game`, `stats[userId]`).
- **PlayStation — the trophy API, signed in as the app.** psn-api's flow:
  `PSN_NPSSO` → `ca.account.sony.com/api/authz/v3/oauth/authorize` (a code)
  → `/token` (kept and refreshed in `gaming_service_tokens`, 0044), then
  `us-prof.np.community.playstation.net/userProfile/v1/users/{onlineId}/profile2`
  for the account id and `m.np.playstation.com/api/trophy/v1/users/{id}/
  trophyTitles`. 2240526 ("Not permitted") is private trophies. No playtime.
- **Xbox — title history through OpenXBL.** `xbl.io/api/v2/search/{gamertag}`
  (the exact gamertag, never the first hit), then
  `/player/titleHistory/{xuid}`, games only. An empty history is taken as a
  hidden one. No playtime.

`supabase/functions/game-accounts` does all three (`link`, `sync` — at most
every six hours — and `unlink`); `_shared/game-accounts.ts` is its pure half
(names, statuses, rows; under `npm test`). It writes `gaming_accounts` with
`linked_by = 'username'` (0044), replaces the provider's `gaming_owned_games`,
and the library section's `gaming_sync_state`. The app: `username-provider.ts`
(three providers in the registry; `link({ handle })`), Edit profile's **Game
accounts** (`<UsernameAccount>`: the name, RAWG's privacy note, Connect;
linked, the count, Import again, Disconnect), a Library row each, and **a
badge per linked platform beside the profile's name** (`<PlatformBadges>`,
the owner's: tapping one raises a bubble with the name it is linked as;
`['gaming-accounts', userId]`, which a link or unlink invalidates). Things
that are easy to get wrong:

- **Nobody proves the account is theirs**, as on RAWG. 0009's
  `unique (provider, external_id)` stands, so a name another GameLog account
  holds is refused (`taken`) — and a squatter blocks the owner until they
  unlink. Sony and Microsoft offer third parties no sign-in to prove it.
- **Imported games are not matched to IGDB.** `link_gaming_owned_games` still
  matches Steam only; a PlayStation, Xbox or GOG tile is the service's own art
  and opens nothing. GOG's product ids are in IGDB's `external_games` and are
  the obvious first match.
- **Not run with keys, and not seen on a phone.** GOG's error answers were
  observed live; nothing else has run. Deno is not installed here — the
  function was only transpiled. See
`lib/gaming/types.ts` for the contract and `supabase/functions/README.md` for
deployment, rate limits and verified API behaviour.

Adding Xbox/PlayStation/Epic/GOG is three steps: add the id to
`GAMING_PROVIDER_IDS` **and** `gaming_providers()` in migration 0009, implement
`GamingAccountProvider`, register it in `lib/gaming/registry.ts`. No screen gains
a conditional — the UI renders from `provider.capabilities`.

- **`provider` is text + CHECK, not an enum.** Deliberate: `alter type … add
  value` cannot be used in the same transaction that references the new value
  (the 55P04 trap that split 0006/0007), and this schema exists to have providers
  added later. An enum would guarantee that trap recurs every time.
- **The client cannot write `gaming_*` tables.** No INSERT/UPDATE policies exist.
  `external_id` is only trustworthy because `steam-auth` verified an OpenID
  assertion for it, so writes happen in Edge Functions with the service role.
  Clients SELECT (profiles are public) and DELETE their own rows (unlink).
- **Capabilities must stay honest.** `purchaseDates: false` for Steam is why the
  library hides the "recently purchased" sort — Steam exposes no purchase date
  anywhere. A sort that quietly fell back to last-played would misrepresent
  itself. Same reasoning applies to every other capability flag.
- **Never sync someone else's account.** Every `useGamingSync` call site guards
  on `isSelf`. Viewing a profile must not spend the shared Steam rate budget or
  refresh a stranger's presence on demand.
- **Sections sync independently** with their own TTLs, because `profile` is one
  request and `achievements` is two *per owned game*. `achievements_synced_at`
  doubles as the resume cursor.
- **Prices come from IsThereAnyDeal, across ~40 storefronts.** IGDB publishes no
  pricing at all. `lib/games/itad.ts` resolves a game to an ITAD id (Steam appid
  first, exact title as a fallback) and then asks for current deals; the key
  lives in the `itad` Edge Function, so prices need a signed-in session like
  everything IGDB. `fetchSteamPrice` survives for the masthead's per-platform
  line, where the question is "what does it cost on *this* platform" rather than
  "where is it cheapest". **Where to buy is the owner's rule now**: the
  official stores are IGDB's and always shown, ITAD prices the ones it can,
  and the other shops are ITAD's — § Where to buy, awards and Steam news. An
  ITAD shop with no usable price is still dropped; never fill a gap from
  another platform's price.
- **No inventory pricing API, anywhere.** Inventory carries `market_hash_name` — the join
  key every price service uses — and nothing else. Adding valuation later must
  not require re-syncing or a schema change.

## Progress, physical copies, similarity and review filters (0022–0026)

Six systems that extend what was there rather than sitting beside it. The rules
that are easy to break:

- **A log is still the user↔game relationship; progress is two columns on it.**
  `status` (with `paused`, 0022) says where you are and `completion`
  (`story` / `main` / `full`, 0023) says the furthest you ever got. The seven
  choices in `constants/progress.ts` are named pairs of the two, and both the
  progress sheet and the log form write through them. **Completion only rises**:
  status-only choices leave it alone (`progressPatch`), and a playthrough that
  got further raises it by trigger. Never write it down from a playthrough.
- **Playthroughs are children of the log** (composite FK to `logs (user_id,
  game_id)`, cascading). One game, many runs, one log — a second log per run
  would split the review, the score and every count that assumes one row.
- **Game ≠ release ≠ copy.** `game_releases` is one platform/region/edition of a
  game, `release_barcodes` maps GTIN-14 codes onto it, and `owned_copies` is one
  person's box, with its own completeness and condition. "Copies", never
  "collection" — a collection is a curated list here. **No column anywhere holds
  a price, and none may be added**: condition describes wear, not worth.
- **Clients cannot write the canonical release tables.** Every write goes through
  the 0024 RPCs. A submission is a *claim*; it becomes canonical when a second,
  independent account files a matching one (`release_consensus_threshold()`, 2)
  or a moderator approves it. Two colluding accounts can therefore canonise a
  wrong release — moderation exists to reverse that, and a moderator is a row in
  `public.moderators`, written only from the SQL editor.
- **Barcodes are GTIN-14 on both sides.** `lib/barcode.ts` and
  `normalize_gtin()` agree; UPC-E is expanded using the scanner's own type
  (`scannerType`), since an eight-digit code alone is ambiguous with EAN-8.
- **ScanDex identifies; it never canonises.** `lookupBarcode` asks Gamelog's
  releases, then pending claims, and only then the `scandex` Edge Function. A
  ScanDex answer is a game and a platform with no region or edition, so it is
  shown as "Identified by ScanDex", prefills the copy and release forms, and is
  never written into `game_releases`. Its cache (`scandex_lookups`, 0027) has no
  policies and no grants — only the function's service role touches it — and the
  function refuses the anon key, which is a valid JWT, so the token's quota is
  spent only by signed-in people. A failure there must end at "unknown", never
  at an error on the scan screen.
- **Community similarity is its own section, never merged with IGDB's.** Pairs
  are stored once (`game_a < game_b`); suggesting a pair *is* voting for it.
  Votes from accounts with no logs are kept but not counted, ranking is the
  Wilson lower bound, and three open reports hide a pair until a moderator
  restores it. A positive vote with reasons or a comment is a **suggestion**
  (0029): it is listed on the pick's screen and can be upvoted by others, never
  by its author. Agreeing with the pair and upvoting someone's reasoning are
  separate acts and separate controls. A positive vote with neither reasons nor
  a comment is an **agreement** (the Agree button); every positive vote is
  exactly one of the two, which is what lets a pick say "3 users suggested this
  game, with 12 users agreeing" without counting anyone twice (0030). Deleting
  your suggestion deletes the vote, and the upvotes on it go with it.
- **A pick can be reported down; somebody's writing cannot.** Three open
  reports hide a pick (0025), because a pick is the community's claim and
  belongs to nobody. A suggestion or a review is one person's words, so reports
  on those (0031) only queue them: a moderator removes the *words* — a
  suggestion keeps its vote, a review keeps its log and score — or dismisses the
  reports, and removal is not reversible. Every flag opens `report/[kind]/[id]`
  and a flag reports the thing it sits on. Never report through `Alert.alert`:
  Android draws at most three buttons, and with three reasons plus Cancel it
  dropped Cancel, so the pick's old report dialog could not be dismissed.
- **Review filters are clauses on the request, never a sift on the phone.**
  `lib/review-facets.ts` says what "Finished" or "PlayStation" means and
  `getGameReviewList` spells it in PostgREST. A platform filter is a *family*:
  the client resolves the stored `played_on` strings (from `game_review_stats`)
  into families and sends the matching strings through `inList()` — never
  `.in()`, which does not escape a `"` in text somebody typed. A platinum counts
  as finished and 100% in both the filters and the stats.
- **Physical and digital never overlap.** `user_game_stats` (0028) counts a game
  with a physical copy as physical only; digital is the Steam library plus
  logged games (not the backlog), each game once. So the profile's
  "128 digital · 14 physical" adds up to the collection.
- **The disc is not the case's disc.** `<CdDisc>` draws a disc template over
  the art, with its geometry in `constants/cd-template.ts` (measured from the
  file): `game_cd.png` for every platform, except the four whose discs are
  their own — PlayStation, PlayStation 2, Wii and Wii U (`<key>_disc.png`,
  `discTemplateFor(platform)`), with the console's printing on them. A copy's
  platform is passed down; one with none recorded is the plain disc.
  `<GameDisc>` and `DISC_TEMPLATE` belong to the protected case feature and are
  untouched. The disc's other side — a mirror with a rainbow in it — is
  `<CdDiscUnderside>`, and only the copy showcase turns a disc over to show it.
- **A copy's screen is an object that turns** (`copy/[id]`, `<CopyShowcase>`).
  The owner's brief: a screen to stay on — "stare at it for a minute or more,
  play around with turning the case, the disc… a unique space". So the first
  screen is the object alone, edge to edge: the copy's case, as a box, under
  one lamp in the game's own colour, **drifting round by itself** — a lap in
  about twenty-four seconds, slowing on the cover and the back. A touch stops
  it.
  - **Drag sideways** and it turns with the finger to any angle, carries on
    with the flick, and comes to rest square on a face.
  - **Tap the cover** and the case opens on the disc in its tray; tap anywhere
    but the disc to shut it.
  - **Tap or drag the disc** and it comes off its hub; the case shuts and
    leaves and the disc stands alone where the case stood, and turns as the
    case did. Flick it left to put it back.
  - **Tilt the phone** and the lamp moves: its reflection slides over the
    plastic, the pool and the shadow shift, the object leans a few degrees.
  - A vertical drag is none of these: it scrolls the page.

  The owner chose those four from a list and left one out — **flick-spinning
  the disc is not a feature; do not add it**. It replaced tap-to-turn-over and
  drag-right-for-the-disc, which had replaced the same two the other way round.
  Under the stage, centred: the game's name, a line that follows the side
  facing the reader, and the keys — "Turn over", "Open" / "Close", "Take out" /
  "Put back" — each the twin of a gesture. A key the copy can never use is not
  drawn; one that cannot act now is dimmed in place, so the row never
  re-centres under a thumb. `mode` (what is on the stage) is the screen's
  state, because its keys change it and so do the stage's gestures.
- **It turns on nothing: the ring under it was removed, by the owner.** The
  chosen staging was called "On the turntable", and the first build drew one —
  a ring of light lying on the floor under the object, a pool inside it, and
  marks round it that went round as the object turned. The owner's words on
  first seeing it run: "remove the ring below the art where it spins". What is
  under the copy now is its shadow, and what is behind it is the lamp
  (`<CopyStageFloor>`). **Do not draw a platter, a ring or any other base under
  it again**, and do not read "turntable" in an older note as a thing to
  draw: it names the idea — the object turns by itself — not an object.
- **The case on that screen is its own, by the owner's exception.** Asked how
  far the showcase could go round the protected case, the owner chose "lift it
  for this screen". So `copy/[id]` draws a box — `<CopyCaseFront>` (the cover:
  `<GameCase>`'s layering restated from the same `CASE_TEMPLATES` by the same
  arithmetic, with no shadow of its own and the art at 1080p), `<CopyCaseBack>`,
  the spine and the opening edge (`copy-case-edge`), the tray and the inside of
  the cover (`copy-case-inside`). **Nothing there edits `<GameCase>`,
  `<GameCaseDisplay>`, `<GameCaseFlip>`, `<GameCaseBack>` or `<GameDisc>`, and
  the exception is the screen, not those components**: they are as protected as
  they were, everywhere else. The showcase's box may have a drawn spine where
  `<GameCase>` must not — that one was a slab set beside a finished face; this
  is a side of a box, absent while the cover is square on.
- **A box is not six rotated views, and `lib/stage-geometry.ts` is why it
  works.** Every view is flattened into its parent, so faces share no 3D space;
  and Android does not keep a transform as a matrix — it decomposes it into
  rotation, scale, an x/y translation and a camera distance, **dropping a
  translation in z and applying one that follows a `perspective` on the screen
  instead of in depth**. A face pushed forward by half the case's thickness
  lands somewhere else on Android than on iOS and the box comes apart at its
  corners. So the projection is done by hand, and each face is two nested views
  in the only vocabulary both platforms draw alike: an inner one with
  `perspective` and `rotateY`, an outer one with `translateX`, `scaleX` and
  `scaleY` (`<StageFace>`, `solveFace`). It is exact — four matching corners
  fix a projective map — and `npm test` checks it against the real projection.
  **Never give a face a `matrix`, a `rotateX`, or a translate after its
  perspective.** Every face is centred on the camera's height, which is what
  keeps the solve that small; anything that must sit lower (a disc standing on
  the floor, an open case stepped back) is moved by `drop`, a plain `translateY`
  on the outer view.
- **What is true of a copy stays true on its stage.** A **sealed** copy
  does not open: it answers a tap with a short shake, and its Open key reads
  "Sealed".
  A copy on a **cartridge or a card** turns and catches the light and no more —
  there is no cartridge artwork yet, and the owner chose that over a generic
  cartridge drawn in code; each console can open once it has a template that
  follows the disc templates' contract (`opensToDisc`). It never pulls out a CD,
  which every copy used to. A **loose** copy is still drawn in a case, also the
  owner's choice: the back is the one place its edition is printed. And what is
  **inside** an open case is what its owner recorded (`caseContents`): a manual
  under the clips only if the copy has one. Never dress it with a booklet.
- **Its sizes are real objects'** (`constants/copy-stage.ts`), because "the
  disc is the wrong size next to its case" was the complaint. The case is the
  smaller of 82% of the display's width and 58% of its height, with no cap —
  295dp on a 360dp phone, where it was 238. A disc is 120/135 of its case's
  width (it was 0.98), a GameCube's 80/135, a UMD's 64/104. A keep case is
  0.104 of its shorter side deep, a cardboard cartridge box about twice that.
  The stage reserves its tallest pose, so nothing under it moves.
- **The idle turn is one long animation, and it knows when to stop.**
  `driftProgress` shapes a single timing through two hundred half-turns, so
  nothing restarts it face by face. It waits six seconds after a touch; it does
  not resume while the case is open or after somebody has left the copy on its
  back to read it. It is off under Reduce Motion and for a screen reader, and
  the screen parks it — and unmounts the phone's sensor — whenever the stage is
  not in front, the app is in the background, the stage is scrolled away or the
  keyboard is up (`active`). A copy left open in a pocket must not be working.
- **Tilt is Reanimated's own sensor, not a new module.** `<StageTilt>` reads
  the rotation vector through `useAnimatedSensor`, on the UI thread;
  `expo-sensors` would have been a native module's full size for the same
  question (§ APK size). The tilt is taken from the quaternion — held upright,
  a phone sits on the Euler angles' singularity — relative to a "level" that
  catches up with however the phone is being held over a few seconds.
- **A render nudges the stage.** The lost-end-value gotcha (§ Gotchas) is
  usually answered by restating the resting pose as a plain style, which needs
  a pose React can name. A case left a quarter of the way round has none, so
  every render of the stage bumps `pulse`, which every face's place depends on:
  all of them are re-solved and re-applied the frame after.
- **Seen on a phone once, by the owner, and tuned to nothing yet.** Its first
  run there crashed on its first frame — the worklet default in § Gotchas.
  Fixed, it ran: the owner saw it turning and had the ring under it removed.
  That is all that is known about how it looks or feels on a device. This
  machine has no Android SDK, and nothing here can be judged in a browser. What
  was checked here: types, lint, the geometry and the measurements under
  `npm test`, the UI-thread code as the Babel plugin ships it, and a still
  rendered from the real PS5 template and a real cover through the same
  functions. What nobody has reported on yet: the phone's tilt (including which
  way each platform's sign runs), the springs' weight, the lamp's strength, the
  open case. Tune those on a device before trusting any of them. The case
  templates are 420–680px wide and are drawn at up to twice their pixels here;
  only re-exported files make the plastic as sharp as the cover now is.
- **The stage is drawn in 3D wherever the build can** (2026-10-30, the
  owner: "a 3D effect for the CD and game case… a dazzling, iridescent sheen
  that shifts as the disc/case tilts back and forth… the back of the CD should
  have a transparent, clear-plastic appearance… physically accurate
  lighting… threejs, shaders… expo-gl"). `<CopyStageGL>` draws
  `lib/copy-scene` — the box, its hinged cover, tray and inside, and the
  disc's two sides and edge — with three.js into an expo-gl canvas, and adds
  the one motion the flat faces could not make: an idle rock, 7° back and
  forth (DESIGN.md § 4.3.1, In 3D). Things that are easy to break:
  - **It follows; it does not lead.** Every number that moves is still the
    flat stage's, on the UI thread — the drift, the springs, the gestures,
    the tilt — packed into one `ScenePose` a frame (`scenePose`) and sent to
    JavaScript with `runOnJS`. The scene stands everything in dp round the
    same centre, seen from `STAGE_CAMERA`, through a lens offset to the
    stage's centre (`stageLens`) — so the 3D case is where the flat one was,
    and the taps (`onDisc`, `onCase`, worked out against the flat camera)
    still find it. `scene.test.ts` projects both and holds them together.
    Change the camera on one side and change it on the other.
  - **The flat stage is the fallback, always.** It is on screen from the
    first frame; the 3D one loads behind it and is only shown — a 320ms
    crossfade, then the flat faces unmounted — once it has drawn a frame.
    Any failure on the way (`onFail`: no expo-gl or view-shot in the build,
    no WebGL 2, a shader the driver refuses, a template that will not load,
    nothing drawn in 20s) leaves the flat stage as it was. Its canvas is at
    0.02 while it loads, never 0: a TextureView that is never drawn may
    never be given its surface.
  - **A setting, off by default on a 32-bit phone** (the owner's,
    2026-10-30: "add a setting to disable the 3d effect and on phones with
    32 bit make it off by default, but keep them able to turn it on").
    Settings → Physical copies, In 3D or Flat (`lib/copy-stage-3d`,
    `useCopyStage3d`), per account on the device, offered only where
    `STAGE_3D_AVAILABLE`. 32-bit is Android's `Build.SUPPORTED_ABIS` with no
    64-bit ABI in it (`lib/copy-scene/device.ts`, tested), read from
    `ExpoDevice` through `requireOptionalNativeModule` — so Android Go on a
    64-bit chip counts as 32-bit, and an unknown list (iOS, an older build)
    leaves it on. Unlike Animated artwork the choice is stored either way,
    because the default is not always on. Flipping it while a copy is open
    resets the stage to flat, and loads afresh when it is on again.
  - **Gated without importing**: `STAGE_3D_AVAILABLE` asks `requireOptionalNativeModule
    ('ExpoGL')` and for `RNViewShot` before `React.lazy` loads anything, as
    `use-album-art-color` does for `ImageColors` — expo-gl requires its
    native module as it is imported, and view-shot's spec uses
    `getEnforcing`. A build from before them draws the flat stage.
  - **The printed faces are pictures of the flat ones.** A GPU cannot set
    type, so `<CopyStageSheet>` lays out `<CopyCaseBack unlit>`, the spine,
    the edge and `<CopyCaseEditionBand>` under a cover in the page's colour
    at the back of the stage, captures each (view-shot, PNG files) and is
    unmounted. Change how one of those faces looks and the 3D one follows.
    They are retaken when the copy's record changes (`snapshotKey`) and
    swapped in without a rebuild (`scene.reprint`). Nothing in the sheet may
    be expo-image (§ A review in one sentence: view-shot cannot read its
    bitmaps). The box art, the case and disc templates and the scans are not
    pictures of views: expo-asset downloads each to a file and expo-gl
    decodes it natively (`texImage2D` with `{ localUri }` — stb_image, so
    **JPEG and PNG only**), wrapped as a `THREE.ExternalTexture`. A scan
    found after the stage is up builds a new scene and swaps it in whole.
  - **Physics, per format** (`lib/copy-scene/optics.ts`): a CD's tracks are
    1.6 µm apart, a DVD's 0.74, a Blu-ray's 0.32 — and the playing side's
    rainbow is those tracks' diffraction, so a PS5 disc is a plain silver
    mirror and a Saturn disc a CD's bow-tie, as they really are. A
    PlayStation disc is black (dyed plastic). If the owner wants every disc
    to show a CD's rainbow, it is `discFormatFor` — not the shader.
  - **Drawn at two pixels a dp** (`stageRenderScale`) and scaled up: the
    canvas is laid out small and transformed, because its pixel buffer is
    its laid-out size. The playing side's grating is the costliest shader in
    the app; the loop runs only while the drift would (`active && !still`)
    and draws on demand otherwise.
  - **Run twice on a phone** (2026-10-30): it stopped on Hermes's missing
    `FinalizationRegistry`, then on expo-gl's context having no `canvas`;
    each time the flat stage stayed, as designed, and each is fixed
    (§ Gotchas). Not yet seen drawing. Rendered here through the same
    three.js, shaders and `makeRenderer` in a browser — WebGL 2 on
    SwiftShader, on a context made to look like expo-gl's (no `canvas`, a
    WebGL 1 prototype, two `pixelStorei` parameters) with Hermes's missing
    globals deleted — with no shader errors;
    `npm test`, types, lint and an Android export pass. Still unknown: frame
    rate on a mid-range phone, the TextureView's compositing over the page,
    snapshot captures on a device, and how the studio's strengths read.
    Expo Go has expo-gl; a sideloaded APK needs a new build for any of it.
- **A copy's edition is printed on the back of its case and nowhere else.**
  Release, what is in the box, condition, when it was got, the barcode: the
  card of those facts under the showcase is gone, by the owner's rule, and the
  release line over it too. That is one reason the case is drawn as large as it
  is: the back is set in fractions of the case's width, so the case's size is
  the type's. A short face still drops rows that do not fit; they are in the
  showcase's spoken label. The line under the game's name follows the side
  facing the reader and **never repeats what the back prints**: on the cover it
  is the developer and the date, and on the back it says only that it is the
  back. Below the fold: **the owner's notes as a field, saved as it is left** —
  on blur, and on the way out if the keyboard was still up (`updateCopyNotes`;
  anybody else sees the note as text) — and **their review of the game, if they
  wrote one, as the reviews sheet's `<ReviewQuote>`** (`getLogOf`, keyed
  `['my-log', userId, gameId, 'with-relations']` so the log form refreshes it).
- **Stored platforms are short forms; read them back with `familyForStored` /
  `platformKeyForStored`.** Everything the pickers write is `PLATFORMS[key].short`
  ("PS5", "SWITCH 2"). `platformFamilies()` matches *provider* names ("Nintendo
  Switch") and misses most short forms — it is for IGDB's lists, not for ours.

## This is React Native, not a web app

Worth stating because component snippets found online almost always assume the
opposite. There is **no DOM, no Tailwind, no NativeWind and no shadcn** here.
`src/global.css` defines four font variables for `react-native-web` and nothing
else — it is not a stylesheet.

A copy-pasted web component will not run. What has to change:

| Web | Here |
|---|---|
| `<div>`, `<span>`, `<button>` | `<View>`, `<Text>`, `<Pressable>` |
| `className` + `clsx`/`tailwind-merge` | `StyleSheet.create` + `useTheme()` |
| `motion/react` (`layoutId`, `animate`) | `react-native-reanimated` |
| `backdrop-blur` | `expo-blur`'s `<BlurView>` |
| `lucide-react` | `@expo/vector-icons`' Ionicons |
| CSS `:hover`, `focus-visible` | press states; there is no hover on a phone |

`components/ui/dock.tsx` is a worked example: it began as a Tailwind + `motion`
web component and the header comment maps every construct to what replaced it.
Port snippets that way rather than installing DOM libraries — `motion` and
`tailwind-merge` would bundle and then do nothing.

## reacticx and glass tabs (2026-11-02)

Eight components the owner pointed at in one message, all ported from their
source (MIT: `rit3zh/reacticx`, `davidmokos/expo-glass-tabs`), restated in
this app's tokens, and not seen on a phone. Each reverses something older;
the older rule is noted where it stood.

- **The bottom bar is expo-glass-tabs** (`app-tab-bar`): a pill 12 from the
  sides, 58 tall, a highlight sliding between tabs on an interruptible spring,
  the glyph under it crossfading to its filled form, white when chosen (it was
  the house blue). **Scrolling down minimizes it** — 44 tall, 34 further in,
  the words folded away — and up, a tap or a tab change brings it back:
  `<Screen>` feeds its `scrollY` to `useMinimizeOnScroll`, so every tab page
  with a page scroller drives it. **Drag along it to scrub**; the tab opens on
  release. A fade (and on iOS a stacked blur) rises behind it. Its glass is the
  package's solid fallback: `UIGlassEffect` is iOS 26's and `expo-glass-effect`
  is not linked. `useTabBarFootprint()` is how far the mini player rises over
  it, since the bar's height over the system inset is `max(inset − 16, 12)`.
- **Every alert is `showAlert`** (`ui/dialog`) — reacticx's dialog: a card
  that swings in 20° about its top edge from 0.8 on a 150 / 25 spring, over a
  scrim (blurred on iOS). Same arguments as `Alert.alert`, which no file calls
  any more; it draws every button (Android's alert drops a fourth). One
  `<DialogHost>` in the root layout, a queue.
- **Sheets are reacticx's tray**: a card 10 from the sides and above the
  system inset, 38 round, rising and growing from 0.9 on a 280 / 30 spring,
  dragged away by its handle with the release projected 0.35s ahead.
  `<SlideUpSheet>` (screen-sized) and `<Tray>` (as tall as its content —
  the multi-pick sheet, the filter bar's sheets, the select field, add to
  collection) share the numbers.
- **Settings is a bouncy accordion** (`ui/accordion`): game colours, animated
  artwork, physical copies, pings, review languages and hidden games, one open
  at a time; the open row parts from its neighbours with a bounce.
  `ReadingLanguages` and `SurpriseHiddenList` are accordion items themselves
  (they take the `AccordionSlot` props). Ratings, moderation, privacy and sign
  out are as they were.
- **The top bar is reacticx's animated header** (`HEADER_FADE`): its ground
  is the page's colour at 85% → 80% → nothing, reaching 50dp past its foot,
  faded in over the first 80dp of scroll — not the solid band of 2026-10-14.
  **Pages have a large title again**: a page with `insetHeader`, a bar with a
  `title`, not a modal and not `centerTitle`, gets its name in `largeTitle`
  (32) at the top of its content, drawn by the page scroller (`ui/page-scroll`)
  and gone by 60dp, while the bar's small name fades and rises in over 40–80.
  This reverses "do not print a screen's heading under its bar"; a page whose
  list sits under a tab row passes `largeTitle={false}` (News, Moderation, the
  inbox, People, Pings). Home's bar is the fade with its keys and no name.
  **The glass bar is on the fade too** (the owner, the same day: "it isn't
  applied across the app"): a game, a studio and a collection keep its discs,
  centred name and handoff, and their blur and `GlassFrost` are gone. A header
  the page does not scroll under — Search's field and tabs, the Profile tab's
  row — has `<HeaderFade>` at the top of its content instead.
- **Search's field folds only once the finger is up.** The fold changes the
  height above the list, which moves the list under a held finger; the list
  reads that as the finger moving, scrolls back, and the fold flips — from a
  thumb's pulse alone (the owner's report). So the page scrollers publish
  `ScreenChrome.dragging`, `<CollapsingField>` decides nothing while it is 1,
  needs 56dp of travel (was 24), and folds over 450ms eased in and out (was
  240 out). Anything else that resizes a header with the scroll must wait for
  `dragging` the same way.
- **Search's field is reacticx's scrollable search**: focusing it folds the
  title away on an 18 / 120 spring and the panel (Search by, the history)
  fades in over the scope, which stays mounted under it; pulling the page past
  its top swells the field and focuses it — iOS only, since Android's scroller
  stops at zero and its pull is the refresh.
- **A physical copy stands on reacticx's mesh gradient** (`<MeshBackdrop>`,
  `lib/mesh-gradient-shader`, compiled in CanvasKit by `npm test`): the game's
  three M3 containers and its page, at a fifth of the reference's speed,
  stopped when the screen is covered. The disc at the top right switches it
  to the plain page, kept per account on the device (`['copy-mesh', userId]`,
  `NEVER_PERSIST`). Skia only; without it there is no disc.
- **The loader is the mascot** (`<Loader>`, `lib/morph`): a blob with two
  rounded-rectangle eyes — Material's `ghostish` — who rests, blinks, then
  turns into a circle, square, triangle, diamond, pentagon and pill, a full
  turn a loop, eyes upright. reacticx's morph loader, its frames sampled by
  arc length in plain TypeScript instead of through Skia, so they are under
  `npm test` (`lib/morph/mascot.test`, which also holds both eyes inside every
  shape). It replaced every `ActivityIndicator`; a build without Skia gets the
  platform spinner.
- **Tabs, Search's carousel and Surprise Me's stack** are the same day's
  first message — § Search and § Conventions.

## Apple TV: the game page, a studio, Explore and Search (2026-11-03)

The owner's brief, with references (Apple TV's app — PRIMETIME, F1 The Movie,
Resident Evil — its website's Severance page, its Home and Store, and its
Android Search): "re-design the game page and studio page into this new Apple
TV style… REPLICATE AS SHOWN"; a new **Explore** tab holding what Search
showed untyped; Search reduced to its field; "the name of every tab… with a
big bold text at the top left corner". It reverses a great deal; where an
older section disagrees, this one is the current state.

**The header, second pass (the owner's, the same day: "I do not see any blur
or fade at all in the game page… the apple music transition with the scroll
blur needs to be in the cover. The cover being pinned and everything we had
before, that needs to be there… go back to the three tabs").** The first pass
drew the art in a Skia canvas of its own (rit3zh's stretch shader); on the
owner's phone it drew no blur and no fade, and it is deleted — `StretchHeader`,
its canvas and `lib/stretch-artwork`. Why it drew nothing was not found (no
device here). What stands:

- **The cover is `<PinnedHero>`** — the game page's and a studio's — with
  everything it had: pinned behind the page, the drift, Convx's row-by-row
  blur climbing it, the mirrored tail and wash, the drain into the page's
  colour by the time the name is under the bar (`solidAt`). Portrait, 2:3 at
  the display's width (`coverHeight`, `constants/game-header`), sharp
  (`sharpCoverUrl`), and **moving** where it has an animated cover — an
  `<AnimatedCoverImage>` over the still in the hero's `media` slot. The room
  above the words is a door to `<CoverViewer>`.
- **The Apple TV words lie on its foot, the title where the blur begins**
  (`wordsTop`, `blurStart` in `lib/progressive-blur`: Convx's knee, 0.78 of a
  side) — the owner's, moved there from the Log pill the same day, the title
  a step smaller (28). **The blur is longer than Convx's** so the words stay
  on it: the hero (art and mirrored tail) is 585/393 of a side, not 495, and
  the wash is whole at 1.42, not 1.21 (`PROGRESSIVE_BLUR`). Only the game page
  and the studio draw the tail. **And it starts above the title** — the
  owner, after seeing the title blend into sharp art: "make it so the blur
  goes up to where the game title is". These two heroes (`<PinnedHero tail>`,
  `<ProgressiveBlur long>`) take their own knee, 0.5 of a side
  (`longKnee`; about 20pt of blur at the title), and their wash starts at
  0.56 (`longWashFrom`), so the page's colour is already rising behind the
  name. The collection page keeps Convx's 0.78. The words
  are `<GameHeaderWords>`: the name where Apple TV sets a logo (still no game
  logo), the genres, **a white pill** and **a round ⋯**, the synopsis in **two
  lines with MORE** (a mask, and a sheet), **the facts** (year, time to beat,
  the score — Pinged's, else IGDB's — the age rating boxed, Must Play) and
  **"Developed by …"**. A studio's are its name or logo and its line.
- **The pill logs**: "Log", then your progress's word; a menu of write / edit
  the review, log / change the progress, read your review, playthroughs. An
  unreleased game's pill is the wishlist. **⋯ is favourite, wishlist, add to
  a collection**, and the collections it is in. The old action row, stats
  strip, "your log" block and masthead cover are gone (`game-actions`,
  `game-stats-strip`, `cover-halo` deleted).
- **The name can be hidden** — Settings → Game title (the owner's,
  2026-11-03): hidden, a game's page draws no logo or name over the cover
  and none in the bar (`useGameTitle`, `lib/game-title`, per account on the
  device, `NEVER_PERSIST`). The title's box stays, at no height, so the
  words and the bar keep their places; a screen reader still hears the name.
- **The trailer**: 4.5 s in (trailers on, no Reduce Motion), or from the play
  disc or its tile, the pinned art fades out, comes back as the landscape
  hero (the old 38%) with the trailer behind it (`<TrailerBackdrop loop=
  {false} onEnd>`), and the words rise to it (`LinearTransition`); when it
  ends, back to the cover the same way. The disc is also the switch for
  trailers playing by themselves.
- **The three tabs are back** — Overview, Soundtrack, Similar — with the
  pinned copy under the bar (`<PinnedTabBar>`, restored). Soundtrack and
  Similar are as they were.
- **The page's colour is seeded by the cover** (it was the hero from
  2026-10-31, when the hero was what the page drained from). A studio's too;
  its banner store remembers a cover (`studio-banner:v2`).
- **The Overview, no cards** (`CardlessContext`, `ui/card-material`): headings
  Apple TV's — `h2`, a chevron straight after where they lead on. Trailers and
  screenshots, events and platforms first (the owner's), then — because the
  community's cards "look weird now" without their card — **Apple's own
  layouts** (`components/game-overview`): **Ratings & Reviews** as the App
  Store's (the score large with its verdict and count, the rating graph beside
  it, then the reviews as a rail of soft boxes, the most liked first, "See
  all" the sheet) and **Played by** as Apple TV's Cast & Crew (round faces,
  friends first and badged, the score under each). Then On Pinged, where to
  buy, your copy, awards, achievements, the series, **the Information box**
  and **Details** as label over value. The review boxes and the Information
  box are Apple's one boxed thing: white at 7% over the page, a 12 corner, no
  edge or shadow — not the old card. Sheets keep their cards.

**Explore** (`(tabs)/explore`, `<DiscoverFeed>`) is what Search showed
untyped. Top to bottom, the owner's order: **the Store screen's hero** — the
games out now and coming soon (`pickPortraits`: five just out, three awaited)
on their portrait covers, full width under the status bar, the art lagging
its page by 12% and drawn that much wider ("zoomed in a little so that the
parallax effect can be noticed"), moving on every six seconds until touched,
page dots, the page's colour rising over its foot, "Explore" large over its
top left and the calendar key at the right (`<ExploreHero>`,
`constants/explore`); **Highly rated**; **Popular this month as Apple TV
Home's big card** (`<FeatureCards>`: 86% of the display, 1.07 wide to tall,
the hero cropped, the rank over the name); then Similar to, Beloved, the Top
1000, and three of the Reviews and the Collections charts with "See all".

**Search** at rest is Apple TV's Android Search: "Search" large, your avatar
at the right (your profile), the field (the scanner in its trailing slot),
and a two-across grid of landscape tiles (`<SearchBrowse>`: the Top 1000 and
the calendar as doors, then this month's popular games on their key art,
named). **The scope tabs appear with a search** — the field touched or
holding anything, or a scope other than Games chosen — and are otherwise
hidden. Typed, every scope is what it was.

**The tab bar** is Home · Explore · Pings · Profile in the glass pill, and
**Search a round glass key of its own** beside it (`SEARCH_ROUTE`), lit when
in front, shrinking with the pill. **Every tab opens on its name in
`largeTitle` at the top left**: Home's in a row over its chips (the bar is
112), Explore's over its art, Search's, Pings' over its tabs, and Profile's
with your handle under it.

**The third pass (2026-11-03, the owner, after seeing the second)**: the
title is the game's logo (§ Artwork); Information and Details follow the
trailers and screenshots; Ratings & Reviews is the score alone and one
review under it (no graph, no rail); On Pinged is three centred rows — a
glyph, then "25 playing now"; Where to buy is a rail of square tiles (the
store's mark on its colour, its name and price under it — `ArtRail
shape="square"`), no Show all; and **the trailer is never blurred** — the
landscape hero is `<PinnedHero blur={false}>` with `TRAILER_FADE`, a solid
fade over its bottom 28% only. The studio page is back to its look from
before Apple TV, and Explore leads with the old square parallax slider
(`<SpotlightSlider>`) under its name — the portrait hero is deleted. The
long hero's blur starts a little lower (`longKnee` 0.56, `longWashFrom` 0.6;
"make it not go too much further up"). **A page's right-hand controls are
one connected bar** ("like if it was the navigation bar"): `<TopBarDisc>`s
in `right` are drawn as keys in one glass capsule over artwork
(`GlassGroup`) and one control-grey capsule in the bar (`BarGroup`); Home's
+ and bell and the Profile tab's + and Settings are a capsule each too.

**Seen on a phone once, the first pass, which drew no blur** (above). The
second pass is types, lint and `npm test` here. To judge on a device: the
blur starting at the Log pill, the words' legibility on the cover's foot, the
fade between the cover and the trailer, the MORE mask, the review rail and
the faces, Explore's parallax and glide, and the tab bar's search key.

## Pinged: pings to people, and pings to everybody (0046)

The owner's rebrand and brief (2026-10-31): the app is **Pinged** — "You ping
someone, discover something, get notified, connect." A ping is two things, and
both are called that on screen:

1. **A ping to a person** (`direct_pings`). A game, a review, a collection, an
   event, a soundtrack or a request is sent to people, with a line. Every Ping
   button (`usePingTo()`, the paper plane — `PING_GLYPH`) opens `send-ping`:
   the game page's bar, a review's like row, a collection's two circles, an
   event's bar, a soundtrack's bar (only once a soundtrack has loaded — none
   does until SoundCloud is connected), a request's bar. It lands in the
   **inbox** behind Home's bell, whose first tab is Pings and second
   Notifications — the owner's.
2. **A ping to the community** (`pings`, `ping_reference_games`,
   `ping_suggestions`): the brief's long specification, a request for a game
   built on up to three games, answered with suggestions and reasons. It is
   the **Pings tab**, which took News's place in the bottom bar.

**The Pings tab has two faces** (the owner's pick of 2026-11-01, a hybrid
of two of the five concepts rendered in `.impeccable/mocks/pings/` by
`scripts/pings-concepts.mjs` — keep the images):

- **For You is "The One You're For"** (`<PingSpotlight>`): one request at a
  time — its games fanned (an unplayed one grey), why it is in front of you
  in `h2` (`spotlightClaim`: "You've played both of these"), who asks, the
  words, and **Suggest a game** as the one white pill. A sideways swipe or
  **Next** brings the next request — `ping_feed`'s order, so the best match
  for the filters, never your own; back goes to the one before; the next page
  is asked for as the queue runs short, and at the true end Next starts over
  (`nextStageIndex`). "Up next" under it lists three; a tap brings one up.
- **Latest and Mine are "The Board"** (`<PingPlate>`): plates on the page,
  not cards — the games as one band of slices with a registration mark in
  each corner, the asker's face pressed half off its bottom-left corner **with
  their name and the time beside it** (the owner's addition), the words in
  `h4`, and under a rule two printed words (`plateFoot`: "2 of 3 played",
  "4 suggestions"; a request no longer open is struck through). "Pin yours"
  (`<PinYours>`, a dashed plate) heads both and replaced the old prompt; the
  tab is "Mine", not "My Pings". The old `<PingCard>` and `<PingPrompt>` are
  deleted; `<StatusTag>` lives in `status-tag.tsx`.
- **Grey for unplayed is `filter: grayscale`**, which Android draws from 12
  and iOS not at all; the dim over it is what carries it everywhere. It is on
  a `<View>` round the image — expo-image's style type has no `filter`.

Rules that are easy to break:

- **Who may ping you is the database's rule** (`can_ping`, the recipient's
  `ping_preferences.audience`): anyone who follows you (the default, and what
  no row means), people you follow back, or friends only — the owner's three.
  `pingable_people()` only ever answers about people the caller follows or is
  friends with, so the setting cannot be probed for strangers; the insert
  trigger says the rule in words ("They only take pings from friends"). The
  setting is `ping_preferences`, readable by its owner alone — never a column
  on the public `profiles`.
- **A ping carries how it looked** (`title`, `subtitle`, `image_url`): the
  inbox draws fifty mixed kinds in one query, and events and soundtracks have
  no local row to join. A soundtrack's title is the *game's* — nothing of
  SoundCloud's is stored (§ Soundtracks).
- **"Played" is playing, played, paused or dropped** — the set "Played by"
  uses. Not backlog, not a wishlist or collection (list rows), not a physical
  copy. `pings.test.ts` reads every status list in 0046 and holds it to that.
- **For You is tiers, not scores**: `least(matched, 2)` desc, then newest,
  over open requests by others. Latest is newest first and has tier 0
  everywhere. The cursor is the last row's `(tier, created_at, id)`, compared
  as a row; `pings-sql.mjs` walks both feeds a row at a time and checks
  nothing repeats or is skipped. `reviewed_count` is said on the card
  ("· reviewed one") and does not rank — the brief's Phase 3.
- **The library leaves the database only as counts about the reader**:
  `matched_count`, `reviewed_count`, and a `played` flag per reference game.
  `ping_feed` is SECURITY INVOKER, so the block policies apply to it.
- **The count is counted** (`ping_suggestion_count` recounts on every insert
  and delete) and is not the client's: `pings` grants UPDATE on the words and
  preferences only, and `pings_guard` resets the database's own fields on
  insert and moves `updated_at` only on a real edit — a new suggestion, or the
  owner opening the request (`mark_ping_seen`), is not one.
- **A suggestion is refused** on a request that is not open, on your own, on
  one of its reference games, across a block, or past five from one person;
  `(ping_id, user_id, game_id)` is unique, so one person suggests a game once
  and several people may suggest the same one — the page groups them
  (`groupSuggestions`: the answer, then the owner's starred ones, then the
  most suggested). "Worth a look" is the owner's alone, through
  `set_ping_suggestion_interesting`.
- **Every game a request names is in `games` first** (`cacheGame`): the same
  id the game page, logs and lists use, so a suggested game's Wishlist,
  Favourite, Log and Collect are the app's own controls and rows — there is
  no Pings wishlist.
- **Safety**: restrictive block policies on all three tables and on
  `direct_pings`; `block_user` also deletes the pings between two people;
  requests and suggestions are 0045's `user_content_reports` kinds `ping`
  and `ping_suggestion`, removed (deleted) from the moderation queue's
  "Comments & people" tab. A deleted request takes its notifications and
  reports with it by trigger, so `delete_my_account()` is unchanged. The
  privacy policy says what pings collect (`constants/legal.ts`, 31 October).
- **News left the tab bar** and is `/news`: News and Events only, from Home's
  "Latest news" and "Latest events" (`?tab=events`). Trailers went with the
  owner's "removing the trailer section and such"; Releases and Popular were
  read as the "and such" — Home's Releases band and Search's charts already
  are those. `TrailerCard` and `getRecentTrailers` are deleted.
- The Home tab's label is "Home" now; it read "GameLog", and "Pinged" beside
  "Pings" would read as one tab twice.

**Not seen on a phone, and 0046 is not applied to the live project.** Types,
lint, `npm test` (`lib/pings` against 0046's text) and `pings-sql.mjs` on
PGlite pass. To judge on a device: the stage's swipe against the page's
scroll and its arrival, the fan's turned cards, the stamp's place on the
band and the name beside it, the filters' row, the send sheet's footer over
the keyboard, and the inbox rows.

## reacticx, second batch: toasts, glass, a Top 10 (2026-11-03)

The owner's message of 2026-11-03, six references at once. Not seen on a phone.

- **Toasts** (`lib/toast` — `toast.success / .error / .info`, `<Toaster>` in
  `ui/toast`): reacticx's `Toast`, its numbers (18 corner, three shown, 16
  out and 5% smaller behind, tap to spread 14 apart, swipe 45dp away, four
  seconds, the `glide` spring), **at the top** — the foot is the tab bar's.
  One `<Toaster>` in the root and one inside every `<Tray>`'s window (a sheet
  is a window of its own on Android); the newest mounted draws. About sixty
  mutations say what they did on success (`listToastFor` for favourites and
  the wishlist); things you watch happen — a like, a vote — say nothing. A
  new write that leaves the screen or changes nothing visible says so too.
- **Shimmer** (`ui/shimmer`, so every `<Skeleton>`): reacticx's band — half
  the block's width, five stops, linear 1.5s, edge to edge. Still a
  Reanimated CSS animation on the UI thread. § Loading's SimpMusic sweep is
  replaced; its argument for the UI thread stands.
- **Scoring a review** (`ui/seek-bar` in `<ScoreInput>`): reacticx's seek
  bar as its demo sets it — no thumb, 10 tall swelling 3.5× under the
  finger, 5% wider, a rigid haptic on grab and release, tap to jump —
  filled in the score's own colour. The ±1/±10 nudges stay.
- **Liquid glass, a setting, off by default** (Settings → Liquid glass,
  `lib/liquid-glass`, `<GlassSurface>` / `useLiquidGlass` in
  `ui/liquid-glass`). On: the top bar's back disc, its right-hand capsule
  and bar keys, the tab bar and its search key, `<DropdownButton>` and its
  menu, `<AnchoredMenu>`, a resting `<IconButton>`, Home's and Profile's
  key capsules, Explore's calendar key. **Never a card or a primary
  action.** iOS with `expo-liquid-glass-view` linked draws Apple's glass
  (the package is iOS-only and asks for its native view on import, so it is
  `require`d behind `requireOptionalNativeModule('ExpoLiquidGlass')`).
  Everywhere else — **Android, the owner's phone** — the material is rebuilt
  from Podium's glass (GHOSTxASR/podium-music-player, ADR-007 / `Glass.kt`,
  read for its numbers; it is GPL, so nothing is copied): its "blur" tier —
  12dp of the page blurred, a 30% dark tint, the accent's glow from the top
  (16% to nothing at 80%), a 1dp rim of light, a 24/8 shadow at 28% — and
  its "solid" tier (62% tint) where Android has no blur target (outside a
  `<Screen>`: the tab bar, menus in a Modal). Its lens refraction is a
  Compose library and is not reproduced.
- **A page's right-hand top bar controls are one capsule** (2026-11-03,
  earlier the same day): § Apple TV's third pass.
- **The game page plays its animated cover in place**: a key in the top
  bar's capsule (sparkles / pause) asks for the portrait animation by hand
  (`explicit`, whatever Settings → Animated artwork says), holds the
  trailer's autoplay back, and says by toast when the game has none.
- **Surprise Me** is reacticx's vertical page carousel (`surprise-carousel`)
  at its demo's numbers (14 in, 6 apart, 0.88 / 60% either side, a haptic
  on rest): portrait covers, the one in front playing its animated portrait
  when Animated artwork is on, title and "developer · year" at the foot over
  a fade; the card opens the game; a glass key in its corner turns it over
  in place — the score, genres, platforms, synopsis (the game page's own
  `['game', id]`), then Backlog, Hide, the top review and its song. The last
  card deals more. Hiding and Backlog are toasts now; the swipe deck, its
  edges and the hidden panel are gone. The owner's sentence about the info
  key was cut off ("information about the game like the…"); what it holds is
  a reading.
- **Android's glass blurs only over the page** (`<GlassSurface overPage>`,
  the top bar's controls alone). A glass key inside the page — Surprise Me's
  info key was the first — made a `<BlurView>` inside its own blur target,
  which draws itself forever: Expo Go closed on Surprise Me with no log.
  Everywhere else Android draws the solid tier. Never give a blur inside
  `<Screen>`'s content `blurTarget`.
- **Superseded in part (2026-11-04, § reacticx, third batch)**: Skia plays
  only an animated WebP or GIF now, never a video; `AnimatedProgressiveBlur`
  and the mesh under the cover in front (`<CoverFront>`) are gone.
- **The game page's animated cover moves under its blur too** — rit3zh's
  apple-music-animated-artwork's method: the animation is decoded once in
  Skia (`useAnimatedImageValue`, or `useVideo` for a WebM / MP4) and its
  frame drawn sharp over the art and into the row-by-row blur's picture
  (`AnimatedProgressiveBlur`, `<PinnedHero animation>`, `HERO_ANIMATES`).
  Before, expo-image played it and the blur was made from the still, so the
  foot never moved. Without Skia the old overlay is drawn.
- **Tapping the cover no longer zooms** (`<CoverViewer>` is deleted): from
  the very top of the page only, the words and everything under them fade
  out, SimpMusic's Apple Music mesh fades in under the cover in place of the
  solid page (`<CoverFront>`), the top bar's keys fade with the words (the
  owner's, 2026-11-03), and the page cannot scroll; a tap anywhere or
  back returns. The Static / Animated words went with the viewer — the top
  bar's sparkles key is the animated cover's control now. The cover's blur and
  its wash ease down to its edge as it comes to the front (650ms, in and
  out; `<PinnedHero lowered>`, the shader's `drop` uniform,
  `COVER_FRONT_KNEE` 0.97 sides — just above the art's foot), so the cover
  is seen whole, and rise back when the page returns.
- **A Top 10** (`top-ten/[id]`, from the "Top 10" key on a profile's
  Favourites): reacticx's circular carousel (`ui/circular-carousel`: ±2
  cards, drop ⅛/¼, 0.85/0.75, 80/50%, 20°/40°, Android blur) of the
  person's Favourites, and under the cover in front "Number 1" in big white
  ExtraBold, changing with reacticx's dynamic text (`ui/dynamic-text`:
  rising forward, falling back, a damped spring). **Favourites holds ten**
  (`FAVOURITES_MAX`, 0047), the profile pins the first four, and it and the
  wishlist cannot be deleted (Delete is hidden on both; 0047 refuses it).

## reacticx, third batch: the cover's shape, one blur, masked tabs, a lens (2026-11-04)

The owner's message of 2026-11-04, eight requests at once. Types, lint and
`npm test` pass; **none of it has been seen on a phone.**

- **The game page's cover is its own shape** ("They must not be cropped or
  resized… fit perfectly to the sides of the screen. If doing this means
  making the header smaller or bigger… its fine"): the display's width and
  the cover's own height for it (`coverHeight(width, aspect)`,
  `constants/game-header`). The shape is IGDB's — `GAME_FIELDS` asks for
  `cover.width, cover.height` now (`Game.coverAspect`) — else the loaded
  file's (`<PinnedHero onLoad>`), else 3:4 until it is known. It was 2:3,
  capped at 74% of the display, and IGDB's covers are mostly 3:4, so every
  one was zoomed and cut. A shape outside 1–2 is no box and is bounded.
- **One blur, and it never changes** ("maybe see if it's better to have
  only one blur that never changes and is the one that works for the
  video"): `<PinnedHero>` mounts one `<ProgressiveBlur>`, which draws the
  still, then the animation's frames (`animatedUri`), then the still again —
  there is no `AnimatedProgressiveBlur` to swap in, so Static ⇄ Animated no
  longer remounts the blur. Its own frame canvas draws the animation sharp.
- **The game page's blur is back as it was before 2026-11-04**, by the
  owner's word after seeing this batch ("Go back to the previous blur… the
  one before… and make the clear view artwork cover like before too"): no
  solid fade while it loads (the review's `<HeroFoot>` keeps one), the
  720p blur source, the wash as it was, and the cover in front is
  `<CoverFront>` again — SimpMusic's mesh under the cover — with the blur
  and wash sliding down to the cover's edge (`slide`, `COVER_FRONT_KNEE`).
  What stayed from the batch: the cover's own shape, the one blur component
  that draws the animation's frames, and the title-off position below.
- **Game title off: the blur begins near the cover's foot**
  (`TITLELESS_KNEE`, 0.88 sides; the cover in front is 0.97): "so that the
  logo in the cover can be seen, but not quite like the one with the full
  clear view". The words start at 0.98 (`TITLELESS_WORDS_KNEE`), just above
  the foot — raised from 1.10 at the owner's word. `<PinnedHero knee>`.
  **The blur runs on under all the words** (`<PinnedHero extend>`,
  `heroExtension`): the page measures the words and the tail and its wash
  are lengthened so the wash is whole only below their foot — "the header
  info and buttons sit half on the blur and half on the game page" (the
  owner). Title off only; with the title on the hero is Convx's length.
  **A dropped blur is squeezed, never slid** (`droppedRow`, and the wash
  scaled toward its own foot): the curve from the new start to the cover's
  foot is the whole curve, so at the foot and down the tail the blur and
  the wash (`washStops(from, extend)`) are as heavy as with no drop. For one build the drop slid the
  whole curve down: at the cover's foot the blur was a few points, the
  bottom edge showed, and the mirrored tail read as a sharp reflection — "a
  3d look… not a fade" (the owner). Do not slide it again. The climb is
  never dropped.
- **Animated covers that crashed or sat still** (Death Stranding was the
  owner's example; the file itself was not looked up here). Three causes in
  Skia, read from its source (`@shopify/react-native-skia` 2.6.2):
  - its `useVideo` on Android hands a frame over and disposes it at once
    (`copyFrameOnAndroid`), so the next draw throws "Attempted to access a
    disposed object" on the UI thread — the app closes; its decoder also
    runs a frame per display frame and never loops;
  - Skia has no APNG decoder: an APNG is its first frame, still forever;
  - `useAnimatedImageValue` throws on a file it cannot decode, times every
    frame by the first one, and stops on a play-once file.
  So the one blur reads **an animated WebP or GIF, or a video**
  (`skiaAnimates`, tested) through the app's own loop
  (`useAnimationFrames` in `ui/progressive-blur`): each image frame its own
  duration and a finished file decoded afresh; a video opened on a runtime
  of its own (`cover-video`), muted, read at its own frame rate, the frame
  on screen kept and the one before it disposed, rewound at its end on
  Android, and given back if it shows nothing in 6s; every dispose on the
  UI thread. **Not an APNG** — Skia cannot animate one — nor a file Skia
  refuses (`onAnimationFail`): those are drawn over the art by
  `<AnimatedCoverImage>` (expo-image, expo-video) with the still's blur
  under them.
- **Convx's blur on a studio, a collection and a review** ("the blur that
  act's as the fade for the header and background"): the long blur and its
  mirrored tail (`<PinnedHero tail>`), and half the tail left showing under
  the art before the page's solid part begins (`shownTail`) — about a
  ninth of the art's height more page above the first shelf. The review's
  square hero is not pinned; `<HeroFoot>` lays the same blur and wash over
  it and its tail behind the row under it. This reverses "a studio and a
  collection do not take it" (§ One colour method).
- **Details is in Information's box** on the Overview (`INFO_BOX`, the
  one filled block there — now two).
- **Tabs are reacticx's masked tab bar** (`<TabBar>`, `organisms/
  masked-tab-bar`): the row drawn twice, once on the track in the quiet ink
  and once inside the white pill in near-black (`segmentPill`,
  `segmentPillInk`; a game's `primary` / `onPrimary`), the inner copy
  shifted back as the pill moves, so the words change colour under its
  edge. Its springs are the reference's (`PILL_SPRING` 30/150/0.5, the
  press 20/150, the follow 220/24, 4dp of swell). Tap glides; dragging the
  pill follows the finger and settles on the nearest tab — horizontal only,
  where reacticx's starts on touch, so a page still scrolls over it. Words
  as wide as their tabs and a scrolling row, as before. The segmented
  control's thumb, wobble and hairlines are gone.
- **Hold any cover and it lifts** — reacticx's matched geometry
  (`ui/cover-zoom`, `<CoverZoomHost>` in the root layout): `<Poster>` has a
  380ms long press (`zoomable`, on by default) that measures it in the
  window and grows a copy to the middle of the screen (500ms,
  bezier 0.33/0.01/0/1, 80% of the width or 60% of the height) over a
  blurred page on iOS, a darkened one on Android (a Modal has no blur
  target); its 1080p fades in over it. Tap, back, or a 100dp drag puts it
  back, and the page's own cover reappears only when it lands. Headers are
  not `<Poster>`s, so they are left out by construction. **Off where a hold
  already means something** — choosing games to remove from a collection,
  taking a Must Play label off (`GameGridTile onLongPress`).
- **The tab bar's highlight is expo-liquid-lens's lens**, with Liquid glass
  on and Skia in the build (`ui/liquid-lens`, `lib/liquid-lens` — its WGSL
  rewritten in SkSL, compiled in CanvasKit by `npm test`): the tabs' glyphs
  (Ionicons' font) and words (Poppins) drawn by Skia under a rounded lens
  that bends them near its rim (8 / 11), tints them white inside its band,
  fills with a breath of white, and stretches and flattens with its speed
  and swells while pressed. The reference draws it with WebGPU, which this
  app does not ship. The plain highlight stays everywhere else. The rim is
  at 7% — the reference's is 7% of its 6% fill, which is not seen.

### The band: the game page's and a review's blur (2026-11-04, later)

The owner, with an album page for reference ("eternal sunshine"): "Make the
blur length and strength like this image… A thin row of blur, that sits on
a) the title logo png, if the title is on, or b) the genre and buttons, if
the title is off. On a) everything from the buttons to below is sitting on
the solid color background. On b) everything from the about row… if the
title is kept on, it has to cover more of the artwork, so you shouldn't
move it lower, just the blur. The blur should have the same fading effect as
the solid color fade… or add the blur and then the fade on top of it, only
that a little lower from the blur."

- **It replaces Convx's foot on the game page** (`<PinnedHero band>`,
  `bandShader`, `BAND` in `lib/progressive-blur`, tested and compiled in
  CanvasKit): from `BAND.lead` (28dp) above the first words — the title, or
  the genres with the title off — the blur comes in, its strength and its
  opacity on one smoothstep, to 30pt by 60% of the band; the page's colour
  comes in on the same curve 22% lower, whole at the band's end: the Log
  pill's row (title on) or the synopsis (title off). The rows are measured
  (`<GameHeaderWords onRows>`), estimated until they are. The words did not
  move: the title still stands at Convx's knee, the title-less words at
  0.98. The hero's tail runs only as far as the band needs
  (`BAND_FOOT` under it); `knee` and `extend` are no longer passed by the
  game page. Scrolling still climbs the blur and drains the art; the cover
  in front slides the band down to the cover's edge with the mesh under it.
- **A review is the album page**: the game's art (the square, else its art
  or cover) pinned at the top, square and full width, the same band and
  animated blur; on its foot, centred, the game's name (at Convx's knee, as
  the game page's title), the writer's face and name, a facts line (date ·
  score and word in the score's colour · platform) and the buttons (like
  and its count, ping, share, report); the band is the page's colour by the
  buttons, and the quote, the review, how it was played and the replies are
  on the page. It replaced the owner's 2026-10-17 screenshot layout, so
  `constants/review-page.ts` now only gives the type sizes of what is under
  the buttons. `<HeroFoot>` and its solid fade are gone with it.
- **Not seen on a phone.** To judge: the band's strength and length against
  the reference, where it lands on a game with no logo, and the review head.
- **Second pass, the same day** (the owner, after seeing it):
  - **Stronger where it starts, and higher**: an ease *out* (heavy just past
    its start), 34pt by half the band, from 56dp above the first words.
  - **Never a reflection**: under the cover's foot the band's tail is the
    cover's last 3% stretched down (`TAIL_STRIP`), not Convx's mirror, so
    the blur there is the cover's colours fading. Convx's tail stays on the
    studio and the collection.
  - **APNGs move under the blur too** (`lib/apng`, tested against Node's
    zlib): split into plain PNGs and composited onto a CPU Skia surface on
    the UI thread, one decode a frame (`nextApngFrame`). Before, an APNG was
    expo-image's over the art and the scroll blurred the still.
  - **The trailer is seen whole**: with it playing, the words start 16dp
    above its foot instead of on it, the scrim is 18%, and its fade a tenth.
  - **A review's head is left-aligned**: glass tags (score and word, the
    platform, how far) over the game's name, the writer; the band ends at
    the facts line, so the facts, the keys (round glass at the left, a big
    filled like at the right with its count) and a rule are on the page;
    the quote and the review under the rule.

## The Apple pass: foundations (2026-11-04)

The owner's critique of the whole app against Apple Music and Apple TV on
iOS 26 (`.impeccable/critique/2026-11-04T23-23-58Z__src-app.md`, 24/40), and
their answers: **Apple's pattern wins over older rulings in this file, except
five, which stay** — lists of games in pages of ten (the pager), the bouncy
Settings accordion, the mascot loader, covers on rows with nothing printed
under them, and Liquid glass off by default. Where a section above disagrees
with this one, this one is current. The foundations came first; the forms
layer, the chrome and the community pages are next, in that order.

- **Inter at Apple's sizes** (`Type`, `constants/theme.ts`): large title 34,
  `display` 28, `h2` 22 (every section heading), `h3` 20, `h4` 17 semibold,
  `h5` 15 semibold, `body` 15, `bodySmall` 13, `caption` 12, `button` 16; row
  titles (`itemTitle`) are 15 *medium*. The app's family is **`Typeface`**.
  **`FontFamily` is the protected game case's Poppins, frozen** — the case
  imports it by name, so the name kept Poppins and the app took a new one;
  the root layout loads Poppins in those three weights for the case alone.
  Never use `FontFamily` outside the case.
- **Measured layout reads Inter now.** `lib/font-advance.ts` (was
  `poppins-advance`) holds Inter's advance widths, printed from the font
  files by `node --import ./scripts/esm-register.mjs scripts/font-advance.mjs`;
  `lib/testkit/app-font.ts` (was `poppins-font`) reads them for tests; the
  review page's baselines use Inter's vertical metrics (`FONT_METRICS`), and
  its row was retuned so every line is still within a dp of the screenshot.
  The tab bar's liquid lens draws Inter SemiBold. A change of face re-runs
  the script.
- **No capitals in content.** `variant="label"` is a sentence-case footnote
  (13 semibold); **`variant="badge"`** is the old caps label, for words
  printed over artwork (an edition on a cover, an event's phase on its art,
  a discount capsule, a score tile's word). The `.toUpperCase()` on list
  tiles, the score line ("92 Outstanding"), moderation, copies and Steam
  headings went with it.
- **The room is true black**: `background` `#000`, `surface` `#1C1C1E`,
  `surfaceElevated` `#28282A`, `surfaceSelected` `#333336`, `skeleton`
  `#28282A`. `review-card.test.ts` allows a step up to 1.3 (Apple's own card
  on black is 1.24). `#28282A` and not Apple's `#2C2C2E` because `textMuted`
  on a control must hold AA. **The three text inks did not move**: the
  protected case's back is set in them.
- **Buttons**: `primary` (the default) is the prominent capsule, filled with
  the accent in force (`filledRoles`: white on the house pages, the game's
  primary on a game's); `secondary` is the grey capsule; disabled is the same
  shape at 35%. "Every action is the same grey pill" is reversed.
- **`showAlert` is Apple's alert**: centred, 300 wide, 30 round, title and
  message centred, full-width capsules — side by side for two (cancel left),
  stacked for more; the last non-destructive button prominent. It no longer
  passes `disabled` while leaving (that restyled every button on exit).
- **One section heading** (`SectionHeader`, `HomeSection`, `ProfileWidget`):
  `h2`, the chevron straight after the words, the whole line the door. The
  profile's widgets lost their hairline and "View all".
- **`EmptyState` takes an `icon`** (a controller by default) and is
  `ContentUnavailableView`: 52pt symbol, `h2` title, one 15pt line at most 300
  wide, one button. `ErrorState` picks its symbol from the failure. About
  seventy call sites were given a symbol for what is missing.
- **Corners**: `Radius.image` 8, `card` / `review` 16, `sheet` 26, and
  `borderCurve: 'continuous'` on covers, cards and skeletons — never on the
  case's framed cover (`rounded="caseImage"`).
- **In-page tabs**: `segmentPill` is white at 22% with white words.
- **Releases and Upcoming** draw `<GameGridTile>` (title and short date under
  each cover) with a skeleton of the same shape; `CoverTile` there was a
  sideways row squeezed into a three-column grid.
- **The protected case is set in Inter too** (the owner, 2026-11-04: "the
  case doesn't need poppins"). `FontFamily` is kept only as the name
  `<GameCaseBack>` imports, pointing at Inter; Poppins is uninstalled. Its
  inks, radii and sizes did not move.
- **Do not reorder the game page's Overview — the information stays at the
  top.** The critique suggested moving the Information and Details box to the
  foot of the Overview, Apple TV's order; the owner refused (2026-11-04):
  "you must not change the order of the information in the overview tab…
  the information must be at the top, not bottom". The order is § Apple TV's
  third pass: trailers and screenshots, then Information and Details, then
  the rest. No Apple-pass change may move it.

**Not seen on a phone.** Types, lint and `npm test` (1,090) pass. To judge
on a device: whether body 15 crowds the denser rows and cards, every fixed
height that held 13pt text, the white primary capsules, and the alert.

## The Apple pass: forms and chrome (2026-11-04)

The second part of § The Apple pass, the same day.

- **`<Switch>`** (`ui/switch`): iOS's 51×31 track, a 27 white knob. Apple's
  green on the house pages and the game's primary on a game's, or a meaning
  colour passed as `tint` (the log form's platinum, a spoiler's red). The knob
  and the colour are CSS transitions on React props. There was no switch in
  the app before.
- **`<InsetGroup>` and `<Row>`** (`ui/inset-group`): iOS Settings' grouped
  list — a quiet heading over it, rows in one `surface` container 26 round
  with hairlines starting where the words do, a footer under it for the
  explanation. A row takes a tinted 29dp glyph tile, a trailing value, a
  chevron (`onPress`), a switch (`toggle`), or is `destructive` (red, and
  `centred` for Sign out). New settings and forms are built from these.
- **Settings**: the accordion stays (a kept ruling), and each on/off item in
  it is now one switch row and a line explaining it, where it was two radio
  cards with a paragraph each. Ratings, Moderation and Privacy are inset
  groups with tinted tiles; Sign out and Delete account are red rows in
  groups of their own. The Pings item's glyph is the paper plane.
- **`<SelectionCard>` is Apple's checklist row**: a filled row, the name and
  its hint, and a checkmark at the trailing edge once chosen (a checkbox
  shows an empty circle that fills with a check). The leading radio and the
  outline are gone, everywhere it is used.
- **A modal's commit is the ✓ in its bar.** `<FrostedTopBar confirm>` draws
  it — a disc filled with the accent in force, a check in its ink, dimmed when
  disabled, a spinner while saving. A form that owns its mutation in a child
  component registers it with **`useBarConfirm()`** (`hooks/use-bar-confirm`,
  a per-screen store on `ScreenChrome.confirmSlot`), passing `null` while a
  picker stands in for the form. Done on the log form, New and Edit
  collection, Edit profile, a playthrough, a new ping, Suggest a game,
  Suggest similar, a report and a copy; their full-width foot buttons are
  gone. A destructive action (Remove log, Delete playthrough) stays at the
  foot. **A new modal form commits the same way.** Still with a foot button:
  award-edit, add-release, send-ping (its Send lives beside the message), the
  scanner's result states.
- **The log form**: Save is the ✓; Platinum and Contains spoilers are
  switch rows; its error line sits at the foot of the scroll. The progress
  pills are unchanged this pass.
- **The top bar**: the row is **52** (an iOS bar's 44 with room for 48dp
  controls; it was M3's 64), and the discs over artwork are centred in it
  (`TOP_BAR_DISC_TOP`, 2 — the side distance `TOP_BAR_EDGE` is still 12), so
  `useDiscRoom()` is 50. **Every bar's title is centred**, 17 semibold (`h4`),
  inset by the wider of its two sides (measured) so it never runs under a
  control; `centerTitle` is kept for its callers and means nothing now. The
  back key is a filled disc on plain pages too. Pages laid out under
  `useHeaderHeight()` moved up 12dp.
- **The tab bar**: labels 10 medium, the unchosen ones white at 55%; Pings'
  glyph is the paper plane, not `radio`.

**The remaining plan, with specs, is `.impeccable/critique/apple-pass-backlog.md`.**

**Large titles that collapse, everywhere (2026-11-05).** Every tab and
every list page opens on its name in `largeTitle`, which folds into the
centred bar title as the page is read:

- **Home** is the plain bar (`<FrostedTopBar variant="bar">` — a page that
  keeps the bar's room itself, under its glow, asks for it that way and
  `<Screen>` gives it a large title anyway) with **one capsule: your face,
  Create, the bell**. The page places the title itself
  (`<PageLargeTitle>`, `<PageScrollView ownLargeTitle>`) inside the glow's
  block, with **the chips on a 44 row under it**: filled 32 capsules, the
  chosen one white, Mood and Genre **pull-downs** (an `<AnchoredMenu>` with a
  check on the one in force; the chip reads the choice). SimpMusic's
  expanding chip, the fixed 112 header, the "Welcome back," row and the
  "Search every game on IGDB" footer are gone.
- **Pings** and **the Profile tab** are the plain bar under `insetHeader`
  with their keys in its capsule (+; + and Settings — the + drops an
  `<AnchoredMenu>`); Pings' tabs and filters head its list; the Profile
  tab's @handle is a line under its large title (`FrostedTopBar subtitle`).
  Neither draws `<HeaderFade>` any more.
- **Inbox, News, People and Moderation** have no `largeTitle={false}`: their
  tab rows are the list's header (`inset={0}` inside the list's margin), and
  their loading and failed states keep the title and the tabs
  (`<PageWithHeader>` in `ui/page-scroll`). The Inbox's "Mark all as read"
  is a `checkmark-done` key in the bar, shown while the tab in front has
  something unread; its rows are flat on the page — the unread dot, a 40
  face, the words, a 44 square of the thing at the trailing edge, hairlines
  from where the words start.
- `<AnchoredMenu>` scrolls inside the display when long, and its rows may
  have no glyph.

**The log form's progress is one row (2026-11-05)** — `<ProgressStatus>`
(`components/progress-status`): **Status** with the choice at its far end,
opening a pull-down of the seven in `PROGRESS_ROWS`' order, each glyph in its
poster hue (lifted to 3:1 on the menu), a check on the one in force;
"Completed" adds **How far**, a two-segment `<Segmented>` (`ui/segmented`,
iOS's control: a grey capsule, a white thumb that glides — use it for any
choice of two to four). A new log still starts with nothing chosen and the
form will not save without one; there is no "tap again to clear" any more.
The seven poured pills are deleted.

**The last foot buttons are in the bar (2026-11-05).** award-edit's Save and
add-release's Submit / Save changes are the ✓ (`useBarConfirm`); on
add-release's result the ✓ is Done — one registration for both states, so
the two never race for the slot. The scanner: "Look it up" is the ✓ while the
field is up, and **"Scan another" is a key in the bar** whenever a result is
shown (it was a ghost button at the foot of five results; the camera re-arms
when the code clears). **send-ping**: the people you ping most as a rail of
56 round faces that tick, then the searchable checklist (flat rows, 40
faces, an iOS check), and the line **in a capsule docked over the keyboard
with its own white send disc** — the full-width "Ping 3 people" button is
gone; the disc's label still says it.

**Forms are rows, and the primitives changed under every screen
(2026-11-05).** The pieces, each used everywhere it applies:

- **`<TextField variant="row">`** — a field inside an `<InsetGroup>`: no
  well, no edge, 16 in, a leading `label` in the quiet ink (Contacts'), a
  multi-line row grows. **`variant="search"`** is a 44 capsule (was 56).
- **`<PullDownRow>`** (`ui/pull-down-row`) — a group row whose value drops
  its choices as a menu, the one in force ticked; `anyLabel` adds a
  clearing first option. `<Row menu>` draws iOS's up-and-down chevron.
- **`<ChecklistGroup>` / `chosenLine`** (`ui/checklist-group`) — a
  many-of list as checked rows with a limit, pushed over its form from a
  row that sums it up; the form's ✓ (`useBarConfirm`) reads **Done** while it
  is up and returns. New ping's Genres and Platforms, Suggest similar's
  twelve reasons.
- **`<PartialDateRow>`** (`ui/partial-date-row`) — a year or a month of one,
  as a row opening a tray of two columns with Clear and Done.
  `<PartialDateField>` is no longer used by the copy or playthrough forms.
- **`<SortBar>`** is one "Sort by Newest ⌄" pull-down (the same props, all
  fourteen callers); `kind="choice"` (a filter or a mode) is a
  `<Segmented>` for two to four options and a plain pull-down for more.
  **`<ChoiceChips>`** without hints is the same: segmented up to four, a
  pull-down past that; with hints it stays the checklist of cards.
- **`<DropdownButton>`** is a grey capsule with no edge; its menu rows are
  44, all in the full ink, the chosen one told by its check alone.
- **Toasts are one at a time** (`TOAST_KEPT` 1): a centred capsule as wide
  as its words, glass under Liquid glass; a tap dismisses; a new one
  replaces it. The stack and its spread are gone.
- **`showPrompt`** (`ui/dialog`) — Apple's alert with a text field; the
  confirming button is enabled only while `accepts` holds.
- **`<ModerationRow>`** (`components/moderation-row`) — a queue entry in an
  inset box: swipe right for the verdict that keeps it, left for the one
  that takes it down (`ReanimatedSwipeable`), ⋯ for both and anything else
  (Read in full, Open the thread) — which is how a screen reader reaches
  them. The cards' rows of two buttons are gone; Reject still asks why in
  place.

And the screens: **New / Edit collection** are Apple Music's New Playlist
(`components/collection-form`: a 140 art tile — the cover's box on Edit — a
centred borderless 22pt name, then Description and Type as rows); **Edit
profile** is Contacts' (a 96 face with **Edit**, which picks a photo and
uploads it to `avatars` on Save — the "Avatar URL" field is gone; the fields
as rows; Game accounts a row a service, each opening its own page in the
sheet — Steam's the SteamID64 — with Android's back returning to the
profile); **New ping** (the question a borderless 20pt field, the games a
⊖/⊕ list, Preferences five rows); **Suggest similar** (one reasons row and
the line); **add-copy, add-release and a playthrough** (every field a row,
Region / Condition / What came with it / Platform pull-downs, dates rows,
How far a segmented control; add-release's "More details" is a group, no
longer folded); **Delete account** (two groups, what is deleted and what
stays, and a red row opening `showPrompt` for the username).

**The community and utility pages (2026-11-05, backlog item 5, in part):**

- **Ratings** — "Ratings" is the large title, the game named in the line
  under it; the sort is the "Sort by" pull-down; the pager at the foot only;
  each score a trailing 17 semibold figure in the ramp, the name regular.
- **Comments** — one row (`components/comment-row`) for a review's replies
  and the thread: a 32 face, "Ada · 2h" on one line, the words at 16, Reply /
  Delete / Report in a ⋯ and on a long press; replies indented 44
  (`COMMENT_INDENT`), hairlines from the words, no rule down the side.
- **The reviews sheet** — "Ratings & Reviews" (no repeated game name, no
  "REVIEWS"); one filter key (white with the count while any is on) opening
  a tray of pull-down rows; the pager at the foot only, its count over the
  list.
- **An event** — its page in its art's Material 3 colours
  (`useGameAccent`), the phase a capsule (LIVE filled red), date · time ·
  watching as one line (no strip), links as 88 square tiles with the
  network's glyph.
- **Achievements** — `components/achievement-parts`: `<AchievementHead>`
  (the game's art dissolving into the page, an 88 `<ProgressRing>` —
  `ui/progress-ring`, plain views, two rotated half-arcs, no SVG — and the
  figures as rounded tiles), `<AchievementMedallion>` (three across, round,
  35% and a lock while locked, rarity in sentence case) and `<GameArtHead>`.
  The game's achievements, Steam's across games, game-stats (art at the head
  now, figures as tiles, "From Steam") and playthroughs (art head, + in the
  bar, runs in inset boxes) use them.
- **A similar pick** — the two covers with "≈", "78% agree" as one figure,
  Agree / Disagree as two equal capsules (white when yours), the reasons as
  a sentence, suggestions in Apple's review box.
- **A ping** — the games fanned on top (`ReferenceFan`, exported from the
  spotlight), the question at 22, "Asked by Ada · 2h" with a 20 face; Edit
  joined Close / Reopen / Delete in the owner's ⋯.
- **Copies** — a two-across grid of covers; Scan / Add by hand are the + in
  the bar.
- **A collection** — Surprise me (a random game of it) and Shuffle (a seeded
  random order, not written back) as two equal capsules, sort and layout in a
  ⋯; nothing at all when there is no description.
- **A studio** — the newest release as one 16:9 tile first; its franchises
  as one **Series** rail, each opening that franchise as a facet search.
- **The game page** — MORE is bare bold text; the bar's keys are ⋯ (the
  animated cover, the trailer, Ping) and Share.
- **Tabs** — the profile's counts on one line ("12 followers · 48 logged ·
  30 following") and its tabs labelled; News rows are Apple News's (the
  outlet, the headline, the time, an 80 square) on Home and News alike; the
  Top 1000 is an inset group with the rank 17 secondary and "‹ Page 3 of 50 ›"
  at its foot (the pages kept, restyled); the Pings board has no
  registration marks, a "Closed" / "Found it" tag in place of the
  strike-through, and its filters behind one key opening a tray.

**The rest of item 5 (2026-11-05, the second pass):**

- **Explore** — the slider has no heading and has page dots under it (the
  one in front wider, driven by the row's offset on the UI thread); Popular
  reviews is a rail of the App Store's review boxes (`<ReviewBox showGame>`,
  exported from `game-overview`), Popular collections a shelf of mosaic
  squares (`<CollectionShelfCard>`, `<CollectionMosaic>` in `list-tile`), ten
  of each.
- **Search typed is "Top results"** — a seventh scope, first, where the tab
  rests (`'top'` in `SEARCH_SCOPES`; untyped it is still the browse grid):
  one Top Result (`<TopResults>`, `search/top-results`) — a studio or a person
  whose name *is* what was typed beats the first game unless the game's
  title is as exact — then Games, Studios, People, Collections and Reviews,
  a few each, every heading switching to its tab (`<HomeSection onSeeAll>`).
  Each section is its tab's own query under its own key. "Search by" in a
  ⋯ in the field was not done.
- **The Top 10** — a huge numeral behind each poster, rising over its top
  and turning with its card (`<CircularCarousel renderBehind>`). "Number 1"
  under the cover stays, the owner's.
- **The calendar** — the month and year are the bar's title (so the large
  title); ‹ › are the bar's capsule; a sideways swipe turns the month (the
  grid follows the finger by half, a fifth of the page or a flick turns it,
  the new month fades in from the side it came from). Months run across
  years. The twelve pills and the year row are gone.
- **A soundtrack** — Play and Shuffle as two grey capsules under its name
  (`shuffled()` in `lib/player-queue`, tested: playable first); the count,
  the length and the upload's credit, mark and link moved to an album-page
  footer under the last track.
- **Now Playing** (`now-playing`, full-screen modal, in
  `MINI_PLAYER_HIDDEN_ROUTES`) — the mini player opens it, not the
  soundtrack: the track's art blurred over the display and darkened, the art
  large, title and uploader with SoundCloud's mark, a scrubber that swells
  under the finger, the transport as bare glyphs, Keep playing as a switch,
  and a key to the whole soundtrack. Art in memory only. It closes itself
  when the music stops.
- **The game page** — trailer captions are under their tiles (`ArtRail`'s
  `titleOf` may answer `undefined` for an item with none); the Similar tab is
  two cover rails, "From the community" (`<CommunitySimilarRail>`, "N agree"
  under each, a cover opens the pick) and IGDB's; on the Soundtrack tab a
  track row opens the soundtrack playing that track (`?play=`) — the player
  stays on its own screen, the owner's earlier rule. `<CommunitySimilarCard>`
  has no caller now.
- **A studio** — under the banner, "Surprise me" (a random game of theirs,
  the white capsule) and a ⋯ (All games, Share); the line under the name is
  "Developer · Since 1986 · 155 games" (`lib/games/studio-about`, tested
  against live IGDB answers: `companies.start_date` with its precision, read
  in UTC; `country` is ISO numeric; the role from `developed` / `published`);
  the grid moved to its own page, `studio-games/[id]` ("All games ›", sorted,
  three across), the page keeping a rail of the newest; an About card at the
  end — IGDB's description, then Founded, Based in, Makes, Games, Releases,
  Average rating. `getStudioCompany` asks for the four new fields
  (`StudioCompany.about`, optional: saved rows predate it).
- **A collection row** — a ⋯ at its far end: Ping, Share, the owner's
  profile.

**Not seen on a phone.** Types, lint, `npm test` (1,100) pass.

## Store-release compliance (audited 2026-10-29)

Against a security / Play Store checklist the owner pasted. **Done in
`app.json`** (a native change — needs a new build, and the local `android/`
folder is stale: `npx expo prebuild --clean` before a local build):
`allowBackup: false` (the session and the query cache are in AsyncStorage);
expo-audio with `recordAudioAndroid: false` and `enableBackgroundPlayback:
false` — nothing records, and music stops outside the app by the owner's rule —
and `blockedPermissions` for RECORD_AUDIO, SYSTEM_ALERT_WINDOW and
FOREGROUND_SERVICE_MEDIA_PLAYBACK (that one needs a Play Console declaration).

Already fine: target SDK 36; cleartext off in release; only the launcher
activity exported; no `console.log`/`info`/`debug` in `src` and nothing logs a
token; IGDB ids from a deep link are checked numeric before a query.

**Done in 0045 and the app (2026-10-29), the three Play requirements:**

- **A privacy policy and terms of use**, written from what the code does
  (`constants/legal.ts`) — in the app (`legal/[doc]`, outside every guard, so
  the sign-up page can link to it; Settings → Privacy and safety) and as web
  pages (`public/legal/`, generated by `scripts/legal-pages.mjs`;
  `legal.test.ts` fails if they are stale). **Add a service that receives
  data, a table of personal data or a permission, and change the policy and
  the Play Data Safety form with it.** `LEGAL_CONTACT_EMAIL` is unset until
  the owner gives one; until then the pages point at the store listing's
  contact address.
- **Account deletion**: Settings → Delete account (`delete-account`, the
  username typed to confirm). The app deletes the `media` uploads under
  `<uid>/avatars|banners|posts` (storage cannot be emptied from SQL), then
  `delete_my_account()` removes other people's likes, comments and
  notifications on the person's writing (polymorphic, no foreign key) and
  deletes the `auth.users` row; every personal table cascades from it —
  `account-safety-sql.mjs` checks no uuid column anywhere still names the
  account. Release photos (`<uid>/releases`) and catalogue releases stay,
  unnamed: they are the shared catalogue's. **A new table holding a person's
  data must cascade from `profiles`**, or that check fails. The web page for
  it is `delete-account.html` (in the app, or by email).
- **UGC**: terms agreed at sign-up (a line under "Make my account" and under
  Google / Facebook), **blocking** (both ways: restrictive RLS hides `logs`,
  `comments`, `wall_posts` and `lists` across a block, triggers refuse a
  follow, friend request, comment, reply, like or wall post across one, and a
  notification between them is dropped; `block_user` cuts follows,
  friendship and notifications; from a profile's menu, undone there or in
  Settings → Blocked accounts), and **reports on comments, wall posts and
  profiles** (`user_content_reports`, one table, keyed on its own id; the
  author is filled in by trigger) in the moderation queue's "Comments &
  people" tab. Profiles stay readable across a block — every embed of an
  author would be null otherwise — and a blocked profile shows a sentence
  and Unblock instead of its content. A block hides ratings from the
  reader's lists but not from any game's score (0041's functions read past
  RLS).

**Still open**: the RAWG and SteamGridDB keys ship in the bundle
(`EXPO_PUBLIC_*`) and want an Edge Function each, as IGDB has; the session is
in AsyncStorage, not the Keystore (`expo-secure-store` was removed for size;
Supabase's LargeSecureStore pattern is the route); R8 is off (§ APK size);
`flowType: 'pkce'` should be set before Google or Facebook sign-in is
enabled; `npm audit` reports transitive issues, mostly in the Expo CLI's
tooling; there is no way for a moderator to suspend an account from the app
(the SQL editor can delete one).

## APK size and speed

The sideloaded APK was 170 MB, with another ~100 MB of data on top. Most of it
was not this app's code. The rules that keep it that way:

- **Only the ARM architectures in the sideloaded APK.** React Native builds its
  native libraries per architecture and Expo packages them uncompressed, so an
  APK carrying all four (`armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`) carries
  every `.so` four times. `eas.json`'s `preview` profile sets
  `GAMELOG_ANDROID_ABIS=armeabi-v7a,arm64-v8a` — every phone, 32-bit included —
  which `app.config.js` turns into `expo-build-properties`' `buildArchs`. Each
  architecture listed costs its full size on every install, whichever phone it
  is. Store builds leave it unset — Play splits an `.aab` per device — and so
  should a build for an x86_64 emulator.
- **A release-only change is untested until it has run on a phone.** Expo Go
  runs this app's JavaScript against *its own* native modules, so nothing about
  the native build — what is linked, what R8 strips — is exercised in dev mode,
  and this machine has no Android SDK to build with. Two such changes shipped
  unrun and the first preview build closed on its splash screen. Change one
  native thing per build, and say so when a change is of this kind.
- **Never exclude `@expo/ui` from autolinking.** It is Jetpack Compose and it
  is big, and nothing here renders its views — but `expo-router`'s Stack loads
  its toolbar at import, that loads `@expo/ui/jetpack-compose`, and
  `State/useNativeState.ts` and `ExpoUIModule.ts` there call
  `requireNativeModule('ExpoUI')` **at module scope**. Unlinked, that throws
  while the root layout is loading, and a release build exits on it. The
  package's Android JS is its `src/` (see its `exports`), not `build/`, which
  holds only type declarations for that half — reading `build/` is how this
  was "verified" safe. The same goes for any module a dependency requires
  eagerly: a native module may be dropped only when the *bundle* no longer
  names it.
- **R8 is off.** `enableMinifyInReleaseBuilds` / `enableShrinkResourcesInReleaseBuilds`
  (`expo-build-properties`) would take roughly 10–15 MB of unused Java and
  Kotlin out of the APK. They were on for the build above and are unproven:
  that build never got far enough to say whether R8 was sound, and an
  obfuscated, sideloaded APK is also the likeliest reason Play Protect began
  warning about it. To try it: turn the two flags on **and nothing else**, add
  `-dontobfuscate` through `extraProguardRules` so class names stay readable,
  build `preview`, and open every screen. A crash that a debug build does not
  have is a missing keep rule.
- **A native module costs its full size whether or not anything calls it.**
  Autolinking links every Expo module in `node_modules`, transitive ones
  included. Uninstall what no bundled file imports (Skia — since reinstalled
  for the hero's blur — `react-native-svg`,
  `expo-secure-store` went this way, and `expo-device` did until the 3D copy stage needed it back — Metro fails the build
  if anything still imports a package that is gone, which is the check). List
  what is linked with `npx expo-modules-autolinking resolve --platform android`.
- **Import fonts by weight path** — `@expo-google-fonts/inter/400Regular`,
  never the package. Each package's index requires every style it has, and
  Metro bundles every file a module requires: seven Inter weights and three
  Source Serif weights (a package since removed) shipped as all thirty-four,
  7.1 MB never drawn.
  `metro.config.js` resolves `@expo-google-fonts/material-symbols` to an empty
  module for the same reason (967 KB that `expo-symbols` imports for a view
  this app never renders).
- **Ask for artwork at the size its slot draws.** Every byte is downloaded,
  decoded and downsampled, then kept in expo-image's disk cache, which on
  Android is Glide's — **capped at 250 MB**, and that cap is most of the "user
  data". IGDB screenshots are `screenshot_big`, Steam capsules the 1× file,
  covers `cover_big`; only the game page's full-bleed hero is `1080p`.
- **Anything a hundred controls ask for is computed once.** `accentRoles()` and
  `generateDynamicTheme()` are cached by seed: a scheme is 6 ms on a warm V8
  and several times that under Hermes, and `useAccent()` used to build the
  house blue's in every button, chip, tab and field on mount.
- **Measure feeds before parsing them.** RSS outlets put whole articles in
  `content:encoded` (and PC Gamer again in `dc:content`): 5.1 MB, parsed on the
  JS thread as Home loads. `lightenFeed` cuts them to what is read — 226 KB —
  and its test holds the parsed result identical.
- **`react-native-view-shot`, `expo-media-library` and `expo-sharing` are
  loaded lazily** (`import()` when the share sheet's pills are pressed) — see
  § A review in one sentence. They were added together; a release build has not
  been made with them. **`expo-video`** is the same: `React.lazy`, in `<TrailerBackdrop>`
  (§ Studio pages, collection pages and studio logos).
- **`expo-gl` and `three` came with the 3D copy stage** (2026-10-30): one
  native module and about 700 KB of minified JavaScript, which Metro bundles
  whether or not the screen is opened. `expo-three` and `@react-three/fiber`
  were not added: the bridge is a few dozen lines in `lib/copy-scene/renderer.ts`,
  and `expo-three` brings `@expo/browser-polyfill`, which puts a fake
  `document` on the global object (see the Gotcha on `typeof document`).
  expo-gl is reached only through `React.lazy`, behind `STAGE_3D_AVAILABLE`.
  **`expo-device` came back with it** (it had been uninstalled as unused),
  for one constant: the ABIs a phone runs, which decide whether the 3D
  stage starts off. Read through `requireOptionalNativeModule('ExpoDevice')`,
  never imported.
- **Judge speed in a release build**, not Expo Go: `npx expo start --no-dev
  --minify`, or the preview APK. Dev mode is several times slower and its
  performance warnings measure that.

## Gotchas

- **An animated style's end value can be lost; commit the end state as a plain
  style.** Reanimated keeps an animated style's *first-render* value as the
  view's React props (`PropsFilter` snapshots it once). Later values live in its
  props registry, and 4.x hands a settled value back to React from a 500ms JS
  interval — but the native side deletes entries over 2s old *before* returning
  those over 1s old, so a JS stall of more than a second while something settles
  drops the end value, and the next re-render shows the first frame again. On the
  game page that was the review button and the action keys vanishing (opacity 0)
  and the case frozen mid-fall. `useLandingArrival` reports `landed` in React
  state so the caller adds the landed pose after the animated style (see
  `game-actions.tsx`'s `Arriving` and `game-case-flip.tsx`). `<SlideUpSheet>`
  does the same with its own `settled` flag — the quick-log progress sheet was
  sliding off-screen a second after it opened, when its data arrived and
  re-rendered it. Anything whose first frame differs from its resting state is
  exposed the same way; a slide between
  React-known positions (the tab bar's indicator) uses a Reanimated CSS
  transition instead, whose target is a React prop. The real fix is the static
  flag `FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS`, which Expo Go cannot change.
- **A Reanimated CSS ease is `cubicBezier(…)`, never a `'cubic-bezier(…)'`
  string.** As a string its CSS animations and transitions accept only the
  predefined names (`ease`, `linear`, `ease-in-out`…) and throw at the first
  render — typecheck, lint, `npm test` and an Android bundle all pass it. The
  blob mesh (`<ArtworkField>`, since removed) shipped one and the game page would not
  open (2026-10-28). Import `cubicBezier` from `react-native-reanimated`, as
  `paint-fill` and `reveal` do.
- **A worklet's parameter default cannot name anything outside the worklet.**
  On the UI thread the names a worklet captures — a constant, another function —
  are unpacked from its closure by the first statement of its body, and a
  parameter's default is evaluated before the body runs. So
  `function solveFace(…, camera = STAGE_CAMERA) { 'worklet'; … }` threw
  `Property 'STAGE_CAMERA' doesn't exist` on the copy screen's first frame, on a
  phone, having passed typecheck and every test: under Node a default reads the
  module like anything else. Read the constant in the body; a default may be a
  literal. `stage-geometry.test.ts` reads that module's source for it, which is
  all a suite with no Babel in it can do. The real check is the plugin itself —
  transform the file with `react-native-worklets/plugin` and read the `code`
  string each worklet is shipped as: the closure is the `const {…} =
  this.__closure` on its first line, and nothing in the parameter list may need
  it. All 118 worklets in the app were swept that way; that one was the only one.
- **A worklet may not call a worklet written below it in the same file.** The
  plugin rewrites each worklet's `export function` into a **`const`**, which is
  not hoisted, and builds every worklet's closure where the worklet itself
  stands — so one that names a worklet defined later captures `undefined` and
  dies on the UI thread with *undefined is not a function*, the moment the
  style first runs. **Node hoists the declaration and every test passes**,
  which is why `npm test`, `tsc`, lint, the worklet-closure sweep above and an
  Android bundle all missed it: `pinnedBlur` called `smoothstep` from forty
  lines above it and took the game page down on the owner's phone
  (2026-10-27). `smoothstep` is the first function in `lib/scroll-motion.ts`
  for that reason, and `scroll-motion.test.ts` reads the file and fails if any
  function there calls one written after it. The other fifteen worklet files
  were swept for the same thing (twelve same-file captures, all in order).
  Transform the file and read the order of the `__closure` assignments if in
  doubt — a capture must come after its target's own.
- **Skia is back for one thing — the pinned hero's row-by-row blur — and a
  gradient still does not need it.** (`<ProgressiveBlur>`, § One colour
  method; reached only through `React.lazy` behind its module's presence.)
  Nothing else may draw through Skia without the owner's say: it is ~8–15 MB
  of native library per CPU architecture, and every `<Canvas>` is a GPU
  surface of its own. React Native 0.86 draws
  `experimental_backgroundImage: 'radial-gradient(…)'` / `'linear-gradient(…)'`
  natively on the New Architecture, iOS and Android alike, so `<SoftGlow>` (and
  Home's old corner light) are plain views. Skia was ~8–15 MB of native library per CPU
  architecture for those two glows and one logo measurement when it was
  removed the first time. What it had and a CSS gradient lacks
  is `dither`: a gradient spanning a few dozen 8-bit steps on near-black can show
  faint rings. Use enough stops that each band is narrow (the ambient light has
  eleven); if rings ever show, the answer is a dithered bitmap, not Skia back.
  The parser accepts `px`/`%` sizes and positions and `rgba()` stops
  (`processBackgroundImage.js`) — and gradients still end on
  `withAlpha(colour, 0)`, because Android interpolates them unpremultiplied.
- **A blurred copy of a remote image is a second download on Android.**
  expo-image blurs with a Glide transformation, and Glide keeps two
  differently-transformed requests for one URL apart, so a sharp and a blurred
  `<Image>` mounted together both go to the network — every cold `<HeroArt>`
  fetched its 1080p art twice. `<HeroArt>` now mounts the blurred copy once the
  sharp one has loaded, when it decodes from the disk cache that load filled.
  iOS coalesces the two already. Anything else that stacks a blurred copy over
  the same remote image needs the same order.
- **A percentage `minWidth` in a wrapping row is measured against the wrong
  box.** When Yoga breaks a `flexWrap` row into lines it resolves each child's
  min and max against the row's *owner* (`FlexLine.cpp`, `mainAxisOwnerSize`) —
  the full-width parent, before the row's own padding — not against the row's
  inner width, as CSS does. The genre grid (since deleted) forced two per row with
  `minWidth: '45%'`: 162dp on a 360dp phone, so two tiles and the gap were 332
  against the 330 inside a 15dp margin, and every genre wrapped onto its own
  row. It had only ever fitted because the margin was 10. Nothing errors and a
  wider phone hides it (393dp fits by a hair). Keep such a floor well clear of
  the limit — just over `1 / (columns + 1)` forces the same wrap — or compute
  the width from `useWindowDimensions`. Reproduced and fixed against
  `yoga-layout` 3.2.1 at 320–800dp.
- **A `<BlurView>` on Android does nothing without a `blurTarget`.** SDK 57
  changed the contract: `blurMethod: 'dimezisBlurView'` with no target silently
  falls back to `'none'` — a flat translucent slab, no blur, one console warning.
  The target is a `<BlurTargetView>` wrapping the content to be blurred, which
  `<Screen>` already renders; a bar inside a `<Screen>` picks it up from
  `useScreenChrome()` and needs nothing. If you add a blurred surface somewhere
  else, it needs its own target — and the target has to be a *sibling* of the
  blur, never its descendant. iOS and the web ignore all of this and sample what
  is behind them for free, so a broken target is a bug you will only see on
  Android.
- **The blur target must be held in state, not a `useRef`.** `BlurView` resolves
  it in `componentDidMount`/`componentDidUpdate` by comparing
  `prevProps.blurTarget?.current`. A ref is filled after first render and never
  causes a second, so the comparison never runs and the blur stays unconfigured
  for the life of the screen. `ScreenChromeProvider` uses a getter/setter object
  that looks like a `RefObject` and calls `setState` on assignment.
- **A page-wide backdrop goes in `<Screen backdrop>`, not in its children.**
  The safe-area inset is applied to the container children sit in, so even an
  `absoluteFill` child begins below the status bar and ends up drawing a hard
  line across it. The `backdrop` slot renders outside the inset.

- **three.js refuses expo-gl's WebGL 2 context unless told otherwise.**
  Since r163 three.js throws "WebGL 1 is not supported" for any context that
  is `instanceof WebGLRenderingContext`, and expo-gl 57 makes its WebGL 2
  class *extend* that one (`common/EXWebGLRenderer.cpp`, as the spec's
  interfaces do). `makeRenderer` (`lib/copy-scene/renderer`) hides the
  global for the length of the constructor, after the caller has checked
  `supportsWebGL2`. **expo-gl's context has no `canvas`**, and three.js
  reads `gl.canvas.width` in `resetState()` — the second phone run stopped
  there ("Cannot read property 'width' of undefined"); the stub canvas is
  hung on the context as `gl.canvas`. It also drops every
  `pixelStorei` parameter expo-gl does not know (it knows two, and logs a
  line for each of the rest, on every state reset). And **import three as an
  ES module** — `import * as THREE from 'three'`: its CommonJS entry is a
  shim that calls `process.emitWarning`, which React Native's `process` does
  not have. Metro picks the module build today (checked in an export).
  **Hermes has no `FinalizationRegistry`**, which three.js's renderer keeps
  for its geometry and texture books — the first run on the owner's phone
  failed in `new WebGLRenderer` on exactly that, and fell back to the flat
  stage. Every call into three.js (the constructor, `compile`, `render`) goes
  through `whileThreeRuns` (`lib/copy-scene/three-globals`), which lends a
  no-op registry and a strong `WeakRef` for the call's length and only where
  the engine lacks them — never installed globally, because other libraries
  feature-detect them. Harmless here only because everything is disposed by
  hand. `three-globals.test.ts` reads three's source and fails if a new
  version creates either anywhere else.
- **`color: 'transparent'` on a nested `<Text>` is ignored on Android.** The
  renderer stores "no colour set" as `0` (`HostPlatformColor::UndefinedColor`
  in `react/renderer/graphics/platform/android`), and `transparent` *is* `0`,
  so the span inherits its parent's colour. Onboarding's typing drew its
  untyped remainder that way and every line showed whole on a phone while
  working on iOS. Use `withAlpha(ink, 0)` — `rgba(r, g, b, 0)`, the same
  invisible colour with non-zero bits — and never from black, whose RGB is `0`
  too.
- **Never `import` `expo-notifications` at module scope.** Its entry point pulls
  in `DevicePushTokenAutoRegistration.fx`, a side-effect module that registers a
  push-token listener *while evaluating*, and that call throws on Android under
  Expo Go (push was removed from Expo Go in SDK 53). One static import took down
  every module that transitively imported it — the News tab went blank and Expo
  Router reported `news.tsx` "missing the required default export", because the
  module had thrown before assigning any. `lib/reminders.ts` loads it with a
  lazy `import()` behind `remindersAvailable`; keep it that way.
- **An event's reminder is scheduled under an id made from the event's**
  (`event-reminder:igdb:1147`), never the random one the scheduler returns. That
  one lived in the RSVP control's state, so it was gone when the screen was
  left, and a reminder switched off on a later visit could not be found to
  cancel — it went off anyway. `<EventRsvp>` (News' event cards) and the
  event page's foot bar both go through `useEventAttendance`, and either can
  undo what the other set. Reminders are local
  notifications: Expo Go on Android cannot schedule them at all, and the
  control says so rather than hiding the fact.
- **Preload icon fonts; do not let `@expo/vector-icons` fetch them lazily.**
  `createIconSet`'s `componentDidMount` does a bare `await Font.loadAsync(font)`
  with no `catch`, so each mounted icon fires its own request and each failure is
  an unhandled rejection — 44 `<Ionicons>` in this app meant 44 of them. The root
  layout calls `useFonts(Ionicons.font)` and holds the splash screen; once the
  family is registered, `componentDidMount` short-circuits and never fetches.
  Pass `Ionicons.font`, never a hand-written `{ Ionicons: … }` — the real family
  name is lowercase `ionicons`.
- **IGDB never talks to the client.** Its Twitch `client_secret` cannot ship in
  a bundle, so `lib/games/igdb.ts` calls the `igdb` Edge Function via
  `supabase.functions.invoke`. That also means IGDB only works for signed-in
  users — fine, since every search screen is behind the auth guard.
- **Platinums are self-reported.** No console publishes a trophy API; PSN in
  particular has nothing public. `logs.platinum` is a plain boolean the user
  ticks. Only Steam can be genuinely synced, via a Steam Web API key plus a
  public profile — and Steam's API returns an *error*, not an empty list, when
  the profile is private.
- **A platform family is not an IGDB platform.** IGDB publishes 220 platforms;
  `PlatformKey` collapses them onto ~70 a player would actually name, through
  the substring table in `constants/platform-cases.ts`. **Order in `PATTERNS`
  is load-bearing and a mistake there is silent** — every entry is a valid key,
  so nothing type-errors. Three traps already caught: `'nes'` matches inside
  "Ge**nes**is", so the Sega rows must precede the NES row; a bare `'xbox'` is
  the *original* console, so "xbox series"/"xbox one" go first; and `'pc'` is
  inside "**PC** Engine", "**PC**-FX" and "Amstrad C**PC**", so those rows
  precede the desktop one. Verify a change by sweeping real IGDB platform names
  through `platformKeyFor`, not by reading the table — all 220 were, when the
  pack's machines were added. An unmatched name becomes `other` rather than
  being dropped — silently discarding it made the switcher claim a game was
  PC-only.
  **A platform has a case only when its template is in `assets/cases/`** —
  fifty-eight today (`CASE_PLATFORMS`), each drawn at its own template's shape,
  so anything that reserves room for one asks `caseHeightFor(width, platform)`,
  never the bare `caseHeightFor(width)`. Most began as the front covers of the
  owner's template pack — **only the front in each console's `cover/` folder**,
  never a spine, a 3D box or an example — copied to `<key>_case.png` because
  the pack's paths held spaces and colons; the pack is no longer in the repo
  and `assets/cases/README.md` records which file each was. PS4, Switch 2,
  Wii U and 3DS are the owner's own shells instead, and win over the pack's.
  **A machine with its own box is its own platform**: every Sega cartridge used
  to be `genesis` and every Atari but the 2600 `atari`, and a Game Gear game in
  a Genesis box is in the wrong one. `xbox_case.png` is the 360's artwork
  (`xbox` uses `xone_case.png`). PC has no case by the owner's decision.
  **Run `scripts/case-templates.mjs` after replacing a file**: it measures
  `templateSize` and `coverArea` from the pixels and says which entries
  disagree — PS4 and PS5 were drawn squashed and inset for two months on
  numbers left over from the placeholders they replaced. The window is the
  see-through part: a clear rectangle, or the *inside* of a translucent shell.
  **A template must be cropped to its case**: one drawn inside clear space
  measures as the whole image, and a cover drawn across the whole image shows
  past the case on every side — PS4's did. Everything else renders the bare
  cover, and `externalCategory`/`storeLabel` are `null` unless the id has been
  verified against the live API, because a wrong one sends people to the wrong
  storefront.
- **Three IGDB endpoints beyond `games`.** `game_time_to_beats` — **plural**,
  like every IGDB path; the singular 404s — is keyed on `game_id` and returns
  **seconds** (not minutes — that guess puts every game at 60× its length); `events` is filtered on its own `games` array, since IGDB
  exposes that join in one direction only and there is no `game.events` field to
  add to `GAME_FIELDS` (the game page's "Featured in" rail asked it that way
  until the owner removed the rail; `event/[id]` reads the same array from the
  event's side). `age_ratings` and `language_supports` moved from integer
  enums to referenced rows — expand `rating_category.rating`,
  `organization.name` and `language.name`, or a client mapping the old integers
  gets nothing back and no error.
- **The rating breakdown is the app's own scores, never IGDB's.** The masthead
  already carries IGDB's aggregate as `COMMUNITY`; `getRatingBreakdown` reads
  one row of 0041's `game_ratings` (before 0041, every `logs.rating` of the
  game, averaged on the phone) and is a separate query from `getGameReviews`
  on purpose — that one caps at 50 rows and joins profiles because it renders
  cards, so tallying it would print "up to fifty" as the total.
- **IGDB has no achievement data at all.** Every game added through search now
  shows zero achievements. Only legacy `steam:` rows and games matched out of a
  linked Steam account still resolve definitions — the game page treats an empty
  list as "no achievements tracked", not as an error.
- **Allowlisting an IGDB endpoint in source does nothing until the function is
  redeployed, and the failure is a feature that is silently missing.** This has
  now bitten twice. `ALLOWED_ENDPOINTS` in `functions/igdb/index.ts` is checked in
  the *deployed* Deno function, so a new entry is inert until
  `supabase functions deploy igdb`; until then the endpoint returns
  400 `Endpoint "…" is not allowed`, `igdbQuery` throws, and any query with
  `retry: false` resolves to `undefined` — indistinguishable from "IGDB has no
  data for this game".
  - **The Top 10** (`popularity_primitives`) catches the rejection and falls back
    to the most-rated releases of the past year — a *different* ranking, which is
    why it returns a `basis` the screen footnotes rather than one fixed claim.
  - **Time to beat** had no such fallback and simply never appeared:
    `<TimeToBeatWidget>` renders `null` on no data, so a failed request looked
    exactly like a catalogue with no submitted times. **And redeploying did not
    fix it**, because the allowlist was not the only fault: the path was spelled
    `game_time_to_beat`, which IGDB answers with a 404. Once redeployed, the
    request got past the allowlist and failed one hop later, at IGDB, looking
    identical on screen. The path is `game_time_to_beats`.
    **Verify a new endpoint by calling the deployed function, not by reading the
    allowlist** — `curl` it with the anon key as the bearer (the function checks
    the JWT, not the user); a 400 means the allowlist, a 502 wrapping an IGDB 404
    means the path. IGDB's schema is published at
    `https://api.igdb.com/v4/igdbapi.proto`, and every `…Result` message there
    names its endpoint's plural. `api-docs.igdb.com` refuses automated fetches.
    `<GameStatsStrip>` separates the two cases on screen — an "unavailable" label
    for a failed request, a "not found" one for a real absence — which is the only
    visible sign of which one you are looking at.
- **Steam's undocumented store endpoints are no longer called for search.**
  `lib/games/steam.ts` stays for id lookups only, keeping its CORS limitation
  (`npm run web`) and its ~200 req / 5 min rate limit off the hot path.
- **RLS is the only authorization.** The anon key ships in the bundle; it is
  powerless *only* because of the policies in the migration. If you add a table,
  add its policies in the same migration.
- **`typeof document !== 'undefined'` is false on a phone.** React Native aliases
  `global.window` to `global` and never defines `document`, so a "do I have a
  DOM" test is `false` on iOS and Android — not just in the Node prerender it was
  written for. Gating the auth storage adapter on it made every AsyncStorage call
  a no-op on device, and auth-js's `getSession()` reads the session **from
  storage and nowhere else** when `persistSession` is true (`inMemorySession` is
  only consulted when it is false). The result is the nastiest shape a bug can
  take: sign-in succeeds, `onAuthStateChange` fires from the sign-in response,
  the store fills in and the auth guard lets you through — while every PostgREST
  request goes out with the anon key, `auth.uid()` is null, and unrelated-looking
  RLS failures appear on `lists`, `games` and any SECURITY DEFINER function that
  checks the caller. Ask "is this storage safe to call here"
  (`Platform.OS !== 'web' || hasDOM`), never "is there a DOM".
- **A signed-in UI is not proof of a signed-in database.** When a write fails RLS
  but the app thinks you are signed in, check the session the *client* would
  send, not the policy: `supabase.auth.getSession()` returning null with the app
  showing you as signed in means the request is arriving anonymous, and no
  amount of policy editing will fix it.
- **`Relationships` in `database.types.ts` is not decoration.** supabase-js reads
  it to type embedded selects (`select('*, profile:profiles(*)')`). Leave it `[]`
  and every embed resolves to `SelectQueryError` instead of the joined row. Add
  an `FK<…>` entry for each foreign key you actually embed across.
- **A table whose primary key holds two foreign keys is a join table to
  PostgREST**, whether you meant one or not. It infers a many-to-many
  relationship through it, and if the two tables it links were already related
  directly, every unhinted embed between them becomes ambiguous and is refused
  (PGRST201, "more than one relationship was found"). 0031 keyed
  `review_reports` on `(log_id, user_id)` and took down every
  `profile:profiles(*)` on `logs` — the feed, profiles, the review page, every
  review list — until 0032 gave it an `id` key. A table that only *records*
  something about a pair (a report, a vote, a flag) gets its own `id` primary
  key and a UNIQUE constraint on the pair; PostgREST reads only the primary key,
  and `upsert(..., { onConflict })` works against the unique constraint just the
  same. `game_similarity_reports` (0025) and `game_similarity_upvotes` (0029)
  still have the junction shape; nothing embeds `profiles` from pairs or votes
  today, and the first thing that does must name its key (`profiles!…_fkey`).
- **Likes and comments are polymorphic** over `(target_type, target_id)`, and
  since 0018 both work on logs **and lists** — the two CHECK constraints used to
  differ deliberately and no longer do. Postgres cannot FK a polymorphic column,
  so integrity is enforced by the `assert_target_exists` trigger. **Widening a
  CHECK means checking three things, not one**, which is what 0018 exists to
  demonstrate: `assert_target_exists` (or a like/comment points at a row that
  does not exist), `notifications.target_type`'s own CHECK (or the AFTER INSERT
  notification trigger raises 23514 and takes the comment down with it, in the
  same transaction, reporting the wrong table), and `target_owner()` (or the
  recipient resolves to null and *nobody is notified*, silently — which is
  exactly what happened to every like on a collection between 0013 and 0018).
  `TargetType` is declared **once**, in `database.types.ts`; `api/types.ts`
  re-exports it. It was declared twice, and the copy silently kept `list` out of
  the barrel.
- **Emphasis in user-written text goes through `<RichText>`**, which understands
  `**bold**`, `*italic*` and `***both***` and nothing else. It is deliberately
  not markdown — see the component's own docblock for why headings, links and
  images are each a liability here. Italic is a **family** (`FontFamily.italic`),
  never `fontStyle: 'italic'`: a custom font has no oblique for Android to
  synthesise, so the property is the same silent no-op `fontWeight` is.
- **The per-game diary was removed from the app.** Dated notes per game
  (`diary_entries`, migration 0011) had a route, a composer, a card on the game
  page's Overview tab, a `diary` kind on the wall's derived activity and its own
  `lib/api/diary.ts`. All of it is gone; PRODUCT.md explicitly declined to name it
  a differentiator, which is the licence that was spent here.
  **The `diary_entries` table still exists** — nothing was dropped and no
  migration was written, exactly as with `posts` below — and `database.types.ts`
  carries a note where its row type was, because a row type is the first thing
  that would let something start reading it again.
  **What survived is `game-stats/[user]/[game]`**, which was the diary route's
  *second* tab and is a different feature: one person's log plus Steam's measured
  figures for one game. It has two live entry points (a library cover, a profile's
  Steam rail) and was renamed off the `/diary/` path because a route spelled that
  way would be the last mention of a feature that no longer exists.
- **User posts and articles were removed from the app.** The composer, the
  article reader, `PostCard`/`ArticleCard`, `MediaCarousel`, the post+log union
  feed and the whole post API are gone; `posts.ts` became `engagement.ts`
  because likes and comments were never part of that feature. **The `posts` and
  `post_media` tables still exist** — nothing was dropped and no migration was
  written — and `TargetType` no longer includes `'post'` even though the column
  and its CHECK still accept it. Two things that survive and are easy to confuse
  with it: **the wall** (`wall_posts`, a different table, still live) and
  **News** (`lib/news/`, RSS from real outlets, which has its own `ArticleCard`
  in `news-cards.tsx`).
- **Notifications are written by triggers, never by the client.** There is
  deliberately no INSERT policy on `notifications`; only the SECURITY DEFINER
  functions in 0003 can create them, so a user cannot forge one.
- **Storage paths must start with the user id** (`media/<uid>/…`). The storage
  RLS policy authorises writes by reading that first path segment, so uploading
  anywhere else is rejected.
- **The app can be a migration ahead of its database.** Migrations are run by
  hand in the SQL editor, so a column a newer migration adds to an RPC's result
  may simply be absent — not null, *absent* — on a database that has not run it.
  Reading one as a number is a crash, not an empty state: the community sheet
  went down on `suggesters.toLocaleString()` against a database at 0029. Make
  such fields nullable in the type, turn a missing one into `null` in
  `lib/api/` (see `withSuggestionFields`), and give the screen something it can
  say without it.
- **The colour extractor only decodes thumbnails.** `lib/artwork-color.ts`
  decodes JPEGs in JavaScript, on the JS thread, so its cost is the pixel count:
  a 90×90 IGDB `t_thumb` is nothing, and a 600×900 Steam `library_600x900.jpg`
  froze the app for seconds on every legacy game's page. `swatchUrl()` maps IGDB
  to `t_thumb` and Steam to `capsule_sm_120.jpg`, returns null for any other
  host (the genre hue takes over), and the decoder is capped at 0.1 MP and
  120 KB. Never feed it a URL it has not shrunk.
- **A `ScrollView` grows unless it is told not to — a horizontal one too.** Its
  base style is `flexGrow: 1; flexShrink: 1`, so a row of pills written as
  `<ScrollView horizontal>` directly in a screen's column takes a share of
  whatever height is spare. `<TabBar>` was that, and for a long time nobody
  could tell: the list under it was a `ScrollView` whose content was taller
  than the screen, so there was no spare height to share. Above anything
  shorter — an empty list, a loading state, a tab that had not filled yet — or
  above a `flex: 1` view, the row took **half the screen** and squeezed the
  page into what was left. The owner had seen it "sometimes… with other tabs";
  it became permanent on Search the day Discover's root changed from a
  `ScrollView` to a `<View style={{ flex: 1 }}>`. The fix is `flexGrow: 0` on
  the row's scroller (`styles.scroller` in `ui/tab-bar`). A horizontal
  scroller inside a wrapper that is as tall as its content, or inside a
  vertical scroller's content, has nothing to grow into and is safe; one that
  is a direct child of a screen's column is not.
- **Performance traps that have already cost this app.** A one-item `FlatList`
  wrapping a whole page (`data={[null]}`) re-renders its page-sized cell whenever
  `renderItem` changes identity — which, as an inline arrow, is every render; use
  a `ScrollView` unless the content is genuinely a list. An inline
  `ItemSeparatorComponent={() => …}` is a new component type per render and
  remounts every separator on screen. And a page that holds its sheets' open
  flags in its own state re-renders itself to open one: the game page keeps them
  in a small store `<GameSheets>` subscribes to. Performance warnings from Expo Go
  are measured in **dev mode**, several times slower than a release build — judge
  speed with `npx expo start --no-dev --minify`.
- **A long list of artwork spreads a window from `constants/list-window.ts`.**
  "VirtualizedList: You have a large list that is slow to update" means two
  scroll events in a row arrived more than half a second late — the JS thread
  was busy drawing rows. The list defaults are the cause more often than any
  one row: ten rows a batch and **ten screens either side** kept mounted, which
  for a grid of covers is every cover it has. `CoverGridWindow` (counted in
  rows of three), `ShelfGridWindow` (rows of four — the library alone) and
  `ArtRowWindow` are on the collection, Search's
  results, Must Play, an event's games, the library, the platform directory,
  events, studios and the reviews sheet; the studio page's grid has its own,
  smaller.
  A new list of covers or cards takes one. The other half is that **a row's
  props must survive a render**: handlers keyed by id and handed down once
  (`<CollectionRow>`, the collection's `GridTile`), never a closure or a JSX
  element built per row — that defeats `memo` on every row at once, and ticking
  one game re-drew the whole collection.
- **The path contains a space** (`claude code app/`). Fine for Expo Go, but
  Android Gradle builds historically break on it. If you ever run
  `expo prebuild` / a local native build and see odd path errors, rename that
  folder to `claude-code-app`.

## 🛡️ Critical Preservation Rules
- **DO NOT MODIFY**: The "physical videogame cases" feature logic, styles, or components.
- **Protected Tokens**: Do not alter any design tokens related to `game-case-*`, `physical-item-*`, or `case-dimensions`.
- **Verification**: Before finalizing any refactor, explicitly confirm that the videogame case feature remains visually and functionally identical to the pre-refactor state.
- **One exception, the owner's, and it is a screen**: `copy/[id]` draws a case of its own (§ Progress, physical copies…). It does so in its own components; the protected ones above are not edited by it and are protected everywhere else exactly as before.   