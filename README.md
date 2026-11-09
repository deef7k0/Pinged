<div align="center">

<br/>

<img src="assets/images/icon.png" alt="Pinged app icon" width="160" />

# Pinged

### Your new discovery app for video games. Find your next game, log where you're at, review it, and ping it to your friends.

<br/>

[![License](https://img.shields.io/github/license/deef7k0/gamelog?style=for-the-badge&labelColor=0d1117)](LICENSE)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2057-000?style=for-the-badge&labelColor=0d1117)](https://docs.expo.dev/versions/v57.0.0/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-000?style=for-the-badge&labelColor=0d1117)](https://reactnative.dev)
[![Stars](https://img.shields.io/github/stars/deef7k0/gamelog?style=for-the-badge&labelColor=0d1117)](https://github.com/deef7k0/gamelog/stargazers)

<br/>

[**Features**](#features) · [**Releases**](#running-it) · [**Contributing**](#contributing) · [**Disclaimer**](#disclaimer)

</div>

> [!IMPORTANT]
> Pinged is a work in progress app for android. It is not affiliated with, endorsed by or connected to IGDB, Twitch, Valve, SoundCloud, Steam, PlayStation, Xbox, Nintendo, GOG or anyone else whose data it reads.

---

<div align="center">

<h1><a id="features"></a>Features</h1>

<table>
  <tr>
    <td width="50%" valign="top">

#### Discovery
- **Find any game** across multiple options to choose from. Scroll through a carousel of games tailored to your taste, or manually look for games with specific genres, themes, platforms, camera perspectives, game engines, and more.
- **Home by mood or genre** — Select any of ten moods and genres in your home page, each with its own categories.
- **Charts** — See what users love, read popular reviews, collections, and a top 1000 games across the app and critics.
- **Release calendar** — Stay up to date with the most anticipated releases in the upcoming months.
- **Studio pages** — Every game from the studio, including DLCs, remakes and remasters, and special editions.
- **Where to buy** — Direct links for buying a game, with prices and discounts.

#### Logging and reviewing
- **Log any game** with a status, how far you got, hours, solo or co-op, platform and a 0–100 score.
- **Playthroughs** — several runs of one game under one log.
- **Write reviews** with spoiler flags, and many customization options.
- **Share a review as an image** — four card styles, with a highlighter for picking the words that go on it.
- **A weighted community score** to prevent malicious intents.
- **Collections** — lists, ranked lists, tier lists, captioned boards and award shows with a real ballot.

#### Pings
- **Ping a game, review, collection, or event**, right into their inbox.
- **Ping the community** — ask for a game based on up to three you have played, and get suggestions with reasons.
- **Who may ping you** is your setting: followers, mutuals or friends only.

#### Physical copies
- **Scan a barcode** and add the box to your collection, with region, completeness and condition.
- **Keep your physical games** — See your games on a 3D case you turn, open and take the disc out.
- **Real back covers and disc labels** from GameTDB and ScreenScraper.

    </td>
    <td width="50%" valign="top">


#### Experience
- **Artwork-driven theming** — Apple Music's inspired artist page for Pinged's game page and other places.
- **Animated covers** where a game has one.
- **Trailers** play a trailer from any game available in Steam.

    </td>
  </tr>
</table>

</div>

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
