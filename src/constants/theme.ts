/**
 * Design tokens.
 *
 * Dark only, and never true black. The page is #0B0A0D and depth is built from
 * *surface steps* — background → surface → surfaceElevated → surfaceSelected —
 * plus a hairline edge, rather than from shadows, which are close to invisible
 * on a dark screen anyway. A card looks lifted because it is lighter than what
 * is behind it.
 *
 * **Controls speak one language: dark, rounded, edged, lit in the house blue.** A
 * premium music player rather than a settings form — large radii, a 1px edge in
 * white at a few percent, generous height, and the accent spent only on what is
 * selected, focused or primary. See DESIGN.md § 9 for the families and
 * `components/ui/` for the primitives that implement them.
 *
 * **The room is dark; the light comes from the games in it.**
 *
 * The chrome is still greyscale — surfaces, rules, body copy and every control
 * that is not the primary one. What changed is that colour is no longer a single
 * house accent applied to chrome. It enters from *content*, in three ways, and
 * a colour that is none of these three is decoration and does not belong:
 *
 *  1. **Identity** — the ten-hue ramp below. A game takes one, derived from its
 *     own IGDB genres (`constants/identity.ts`), and that hue lights its page:
 *     the cast under its case, its active tab, its primary action, its links.
 *     Two games are never the same page in two skins.
 *  2. **Meaning** — score, log status, achievement rarity, tier. These are
 *     *data*: a reader parses good/bad, playing/dropped, common/legendary before
 *     they parse the digits or the word. They are aliases onto the same ramp, so
 *     the app has one set of hues rather than four unrelated ones.
 *  3. **Artwork** — the cover itself, blurred into an ambient wash behind a
 *     page (`components/ui/ambience.tsx`). Not a derived colour at all: the
 *     actual pixels of the actual box art.
 *
 * `primary` is PlayStation blue and is the *house* colour — every screen that
 * is not about one specific game runs on it, which is what keeps the app from
 * becoming a fruit salad. (It was lavender for one pass of the control
 * migration; the owner took it back to blue.) Identity shifts the accent only
 * where there is a game to shift it to, and a game's own screens keep their
 * Material 3 palette.
 *
 * Everything is a token. Colours, spacing, radii, type, motion and the minimum
 * tap target all live here, and a value typed directly into a component is a
 * bug rather than a shortcut.
 *
 * Read colours through `useTheme()` rather than importing `Colors` directly.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { ensureContrast, mix, readableInk, tint, toHsl, withAlpha } from '@/lib/color';
import { generateDynamicTheme, type DynamicThemeColors } from '@/theme/dynamic-color';

export { ensureContrast, readableInk, tint, withAlpha } from '@/lib/color';

export const Colors = {
  /*
   * Dark only.
   *
   * `light` exists so the `ThemeColor` type stays honest and so nothing has to
   * branch, but it holds the same values: this app is a dark room by design and
   * a light counterpart would be a second product. `APP_SCHEME` in
   * `hooks/use-theme` is the single place that says so.
   */
  dark: {
    /*
     * The three inks stayed neutral through the move to the violet-black room.
     * The music-app reference proposed violet-tinted ones; they are within a
     * few RGB units of these, and these are also what the physical game case's
     * printed back is set in — a protected feature that must render exactly as
     * it did. Hierarchy is brightness: 18.1:1, 8.3:1 and 6.1:1 on the page.
     */
    text: '#F5F5F5',
    textSecondary: '#A8A8A8',
    /**
     * The quiet step — timestamps, counts, captions.
     *
     * Was #767676 (4.12:1 on the old page), then #808080, which cleared the
     * page and failed every card. #8F8F8F clears every fill the app has: 6.11
     * page, 5.72 surface, 5.34 elevated, 4.86 selected. The reference's #77727F
     * was not adopted: 4.23:1 on the page and 3.70:1 on `surfaceElevated`,
     * under AA wherever it would actually land, at the 10px this is set at.
     *
     * It is *not* legible on an accent-washed control (4.32:1 on a selected
     * card), so type inside anything selected steps up to `textSecondary`.
     */
    textMuted: '#8F8F8F',

    /**
     * The page. Never true black: #000 on OLED smears on scroll and kills the
     * sense of depth the surface steps are built on.
     *
     * **The owner's colour** (2026-10-20), and it is measured out of their own
     * reference rather than named: the page in that screenshot is this hex
     * exactly, and the card on it is `surface`'s. It is where the room was
     * before the near-black experiment — the retired #14171b, one blue level
     * up — so the floor is lighter than it was (luminance 0.0084 against
     * 0.0032) and everything above it moved with it. Every ink still clears AA
     * on both this and a card; `review-card.test.ts` holds that.
     */
    background: '#14171C',
    /**
     * Home's page fill, and only Home's — an experiment with the room's floor,
     * kept to one screen so the rest of the app is unaffected. Change it here.
     *
     * The same as `background` again: the owner gave one colour for the app's
     * page and Home is the app. While the two agree, a card measures the same
     * step on Home as everywhere else — which is what the review card's test
     * checks against both.
     */
    homeBackground: '#14171C',
    /**
     * **Cards** — every one in the app, the review card and the collection
     * card included, and the tab bar. One perceptible step off the page:
     * 1.089:1 on `background`. The owner's colour (2026-10-20), measured from
     * the same reference as the page.
     *
     * A card is *above* the page now. It was below it for one pass — the
     * review card was its own near-black `reviewCard`, a shade under the room
     * — and that token is gone: the owner gave one card colour for all of
     * them, and both cards were already drawing with this one.
     *
     * **Solid, and it has to be.** It was tried at 62% opacity (`#1b1e249f`),
     * which broke three things quietly: `tint()` and `withAlpha()` read only a
     * plain `#RRGGBB`, so the house accent's tinted card came back see-through
     * and the News dock's 80% wash came back at 62%; and on Android a
     * translucent view with `elevation` shows its own shadow through itself, a
     * grey smudge inside every card. Keep it a six-digit hex.
     *
     * This is the fixed-colour ladder and nothing on a game's own screens uses
     * it for their surfaces: those run on `accentRoles`, which derives them from
     * the artwork. See CLAUDE.md, "The room is dark".
     */
    surface: '#1B1F28',
    /**
     * Nested surfaces, and the resting fill of a control — a secondary button,
     * an icon button, an unselected chip. The reference's "interactive surface".
     *
     * It moved up with the page and the card (2026-10-20): a control inside a
     * card has to stay visible against it, and at its old #15171D it would
     * have been *darker* than the card it sits on. 1.063:1 over `surface`,
     * which is the step it has always kept.
     */
    surfaceElevated: '#1F2430',
    /**
     * Pressed and neutral-selected fill: one step above a resting control.
     * 1.111:1 over `surfaceElevated`, as before — the whole ladder shifted,
     * none of its intervals did.
     */
    surfaceSelected: '#262C3A',
    /**
     * The well of a text field, a select field and the search bar — the owner's
     * reference, SimpMusic's name field: its `onSurfaceVariant` at 8%, which
     * renders #0F0F0F on a black page. No border: the fill alone draws it.
     *
     * Translucent rather than a hex so the lift is the same over every floor it
     * sits on — the page, Home's own `homeBackground`, a game's Material 3 page.
     */
    input: 'rgba(255, 255, 255, 0.06)',
    /**
     * The fill of every action button and icon button — the reference's
     * "Create room": `onSurfaceVariant` at 12%, #181818 on black. A step
     * lighter than a field's well, so an action and the field it acts on read
     * as two different objects. Translucent for the same reason as `input`.
     */
    controlFill: 'rgba(255, 255, 255, 0.094)',
    /** `controlFill` while held: a step brighter, eased in by `PressableScale`. */
    controlPressed: 'rgba(255, 255, 255, 0.15)',
    /**
     * The label on an action button: a soft light grey rather than white, as the
     * reference sets it (#D6D4D9 measured). 12.4:1 on `controlFill` over black.
     */
    controlInk: '#D6D6D6',
    /**
     * The resting edge of a *choice* — a selection card, a filter or sort pill,
     * an unchosen segment: the reference's `onSurfaceVariant` at 20%. Choices
     * are outlined and actions are filled; the edge is what says "one of
     * these", where a filled grey pill says "do this".
     */
    outline: 'rgba(255, 255, 255, 0.16)',

    /** Overlays for touch feedback. Layered *over* a surface, never instead. */
    hover: 'rgba(255, 255, 255, 0.04)',
    pressed: 'rgba(255, 255, 255, 0.07)',

    /**
     * The subtle edge: dividers, and the 1px outline every resting control
     * carries. 1.15:1 against the page — visible as an edge, never as a line
     * you read. Controls are drawn by this edge and a surface step, not by a
     * shadow.
     */
    border: 'rgba(255, 255, 255, 0.07)',
    /**
     * The strong edge: an open disclosure, an unchecked box's ring, a rule that
     * must hold on the page (1.33:1). Unchanged at 12% — the game case's
     * PC-cover frame is drawn in it, and that frame is protected.
     */
    borderStrong: 'rgba(255, 255, 255, 0.12)',

    /**
     * The house accent. PlayStation blue, and the app's own colour: the tab
     * bar, the home feed, search, notifications and every screen that is not
     * about one particular game.
     *
     * **An accent, not a theme.** Most of any screen stays black, near-black,
     * grey and white; the blue marks what is selected, focused or primary, and a
     * screen with six blue things has no primary action.
     *
     * **Fills only.** At 3.94:1 on the page it is below AA for text — right
     * under white on a filled button (5.01:1), wrong for a word. Type that wants
     * to look like the house colour uses `primaryText`, and so do the selected
     * and focus states (`accentRoles`), because a 14% wash of *this* blue over
     * near-black comes out darker than the resting control surface.
     */
    primary: '#FFFFFF',
    /** White on the blue fill, 5.01:1. */
    onPrimary: '#0E0E0E',
    /** Pure white, for type and glyphs over artwork or a dark scrim. */
    white: '#FFFFFF',
    /**
     * The same blue, lifted so it can carry a label: 6.07:1 on the page, 5.31 on
     * `surfaceElevated`, 4.83 on `surfaceSelected`.
     *
     * Not a second accent — a legibility variant of the first. Anywhere the blue
     * is *type* (a link, an active tab label, "See all") reaches for this;
     * anywhere it is a *fill* keeps `primary`. It is also the base the house
     * `wash`, `edge` and `ring` are built from.
     */
    primaryText: '#FFFFFF',
    /**
     * A wash of the accent — the house `wash`: `primaryText` at 16%. Lighter
     * than the resting control fill it replaces, which is what lets it mark a
     * selected control by brightness as well as by hue.
     */
    primaryMuted: 'rgba(255, 255, 255, 0.16)',
    /**
     * The accent on a game's screens with game colours off (Settings → Game
     * colours) — the owner's #CACACA (2026-10-20). A soft grey rather than
     * the house white, so a game's page reads as that page, not as the feed:
     * the review button, the lit keys, the selected tab. 10.96:1 on the page;
     * near-black type on it (`readableInk`).
     */
    gameNeutral: '#CACACA',
    accent: '#FFFFFF',

    /*
     * ---------------------------------------------------------------------
     * The identity ramp — ten hues, and the app's only colour primitives.
     * ---------------------------------------------------------------------
     *
     * Every coloured thing in the app that is not the house blue or the raw
     * artwork resolves to one of these ten. A game's page takes one (from its
     * genres); score, status and rarity alias onto them. That is what makes
     * this a system rather than a bag of swatches: there are ten hues, not
     * thirty-one, and a new meaning gets an alias rather than a new hex.
     *
     * Tuned as a set against the near-black page, not picked individually:
     *
     *  - Every one clears **4.5:1 on all three surface steps**, so any of them
     *    can carry small type. The floor of the set is `crimson` at 5.78:1 on
     *    `surfaceElevated`; there is no member that only works on the page.
     *  - Every one takes **dark ink** when used as a fill (`readableInk`), which
     *    is why an identity-coloured button is near-black-on-hue rather than
     *    white-on-hue. That is deliberate: white on a mid-chroma hue is the one
     *    combination in this palette that reliably fails.
     *  - Spread around the wheel with gaps wide enough to survive a scrolling
     *    wall of covers. Adjacent games should not read as the same game.
     */
    identityEmber: '#FF9142',
    identityCrimson: '#FF6F7D',
    identityGold: '#F3C24B',
    identityLime: '#A8DC5A',
    identityJade: '#43D98C',
    identityAqua: '#3CD6CE',
    identitySky: '#57B2FF',
    /* Pulled off #8B9DFF, which sat 49 RGB units from `identityViolet` — close
       enough that a strategy game and a puzzle game were the same colour in a
       franchise rail, which is the one place the ramp has to work hardest. */
    identityCobalt: '#8394FF',
    identityViolet: '#B98CFF',
    identityMagenta: '#FF7ACB',

    /*
     * The score ramp. Three colours that are *data*, not chrome.
     *
     * A 0-100 score has to be readable as good/mixed/bad before the digits are,
     * and one hue cannot say that. They appear on numerals and their labels —
     * never on a fill, an outline or a control.
     *
     * **These are now the only score colours.** `scoreColor()` used to return
     * `success`/`accent`/`danger` while `<ScoreBadge>` reached for these three,
     * so the same 55 was amber in one component and blue in another. The blue
     * was the wrong of the two: neutral is *mixed*, and rendering it in the
     * house accent made a middling game look endorsed. Amber, everywhere.
     */
    /* #4ADE80 taken 8% towards black at the owner's direction (2026-10-16):
       "make the green… slightly darker". Same hue; it is the score box's fill
       and every high score's numeral, so it moved everywhere at once. */
    scoreHigh: '#44CC76',
    scoreMid: '#F5A524',
    /* Lifted from #EF4444, which measured 4.13:1 on `surfaceElevated` — under
       AA for the 13px inline numeral that a feed row renders it at. #F35555 is
       4.61:1 on the same surface and is the smallest step that clears it. */
    scoreLow: '#F35555',

    /*
     * Log status. Five states, five hues, aliased onto the ramp.
     *
     * `backlog` used to be `textSecondary` — grey, which said "no status" for
     * the one status a logging app is most about. A shelf of things you mean to
     * play is not an absence.
     */
    statusPlaying: '#43D98C',
    statusPlayed: '#2E93E8',
    /**
     * Pale violet: queued, not dead.
     *
     * Lighter than it wants to be, on purpose. The first choice was a dusty
     * #9B93E8, which sits 16 RGB units from `statusPlayed` under simulated
     * protanopia — blue and violet are the classic red-blind collapse, and
     * these two are the pair a backlog screen shows side by side. Lifting the
     * lightness restores the separation to 53, because luminance is the
     * difference that survives when hue does not.
     */
    statusBacklog: '#C9A6FF',
    /** Rust, not the alarm red. Dropping a game is a verdict, not an error. */
    statusDropped: '#CE7B62',
    /**
     * Gold, for `paused` (0022): the amber light between going and stopped.
     *
     * An alias of `identityGold`, not a new hex — a meaning joins the ramp. It
     * sits apart from the four above on hue *and* on luminance (it is the
     * lightest of the five), and a reader who cannot tell gold from jade still
     * has the pause glyph and the word, which every status ships beside it.
     */
    statusPaused: '#F3C24B',

    /*
     * Achievement rarity, from Steam's global unlock percentage.
     *
     * The five-step loot ramp every player already knows how to read — and the
     * one place in this app where borrowing a genre convention beats inventing
     * a vocabulary. Bands live in `constants/rarity.ts`; only the hues are here.
     */
    rarityCommon: '#9AA3AE',
    rarityUncommon: '#43D98C',
    rarityRare: '#57B2FF',
    rarityEpic: '#B98CFF',
    rarityLegendary: '#F3C24B',

    /** Platinum trophies. */
    platinum: '#A9B6CC',

    /**
     * The Must Play label (0034): a moderator's pick — the wedge in a cover's
     * top-right corner, and the star alone elsewhere.
     *
     * An alias of `identityJade`, not a new hex — a meaning joins the ramp, as
     * `statusPaused` did. Green at the owner's direction (it was ember): the
     * mark is the one thing in this app that sits *on* box art in a colour.
     */
    mustPlay: '#43D98C',
    /**
     * The star inside the wedge: `mustPlay` taken 60% toward black — the same
     * green, darker, "completely filled in a darker green" (2026-10-17) —
     * 4.7:1 on the wedge.
     */
    mustPlayStar: '#1B5738',

    /**
     * Review prose, and only review prose.
     *
     * A muted grey rather than `textSecondary`. Body copy at reading length
     * wants to be *quieter* than interface text, not the same brightness — a
     * thousand words at `text` is a wall, and at `textSecondary` it still reads
     * as a UI string that happens to be long. This is the colour of ink on a
     * page: present, unemphatic, and carrying the same violet trace as the
     * surface under it (it was #8A949A, blue-green, when the room was).
     * Same luminance as before: 6.29:1 on the page, 5.90:1 on a card.
     *
     * It was chosen for a serif and outlived it: now that a review is set in
     * Inter like everything else, this ink is what still tells a page of
     * somebody's writing from a page of the app's own text.
     */
    proseInk: '#958F9D',

    /**
     * A liked review's heart.
     *
     * Not `danger`. The app aliased the two because both are "a red-ish glyph",
     * and it was always a category error: `danger` means *this will destroy
     * something* and appears on delete confirmations, while a like is an
     * endorsement. One warm amber, used where a like is the subject of the row
     * rather than one icon in a bar. 8.67:1 on the page.
     */
    liked: '#FF9D35',

    /* Same lift as `scoreLow`, and for the same reason: `<Button variant="danger">`
       renders this as its label on `surfaceElevated`, where #EF4444 was 4.13:1. */
    danger: '#F35555',
    success: '#4ADE80',

    /*
     * `<SoftGlow>`'s default colours — and, until 2026-10-22, Home's corner
     * light, which SimpMusic's glow replaced (`home/home-glow`, coloured from a
     * cover rather than from these).
     *
     * These were drawn for an earlier, much stronger corner glow — a `<SoftGlow>`
     * in the same corner — which was replaced by the soft ambient light because
     * it read as a lit corner rather than as light. The notes below are that
     * glow's history, and still explain the values.
     *
     * `glowCore` was #3A2050 and the glow was **invisible on a device** — not
     * dim, invisible. That hex is 1.34:1 against the page at *full* opacity, and
     * the glow never runs at full opacity: after the radial falloff and the blur
     * the brightest on-screen pixel measured #1A151E, which is 1.04:1. There was
     * nothing to see because there was nothing there.
     *
     * #6B4C9A is 2.79:1 at full strength, which lands the composited corner
     * around 1.7:1 — a glow you can see, that still could not be mistaken for a
     * surface. The old value survives as `glowEdge`, where it is doing the job
     * it is actually suited to: the *outer* half of the ramp, where the light is
     * meant to be nearly gone.
     *
     * Not part of the identity system and not available to it. This is the one
     * decorative colour in the app, and it is fixed rather than derived
     * precisely so Home does not shift hue with whatever game happens to be on
     * it. It stays violet beside the blue house accent, as it always had: the
     * light is atmosphere, not chrome, and does not have to match the controls.
     */
    glowCore: '#FFFFFF',
    glowEdge: '#8E9099',

    /**
     * The light ground under somebody else's logo — a platform's, a studio's —
     * when nothing is known about it (`ui/logo-mark.tsx`).
     *
     * The fallback, no longer the rule. Those marks are drawn for white pages
     * and every one used to sit on this plate; each is now measured once and
     * drawn straight on the page, lightened when its ink would be lost, or on a
     * plate of its *own* ground when it is not cut out at all. This is what is
     * left for a logo that could not be measured: a plate the colour of `text`
     * is legible whatever turns out to be on it.
     */
    logoPlate: '#F5F5F5',

    /** Scrim over hero artwork so text stays legible on any cover. */
    scrim: 'rgba(0, 0, 0, 0.6)',
    /** Skeleton placeholder fill: a control's resting step, so it reads on a card. */
    skeleton: '#1F2430',
    /**
     * The light that sweeps a skeleton — SimpMusic's `shimmerLine` over its
     * `shimmerBackground` (`ui/shimmer`, `Modifier.shimmer()`).
     *
     * Measured, not picked. The reference's background is `0x7E383737`, which
     * over its own `#121212` panel composites to a relative luminance of
     * 0.0178 — and `skeleton` here is 0.0177, which is luck worth keeping. Its
     * line, `#4D4848`, stands at 1.72:1 on that; this is the colour at the
     * same ratio on `skeleton`, so the sweep reads exactly as strongly as the
     * reference's does. Any brighter and a loading list glitters.
     */
    skeletonSweep: '#40495E',

    /**
     * Ink for gradient ramps over artwork, and the palette's only true black.
     *
     * Not a surface: `background` is still the floor and nothing is ever *filled*
     * with this. It exists because a fade sitting under a photograph has to
     * reach real black, which `scrim` (a flat 60% overlay) cannot do. Always
     * fade it with `withAlpha(shadowInk, 0)`, never the keyword `transparent`.
     */
    shadowInk: '#000000',

    /*
     * The tier-list ramp. Data rather than chrome, and exempt from the
     * one-accent rule for the same reason the score ramp is: a tier list is a
     * chart of the user's own judgement, and six rows that are all grey is not a
     * tier list. Warm → cool so the ordering reads before the letters do.
     *
     * Row-header fills only. These are tuned as backgrounds for near-black type
     * and are not legible as text colours on a dark surface.
     */
    tierS: '#FF7B7B',
    tierA: '#FFB068',
    tierB: '#FFD86B',
    tierC: '#B6E07A',
    tierD: '#7ACBE0',
    tierF: '#B0A6E0',

    /*
     * The poster palette — the owner's reference (2026-10-15), sampled off its
     * screenshots: a run of solid, saturated fills, each a whole surface.
     *
     * **An exception to "colour comes from the art", and a bounded one.** It is
     * drawn in two places and nowhere else: onboarding (its pages that ask for
     * access are one of these colours, edge to edge — `constants/poster.ts`) and
     * the log form's seven progress choices, which fill with them
     * (`PROGRESS_POSTER` in `constants/progress.ts`). Status colour is already
     * meaning; these are its loud cousins, for the two places a choice is
     * the whole screen.
     *
     * Fills only. Type on them is `readableInk()` or one of the measured inks
     * below; `poster.test.ts` holds every pair at AA.
     */
    posterRed: '#F11B25',
    /** Type on `posterRed`. The reference's navy, darkened until it clears
     *  4.5:1 for small text (4.58); its own #0E1B2E was 4.05. */
    posterRedInk: '#080C16',
    posterCobalt: '#2B29D5',
    /** Type, and the button, on `posterCobalt` (5.43:1). */
    posterButter: '#F6C36A',
    posterPink: '#FF74D5',
    /** Type on `posterPink`. The reference set red on pink at 1.99:1; this is
     *  the same red taken down until it reads (4.64). */
    posterPinkInk: '#7A0913',
    /** Type on `posterButter` and on the off-white pill. */
    posterNavy: '#0E1B2E',
    posterViolet: '#7B4CFD',
    posterTeal: '#1FB48C',
    posterYellow: '#EBD95B',
    posterOrange: '#F4771A',
    /** The tile red, a step deeper than the page red so white clears it (4.79). */
    posterCrimson: '#E01D2B',
    /** The reference's primary pill — off-white, not white. 17:1 under its ink. */
    posterPaper: '#F2F1ED',
    /** The same pill, disabled: a mid grey with a dim label, as drawn. */
    posterDisabled: '#7D7B7C',
    posterDisabledInk: '#3E3D40',
    /*
     * Onboarding's own room, which is darker than the app's: the reference is
     * black. Not #000 — that smears on OLED when anything moves, and here the
     * words move. Fields are the reference's dark well with a hairline.
     */
    onboardingPage: '#050506',
    onboardingField: '#161419',
    onboardingEdge: '#2C2A30',

    /*
     * A review shared as an image — SimpMusic's lyrics card, read from
     * `ShareLyricsSheet.kt` (`ShareLyricsPalette`), its four fixed swatches
     * exactly. The first swatch on the sheet is the game's own colour, read
     * off its cover; these are there for when that colour is grey.
     *
     * **An image, not the interface.** These fill a picture somebody posts
     * elsewhere and are drawn nowhere in the app but its preview. Type on
     * them is `shareInkDark` or white, by luminance (`constants/share-card.ts`,
     * which `share-card.test.ts` holds at AA).
     */
    shareCharcoal: '#1F1F1F',
    shareForest: '#2F5D50',
    shareBrick: '#7A3B3B',
    sharePaper: '#E8E2D4',
    /** Type on a light swatch — SimpMusic's #141414 — and on a dark one, white. */
    shareInkDark: '#141414',
    shareInkLight: '#FFFFFF',

    /** Legacy aliases kept so older call sites keep compiling. */
    backgroundElement: '#202020',
    backgroundSelected: '#2A2A2A',
  },
} as const;

/** Dark-only: the light palette is the dark one. See the note above. */
export const Palette = Colors.dark;

export type ThemeColor = keyof typeof Colors.dark;
export type ThemePalette = typeof Colors.dark;

/**
 * The identity ramp in order, as palette keys.
 *
 * `constants/identity.ts` maps genres onto these names rather than onto hexes,
 * so retuning a hue is a one-line edit here and nothing downstream knows.
 */
export const IDENTITY_KEYS = [
  'identityEmber',
  'identityCrimson',
  'identityGold',
  'identityLime',
  'identityJade',
  'identityAqua',
  'identitySky',
  'identityCobalt',
  'identityViolet',
  'identityMagenta',
] as const satisfies readonly ThemeColor[];

export type IdentityKey = (typeof IDENTITY_KEYS)[number];

/**
 * How much hue goes into a tinted surface.
 *
 * High, and it can afford to be: `tint` restores the surface's original
 * luminance afterwards, so this dial changes only *chroma*. At 0.3 `surface`
 * under the sky hue resolves to #101D29 — unmistakably blue, unmistakably still
 * a near-black card. Below about 0.15 the tint stops being legible as a colour
 * and starts looking like a rendering artefact.
 */
const SURFACE_TINT = 0.3;

/**
 * Everything one accent hue has to be able to do, derived from the hue itself.
 *
 * A hue arrives as a single hex — from a game's genres, or `primary` when there
 * is no game — and a page needs six things from it. Deriving them beats storing
 * them: ten hues × six roles would be sixty tokens to keep in step, and the
 * whole point of the ramp is that adding an eleventh hue costs one line.
 *
 * **A tinted surface measures the same as the grey it replaces.** `tint` mixes
 * the hue in and then puts the luminance back, so contrast against every text
 * token moves by at most 0.07 — pure 8-bit rounding — across all ten hues on
 * both steps, and no AA or AAA verdict flips anywhere. That is the property
 * that makes these safe to use wherever the grey was: no per-hue exceptions and
 * no "careful what you put on the red one". (`textMuted` sits at 3.9:1 on the
 * elevated step, tinted or not — a pre-existing limit of the quiet grey on the
 * lightest surface, unchanged by any of this.)
 */
export type AccentRoles = {
  /**
   * The hue as a **fill**, and on a game's screens it is the loudest thing there.
   *
   * M3's `primary` (primary palette, tone 80) when the accent came from a game
   * (`tonal: true`), the hue exactly as given otherwise. See `accentRoles` for
   * why those are different questions.
   *
   * **Reserved, on a game page, for the masthead.** The review button, an active
   * action key, the live platform key — and nothing else. Its whole job is to be
   * the one saturated thing on a very dark page, which it stops doing the moment
   * a second element wears it.
   */
  color: string;
  /**
   * The hue as **type on a surface**: a link, an active tab label, a glyph.
   *
   * Lifted to 4.5:1 against the lightest surface accented type ever lands on, so
   * clearing AA there clears it everywhere. On a tonal accent that surface is
   * `elevated` below — a control's own fill — rather than the app's grey
   * `surfaceElevated`, because on a game page the grey one never appears.
   */
  onSurface: string;
  /** Near-black or white — whichever is legible *on* `color`. */
  ink: string;
  /**
   * Secondary type on a surface carrying this hue.
   *
   * Near-white with a trace of the accent in it, rather than grey. It was
   * introduced for the scroll gradient, whose brightest stop left every grey
   * token under AA; the gradient is gone from the game page now, but the role
   * outlives it for a quieter reason — on a page whose every surface is hue-tinted
   * a neutral grey reads as a foreign object, and this does not.
   */
  quietInk: string;
  /**
   * The fill behind an active chip, pill or badge — and the fill of anything
   * *selected*: a sort pill, a report reason, a tab. A light wash of the hue's
   * legible form; see `HOUSE_STATES` for why it is not a wash of the fill.
   */
  wash: string;
  /**
   * The edge of a selected or focused control.
   *
   * Paired with `wash` it is what "selected" looks like everywhere — a tint
   * inside, a lit edge around it, and the label up a step. The edge is the
   * carrier that survives colour blindness: over the page the house edge
   * measures 2.53:1 against a resting edge's 1.15, a difference of brightness,
   * not of hue.
   */
  edge: string;
  /** `color` while it is held down — a deeper, not a lighter, fill. */
  pressed: string;
  /** The focus ring: a 3dp halo outside the control's edge. */
  ring: string;
  /**
   * The page itself. **Tonal accents only** — it is `background` otherwise.
   *
   * M3's `background` — the neutral palette at tone 10. A game page fills with
   * this instead of running a gradient, which is what gives `color` (tone 80)
   * seven tone steps of headroom to be loud in.
   */
  page: string;
  /** A block sitting directly on the page. One step up from `page`. */
  surface: string;
  /**
   * A **control**: an inactive action key, a platform key, a row inside a card.
   *
   * One step above `card` on purpose, so a control nested inside a card is still
   * visible against it. On the page itself it reads as recessed rather than
   * raised, because everything around it is either darker (the page) or far
   * louder (`color`).
   */
  elevated: string;
  /**
   * `<InfoCard>` — the panels the game page is built from.
   *
   * Slightly lighter than `page` and no lighter: the card is a container, not a
   * highlight, and the thing that has to stand out on that page is the primary
   * button, not the box around the synopsis.
   */
  card: string;
  /** The coloured light an object casts. Alpha, so it works over artwork. */
  glow: string;
  /**
   * The full Material 3 role set this accent was built from.
   *
   * The ten roles above are the app's own vocabulary and cover most of what a
   * screen needs. This is the rest of M3 — `primaryContainer`, the secondary and
   * tertiary families, `outline`, the three `surfaceContainer` steps — for the
   * places that want a role the short list has no name for. A selected chip
   * wants `secondaryContainer`; a hairline wants `outlineVariant`; neither has
   * an equivalent in the ten.
   *
   * Present on the house accent too, seeded from `primary`, so a component may
   * read it unconditionally.
   */
  m3: DynamicThemeColors;
  /**
   * Whether these roles were built from a game's artwork (`tonal: true`) —
   * a game's own page — or are the house accent, the app's own room.
   *
   * What a card reads to choose its fill (`useCardMaterial`): the game's dark
   * tone on a game's page, the app's `surface` everywhere else — including a
   * game's page when the reader has switched game colours off.
   */
  tonal: boolean;
};

/**
 * How far `pressed` deepens `color`: toward black on the house accent, toward
 * M3's `onPrimary` — itself near-black — on a game's.
 */
const PRESSED_DEPTH = 0.14;

/**
 * How strong the state roles are, per mode.
 *
 * **Built from the hue's legible form, not its fill.** The house blue is a
 * mid-luminance fill (3.94:1 on the page), and a 14% wash of it over near-black
 * lands *darker* than the resting control surface — a selected pill would look
 * dimmer than the ones around it, and brightness would stop carrying selection
 * for anyone who cannot see the hue. `onSurface` (`primaryText` for the house)
 * is light enough that its wash lifts the fill instead: 0.0137 against the
 * resting 0.0108 in luminance. A game's M3 `primary` is tone 80 and already
 * light, so it takes a slightly softer set.
 */
const HOUSE_STATES = { wash: 0.16, edge: 0.55, ring: 0.3 } as const;
const TONAL_STATES = { wash: 0.14, edge: 0.45, ring: 0.22 } as const;

/**
 * Build the roles for one hue.
 *
 * ## Two modes, and the difference is where the hue came from
 *
 * `tonal: false` (the default) is the **house blue**. `primary` is a chosen
 * brand colour that already has the right saturation and lightness, and the app
 * outside a game page is surfaced from the fixed ladder with a fixed
 * `background` — so the roles are the hue itself plus the legacy `tint()`ed
 * surfaces, and nothing about the forty screens on the house accent moves with
 * any game.
 *
 * `tonal: true` is a **game**. The hue is a measurement off box art, the page is
 * about to be built entirely out of it, and every role is read off
 * a Material 3 tonal palette. This is the mode `<AccentProvider>` uses.
 *
 * Keeping both in one function rather than forking it is deliberate: every
 * consumer reads the same role names either way, so a shared primitive —
 * `<Button>`, `<InfoCard>`, `<TabBar>` — never learns which kind of screen it is
 * on. Only the values under the names change. That is also why a selected sort
 * pill is blue on the Search tab and the game's own colour on its reviews
 * sheet: `wash`, `edge` and `ring` are derived here, from whichever hue is in
 * force.
 *
 * **Computed once per hue and mode, then shared.** Both modes build a Material 3
 * scheme and run luminance-preserving tints, and the house blue is asked for by
 * every control that reads `useAccent()` — so the result is cached, and callers
 * get the same object back. Treat it as immutable.
 */
export function accentRoles(hue: string, { tonal = false }: { tonal?: boolean } = {}): AccentRoles {
  const key = `${tonal ? 'tonal' : 'house'}:${hue}`;
  const cached = accentCache.get(key);
  if (cached) return cached;

  const roles = buildAccentRoles(hue, tonal);
  /* Oldest first out; a Map iterates in insertion order. A game's hue is read
     off its box art, so a long session would otherwise keep every one it saw. */
  if (accentCache.size >= ACCENT_CACHE_SIZE) {
    accentCache.delete(accentCache.keys().next().value as string);
  }
  accentCache.set(key, roles);
  return roles;
}

const accentCache = new Map<string, AccentRoles>();
const ACCENT_CACHE_SIZE = 64;

/** Material 3's roles for an achromatic house colour, from the room's own ladder. */
function neutralM3(hue: string, ink: string): DynamicThemeColors {
  const c = Colors.dark;
  return {
    primary: hue,
    onPrimary: ink,
    primaryContainer: c.surfaceSelected,
    onPrimaryContainer: c.text,
    secondary: c.textSecondary,
    onSecondary: ink,
    secondaryContainer: c.surfaceElevated,
    onSecondaryContainer: c.text,
    tertiary: c.textSecondary,
    onTertiary: ink,
    tertiaryContainer: c.surfaceElevated,
    onTertiaryContainer: c.text,
    background: c.background,
    onBackground: c.text,
    surface: c.background,
    onSurface: c.text,
    surfaceVariant: c.surfaceElevated,
    onSurfaceVariant: c.textSecondary,
    surfaceContainer: c.surface,
    surfaceContainerHigh: c.surfaceElevated,
    surfaceContainerHighest: c.surfaceSelected,
    outline: c.textMuted,
    outlineVariant: '#2C2E36',
  };
}

function buildAccentRoles(hue: string, tonal: boolean): AccentRoles {
  if (!tonal) {
    /* The house blue. `primary` is a chosen brand colour sitting on a fixed
       `background`, not a measurement, so there is nothing for a tonal palette
       to derive — and running it through one would relight the forty screens
       that are not about a game. */
    const ink = readableInk(hue);
    /* The house hue's type twin is a chosen value, `primaryText`, so the tab
       labels, links and selected states all say the same blue. Any other hue's
       is computed. */
    const type =
      hue === Colors.dark.primary
        ? Colors.dark.primaryText
        : ensureContrast(hue, Colors.dark.surfaceElevated, 4.5);
    /* A white (or grey) house colour has no hue for Material to build a
       palette from — it falls back to cyan — so its M3 roles are the room's
       own neutrals instead. */
    const neutral = (toHsl(hue)?.s ?? 0) < 0.05;
    return {
      color: hue,
      onSurface: type,
      ink,
      quietInk: neutral ? Colors.dark.textSecondary : mix('#FFFFFF', hue, 0.24),
      wash: withAlpha(type, HOUSE_STATES.wash),
      edge: withAlpha(type, HOUSE_STATES.edge),
      pressed: mix(hue, Colors.dark.shadowInk, PRESSED_DEPTH),
      ring: withAlpha(type, HOUSE_STATES.ring),
      page: Colors.dark.background,
      surface: tint(Colors.dark.surface, hue, SURFACE_TINT),
      elevated: tint(Colors.dark.surfaceElevated, hue, SURFACE_TINT),
      card: tint(Colors.dark.surfaceSelected, hue, SURFACE_TINT),
      glow: withAlpha(hue, 0.42),
      m3: neutral ? neutralM3(hue, ink) : generateDynamicTheme(hue, true),
      tonal: false,
    };
  }

  /*
   * A game: every role comes off a Material 3 tonal palette seeded by the hue.
   *
   * The mapping is the whole bridge between the app's vocabulary and M3's, and
   * it is deliberately a *rename* rather than a translation — each legacy role
   * resolves to the M3 role that answers the same question, so the twenty-odd
   * components already reading `accent.card` or `accent.elevated` get M3 colours
   * without one of them being edited.
   *
   *   page     → background              neutral  10   the screen fill
   *   surface  → surface                 neutral  10   a block on the page
   *   card     → surfaceContainer        neutral  20   <InfoCard>
   *   elevated → surfaceContainerHigh    neutral  24   controls, rows in cards
   *   color    → primary                 primary  80   the one loud fill
   *   ink      → onPrimary               primary  20   type on that fill
   *   quietInk → onSurfaceVariant  neutralVariant 80   secondary type anywhere
   *
   * Two things this buys that the previous HSL ramp could not. **The tones are
   * perceptual**: HCT tone 20 is the same lightness at every hue, where HSL
   * lightness is not — which is why the old ramp needed per-role saturation
   * tuning to look even across the wheel, and why its yellows read brighter than
   * its blues at identical values. And **there is a second and third accent
   * family** (`secondary`, `tertiary`) for the first time, reachable through
   * `m3` below.
   *
   * What it costs, and it is worth stating plainly: M3's neutrals carry chroma 6
   * (neutral) and 8 (neutralVariant), so a page built from them is far closer to
   * grey than the deeply tinted `#191307` the HSL ramp produced from the same
   * seed. That is Material's judgement rather than an accident — the colour is
   * meant to live in the accents, not the substrate. `TONES` is gone; turning
   * the page back up means raising the neutral palettes' chroma in
   * `dynamic-color.ts`, in one place, for every role at once.
   */
  const m3 = generateDynamicTheme(hue, true);

  return {
    color: m3.primary,
    /* Already tone 80 against a tone-20/24 surface — comfortably past AA — so
       `ensureContrast` is a floor that never fires here rather than a lift. It
       stays because a future variant or contrast level could change that, and a
       silent drop under 4.5:1 is exactly what this role exists to prevent. */
    onSurface: ensureContrast(m3.primary, m3.surfaceContainerHigh, 4.5),
    ink: m3.onPrimary,
    quietInk: m3.onSurfaceVariant,
    wash: withAlpha(m3.primary, TONAL_STATES.wash),
    edge: withAlpha(m3.primary, TONAL_STATES.edge),
    /* M3's own pressed state is `onPrimary` layered over `primary`, which is
       what a mix toward the ink computes. */
    pressed: mix(m3.primary, m3.onPrimary, PRESSED_DEPTH),
    ring: withAlpha(m3.primary, TONAL_STATES.ring),
    page: m3.background,
    surface: m3.surface,
    elevated: m3.surfaceContainerHigh,
    card: m3.surfaceContainer,
    glow: withAlpha(m3.primary, 0.42),
    m3,
    tonal: true,
  };
}

/**
 * Poppins, in four weights, and nothing else.
 *
 * **Weight is a family here, not a `fontWeight`.** React Native on Android will
 * not synthesise a bold from a custom font: `fontFamily: 'Poppins_400Regular'`
 * plus `fontWeight: '700'` renders regular, silently, and the bug only shows on
 * one platform. Every weight is therefore a separate loaded family, and nothing
 * in the app should set `fontWeight` on text again — reach for one of these.
 *
 * Four weights because the system uses three: 400 for reading, 500 for small
 * dense metadata, 600 for anything that has to be picked out of a page. 700 is
 * reserved for the two largest steps, which are page titles.
 *
 * ## The two italics, and why they are not `fontStyle`
 *
 * Exactly the same trap as weight, and it caught this app once already: an
 * empty-state line on the review screen carried `fontStyle: 'italic'` over
 * `Inter_400Regular` (Poppins' predecessor here) and rendered upright on
 * Android, because a custom family has no oblique to synthesise from either.
 * Italic is a *family* here too.
 *
 * They exist for **user-written emphasis and nothing else** — `*italic*` and
 * `**bold**` in a collection's description, via `<RichText>`. No token on the
 * type scale reaches for them, and none should: the scale separates by size and
 * weight, and an italic step would be a third axis for chrome that has no use
 * for one. Two faces rather than four because emphasis inside body copy is the
 * only place they appear, and body copy is regular or bold.
 */
/**
 * The app's one family: Poppins, for everything — SimpMusic's own font, at
 * the owner's direction (2026-10-17).
 *
 * **It replaced Inter, which had replaced a second family before it.** Source
 * Serif 4 set reviews and nothing else until the owner had it removed
 * ("remove the specific font for reviews and just use the normal one"), and
 * Inter was that normal one from then on. SimpMusic's `Typo.kt` wires its
 * whole type scale to one bundled file, `poppins_medium`, and leans on
 * Android's fake-bold for every heavier weight it asks for — this app brings
 * in Poppins' own weight files instead, the way Inter's were, so `fontWeight`
 * keeps meaning something rather than silently flattening to medium.
 *
 * **Every weight is its own family name.** Android will not synthesise a bold or
 * an oblique from a custom font, so `fontWeight: '700'` on Poppins silently
 * renders regular. Reach for a family, never a weight.
 *
 * `light` exists for one thing: the release year beside a review's title, where
 * a year has to recede from a bold title without getting smaller.
 */
export const FontFamily = {
  light: 'Poppins_300Light',
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  italic: 'Poppins_400Regular_Italic',
  boldItalic: 'Poppins_600SemiBold_Italic',
  /**
   * Onboarding's two, and nothing else's (the owner's reference, 2026-10-15).
   * ExtraBold sets its headlines — lowercase, very large, tracked tight; the
   * mono sets the small instruction over them ("choose one"). Each is one
   * weight, imported by its own path in the root layout. Geist Mono is its
   * own reference, not SimpMusic's, and stayed through the Poppins switch.
   */
  extraBold: 'Poppins_800ExtraBold',
  mono: 'GeistMono_400Regular',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: FontFamily.regular,
    serif: 'ui-serif',
    rounded: FontFamily.regular,
    mono: 'ui-monospace',
  },
  default: {
    sans: FontFamily.regular,
    serif: 'serif',
    rounded: FontFamily.regular,
    mono: 'monospace',
  },
});

/**
 * Spacing ladder, at the owner's reference's numbers.
 *
 * ⚠️ **The names are step names.** `x16` is the page margin and resolves to 15,
 * not 16. Read the value here, never infer it from the name, and never "fix" a
 * name to match its number.
 *
 * ## SimpMusic's ladder, read from its code
 *
 * The values are the dp SimpMusic lays itself out in, from `HomeScreen.kt`,
 * `AdapterItems.kt`, `FullWidthItems.kt`, `LibraryScreen.kt` and
 * `SearchScreen.kt`: 4 between chips, 8 between a list's items and from art to
 * its title, 12 from a thumbnail to its text and between grid cells, **15 at
 * the side of every page** (Home, Library, every row), 20 and 24 for a sheet's
 * or a setting's inset, 32 for an album's body, 48 at the foot of a scroll.
 *
 * ## What this undid
 *
 * The ladder had been compressed twice — first by a quarter, then a further
 * ~17% from `x12` up — to zoom the chrome out so the artwork out-weighed it:
 * the page margin was 10 and a band's gap 40. At the owner's direction the app
 * now takes SimpMusic's dimensions instead, so the ladder went back to
 * Material's 4dp grid with the reference's 15 for the margin. The controls
 * had been sized to the reference *on* the compressed ladder (a 52dp button,
 * 15 inside a field), and were re-pointed so they kept those sizes.
 */
export const Spacing = {
  x4: 4,
  x8: 8,
  x12: 12,
  /** The page margin: SimpMusic's 15, on Home, Library and every row. */
  x16: 15,
  x20: 20,
  x24: 24,
  /** Between one band of a page and the next, and an album's body inset. */
  x32: 32,
  x40: 40,
  /** The foot of a scroll. */
  x48: 48,
  /*
   * The top of the ladder, for the space under a form whose footer is pinned
   * over it. Bands of a page are `x32` apart — the reference's own interval —
   * not this.
   */
  x64: 64,
} as const;

/**
 * Radii. See DESIGN.md § 5.
 *
 * **Two regimes.** *Interface* is large and soft — the music-app language:
 * controls at 20, fields at 16, cards at 12, sheets at 24, and a pill for
 * anything that filters or tags. *Artwork* keeps its small, square-ish corners
 * (`image`, the case's own radii), because a box is a box: rounding a cover to
 * match the buttons beside it would make it look like one of them.
 *
 * The small steps (`xs`…`lg`) are for details inside a control — a badge, a
 * swatch, a seam — and for the game page's Material 3 cluster, which is shaped
 * by its own rules and did not move.
 *
 * Naming by role is what keeps them in place — `Radius.card` cannot drift onto a
 * button the way `md` could. Nothing uses the same radius as everything: a
 * field is squarer than the button that submits it, and a sheet is rounder than
 * the rows in it, so each reads as a different kind of object.
 */
export const Radius = {
  none: 0,
  xs: 2,
  sm: 3,
  md: 5,
  lg: 8,
  /** Chips, filters, tabs, search, badges, progress tracks, avatar rings. */
  pill: 999,

  /** Game covers, screenshots, thumbnails — anything rectangular and pictorial. */
  image: 4,
  /**
   * Pressable controls that are not buttons — toggles, segments, the log
   * form's status pills. Buttons themselves are full pills (`pill`), as the
   * owner's reference draws them.
   *
   * 20, which on a 48dp control resolves to a soft stadium and on anything 40dp
   * or shorter to a true pill (React Native clamps a radius at half the side).
   * Icon buttons are circles and take no token: `size / 2`.
   */
  control: 20,
  /**
   * **Every card in the app** — a notice, a panel, a row in a list, a game
   * page's section card — and the review card's own corner (`review`).
   *
   * One corner since the owner's direction of 2026-10-20: "make all the cards
   * in the app with that style of the review ones, with the same size and
   * corner ratio… even the ones in the game page". It was 16 for the app's
   * cards, 8 (scaled) for the game page's section cards and 18 for the `Card`
   * panel variant (`cardLarge`, deleted with that). The material that goes with
   * it — the fill, the hairline edge, the inset — is `useCardMaterial`.
   */
  card: 12,
  /**
   * A **review card**'s corner, and since 2026-10-20 every card's: `card` is
   * the same number. Kept as its own name because the review card is the
   * reference the rest were brought to, and a reader of `<LogCard>` should see
   * which shape it is.
   *
   * Measured off the owner's two references (2026-10-20), where the corner is
   * about 3% of the card's width in both — 16.5px on a 523px-wide card in one
   * and ~5px on a 200px one in the other, which on a full-width card here is
   * 9–11dp. It was `lg` (8), and the owner asked for the reference's ratio:
   * "look at the round corner ratio of the card".
   */
  review: 12,
  /**
   * Every field — text, text area, select, search: the reference's 18dp.
   * Squarer than a button's full pill, so a field and the button that submits
   * it read as two different objects.
   */
  input: 18,
  /**
   * The top corners of a bottom sheet, and the corners of a dialog or a menu —
   * anything that sits *above* the page. The roundest interface shape, because
   * everything inside it is less round.
   */
  sheet: 24,

  /*
   * Preserved — the physical game case keeps its own radii. See DESIGN.md § 5.3.
   *
   * `caseImage` was the same number as `image` under the previous scale and is
   * not under this one, so they are separate tokens on purpose: folding them
   * back together would silently redesign the case. `caseImage` covers both the
   * artwork inside the case window and the hairline frame around the PC/mobile
   * cover that stands in when a platform has no case.
   */
  caseImage: 12,
  caseSpine: 3,
} as const;

/**
 * Type scale. See DESIGN.md § 2.
 *
 * Each step pairs a size, a line height and a *family* (see `FontFamily`: on
 * Android the weight has to be the family or it is ignored). Nothing here sets
 * `fontWeight` — the family carries it.
 *
 * Structural steps are `display` and `h1`–`h6`; prose is `body` / `bodySmall`;
 * `caption` and `label` are the metadata steps; `button` is control text.
 * Hierarchy is carried by weight and colour before size — the gaps between the
 * heading steps are deliberately small.
 *
 * **Tracking is in points, not em.** React Native has no `em`, so DESIGN.md's
 * relative values are resolved against each step's own size: -0.02em on 32
 * becomes -0.64, 0.08em on 11 becomes 0.88. Changing a step's size means
 * recomputing its tracking.
 *
 * ## The sizes are SimpMusic's
 *
 * Each step is one of the owner's reference's styles (`Typo.kt`), at its sp:
 * `display` its `titleLarge` (25, an album's name), `h1` `headlineLarge` (23),
 * `h2` `headlineMedium` (20, Home's shelf titles — "Quick picks"), `h3`
 * `titleMedium` (18, a sheet's or a screen's title), `h4` `labelMedium` (16,
 * the artist page's section headings and a setting's name), `h5` `labelSmall`
 * (14, a chip's and a tab's word), `body` `bodyMedium` (13) and `bodySmall`
 * its `bodySmall` (11). `caption` is 11 too — the reference sets nothing
 * smaller that is meant to be read. `h6` and `label` stay at 10: they are
 * badges, which the reference draws smaller still (its LIVE badge is 9).
 *
 * The scale had been zoomed out ~8% with the spacing ladder; it came back up
 * with it. Weights stayed this app's: SimpMusic registers one Poppins file and
 * lets Compose synthesise the rest, which says nothing worth copying.
 */
export const Type = {
  display: { fontSize: 25, lineHeight: 30, fontFamily: FontFamily.bold, letterSpacing: -0.55 },
  h1: { fontSize: 23, lineHeight: 28, fontFamily: FontFamily.bold, letterSpacing: -0.39 },
  h2: { fontSize: 20, lineHeight: 25, fontFamily: FontFamily.bold, letterSpacing: -0.22 },
  h3: { fontSize: 18, lineHeight: 23, fontFamily: FontFamily.bold },
  h4: { fontSize: 16, lineHeight: 21, fontFamily: FontFamily.bold },
  h5: { fontSize: 14, lineHeight: 19, fontFamily: FontFamily.bold },
  h6: { fontSize: 10, lineHeight: 14, fontFamily: FontFamily.bold, letterSpacing: 0.22 },

  body: { fontSize: 13, lineHeight: 19, fontFamily: FontFamily.regular },
  /* Long-form reading — an article or review body, not UI copy. Deliberately
     looser than `body`: those two screens are the ones people actually read. */
  prose: { fontSize: 14, lineHeight: 22, fontFamily: FontFamily.regular },
  bodySmall: { fontSize: 11, lineHeight: 15, fontFamily: FontFamily.regular },

  /*
   * 11, the reference's smallest reading size (`bodySmall`) and iOS's
   * legibility floor. It was 10 while the scale was zoomed out. `label` stays
   * at 10 because it is a badge — uppercase, tracked, a word or two over art —
   * and a badge that grew would no longer fit the covers it sits on. Do not
   * shrink either.
   */
  caption: { fontSize: 11, lineHeight: 14, fontFamily: FontFamily.regular, letterSpacing: 0.2 },
  label: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  /*
   * Control text. 13 semibold — the reference's `titleSmall`, the small label in
   * the middle of a 52dp pill.
   */
  button: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.semibold },
  /**
   * A tab's label — Material's `labelLarge`, which SimpMusic's filter chips
   * (every tab row under its top bars) are set in: 14, medium, sentence case.
   */
  tab: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.medium, letterSpacing: 0.1 },
  /**
   * A form field's label, set *above* the field: small and medium weight, the
   * reference's 11sp Poppins Medium translated to Inter at the 12 it needs to
   * read the same. The field under it is the object; the label names it.
   */
  fieldLabel: { fontSize: 12, lineHeight: 16, fontFamily: FontFamily.medium },
  /**
   * What is typed into a field. **No `lineHeight`, on purpose**: on Android a
   * line height on a `TextInput` clips descenders and fights the vertical
   * centring the field's min-height does. 13, the reference's.
   */
  fieldText: { fontSize: 13, fontFamily: FontFamily.regular },
  /**
   * The name on a selection card — the reference's Server option. Medium, not
   * bold: a choice is read, not announced, and the circle beside it carries
   * which one is on.
   */
  optionTitle: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.medium },
  /**
   * The title of a row or a card in a list — a game in a collection, a
   * collection in a list of them. The reference's `titleSmall`: 13 semibold,
   * with its supporting line in `bodySmall` under it. Bold is for titles and
   * figures; everything around them is regular and quieter.
   */
  itemTitle: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.semibold },

  /* -------------------------------------------------------------------------
   * Reviews, and nothing else in the app.
   *
   * **Inter, like the rest.** These steps were the serif's whole extent — a
   * review's title, its prose, the headline and excerpt on a card were set in
   * Source Serif 4 so that writing read as writing. The owner removed the
   * serif (see `FontFamily`), and the steps stayed: they are still the
   * *sizes* of a review surface, and every review screen already asks for them
   * by name. What sets a review apart now is `proseInk`, the looser leading of
   * `reviewProse`, and the page it is on.
   *
   * Still not for use outside a review surface — not because of the face any
   * more, but because a game's title in a search result is a row's title
   * (`itemTitle`), not a headline.
   * ---------------------------------------------------------------------- */

  /**
   * The game's name on a review page. The one headline in the app — `h2`'s
   * size and tracking on a line one tighter, because it stands alone beside a
   * score rather than over a section.
   */
  reviewTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.22,
  },
  /** The same, on a feed card, where it shares a column with the artwork. */
  reviewTitleSmall: { fontSize: 16, lineHeight: 20, fontFamily: FontFamily.bold },
  /**
   * The writer's own headline on a feed card — "One of the best games of all
   * time" — closing the header block beside the box art, under the score and
   * the date. 11 bold: the sans floor is 10, and a headline is one step over a
   * badge.
   */
  reviewHeadlineSmall: { fontSize: 11, lineHeight: 15, fontFamily: FontFamily.bold },
  /*
   * The prose: 14 on 22, the reading step (`prose`).
   *
   * It ran 14/23 while it was a serif, which needs the extra leading to keep
   * its lines from knitting together at length. Inter's x-height is larger and
   * its lines hold apart on less; at 23 a page of it reads as double-spaced.
   * 22 on 14 is 1.57 — still the loosest block in the app, as the one thing in
   * it somebody reads rather than scans should be.
   */
  reviewProse: { fontSize: 14, lineHeight: 22, fontFamily: FontFamily.regular },
  /** The excerpt on a feed card, beside the artwork. */
  reviewExcerpt: { fontSize: 13, lineHeight: 20, fontFamily: FontFamily.regular },
  /** The release year beside a review's title. Recedes without shrinking. */
  reviewYear: { fontSize: 14, lineHeight: 19, fontFamily: FontFamily.light },
  /** "Review by <name>". Sans, because it is a fact about the piece. */
  reviewByline: { fontSize: 12, lineHeight: 17, fontFamily: FontFamily.semibold },
  /**
   * The playthrough block: platform, hours, platinum, date.
   *
   * 13/18, up from 11/16. These are the facts somebody checks *before* deciding
   * whether to read the review — what it was played on, for how long, how far
   * through — and at 11 they were the quietest type on a page whose masthead is
   * a 20px title beside a score tile. They are the one part of that
   * masthead that is information rather than identity, so they get the step.
   *
   * Still under the title and the score, which is the constraint: this reads
   * *after* both, not against them.
   */
  reviewMeta: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.semibold },

  /*
   * Preserved — the physical game case keeps its own type. See DESIGN.md § 2.3.
   *
   * These are the exact metrics the case rendered at before this scale was
   * adopted, pinned so its appearance did not move with the migration. Do not
   * use them anywhere else and do not tidy them onto `h1`/`h6`: `h1` grows the
   * placeholder letter by 4, and `h6`'s bold weight widens the uppercase edition
   * badge enough to truncate it on the 108dp case.
   */
  caseTitle: { fontSize: 24, lineHeight: 30, fontFamily: FontFamily.bold },
  caseEdition: { fontSize: 12, lineHeight: 16, fontFamily: FontFamily.medium },

  /*
   * Onboarding — the owner's reference, matched by eye against its screenshots
   * on a 390pt display. Used there and nowhere else.
   *
   * The headline is the screen: lowercase, ExtraBold, tracked to -3% (the
   * craft floor's limit is -4%), a 1.05 line so two lines read as one block.
   */
  posterHeadline: {
    fontSize: 40,
    lineHeight: 42,
    fontFamily: FontFamily.extraBold,
    letterSpacing: -1.2,
  },
  /** The small instruction over a headline — "choose one" — and the
   *  "import + auto-sync" line in a row. */
  posterLabel: { fontSize: 12, lineHeight: 16, fontFamily: FontFamily.mono },
  /** The one sentence inside the brackets. */
  posterNote: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.semibold },
  /** The pill's label, a step over `button`: the reference's pills are 56 high. */
  posterButton: { fontSize: 15, lineHeight: 20, fontFamily: FontFamily.semibold },
  /** What is typed into an onboarding field. */
  posterField: { fontSize: 16, lineHeight: 21, fontFamily: FontFamily.regular },
} as const;

/**
 * Score numeral sizes. See DESIGN.md § 15.
 *
 * The score is a bare coloured numeral at 700, so it sits outside the type scale
 * — its size is chosen by how much room the score has, not by where it falls in
 * a document hierarchy. `inline` is body height, for a feed row where the score
 * is one fact among several; `hero` is the headline number on a review page.
 */
export const ScoreSizes = {
  inline: 12,
  medium: 17,
  large: 25,
  hero: 35,
} as const;

/**
 * Elevation. See DESIGN.md § 6.
 *
 * Depth is carried by **two** things working together: the surface step
 * (`background` → `surface` → `surfaceElevated` → `surfaceSelected`) and a
 * shadow on top of it. The step still does most of the work — a shadow alone is
 * nearly invisible against a near-black page — but the shadow is what makes an
 * element read as sitting *above* the page rather than being painted on it.
 *
 * **Controls do not cast.** Buttons, fields, chips and icon buttons are drawn
 * by a surface step and a 1px `border` — the music-app language keeps shadows
 * to near nothing, and a control that needs more presence gets a brighter edge
 * or a fill, not a tier. `control` survives for the few elements that are
 * genuinely *objects on* the page rather than controls in it.
 *
 * Four interface tiers, and they are deliberately restrained. On a near-black
 * page a large soft shadow does not look like depth, it looks like a grey
 * smudge; the lift comes from a tight radius and a short offset, not from
 * opacity.
 *
 *   card     a block resting on the page
 *   control  something you can press
 *   raised   pressed, active, or floating above siblings
 *   overlay  a dock, popover, sheet or modal — off the page entirely
 *
 * **The ceiling is the game case.** `game-case.tsx` casts at opacity 0.45,
 * radius 18, offset (6, 12) — strictly larger than `overlay` in opacity, offset
 * and radius, and the only shadow in the app with a horizontal component. That
 * gap is not decoration: the case is a depicted physical object and everything
 * here is interface. If an interface tier ever grows past `overlay`, the case
 * stops reading as the one real thing on the shelf. See DESIGN.md § 6.1.
 */
export const Elevation = {
  none: {},
  card: Platform.select({
    ios: {
      shadowColor: Palette.shadowInk,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  control: Platform.select({
    ios: {
      shadowColor: Palette.shadowInk,
      shadowOpacity: 0.24,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    android: { elevation: 3 },
    default: {},
  }),
  raised: Platform.select({
    ios: {
      shadowColor: Palette.shadowInk,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
    },
    android: { elevation: 6 },
    default: {},
  }),
  overlay: Platform.select({
    ios: {
      shadowColor: Palette.shadowInk,
      shadowOpacity: 0.38,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 10 },
    default: {},
  }),
} as const;

/**
 * Motion. Short and ease-out, and only where it helps you understand what moved.
 */
export const Motion = {
  fast: 150,
  normal: 200,
  slow: 300,
  /**
   * How far a card or button shrinks while held.
   *
   * The default for `<PressableScale scaleTo>`, and only half the story since
   * that component learned about Reduce Motion: under the OS setting it holds
   * still and dims instead, because a scale is spatial movement while press
   * feedback is an affordance, and answering the first by deleting the second
   * would be the wrong trade. This value is the motion-on path.
   *
   * 0.95 since 2026-10-31, toward Convx's 0.94 (`bounceClick`): at 0.98 a
   * card barely moved, and the owner asked that a tap always answer. Every
   * control that sets its own `scaleTo` kept it; they all spring now.
   */
  pressScale: 0.95,
} as const;

/**
 * Minimum tap target. Nothing tappable is smaller.
 *
 * **The two platforms do not agree, and this used to claim they did.** The HIG
 * sets 44pt; Material sets 48dp with 8dp of separation. A single 44 satisfied
 * iOS and quietly shipped four points short on every Android device — which is
 * the whole meaning of `adaptive` in PRODUCT.md: one design language, each
 * platform's own guarantees.
 *
 * Read it, never restate it. A hard-coded 44 in a component is the same bug
 * this constant exists to prevent, one file further down.
 */
export const TapTarget = Platform.select({ android: 48, default: 44 }) as number;

/**
 * How tall a control is drawn, as distinct from how large it is to touch.
 *
 * The reference's numbers: a button is 52 and a field is 54, the field a hair
 * taller because it holds a line you type rather than a word you tap. `medium`
 * is every action button and clears both platforms' floors on its own; `small`
 * is drawn shorter and reaches `TapTarget` through `hitSlop`, which is what
 * lets a row of filter pills stay light without a thumb missing them; `large`
 * is for the one action a screen exists for.
 *
 * `small` is the reference's chip, 32 (Material's filter chip, which SimpMusic
 * draws its Home, Library and Search filters with). It was 36.
 */
export const ControlHeight = {
  small: 32,
  medium: 52,
  field: 54,
  large: 60,
} as const;

/**
 * The touch slop that lifts a `ControlHeight.small` control to the platform
 * floor: 6 on iOS, 8 on Android. Vertical only — horizontally the label is
 * already wider than the floor.
 */
export const SmallControlSlop = {
  top: (TapTarget - ControlHeight.small) / 2,
  bottom: (TapTarget - ControlHeight.small) / 2,
} as const;

/**
 * The vertical gap between wrapped rows of small controls: exactly the two
 * slops that meet across it (12 on iOS, 16 on Android).
 *
 * Slop expands the touch rectangle without moving the box, and React Native
 * resolves an *overlap* by view order rather than by proximity — so with a
 * smaller gap, a tap between two rows of filter pills would land on whichever
 * pill mounted later. At this gap the touch rectangles tile the row edge to
 * edge and never overlap. Use it as `rowGap` on any wrapping row of
 * `ControlHeight.small` controls; the column gap is free, because the slop is
 * vertical only.
 */
export const SmallControlRowGap = TapTarget - ControlHeight.small;

/** Portrait box art. Every poster in the app uses this ratio. */
export const PosterAspectRatio = 2 / 3;
/** Landscape key art (Steam headers, IGDB artworks). */
export const HeroAspectRatio = 16 / 9;

/**
 * How much of the display a full-bleed hero fills.
 *
 * Sized against the screen rather than the art's own 16:9, because the hero is
 * the page's opening statement and 16:9 on a tall phone is a 26%-high band — a
 * banner above the content rather than a backdrop behind it. At 38% the art
 * carries the top of the screen the way it does on a store page.
 *
 * The trade is a centre crop: a 16:9 source shown at ~1.2:1 loses its outer
 * thirds. Key art is composed centrally, and `heroHeightFor` never returns less
 * than the untouched 16:9 height, so wide displays keep the whole frame.
 */
export const HeroHeightRatio = 0.38;

export const MaxContentWidth = 800;
