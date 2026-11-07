<div align="center">

<br/>

<img src="assets/images/icon.png" alt="Pinged app icon" width="160" />

# Pinged

### Letterboxd for videogames — log what you play, review it, and ping it to people

<br/>

[![License](https://img.shields.io/github/license/deef7k0/gamelog?style=for-the-badge&labelColor=0d1117)](LICENSE)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2057-000?style=for-the-badge&labelColor=0d1117)](https://docs.expo.dev/versions/v57.0.0/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-000?style=for-the-badge&labelColor=0d1117)](https://reactnative.dev)
[![Stars](https://img.shields.io/github/stars/deef7k0/gamelog?style=for-the-badge&labelColor=0d1117)](https://github.com/deef7k0/gamelog/stargazers)

<br/>

[**Features**](#features) · [**Running it**](#running-it) · [**How it is built**](#how-it-is-built) · [**Contributing**](#contributing) · [**Disclaimer**](#disclaimer)

</div>

> [!IMPORTANT]
> Pinged is a work in progress and is not released yet. It is not affiliated with, endorsed by or connected to IGDB, Twitch, Valve, SoundCloud, Steam, PlayStation, Xbox, Nintendo, GOG or anyone else whose data it reads. The repository, the package id and the Expo slug still say `gamelog` on purpose — renaming them would install a second app and break sign-in redirects.

---

<div align="center">

<h1><a id="features"></a>Features</h1>

<table>
  <tr>
    <td width="50%" valign="top">

#### Logging and reviewing
- **Log any game** with a status, how far you got, hours, solo or co-op, platform and a 0–100 score.
- **Playthroughs** — several runs of one game under one log.
- **Reviews** with bold/italic text, spoiler flags, and **a review in one sentence** between drawn quote marks.
- **Share a review as an image** — four card styles, with a highlighter for picking the words that go on it.
- **A weighted community score** — ratings that rarely vary carry a little less influence, computed in Postgres and explained to the reader.
- **Collections** — lists, ranked lists, tier lists, captioned boards and award shows with a real ballot.

#### Pings
- **Ping a game, review, collection, event or soundtrack to someone**, with a line, into their inbox.
- **Ping the community** — ask for a game based on up to three you have played, and get suggestions with reasons.
- **Who may ping you** is your setting: followers, mutuals or friends only.

#### Physical copies
- **Scan a barcode** and add the box to your collection, with region, completeness and condition.
- **A copy stands on a stage of its own** — a case you turn, open and take the disc out of, under a lamp your phone's tilt moves, in 3D where the build can draw it.
- **Real back covers and disc labels** from GameTDB and ScreenScraper.

    </td>
    <td width="50%" valign="top">

#### Discovery
- **IGDB is the one catalogue** — every game has one identity, one cover, one id.
- **Home by mood or genre** — ten moods as real catalogue queries, each with its own shelves, quick picks and studio.
- **Games for you** — a new round of recommendations every time you open the app, drawn from your own logs, with no repeats.
- **Surprise Me** — one dealt game, one song from it, with filters you can combine.
- **Charts with a period** — popular reviews, people and collections, counted inside a window, and the same count among your circle.
- **A Top 1000**, Pinged's own or the critics'.
- **A release calendar**, a platform directory, studio pages and facet search by genre, theme, engine, series or language.
- **Where to buy** — the official stores IGDB links, priced by IsThereAnyDeal where it can.

#### Experience
- **Material 3 colour from the artwork** plus Apple Music's key colour for the page — every screen about one game wears that game.
- **A pinned hero with a row-by-row blur** that climbs as you scroll and drains into the page.
- **Animated covers** where a game has one, and silent trailers under the artwork.
- **Soundtracks from SoundCloud** in the app's own player, with a mini player and Now Playing.
- **Dark and light rooms**, liquid glass chrome, and a reduced-motion path for everything that moves.

    </td>
  </tr>
</table>

</div>

---

<div align="center">

<h1><a id="running-it"></a>Running it</h1>

</div>

There is no release build yet — you run it from source with Expo Go or a dev client.

```bash
npm install
cp .env.example .env     # fill in the Supabase URL and anon key
npm start                # scan the QR code with Expo Go
```

Then, in order:

1. **Run every migration** in `supabase/migrations/` in the Supabase SQL editor. Nothing works before this — there are no tables and every query 404s. A few files add an enum value and must run alone; their headers say so.
2. **Deploy the IGDB Edge Function** — it is the app's only game source:
   ```bash
   supabase secrets set TWITCH_CLIENT_ID=… TWITCH_CLIENT_SECRET=…
   supabase functions deploy igdb
   ```
3. **Optional functions**, each adding one feature and degrading cleanly without it: `itad` (prices), `opencritic` (critic quotes), `soundcloud` (soundtracks), `steam-store` (awards and news), `scandex` (barcodes), `copy-art` (back covers and discs), `game-accounts` (PlayStation, Xbox and GOG by username).

Environment variables are inlined at build time, so restart with `npx expo start --clear` after editing `.env`.

```bash
npx tsc --noEmit    # typecheck
npx eslint src      # lint
npm test            # the pure modules: geometry, colour, rules, SQL contracts
```

`CLAUDE.md` is the long-form engineering log — every convention, every ruling and every trap this codebase has already fallen into. Read it before changing anything structural. `PROJECT.md` is the product scope and `DESIGN.md` the normative design layer.

---

<div align="center">

<h1><a id="how-it-is-built"></a>How it is built</h1>

</div>

| | |
|---|---|
| **App** | Expo SDK 57, React Native 0.86, React 19.2, TypeScript, Expo Router (file-based routes in `src/app/`) |
| **State** | TanStack Query for server data, a persisted query cache per account, zustand for the session |
| **Backend** | Supabase — Postgres with row-level security as the only authorization, Edge Functions for every third-party key |
| **Catalogue** | IGDB through an Edge Function; Steam, SteamGridDB and RAWG for artwork and tags only |
| **Motion & graphics** | Reanimated on the UI thread, Skia for the hero blur and shaders, three.js on expo-gl for the 3D copy stage |

---

<div align="center">

<h1><a id="contributing"></a>Contributing</h1>

Issues and pull requests are welcome.

</div>

Two things to know before you open one:

- **The physical game case feature is protected.** Its components, tokens and dimensions must not be modified; `copy/[id]` is the one screen allowed its own case, in its own files.
- **Design decisions in `CLAUDE.md` are rulings, not suggestions.** Many of them reverse an earlier version of themselves after being seen on a phone. If a change contradicts one, say so in the pull request rather than quietly undoing it.

---

<div align="center">

<h1><a id="disclaimer"></a>Disclaimer</h1>

</div>

Pinged is an independent hobby project.

* **No game data is owned here.** Metadata, covers and artwork come from IGDB, Steam, SteamGridDB, RAWG, Wikimedia Commons, GameTDB and ScreenScraper, each under its own terms; music comes from SoundCloud and nothing of SoundCloud's is ever stored. Prices come from IsThereAnyDeal, critic quotes from OpenCritic.
* **Nothing is rehosted** except the small number of images an Edge Function caches so no phone hot-links a credentialed source.
* **Your use is your responsibility.** If you deploy this, you need your own API credentials and you agree to each provider's terms yourself.

---

<div align="center">

<h1><a id="license"></a>License</h1>

MIT — see [LICENSE](LICENSE).

</div>
