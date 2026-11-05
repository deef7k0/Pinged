# The Apple pass: what is left, and how to build it

Companion to `2026-11-04T23-23-58Z__src-app.md` (the critique) and to
CLAUDE.md § The Apple pass: foundations / forms and chrome (what is done).
Written 2026-11-04 so a fresh session can continue without this chat.

## Standing rules (the owner's answers)

- **Apple Music / Apple TV (iOS 26) wins over older CLAUDE.md rulings**,
  except five that stay: lists of games in **pages of ten** (the pager; it may
  be restyled, not removed), the **bouncy Settings accordion**, the **mascot
  loader** (buttons included), **covers on rows with nothing printed under
  them**, and **Liquid glass off by default**.
- **Never reorder the game page's Overview**: trailers and screenshots, then
  Information and Details, then the rest. Restyle inside sections only.
- Inter at Apple's sizes and a true-black room are done (`Typeface`, `Type`,
  `Colors.dark`). The protected game case is in Inter too.
- Record each reversal in CLAUDE.md as it is built. Nothing has been seen on
  a phone; say so in each report.

## Done (2026-11-04)

Type scale, label/badge split, true black ladder, prominent `primary`
button, Apple alert, one section heading, EmptyState symbols, continuous
corners, glass tab pill, Releases/Upcoming grid, Poppins removed; `Switch`,
`InsetGroup`/`Row`, checklist `SelectionCard`, ✓ commit in the bar
(`confirm`, `useBarConfirm`) on nine modals, Settings rebuilt, log form
switches, 52dp centred bar, filled back disc, tab bar labels.

## Next, in order

### 1. Chrome: large titles that collapse — DONE 2026-11-05

(See CLAUDE.md § The Apple pass: forms and chrome. Kept as the spec.)

- **Home, Pings, Profile tab** draw fixed title rows (`home-header.tsx`,
  `(tabs)/pings.tsx` ~262, `(tabs)/profile.tsx` ~75). Route each through the
  page scroller's large title (`ui/page-scroll`) so it collapses into the
  centred 17pt bar title. Home: "Home" 34 with one glass capsule at the right
  (avatar 32, Create, bell); chips in a 44 row that scrolls with the page,
  filled 32-tall capsules (no outline), opening pull-down menus instead of
  expanding inline. Delete the "Welcome back," row (`index.tsx` ~514–534) and
  the "Search every game on IGDB" footer link (~726–735).
- **Inbox, News, People, Moderation** pass `largeTitle={false}` because their
  tab row sits above the list. Move the tab row into each list's header so
  the large title can sit above it. Inbox: "Mark all as read" becomes a
  `checkmark-done` key in the bar; rows flat on the page (avatar 40, 15pt
  text, a 44×44 thumbnail at the trailing edge, not a box inside a box).

### 2. Log form: status as one pull-down — DONE 2026-11-05

Replace the seven poured progress pills (`progress-pills.tsx`) with one row,
"Status ⌄", a menu of the seven choices, each glyph tinted in its poster hue,
a checkmark on the chosen one; "Completed" reveals a 2-segment Story / Main.
A new log still starts with nothing chosen and saving waits for a choice.

### 3. Remaining foot buttons → ✓ — DONE 2026-11-05

award-edit (commit lives in a child: use `useBarConfirm`), add-release, the
scanner's result states. send-ping: the message in a glass capsule docked
above the keyboard with its own send disc; recipients as a horizontal rail of
round avatars that tick, then a searchable checklist.

### 4. Forms still built from wells and chips — DONE 2026-11-05

- `TextField` needs a `variant="row"` (no well, 16 inset, the group supplies
  the fill; multiline auto-grows). Search fields: 44-tall capsule.
- New / Edit collection (Apple Music New Playlist): a 140 artwork tile, a
  centred borderless 22pt title field, then a group with Description and
  Type (pull-down).
- Edit profile (Edit Contact): a 96 avatar with "Edit" under it — delete the
  "Avatar URL" field; game accounts as rows that push a page holding
  SteamID64.
- New ping: the question as a borderless 20pt field; reference games as an
  editable list (⊖ / ⊕ "Add a game"); Preferences as five pull-down rows
  (Genres and Platforms push checklists) instead of ~30 chips.
- Suggest similar: one "What makes them alike" row pushing the twelve
  reasons ("Choose up to 4" in the footer).
- add-copy / add-release / playthrough: every field a row; Region and
  Condition pull-downs; dates a trailing value opening a date tray;
  completion a segmented control.
- Delete account: two groups ("What's deleted", "What stays") and a red row
  opening an Apple alert with the username field inside it.
- Moderation: inset-group rows, swipe right to approve, left to remove, ⋯ for
  "Read in full".
- `SortBar` (15 sites) → one "Sort by Newest ⌄" pull-down (`DropdownButton`).
  `ChoiceChips`: ≤4 options a segmented control, more a pull-down row.
- `DropdownButton` trigger: no outline; menu rows 44, no fill on the chosen
  row, radius 26.
- Toast: a centred glass capsule, auto width, one at a time.

### 5. Community and utility pages — DONE 2026-11-05 ("Search by" in a ⋯ in the field left; see CLAUDE.md)

- **Reviews sheet** (App Store "Ratings & Reviews › See All"): drop the
  repeated game name and "REVIEWS"; the score with "out of 100" and five
  thin bars; one "Sort by Most Liked ⌄" and a Filter glass key opening a tray
  of menus. Keep pages (kept ruling), pager at the foot only.
- **Ratings** (`ratings/[id]`): drop the h1 the bar already says; score as a
  trailing 17 semibold number in the ramp, name regular.
- **Comments** — one shared row for `comment-section.tsx` and
  `comments/[type]/[id].tsx`: 32 face, name 15 semibold and "· 2h" on one
  line, body 16, actions in ⋯ / long press, replies indented 44.
- **Event**: page coloured from its art (`useGameAccent`); LIVE / UPCOMING
  capsule; date · time · watching as one line (no StatsStrip); one white
  Watch capsule; links as square tiles.
- **Achievements / gaming-achievements / game-stats / playthroughs** (iOS
  Games app, Fitness): the game's art at the top, an 88pt progress ring, a
  three-across grid of medallions (locked at 35%, rarity sentence case),
  figures in rounded tiles; game-stats has no art today.
- **similar/[id]**: the two covers with "≈", "78% agree", Agree / Disagree
  as two equal capsules, reasons as a sentence, suggestions as review boxes.
- **ping/[id]**: reference games fanned on top, the question at 22, "Asked by
  Ada · 2h" with a 20 face, one white "Suggest a game", owner controls in ⋯.
- **copies/[user]**: a two-across grid of covers; Scan / Add as "+" in the bar.
- **Collection** (`list/[id]`): two equal grey capsules (Surprise Me,
  Shuffle); sort and layout in ⋯; rows regular weight with a trailing ⋯;
  nothing when there is no description.
- **Studio** (Apple Music artist page): a white capsule plus ⋯ under the
  name; meta "Developer · Since 1998"; a "Latest release" tile first;
  franchises folded into one Series rail; "All Games ›" pushes its own grid;
  an About card at the end.
- **Soundtrack**: Play / Shuffle capsules, album-page footer, and a
  full-screen Now Playing from the mini player (cover blur behind, big art,
  swelling scrubber, transport glyphs with no circles).
- **Game page extras** (order untouched): MORE as bare bold text, no pill;
  at most two top-bar keys (share, ⋯ holding Ping / trailer / animated);
  trailer captions under the tile; Similar tab as two cover rails; Soundtrack
  tab shows its top tracks inline.
- **Tab screens**: Explore — no heading over the slider, add page dots,
  Popular reviews as a rail of review boxes, collections as a square mosaic
  shelf; Search typed — Top Result plus grouped sections with See All, "Search
  by" in a ⋯ in the field; Pings — For You as one colour-banded card, the
  Board without registration marks, caps feet or strike-through ("Closed"
  tag instead), filters behind one key; Profile — counts on one line, labelled
  tabs, the name as the large title; News — Apple News rows (80pt square
  thumbnail, no summary, no "Read story"); Top 1000 — inset rows, rank 17
  secondary, pager at the foot as "‹ Page 3 of 50 ›"; Top 10 — huge rank
  numerals behind each poster; Calendar — the month as the large title, a
  ‹ › capsule, swipe between months instead of twelve pills.

### Smaller fixes noted

- `submissions.tsx` ~74: inline `ItemSeparatorComponent` remounts every row.
- Library home glyphs are white (`primaryText`); give them a tint.
- Welcome / onboarding (Apple wins): sentence-case 34pt headlines with a
  symbol over each, no Geist Mono, Apple Music's "choose artists" bubbles for
  favourites and genres, a fade instead of letter-by-letter typing.
