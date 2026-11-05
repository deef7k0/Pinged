---
name: GameLog
description: A gaming discovery app in Apple Music and Apple TV's language — a true-black room, Inter at Apple's sizes, capsule controls, colour taken from the games, and a lot of games.
scheme: dark-only
target: react-native
colors:
  # Apple Music's and Apple TV's room (the Apple pass, 2026-11-04): a true-black
  # page, iOS's #1C1C1E for a card, and the ladder climbing from there — card on
  # page 1.24:1, elevated on card 1.16, selected on elevated 1.17. It has to
  # climb: a control resting on a card is drawn by being lighter than the card.
  # It was the owner's blue-grey #14171C / #1B1F28 from 2026-10-20. Nothing on
  # a game's screens uses these for surfaces: those come from its artwork.
  background: "#000000"
  surface: "#1C1C1E"
  # Nested blocks and wells, and the resting fill of a control.
  surfaceElevated: "#28282A"
  surfaceSelected: "#333336"
  # The owner's reference, SimpMusic, measured from its code: a field's well is
  # its onSurfaceVariant at 8% (#0F0F0F on black), an action's fill at 12%
  # (#181818 on black). Translucent, so the lift is the same on every floor.
  input: "rgba(255,255,255,0.06)"
  controlFill: "rgba(255,255,255,0.094)"
  controlPressed: "rgba(255,255,255,0.15)"
  # The soft label on an action button (#D6D4D9 measured). 12.4:1 on its fill.
  controlInk: "#D6D6D6"
  # The segmented control (every in-page tab row): a translucent track and a
  # solid thumb that slides along it — reacticx's SegmentedControl.
  segmentTrack: "rgba(255,255,255,0.08)"
  segmentThumb: "#3A3A3C"
  # The masked tab bar's pill and the chosen words inside it: iOS 26's glass
  # thumb, white at 22% with white words (2026-11-04; it was a solid #F2F2F2).
  segmentPill: "rgba(255,255,255,0.22)"
  segmentPillInk: "#FFFFFF"
  # The resting edge of a choice — a selection card, a filter pill. Choices are
  # outlined; actions are filled.
  outline: "rgba(255,255,255,0.16)"
  hover: "rgba(255,255,255,0.04)"
  pressed: "rgba(255,255,255,0.07)"
  # Dividers. 1.15:1 on the page.
  border: "rgba(255,255,255,0.07)"
  # Unchanged: the protected game case's PC-cover frame is drawn in it.
  borderStrong: "rgba(255,255,255,0.12)"
  # The edge of box art: one hairline inside a cover's own corner, over its
  # artwork — #DDEEFF at 35%, the poster outline of the owner's Letterboxd
  # reference. An alpha, not a grey: it lightens the art under it. See § 4.
  # The house accent is white, Apple TV's: the prominent capsule is white with
  # near-black words, and a game's screens take the game's own colour instead.
  # (It was PlayStation blue #0070CC; the code moved to white before this file
  # did — the docs caught up on 2026-11-04.)
  primary: "#FFFFFF"
  onPrimary: "#0E0E0E"
  # `primaryText` at 16%: the house `wash`, lighter than the resting control fill.
  primaryMuted: "rgba(255,255,255,0.16)"
  accent: "#FFFFFF"
  # The accent as type: white on the house pages.
  primaryText: "#FFFFFF"
  # Neutral, deliberately: the reference's violet inks are within a few units
  # of these, and these are what the protected case's printed back is set in.
  text: "#F5F5F5"
  textSecondary: "#A8A8A8"
  textMuted: "#8F8F8F"
  scoreHigh: "#4ADE80"
  scoreMid: "#F5A524"
  scoreLow: "#F35555"
  danger: "#F35555"
  success: "#4ADE80"
  # Identity ramp — genre → hue, the fallback when a cover's dominant hue
  # cannot be extracted. See `constants/identity.ts`.
  identityEmber: "#FF9142"
  identityCrimson: "#FF6F7D"
  identityGold: "#F3C24B"
  identityLime: "#A8DC5A"
  identityJade: "#43D98C"
  identityAqua: "#3CD6CE"
  identitySky: "#57B2FF"
  identityCobalt: "#8394FF"
  identityViolet: "#B98CFF"
  identityMagenta: "#FF7ACB"
  # Log status. Data, not chrome — each ships its word or glyph beside the hue.
  statusPlaying: "#43D98C"
  statusPlayed: "#2E93E8"
  statusBacklog: "#C9A6FF"
  statusDropped: "#CE7B62"
  statusPaused: "#F3C24B" # = identityGold; 0022
  # Achievement rarity bands.
  rarityCommon: "#9AA3AE"
  rarityUncommon: "#43D98C"
  rarityRare: "#57B2FF"
  rarityEpic: "#B98CFF"
  rarityLegendary: "#F3C24B"
  # The ambient page glow. A gradient, never an image.
  glowCore: "#6B4C9A"
  glowEdge: "#3A2050"
  platinum: "#A9B6CC"
  # The Must Play label's disc (0034) — a moderator's pick, the one coloured
  # mark this app puts on box art. = identityJade; a meaning joins the ramp.
  # Green at the owner's direction; it was identityEmber.
  mustPlay: "#43D98C"
  # The light ground under a platform's or studio's logo that could not be
  # measured. Logos are otherwise drawn straight on the page (ui/logo-mark),
  # lightened when their ink would be lost. Never an app surface.
  logoPlate: "#F5F5F5"
  # Review prose, and only review prose: a muted grey, quieter than
  # `textSecondary` and carrying the surfaces' cool trace (it was blue-green
  # when the room was). 6.29:1 on the page. See § Typography — the review steps.
  proseInk: "#958F9D"
  # A liked review's heart. Deliberately not `danger`: a like is an endorsement,
  # `danger` means something is about to be destroyed. 8.67:1 on the page.
  liked: "#FF9D35"
  scrim: "rgba(0,0,0,0.6)"
  # A placeholder's fill, and the light that sweeps it. The sweep is measured,
  # not picked: SimpMusic's shimmer line stands at 1.72:1 on its own shimmer
  # background, and this is the colour at that ratio on `skeleton`. See § 22.
  skeleton: "#28282A"
  skeletonSweep: "#4C4C4F"
  # Ink for gradient ramps over artwork. Not a surface — never fill with it.
  shadowInk: "#000000"
  # Tier-list ramp. Data, not chrome. See § 1.5.
  tierS: "#FF7B7B"
  tierA: "#FFB068"
  tierB: "#FFD86B"
  tierC: "#B6E07A"
  tierD: "#7ACBE0"
  tierF: "#B0A6E0"
  # The poster palette — the owner's reference (2026-10-15), sampled off its
  # screenshots. Solid, saturated fills, each a whole surface. Two places only:
  # onboarding's pages that ask for access (§ 27.1) and the log form's seven
  # progress pills (§ 27.2). The inks were taken down from the reference's
  # until they clear AA; `poster.test.ts` holds every pair.
  posterRed: "#F11B25"
  posterRedInk: "#080C16" # 4.58:1; the reference's navy was 4.05
  posterCobalt: "#2B29D5"
  posterButter: "#F6C36A" # on cobalt, 5.43:1
  posterPink: "#FF74D5"
  posterPinkInk: "#7A0913" # 4.64:1; the reference's red on pink was 1.99
  posterNavy: "#0E1B2E"
  posterViolet: "#7B4CFD"
  posterTeal: "#1FB48C"
  posterYellow: "#EBD95B"
  posterOrange: "#F4771A"
  posterCrimson: "#E01D2B" # the tile red; white clears it (4.79)
  posterPaper: "#F2F1ED" # onboarding's off-white pill
  posterDisabled: "#7D7B7C"
  posterDisabledInk: "#3E3D40"
  # Onboarding's room: darker than the app's, as the reference is black.
  onboardingPage: "#050506"
  onboardingField: "#161419"
  onboardingEdge: "#2C2A30"
  # Legacy aliases, kept so older call sites keep compiling. Do not use in new code.
  backgroundElement: "#1C1C1E"
  backgroundSelected: "#2C2C2E"
typography:
  # Apple's text styles in Inter (the Apple pass, 2026-11-04): largeTitle 34,
  # display = Title 1 28, h2 = Title 2 22 (every section heading), h3 = Title 3
  # 20, h4 = Headline 17 semibold, h5 = Subheadline 15 semibold, body 15
  # (Inter at 15 sets as SF does at 16–17), bodySmall = Footnote 13, caption 12.
  # `label` is a sentence-case footnote; `badge` (and `h6`) are the only capitals,
  # printed over artwork. Row titles are medium, not bold. They were SimpMusic's
  # sizes in Poppins (body 13) until then.
  # `caseTitle` / `caseEdition` keep their sizes (§ 2.3), in Inter.
  largeTitle:
    fontFamily: "Inter_700Bold"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "41px"
    letterSpacing: "-0.9px"
  display:
    fontFamily: "Inter_700Bold"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "34px"
    letterSpacing: "-0.7px"
  h1:
    fontFamily: "Inter_700Bold"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "30px"
    letterSpacing: "-0.55px"
  h2:
    fontFamily: "Inter_700Bold"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "-0.45px"
  h3:
    fontFamily: "Inter_700Bold"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "25px"
    letterSpacing: "-0.35px"
  h4:
    fontFamily: "Inter_600SemiBold"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "22px"
    letterSpacing: "-0.25px"
  h5:
    fontFamily: "Inter_600SemiBold"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "-0.15px"
  h6:
    fontFamily: "Inter_700Bold"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: "14px"
    letterSpacing: "0.2px"
  body:
    fontFamily: "Inter_400Regular"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "21px"
    letterSpacing: "-0.15px"
  prose:
    fontFamily: "Inter_400Regular"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "-0.15px"
  bodySmall:
    fontFamily: "Inter_400Regular"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "-0.05px"
  caption:
    fontFamily: "Inter_400Regular"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0px"
  label:
    fontFamily: "Inter_600SemiBold"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "18px"
    letterSpacing: "0px"
  badge:
    fontFamily: "Inter_500Medium"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: "13px"
    letterSpacing: "0.8px"
    textTransform: "uppercase"
  # 13 semibold, the reference's titleSmall: the small label in a 52dp pill.
  button:
    fontFamily: "Inter_600SemiBold"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "21px"
    letterSpacing: "-0.2px"
  # A form field's label, small and medium weight, above the field.
  fieldLabel:
    fontFamily: "Inter_500Medium"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
    letterSpacing: "0px"
  # What is typed into a field. No lineHeight on purpose: on Android a
  # lineHeight on a TextInput clips descenders.
  fieldText:
    fontFamily: "Inter_400Regular"
    fontSize: "16px"
    fontWeight: 400
    letterSpacing: "-0.2px"
  # The name on a selection card.
  optionTitle:
    fontFamily: "Inter_500Medium"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "-0.15px"
  # The title of a row or a card in a list — the reference's titleSmall.
  itemTitle:
    fontFamily: "Inter_500Medium"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "-0.15px"
  # Preserved — the game case keeps its own type. See § 2.3. Do not use elsewhere
  # and do not fold these into the scale above.
  caseTitle:
    fontFamily: "Inter_700Bold"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "30px"
  caseEdition:
    fontFamily: "Inter_500Medium"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
  # A tab's label: Material's labelLarge, which SimpMusic's chips are set in.
  tab:
    fontFamily: "Inter_500Medium"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "19px"
    letterSpacing: "-0.1px"
  # Onboarding, and nothing else (§ 27.1). ExtraBold and Geist Mono are one
  # weight each, loaded by path; "Inter for everything" still holds elsewhere.
  posterHeadline:
    fontFamily: "Inter_800ExtraBold"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: "42px"
    letterSpacing: "-1.2px"
  posterLabel:
    fontFamily: "GeistMono_400Regular"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  posterNote:
    fontFamily: "Inter_600SemiBold"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "18px"
  posterButton:
    fontFamily: "Inter_600SemiBold"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
  posterField:
    fontFamily: "Inter_400Regular"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "21px"
  # ---------------------------------------------------------------------------
  # Reviews, and nothing else in the app.
  #
  # Inter, like the rest. These steps were set in Source Serif 4 until the owner
  # removed it ("remove the specific font for reviews and just use the normal
  # one"); the steps stayed, as the sizes of a review surface. A review is told
  # apart by `proseInk`, the looser leading of `reviewProse` and the page it is
  # on — not by a second typeface. Do not bring a serif back.
  # ---------------------------------------------------------------------------
  reviewTitle:
    fontFamily: "Inter_700Bold"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "27px"
    letterSpacing: "-0.45px"
  reviewTitleSmall:
    fontFamily: "Inter_600SemiBold"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "22px"
    letterSpacing: "-0.25px"
  reviewHeadlineSmall:
    fontFamily: "Inter_600SemiBold"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "18px"
    letterSpacing: "0px"
  # 14/22, the reading step. It ran 14/23 as a serif; Inter holds its lines
  # apart on less.
  reviewProse:
    fontFamily: "Inter_400Regular"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "-0.15px"
  reviewExcerpt:
    fontFamily: "Inter_400Regular"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "21px"
    letterSpacing: "-0.15px"
  reviewYear:
    fontFamily: "Inter_300Light"
    fontSize: "15px"
    fontWeight: 300
    lineHeight: "20px"
    letterSpacing: "0px"
  reviewByline:
    fontFamily: "Inter_600SemiBold"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "18px"
    letterSpacing: "0px"
  reviewMeta:
    fontFamily: "Inter_500Medium"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "0px"
    lineHeight: "18px"
spacing:
  # STEP NAMES. `x16` is the page margin and is 15, SimpMusic's, not 16; every
  # other step equals its name. Read the value, never infer it from the name.
  #
  # SimpMusic's ladder, from its code: 4 between chips, 8 between a list's items,
  # 12 from a thumbnail to its text, 15 at the side of every page, 24 for a
  # setting's inset, 32 between sections, 48 at the foot of a scroll. The ladder
  # had been compressed twice (the margin was 10, a band's gap 40) to zoom the
  # chrome out; at the owner's direction it now takes the reference's numbers,
  # and the controls that were sized to the reference on the old ladder were
  # re-pointed so they kept their sizes.
  x4: "4px"
  x8: "8px"
  x12: "12px"
  x16: "15px"
  x20: "20px"
  x24: "24px"
  # Between one band of a page and the next.
  x32: "32px"
  x40: "40px"
  x48: "48px"
  # Under a form whose footer is pinned over it.
  x64: "64px"
rounded:
  # Two regimes: interface is large and soft; artwork keeps small corners.
  none: "0px"
  xs: "2px"
  sm: "3px"
  md: "5px"
  lg: "8px"
  # Chips, filters, tabs, search, badges, progress tracks, avatar rings.
  pill: "999px"
  # Role aliases. Every one drawn continuous (`borderCurve`), except the
  # protected case's, since the Apple pass (2026-11-04): covers 8, cards 16,
  # sheets 26.
  image: "8px"
  # Pressable controls that are not buttons — toggles, segments. Buttons are
  # full pills (`pill`); icon buttons are circles: size / 2, not a token.
  control: "20px"
  # Every card — and so every notice, selection card and menu row — has the
  # review card's corner since 2026-10-20 ("all the cards in the app with that
  # style of the review ones"). `cardLarge` (18) was deleted with that.
  card: "16px"
  # The review card's corner, measured off the owner's references
  # (2026-10-20): about 3% of the card's width in both. The same as `card`.
  review: "16px"
  # Every field — text, text area, select, search: the reference's 18. Squarer
  # than a button's full pill, so a field and its button read as two objects.
  input: "18px"
  # Bottom sheets (top corners), dialogs and menus.
  sheet: "26px"
  # Preserved — the game case keeps its own radii. See § 4.1. Do not fold these
  # into the scale above.
  caseImage: "12px"
  caseSpine: "3px"
motion:
  fast: "150ms"
  normal: "200ms"
  slow: "300ms"
  easing: "ease-out"
  pressScale: 0.98
elevation:
  # Controls do not cast: buttons, fields, chips and icon buttons are drawn by a
  # surface step and a 1px `border`. These tiers are for cards and overlays.
  none: "none"
  card: { opacity: 0.2, radius: 6, offsetY: 2, android: 2 }
  control: { opacity: 0.24, radius: 8, offsetY: 3, android: 3 }
  raised: { opacity: 0.3, radius: 12, offsetY: 5, android: 6 }
  overlay: { opacity: 0.38, radius: 16, offsetY: 8, android: 10 }
  # Ceiling — the depicted object (§ 4.1.7). Interface must never reach this.
  gameCase: { opacity: 0.45, radius: 18, offsetX: 6, offsetY: 12, android: 12 }
score:
  inline: 12
  medium: 17
  large: 25
  hero: 35
layout:
  maxContentWidth: "800px"
  # Resolves per platform in `constants/theme.ts` — 44 on iOS, 48 on Android.
  # This is the one place the two platforms diverge, and it is behavioural
  # rather than visual, which PRODUCT.md permits. Import `TapTarget`; never
  # hard-code either number in a component.
  tapTarget: "44px"
  tapTargetAndroid: "48px"
  # How tall a control is drawn, as distinct from how large it is to touch.
  # `small` reaches the tap floor through vertical slop, and wrapped rows of
  # small controls are spaced by exactly the two slops (`SmallControlRowGap`)
  # so their touch boxes tile rather than overlap.
  # The reference's: a button is 52 and a field 54.
  controlHeight: { small: "32px", medium: "52px", field: "54px", large: "60px" }
  posterAspectRatio: "2:3"
  heroAspectRatio: "16:9"
  heroHeightRatio: 0.38
components:
  card:
    # On a game's page, the game's `primaryContainer` at half brightness;
    # `surface` everywhere else, and there with game colours off.
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "15px"
    gap: "12px"
    # The review card's hairline, white at 7%. A control's edge is `outline`,
    # at 16% — more than twice as bright — so a card still is not a button.
    border: "1px {colors.border}"
    shadow: "{elevation.card}"
  card-elevated:
    backgroundColor: "{colors.surfaceElevated}"
  # Metadata — not pressable, so no edge.
  chip:
    backgroundColor: "{colors.surfaceSelected}"
    textColor: "{colors.textSecondary}"
    typography: "{typography.bodySmall}"
    rounded: "{rounded.pill}"
    height: "34px"
    padding: "0 14px"
    border: none
  chip-active:
    backgroundColor: "{colors.primaryMuted}"
    textColor: "{colors.primaryText}"
  # The app's one selected state (`useSelectable`), for every pressable control
  # with an on/off: sort and filter pills, selection cards, segments, toggles.
  # Choices are outlined at rest; actions are filled.
  selectable:
    backgroundColor: "transparent"
    border: "1px {colors.outline}"
    textColor: "{colors.textSecondary}"
  selectable-selected:
    backgroundColor: "accent wash"
    border: "1px accent edge"
    textColor: "{colors.text}"
  filter-pill:
    rounded: "{rounded.pill}"
    height: "{layout.controlHeight.small}"
    padding: "0 13px"
  # The reference's Server option, from its code.
  selection-card:
    rounded: "{rounded.card}"
    padding: "15px"
    gap: "13px"
    leading: "radio, 34px"
    title: "{typography.optionTitle}"
    hint: "{typography.bodySmall}, {colors.textSecondary}"
  radio:
    size: "34px (26px on a compact picker row)"
    border: "1px text at 22%"
    selected: "accent (legible) at 18% fill, accent check"
  # Every action: the reference's "Create room".
  button:
    backgroundColor: "{colors.controlFill}"
    pressedColor: "{colors.controlPressed}"
    textColor: "{colors.controlInk}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: "{layout.controlHeight.medium}"
    padding: "0 20px"
    border: none
    shadow: none
  button-primary:
    extends: button
    textColor: "{colors.text}"
  button-danger:
    extends: button
    textColor: "{colors.danger}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
  # The reference's disabled "Join room".
  button-disabled:
    backgroundColor: "transparent"
    border: "1px {colors.borderStrong}"
    textColor: "{colors.textMuted}"
  # The game page's review button only; its Material 3 treatment is preserved.
  button-vivid:
    backgroundColor: "accent, saturation lifted"
    textColor: "readable ink"
  button-small:
    height: "{layout.controlHeight.small}"
    padding: "0 13px"
  button-large:
    height: "{layout.controlHeight.large}"
  icon-button:
    backgroundColor: "{colors.controlFill}"
    rounded: "50%"
    size: "40px (32px small), touched at the tap floor"
    border: none
  focus-ring:
    outline: "3px accent ring, outside the control"
  # The reference's name field, from its code.
  input:
    backgroundColor: "{colors.input}"
    border: none
    borderFocused: "1.5px accent (legible)"
    borderError: "1.5px {colors.danger}"
    rounded: "{rounded.input}"
    height: "{layout.controlHeight.field}"
    padding: "0 15px"
    typography: "{typography.fieldText}"
    label: "{typography.fieldLabel}, above, 8px gap"
  textarea:
    extends: input
    minHeight: "120px"
  select:
    extends: input
    trailing: "chevron-down"
    menu: "{components.sheet}"
  search-bar:
    extends: input
    iconPosition: "leading"
  checkbox:
    size: "20px"
    rounded: "{rounded.md}"
    border: "1.5px {colors.borderStrong}"
    checked: "accent fill, accent ink check"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sheet} (top corners)"
    border: "hairline {colors.border}"
  tab:
    rounded: "{rounded.pill}"
    selectedBackground: "accent wash"
    selectedText: "accent"
    text: "{colors.textMuted}"
  # SimpMusic's bar: a capsule of tabs floating over the page.
  bottom-nav:
    backgroundColor: "none — the page shows around the capsule"
    capsuleColor: "{colors.surface}"
    indicatorColor: "{colors.surfaceSelected}"
    height: "64px"
    indicatorHeight: "56px"
    capsuleInset: "6px"
    maxTabWidth: "96px"
    padding: "4px 16px 8px"
    maxItems: 5
    selectedColor: "{colors.primaryText}"
    unselectedColor: "{colors.textMuted}"
  score:
    display: "bare numeral, verdict colour"
    fontWeight: "700"
    sizes: "inline 12 / medium 17 / large 25 / hero 35"
gameCase:
  templateSize: { width: 540, height: 680 }
  widths: { small: 108, medium: 168, large: 232 }
  perspective: 900
  # The case rests square. Rotation is motion now — the arrival landing and the
  # drag-to-turn — not a permanent skew across the artwork. See § 4.1.
  tilt: 0
  shadow:
    color: "#000000"
    opacity: 0.45
    radius: 18
    offset: { width: 6, height: 12 }
    elevation: 12
  gloss:
    - "rgba(255,255,255,0.20)"
    - "rgba(255,255,255,0.04)"
    - "rgba(255,255,255,0)"
  glossStart: { x: 0, y: 0 }
  glossEnd: { x: 0.9, y: 0.55 }
  # Nothing draws a spine — see § 4.1.5. `spineRadius`, `spineWidth` and
  # `spineTextColor` still exist in `constants/` so this block mirrors them, but
  # only `spineColor` is read, by the back face's branding band.
  spineRadius: 3
  platforms:
    ps5:
      coverArea: { x: 16, y: 58, width: 508, height: 606 }
      spineWidth: 26
      spineColor: "#0D47A1"
      spineTextColor: "#FFFFFF"
      accent: "#1565C0"
    ps4:
      coverArea: { x: 16, y: 52, width: 508, height: 612 }
      spineWidth: 26
      spineColor: "#0D47A1"
      spineTextColor: "#FFFFFF"
      accent: "#1565C0"
    xbox:
      coverArea: { x: 14, y: 62, width: 512, height: 604 }
      spineWidth: 24
      spineColor: "#107C10"
      spineTextColor: "#FFFFFF"
      accent: "#107C10"
    switch:
      coverArea: { x: 14, y: 46, width: 512, height: 620 }
      spineWidth: 22
      spineColor: "#E60012"
      spineTextColor: "#FFFFFF"
      accent: "#E60012"
  disc: { size: 512, artRadius: 248, hubRadius: 78 }
---

# Design System: GameLog

> **Implementation target:** React Native 0.86 / Expo SDK 57 / expo-router. There
> is no DOM, no Tailwind and no CSS-in-JS here — see § 26. Values below are
> **density-independent pixels**, applied through `StyleSheet.create` and read
> through `useTheme()`.
>
> **Tokens are normative; prose is context.** The YAML frontmatter above is the
> machine-readable layer consumed by `.impeccable/design.json` and the live
> panel. Where prose and the frontmatter disagree, the frontmatter wins and the
> prose is a bug.
>
> **The frontmatter mirrors the code.** Colour, type, radius, spacing, motion
> and the component geometry match `src/constants/theme.ts` and
> `src/components/ui/`. Some prose below predates a later pass and quotes older
> numbers; where it does, the frontmatter wins. § 9 is the current statement of
> how controls look and behave.
>
> **Preserved feature.** The **physical videogame case** is specified in
> **§ 4.1**. Its rules, dimensions, materials and placement constraints are
> normative and are not superseded by anything else in this document. Where a
> global rule would conflict with it — the shadow ban, the poster radius — § 4.1
> wins.

---

## The Apple pass (2026-11-04) — read this first

After a whole-app critique against Apple Music and Apple TV on iOS 26, the
owner ruled that **Apple's pattern wins over older rulings in this file**,
with five exceptions that stay: lists of games in pages of ten, the bouncy
Settings accordion, the mascot loader, covers on rows with nothing printed
under them, and Liquid glass off by default. Where a section below
disagrees with this one, this one is current. What changed in the
foundations (the frontmatter above is updated to match):

- **The room is true black.** `background` `#000000`, cards `#1C1C1E`
  (iOS's `secondarySystemBackground`), then `#28282A` and `#333336` — the
  ladder still only climbs, and `textMuted` still clears AA on a control.
  § 1.1's "never true black" is reversed.
- **Inter at Apple's sizes.** Large title 34, Title 1 28, Title 2 22 (every
  section heading), Title 3 20, Headline 17 semibold, Subheadline 15, body
  15, Footnote 13, caption 12. Row titles are medium, not bold. The game case is set
  in Inter too; the app's family is `Typeface`.
- **No small capitals in content.** `label` is a sentence-case footnote;
  `badge` (10, uppercase, tracked) is for words printed over artwork.
- **The prominent capsule.** `<Button variant="primary">` (the default) is
  filled with the accent in force — white on the house pages, the game's
  primary on a game's — and disabled is the same shape at 35%. "Every action
  is the same grey pill" (§ 9) is reversed; `secondary` is the grey capsule.
- **Apple's alert.** `showAlert` is a centred 300-wide card, 30 round, its
  title and message centred, full-width capsule buttons side by side for two
  and stacked for more.
- **One section heading**: `h2` with a chevron straight after the words when
  the heading leads somewhere — on every page, the profile's widgets
  included. SimpMusic's 16pt heading with a far-end "More" is gone.
- **Empty and error states** are `ContentUnavailableView`: a 52pt symbol, a
  Title 2 heading, one line, one button.
- **Corners**: covers 8, cards 16, sheets 26, drawn continuous — except the
  protected case's.
- **In-page tabs**: the masked pill is white at 22% with white words, not a
  solid white block.

**The Overview's order is fixed**: Information and Details stay near the
top, after the trailers and screenshots — never moved to the foot, Apple TV's
order notwithstanding (the owner, 2026-11-04).

Then, the same day — the forms layer and the chrome: an iOS **switch**
(`ui/switch`), **grouped rows** (`ui/inset-group`: a 26-round `surface`
group, inset hairlines, tinted glyph tiles, a footer for the explanation),
**choices as checklist rows** (a trailing checkmark, no radio, no outline),
**a modal's commit as the ✓ in its bar** (`confirm`, `useBarConfirm`), a
**52dp bar row with every title centred** at 17 semibold, the back key a
filled disc on every page, and tab labels at 10 medium.

Still to come: large titles that collapse into the bar on every root page,
the log form's status as a pull-down, then the community and utility pages.

## 0. Design Language Summary

**A premium gaming social platform, built for long sessions.**

The people who use this app spend hours browsing games, reviews, collections and
profiles. Everything here follows from that: the interface has to be calm enough
to sit in for an hour, dense enough to be worth scrolling, and readable enough
that none of it is work.

Quality comes from spacing, typography, consistency, hierarchy and proportion —
never from effects. No neumorphism, no skeuomorphism, no gradients as decoration.
If something looks expensive here it is because the spacing is right, not because
it is doing a trick.

**Two sanctioned exceptions, both structural rather than decorative**, and both
defined in the frontmatter, which is normative where this prose disagrees:

- **The ambient light** (`glowCore`). A gradient, never an image, and never
  behind content it would compete with — see § 25's rule on `<Ambience>`.
  Home's `<AmbientLight>` is a very large, very soft field in the top-left
  corner — where an earlier, far stronger corner glow sat — lighting the left of
  the screen and falling off before it reaches the right. 1.12:1 against the
  page at its brightest, so it can stay fixed while the page scrolls through it
  without dragging any text below AA. The earlier glow was a `<SoftGlow>` that
  faded out on scroll; it read as a lit corner rather than as light.
- **The frosted bar.** `<FrostedTopBar>` is clear until the page moves under
  it; then it is blur plus a wash of the page's own colour — 30%, or 85% where
  the colour is artwork's — and no fill of its own. It is a layer, not a
  surface: it has nothing to show and exists to soften what the page put behind
  it. § 7.

**Key characteristics:**

- Dark only, and never true black. `#0B0A0D` is the floor — a near-black with
  a faint cool trace, darker than the blue-grey it replaced.
- Depth is a *surface step*, not a shadow: background → surface → elevated.
  **Actions are filled** (a translucent grey pill) and **choices are outlined**
  (an edge, no fill, until chosen).
- One accent — **PlayStation blue** `#0070CC`, with `#2E93E8` for type — on
  selected nav, primary actions, selected and focused controls, and links. It
  is an accent, not a theme: most of any screen is black, near-black, grey and
  white.
- A game's own screens keep their **Material 3** palette, read from the box art;
  the accent in force there is the game's colour, not the house blue.
- Medium-high density, achieved with chips and spacing, never by shrinking text.
- **Two radius regimes.** Interface is large and soft — controls at 20, fields
  at 18, cards at 12, sheets at 24, a pill for anything that filters or tags, a
  circle for a glyph on its own. Artwork keeps its small, square-ish corners.

**The control language is a premium music player's — specifically the owner's
reference, SimpMusic, read from its source.** Grey pills for actions, soft wells
for fields, outlined cards with a leading circle for choices, the accent only
where something is selected, focused or primary, and next to no shadow. See § 9.

The deliberate exception to all this restraint is the system's **depicted
physical object** — the thing drawn as an object rather than as interface, and
the only element allowed to cast, gloss and turn: the **physical game case**
(§ 4.1), the app's signature object. Surprise Me's dealt card was a second one,
a card off a deck, until the owner had it made a plain slide (§ 4.2).

---

# 1. Colour

## 1.1 The room

Six steps on one faint cool trace, and each one has a job.

- **Background** `#0B0A0D` — the page. Never `#000`: true black smears on OLED
  during scroll and removes the contrast the whole depth model is built on. It
  replaced the cool `#14171b` at the owner's request — darker, not bluer, not
  black.
- **Surface** `#141317` — cards and the bottom bar. 1.068:1 against the page.
- **Surface elevated** `#1B1A20` — a block inside a card, a thumbnail well.
- **Surface selected** `#24222A` — the chip fill, and a control while pressed.
- **Input** `rgba(255,255,255,0.06)` — every field's well, #0F0F0F on black:
  the reference's name field. No border; the fill alone draws it.
- **Control fill** `rgba(255,255,255,0.094)` — every action button and icon key,
  #181818 on black: the reference's "Create room". A step lighter than a field,
  so an action and the field it acts on are two objects. Its label is
  `controlInk` `#D6D6D6`.
- **Outline** `rgba(255,255,255,0.16)` — the resting edge of a choice.
- **Hover** `rgba(255,255,255,0.04)` / **Pressed** `rgba(255,255,255,0.07)` —
  layered *over* a surface, never replacing it.
- **Border** `rgba(255,255,255,0.07)` — dividers, and the 1px edge every resting
  control carries. `borderStrong` `rgba(255,255,255,0.12)` is the strong edge.

## 1.2 The accent

**PlayStation blue** `#0070CC`, and there is only one per screen. (Lavender was
tried for one pass of the control migration; the owner took it back to blue.)

It appears on: selected navigation, the primary button, selected and focused
controls, badges, and links. The rule is absolute because the accent only
directs attention while it is rare — a screen with six blue things has no
primary action, it has six. **Most of any screen stays black, near-black, grey
and white.**

**Fills only.** At 3.94:1 on the page it is below AA for text — right under
white on a filled button (5.01:1), wrong for a word. Blue *type* uses
`primaryText` `#2E93E8` (6.07:1 on the page, 5.31 on `surfaceElevated`).

Every state is derived from whichever accent is in force (`accentRoles`). On the
house accent they are built from `primaryText`, not from the fill: `wash` (16%)
is the selected fill, `edge` (55%) the selected or focused edge, `ring` (30%)
the keyboard focus ring. A 14% wash of the *fill* blue over near-black lands
darker than a resting control, and a selected pill would look dimmer than its
neighbours. `pressed` is the primary fill 14% deeper (`#0060AF`, 6.38:1 under
white). On a game's screens the same roles come from the game's Material 3
palette — so a selected sort pill is blue on the Search tab and the game's own
colour on its reviews sheet.

`accent` is an alias of `primary`.

## 1.3 Text

`#F5F5F5` primary, `#A8A8A8` secondary, `#8F8F8F` muted. Three neutral steps —
they did not take the room's cool trace, because the protected game case's printed
back is set in them — and hierarchy within a block is expressed by moving
between them before it is expressed by changing size. Inside a *selected*
control, muted steps up to secondary: it is 4.32:1 on the accent's wash.

## 1.4 Colour usage

| Token              | Value                    | Usage                                        |
| ------------------ | ------------------------ | -------------------------------------------- |
| `background`       | `#0B0A0D`                | The page                                     |
| `surface`          | `#141317`                | Cards, tab bar, sheets                        |
| `surfaceElevated`  | `#1B1A20`                | Nested block, every control's resting fill    |
| `surfaceSelected`  | `#24222A`                | Chips, a control while pressed                |
| `input`            | `rgba(255,255,255,.06)`  | Every field's well                            |
| `controlFill`      | `rgba(255,255,255,.094)` | Every action button and icon key              |
| `controlInk`       | `#D6D6D6`                | The label on an action button                 |
| `outline`          | `rgba(255,255,255,.16)`  | A choice's resting edge                       |
| `text`             | `#F5F5F5`                | Titles, headings, primary copy                |
| `textSecondary`    | `#A8A8A8`                | Supporting copy                               |
| `textMuted`        | `#8F8F8F`                | Metadata, timestamps, counts                  |
| `primary`          | `#0070CC`                | Primary fill, badges — never type             |
| `primaryText`      | `#2E93E8`                | Links, selected nav, the accent as type       |
| `primaryMuted`     | `rgba(46,147,232,.16)`   | Active chip / badge fill, the house wash      |
| `border`           | `rgba(255,255,255,.07)`  | Dividers, every control's 1px edge            |
| `borderStrong`     | `rgba(255,255,255,.12)`  | Strong edge, unchecked box and radio rings    |
| `scrim`            | `rgba(0,0,0,.6)`         | Overlay on hero artwork                       |
| `platinum`         | `#A9B6CC`                | Platinum trophy marker                        |
| `mustPlay`         | `#43D98C`                | The Must Play badge's disc (= `identityJade`) |
| `logoPlate`        | `#F5F5F5`                | The plate under a logo that could not be measured |

## 1.5 Colour that carries meaning

Score is **data rather than chrome**, and it has one ramp: `scoreHigh`
`#4ADE80`, `scoreMid` `#F5A524`, `scoreLow` `#F35555`, returned by
`scoreColor()` in `constants/score.ts`. A score has to read as good, mixed or bad
before the digits are parsed, and the accent must never be one of the three — a
blue 55 would look endorsed. `danger` `#F35555` is also destructive actions;
`success` `#4ADE80` a positive result.

### The tier ramp

`tierS` `#FF7B7B` · `tierA` `#FFB068` · `tierB` `#FFD86B` · `tierC` `#B6E07A` ·
`tierD` `#7ACBE0` · `tierF` `#B0A6E0`

Six hues for the tier-list rows, and they take the same exemption as the score
ramp: a tier list is **a chart of the user's own judgement**, and six rows that
are all grey is not a tier list. The ramp runs warm-to-cool so the ordering reads
before the letters do.

They appear on a row's header fill and nowhere else — never on a control, a
button or a piece of chrome, and never as a text colour on a dark surface (they
are tuned as backgrounds for near-black type).

### Ink

`shadowInk` `#000000`. Pure black, and the palette's only one.

It is **not a surface** — `#0B0A0D` remains the floor and nothing is ever filled
with `shadowInk`. It exists solely as the far stop of a gradient ramp over
artwork, where a fade has to reach true black to sit under a photograph. `scrim`
`rgba(0,0,0,0.6)` is the flat overlay; `shadowInk` is the gradient ink. Fade it
with `withAlpha(shadowInk, 0)`, never the keyword `'transparent'`.

### Named rules

**The One Accent Rule.** Blue means "this, here, now" — selected, focused,
or the thing to press. If it is decorating something that is none of those, it
is wrong.

**The Borrowed Colour Rule.** Every other hue on screen belongs to a game's
artwork or to data (score, status, rarity, tier). The interface supplies
near-black, grey, white and one blue; the covers supply the rest.

> **Case exception.** The per-platform case colours in § 4.1 (`#0D47A1`,
> `#107C10`, `#E60012`) are **not** UI accents and are exempt from the One Accent
> Rule. They are properties of a depicted physical object, the way a real PS5
> case is blue. They never appear on a control, a fill or a piece of chrome.

---

# 2. Typography

**Inter**, in four weights, and nothing else.

**Weight is a family, not a number.** React Native on Android will not
synthesise a bold from a custom font — `fontFamily: 'Inter_400Regular'` with
`fontWeight: '700'` silently renders regular, on one platform only. Every weight
is a separately loaded family (`FontFamily.regular` / `.medium` / `.semibold` /
`.bold`) and **nothing in the app sets `fontWeight` on text**.

Typography goes through `<Text variant="…">` from `components/ui/text`, never a
raw `<Text>`.

## 2.1 The scale

| Variant     | Size / line height | Weight | Tracking  | Used for                                    |
| ----------- | ------------------ | -----: | --------- | ------------------------------------------- |
| `display`   | 32 / 38            |    700 | -0.02em   | The app name on Home, a review's own title   |
| `h1`        | 28 / 34            |    700 | -0.015em  | Page titles. A game's name on its page       |
| `h2`        | 22 / 28            |    700 | -0.01em   | Major section headings                       |
| `h3`        | 18 / 24            |    700 | 0         | Card titles, a review's headline in a feed   |
| `h4`        | 16 / 22            |    700 | 0         | Sub-headings, a developer name               |
| `h5`        | 14 / 20            |    700 | 0         | A row's title, a username                    |
| `h6`        | 12 / 16            |    700 | 0.02em    | Smallest emphatic label                      |
| `body`      | 15 / 22            |    400 | 0         | UI copy. Synopses, descriptions, form text   |
| `prose`     | 17 / 28            |    400 | 0         | Long-form reading: an article or review body |
| `bodySmall` | 13 / 18            |    400 | 0         | Secondary copy                               |
| `caption`   | 11 / 15            |    400 | 0.02em    | Metadata, timestamps, counts                 |
| `label`     | 11 / 14            |    500 | 0.08em    | Uppercase section labels                     |
| `button`    | 14 / 20            |    600 | 0         | Every button label                           |

Tight tracking on the large steps and open tracking on the small ones is what
keeps a 32px title and an 11px label reading as the same system.

**`prose` is not `body`.** `body` is interface copy — it sits next to controls
and inside cards, where being compact is part of being legible. `prose` is for
the two screens someone actually *reads*: an article and a review. A paragraph
somebody wrote about a game deserves a longer measure and a looser leading than a
form label does, and squeezing it onto the UI step to save a token makes the app
worse at the one thing it exists for.

## 2.2 Observed hierarchy

```text
Page title       24–28 / bold
Section heading  11–13 / muted / uppercase
Game title       14–18 / semibold-bold
Metadata         12–14 / muted
Body copy        14–16
Navigation       12–14
```

The most important visual distinction is **weight + colour**, not large
font-size jumps.

### Named rules

**Hierarchy by weight and colour.** 400 carries prose, 500 the uppercase labels,
600 button text, 700 everything structural. To make something matter, move it up
a step or change its colour before reaching for anything else.

**Density is deliberate.** Medium-high density is the target, reached with chips,
spacing and alignment. The 11px caption and label steps exist for genuine
metadata — timestamps, counts, section labels — and are not a licence to shrink
reading copy to make a layout fit.

## 2.3 Case type — **PRESERVED**

The game case does **not** take the scale above. Two steps are pinned to the
values they rendered at before this scale was adopted, so the case's appearance
is unchanged:

| Variant       | Size / line height | Weight | Used for                              |
| ------------- | ------------------ | -----: | ------------------------------------- |
| `caseTitle`   | 24 / 30            |    700 | The lettered placeholder in the window |
| `caseEdition` | 12 / 16            |    500 | The "COLLECTOR'S EDITION" badge strip  |

These exist for the same reason as `caseImage` and `caseSpine` in § 5.3: they are
properties of a depicted physical object, not steps in a document hierarchy. Do
not use them anywhere else, and do not "tidy" them onto `h1`/`h6` — `h1` would
grow the placeholder letter by 4px, and `h6`'s bold weight widens the uppercase
badge enough to truncate it on the 108dp case.

> **There is no spine typography.** The case drew a generated spine slab for a
> while — a rectangle in `spineColor` carrying the game's title rotated
> bottom-to-top plus the platform's short name — and it was removed. It put
> hand-drawn app type, in a different face and a different colour, flush against
> a template PNG that is already finished artwork; the object read as a case
> with something stuck to its edge. The template is the whole object.

## 2.4 The reference's rhythm — bold for figures, quiet for everything else

Taken from the owner's reference, SimpMusic's Analytics screen
(`AnalyticsScreen.kt`), and applied where this app has the same kind of page —
the studio page, the game page's stats and cards, the collection rows.

- **Bold is for titles and figures only.** Everything that explains them is
  regular, a step smaller and quieter. The reference sets its page title at 25
  bold, its section headers and values at 16 bold, and every label, caption and
  secondary line at 11–13 regular in a muted grey.
- **A fact is a quiet label over a bold value** ("Total listened time" /
  **2 h 19 min**), or a bold figure over a quiet line (**53** / "Songs played").
  Label and value sit 2–4dp apart and read as one object.
- **Sentence case, no tracking.** No uppercase micro-labels on a stat strip, a
  masthead fact or a notice: "To beat", "Collections", "Planned release",
  "Lowest". Acronyms stay acronyms (PEGI, ESRB, IGDB).
- **Rows and cards title themselves in `itemTitle`** (13 semibold) with a
  `bodySmall` line under them — a game in a collection, a collection in a list,
  a search result.
- **Sections breathe.** ~32dp between sections, ~16dp from a heading to what it
  heads (`<HomeSection>`: `x12`, as cards stack), ~15dp inside a card. The game page's sections
  are measured from the reference's artist page instead (§ 14).
- **A header over artwork** puts the title first, then a row: the subject on the
  left (a bold figure over a quiet line) and one measurement on the right,
  right-aligned (label over value). The studio page is the worked example: its
  name, then "*N* games" over its years, and "Average rating" over the score.
- **The accent is not a number's colour.** The reference tints its secondary
  figures ("13 min", "+15%") in its seed colour; here a *score* keeps its own
  ramp (`scoreColor`), because a blue 55 reads as endorsed.

The side margin is the reference's **15**, the one SimpMusic's Home, Library and
every row of it use (its Analytics screen's 24 is that screen's own). It was 10
while the interface was zoomed out, and it moved on every screen at once —
widening one would misalign it with its own rails.

---

# 3. Spacing & Layout

## 3.1 The ladder

**SimpMusic's spacing**, read from its code, on Material's 4dp grid. The ladder
is fixed — 4, 8, 12, 15, 20, 24, 32, 40, 48, 64 — and a gap that is not on it is
a bug rather than a decision. `Spacing.x16` is the one step that is not its own
name: it is the page margin, and the reference's margin is 15.

- Outer page padding: **15** (`x16`)
- Card padding: **15** (`x16`)
- Between sections and between Home's bands: **32** (`x32`), against 15 from a
  heading to its content. The interval separating bands has to be unmistakably
  bigger than any interval inside one.
- Scroll tails end in **48**

**One sanctioned exception: the hairline gap.** A `gap` of `1` or `2` between a
label and the value directly beneath it — a stat cell, a byline, a track row — is
allowed and is not a ladder violation. Those pairs are one object read as one
unit, and promoting them to `4` visibly loosens the dense rows the chip system
exists to keep tight. The exception covers `gap` and sub-4px `padding` inside a
badge or pill only. It is not a licence to invent a 6 or a 10 anywhere else.

## 3.2 Structure

Phone-first, single column, with a centred `MaxContentWidth` (800) cap so a
tablet or `react-native-web` stays readable without becoming a desktop layout.

```text
Screen
│
├── Floating transparent header + <HeaderBackdrop />
│
├── ScrollView
│   ├── section            (24 between)
│   ├── poster rail        (horizontal FlatList)
│   └── poster grid
│
└── Bottom tab bar: 4 + 64 capsule + 8
```

**Heroes bleed.** A screen that opens on artwork — a game, a collection, a
review, the Top 10 — cancels its container's horizontal padding so the image
reaches both edges and runs under the transparent header.

## 3.3 Rails and grids

**A row of games is covers under a heading on the page.** It is the shape of
every row of games in the app — Home, Search, a studio, a game's franchise and
editions (`<HomeSection>` or `<Section>` over a `<GameCoverRail>`;
`constants/cover-rail`, under `npm test`).

```text
Popular this month                        ›   one line, `h4`; a chevron if it leads on
▯▯▯▯▯▯   ▯▯▯▯▯▯   ▯▯▯                         120×180, 20 apart, 2½ in view (360dp)

        32 to the next section
```

| | On a 360dp phone | Rule |
| --- | --- | --- |
| Cover | 120 × 180 | a third of the display wide, 2:3 — the album height of SimpMusic's artist page |
| Between covers | 20 | |
| In view | ≈ 2½ | from the page's margin, running off the far edge |
| Heading to covers | 12 | |
| Between sections | 32 | |

- **The size is the old one, and it stays.** For one build the covers were
  82×123 — Letterboxd's poster to scale, nearly four in view. The owner saw
  them on a phone: "They are too tiny."
- **Nothing is printed under a cover.** The box is the label; the title is the
  cover's spoken label. A row prints one line only for what the box cannot say:
  a chart's rank, a release date, GameLog's score, a face with a name and a
  score. Those lines are `textSecondary` — Home's light passes under them.
- **No subtitle, no "See all".** A heading that leads somewhere is the link, the
  whole line, and ends in a quiet chevron. One small control may take the
  chevron's place.
- **Never in a card.** The owner's reference for these sections (Letterboxd's
  home) draws each in a rounded panel and the first build copied it; the owner
  saw it on a phone and had the cards removed — "leave the game's rails on
  their own". On a game's page too.

A rail of *wide* art — screenshots, the critics' quotes in the reviews sheet —
is the same thing at the reference's video height (`<ArtRail>`).

A grid is a `FlatList` with `numColumns`, sized from `useWindowDimensions()`.
There are no media queries in React Native. Three across, with one exception:

| | Columns | Gap | A cover on a 360dp phone | Where |
| --- | --- | --- | --- | --- |
| Every grid of games | 3 (`PORTRAIT_COLUMNS`) | 12 (a studio's is 8) | 102×153 | the inside of a collection, a studio, Must Play, an event, a month of the calendar, Search's results |
| Somebody's **library** | 4 (`SHELF_COLUMNS`) | 8 (`SHELF_GAP`) | 76×114 | the library screen, and nowhere else |

The library is somebody's own games, and how many are in view matters more
there than how large each is. The owner's reference for it is a Letterboxd films
tab, measured from a screen drawn 202 pixels wide: posters 40 across, 5 apart,
one quiet line under each. That line is the person's score (in the score's own
colour), else their status, else Steam's playtime; the game's name is not
printed — the box prints it — and is the tile's spoken label.

**A collection's grid has been ruled on five times and is three.** Three, four,
three ("a thumbnail of the box"), four when the library's layout was asked for
"the same for the collection screen inside", and — once the owner had seen that
on a phone — three, with four kept for the library. The two are not meant to
match.

---

# 4. Poster Geometry

Movie and box artwork uses the standard **2:3 portrait ratio**, exported as
`PosterAspectRatio`.

```ts
aspectRatio: PosterAspectRatio,   // 2 / 3
```

Never stretched; always the true aspect ratio, cropped rather than distorted.
`<Poster />` falls back to `heroUrl` when a game has no cover, which is why chart
queries filter on `cover != null` rather than rendering placeholders.

Landscape key art uses `HeroAspectRatio` (16:9), and a full-bleed hero fills
`HeroHeightRatio` (0.38) of the display — see § 13.

Do **not** force a fixed pixel size on a poster. Set the aspect ratio and let the
rail or grid determine width.

## 4.0.1 The cover's edge — removed

**A portrait cover wears no outline.** For a while every one wore a hairline of
cool white inside its corner (`coverEdge`, `#DDEEFF` at 35%, from the owner's
Letterboxd reference); the owner had it removed (2026-10-14), and the token with
it. The corner is still `Radius.image`, 4. Do not draw an edge over a cover or
round a `<Poster>` again.

## 4.0.2 The cover stack

**A collection is shown as five covers overlapping, the first one whole and in
front, across the inside of a card** — wherever collections are listed
(`<CoverStack>`), and nowhere else: a profile's library drew it for a while
and is four separate covers now (§ 18.1). The owner's reference is old
Letterboxd's "New from friends" tile, and every figure of the overlap is read
off it, where a poster is 72 pixels wide:

```text
┌────┬────┬────────┬────┬────┐     five covers, the same size and level
│ 4  │ 2  │   1    │ 3  │ 5  │     1 in front, 2 and 3 behind it, 4 and 5 behind those
│    │    │        │    │    │     each steps 40/72 of a cover from the one in front
└────┴────┴────────┴────┴────┘     the stack is 232/72 covers wide: 3.22
```

| | Reference | Here |
| --- | --- | --- |
| Step | 40px of a 72px poster — 44% covered | `STACK_STEP`, 0.556 |
| Width | 232px, 3.22 posters | the row it is given, exactly — the inside of its card |
| On a 360dp phone | — | covers 93×140 in a collection's card; 94×141 in the profile's box |
| Shadow of a cover on the one behind | ~6px, soft | a drawn strip, 8% of a cover, to 42% black |
| Each cover | its own corner, no outline | `<Poster>`: `Radius.image` |

- **The first cover represents the thing** — a collection's chosen cover, a
  library's newest game — and is the one drawn whole. The rest alternate left
  and right, outward.
- **Five covers span the row exactly**, so in a card the stack stands on the
  margins of the text above and below it: the first cover's left edge under the
  title's, the last one's right edge under whatever ends the title's line. For
  one pass a full stack took seven-eighths of its row, centred, to be "a little
  bit smaller"; it lined up with nothing, and the owner had it brought back to
  the margins. The card's inset is all the smaller it gets.
- **A cover is the size it is in a full stack.** Fewer than five are built from
  the first cover outward, and **a short stack stands in the middle of its
  row**: the air either side is the same, to the dp. They stood at the left edge
  once, and a collection of three left a third of the row empty. No empty places
  are drawn; none at all is one lettered placeholder, in the middle.
- **The shadow is a gradient, not an elevation**, and it is drawn by the cover
  in front, outside its own edge. Five level covers have no "below" for an
  elevation to fall on, and Android paints a view's children in order of
  elevation — a strip laid on the cover behind would be painted under it.
- It is never a rail or a grid of games: those are covers side by side
  (§ 3.3). The stack says *a shelf, with something pulled forward*.

**A collection is this stack in a card where it is listed, and one cover on its
own screen.** The owner's second reference for it is a list drawn as a panel —
its name top left, "32 Films" top right, its posters under them — with the
direction to put "everything inside the card":

```text
┌────────────────────────────────────────┐   the review card's own card:
│ 🏆 Horror I finished at 3am   12 games │   surface, 12 corner, 15 in, the card
│                                        │   shadow, a hairline edge
│ ▮▮▮▮▮▮▮[ ▮▮▮▮▮▮▮▮▮ ]▮▮▮▮▮▮▮           │   the stack, margin to margin
│                                        │
│ Two lines of the owner's own argument… │   the description, if there is one
│ (◯) ada                                │   who made it
└────────────────────────────────────────┘
```

| | Reference (card 222px wide) | Here |
| --- | --- | --- |
| The card | a flat slate panel | `<LogCard>`'s own: `surface`, `Radius.review`, a hairline edge, the card shadow |
| First line | name left, count right | `h5` with its kind's glyph, the count in `bodySmall` / `textMuted` on its baseline |
| Inset | 7px | `Spacing.x16`, the review card's |
| Posters | from one inset to the other | five covers from one inset to the other |
| Title to covers | 9px | 12 |
| Between cards | 7px | 12, as review cards stack |

**It is the review card, by the owner's direction** ("the same card as the
review card in the home page"). It was the app's `<Card>` for one pass —
`surface`, a step above the page, a 16 corner — beside reviews that sit a shade
*below* the page with an 8 corner, and the two in one feed were different
objects.

One to a row, with no likes or comments on it (`<ListTile>`). The count moved
from the end of the byline to the title's line, where the reference has it; the
byline is the owner alone. The collection's own header is one game's art, the
same game the stack has in front. **There is no mosaic**: the 2×2 picture of a
collection's first four covers, and the owner's choice between it and one cover,
were removed from the app at the owner's direction.

---

# 4.1 Physical Game Case — **PRESERVED FEATURE**

> Carried over **verbatim in intent and value** from the previous design system
> and from the live implementation in
> [`src/components/game-case.tsx`](src/components/game-case.tsx) and
> [`src/constants/platform-cases.ts`](src/constants/platform-cases.ts).
> **Do not alter its logic or visual definition.** No rule elsewhere in this
> document overrides it.

The **physical case** is the app's signature object and the one thing allowed to
look expensive. It is a game rendered as a boxed copy you could have taken off a
shelf.

## 4.1.1 The Object Rule

**If it depicts a physical object, it may cast a shadow. If it is interface, it
may not.** There is no third case, and "this card feels flat" is not one — that
is what the surface step is for.

The only shadow tokens in the system that describe a real cast belong to the one
thing that genuinely casts: the **game case**, and the poster/disc it derives
from. Everything else uses the surface-step model in § 6.

## 4.1.2 Placement — where the case may appear

The case appears on:

* A game's own page — the Platforms section of its Overview tab (§ 14.1).
  The masthead shows the plain cover.
* The log form.
* A review masthead.
* Future collection / shelf screens.

It appears **nowhere else**. It must **never** appear in a feed, a review card, a
search result, a notification, a comment, a list tile, or any other social or
list context — those all use `<Poster />` or `<GameListItem />`.

The rule is intentional: social surfaces stay fast and flat; the case is what
makes opening a game page feel like picking something off a shelf. Diluting it
everywhere destroys that.

## 4.1.3 Platform eligibility — console only

```ts
type CasePlatformKey =
  | 'ps5' | 'ps4' | 'ps3' | 'ps2'
  | 'xbox' | 'xbox360'
  | 'switch2' | 'switch' | 'wiiu' | 'wii' | 'gamecube'
  | 'threeds' | 'gba' | 'gameboy' | 'snes' | 'nes'
  | 'atari2600';
```

Console only, and that is the whole rule: a boxed copy is a real object you could
have put on a shelf. PC has been digital-first for a decade and mobile never had
a box at all, so rendering one there is a prop, not a memory — those platforms
show the bare cover art instead.

A console has a case once its artwork is in `assets/cases/`. The ones still
without — PS1, PSP, Vita, the original Xbox, N64, DS, Game Boy Color, Sega's —
show the bare cover; nothing is ever drawn in another console's box. That is why
the Atari 2600 is its own platform, apart from the rest of the Atari family: the
template is the 2600's, and a Jaguar game does not belong in it. `xbox` (Series
X|S, One and cloud together) wears the Xbox One box, there being no Series
template.

## 4.1.4 Dimensions

**The boxes are not one shape.** Each template carries its own `templateSize` —
the real pixel dimensions of its PNG — and is drawn at those proportions: a
modern keep case about 1.25–1.43× as tall as it is wide, a Switch 2 case 1.62×,
a 3DS or Game Boy box nearly square, a SNES box and a GBA cartridge on their
side at ~0.6×. The standard keep case is the nominal size, for a caller that
wants "a case" and no particular game's:

```ts
CASE_TEMPLATE_SIZE = { width: 540, height: 680 }
```

Rendered width of the case face, in dp:

```ts
WIDTHS = { small: 108, medium: 168, large: 232 }
```

Height is always derived, never authored:

```ts
caseHeightFor(width, platform) = (width / templateSize.width) * templateSize.height
caseHeightFor(width)           = (width / 540) * 680      // the nominal case
```

Anything that reserves space for a case — the flip wrapper, both back faces, the
copy showcase, the Platforms section's slot — asks with the platform. Asking
without one for a real case is the bug that put a poster on top of the controls
under it.

A caller that knows the viewport passes a **measured width** instead of a named
size. The three named sizes are fixed dp, which on a 320pt phone made the large
case 73% of the screen width while the hero above it scaled freely — two elements
in the same composition disagreeing about how big the screen is.

All internal offsets derive from a single scale factor:

```ts
scale = renderedWidth / templateSize.width
```

## 4.1.5 Per-platform template geometry & materials

`coverArea` is the transparent window in the template PNG, in template pixels —
**measured from the file**: the bounding box of its largest transparent region,
widened 2px wherever there is chrome for the cover to slide under. A window need
not be a rectangle (the NES box's is slanted, the GBA cartridge's rounded); the
cover is drawn beneath and the template's own pixels do the cutting.

| Platform    | File                      | templateSize | coverArea (x, y, w, h) | spineColor |
| ----------- | ------------------------- | ------------ | ---------------------- | ---------- |
| `ps5`       | `ps5_case.png`            | 549×688      | 0, 78, 549, 610        | `#0D47A1`  |
| `ps4`       | `ps4_case.png`            | 485×678      | 0, 0, 485, 678         | `#0D47A1`  |
| `ps3`       | `ps3_case.png`            | 573×660      | 0, 56, 573, 604        | `#2A2A2E`  |
| `ps2`       | `ps2_case.png`            | 394×562      | 0, 63, 385, 490        | `#00308F`  |
| `xbox`      | `xone_case.png`           | 516×730      | 0, 88, 516, 642        | `#107C10`  |
| `xbox360`   | `xbox_case.png`           | 610×870      | 0, 104, 610, 766       | `#107C10`  |
| `switch2`   | `switch2_case.png`        | 392×636      | 0, 11, 375, 614        | `#E60012`  |
| `switch`    | `switch_case.png`         | 540×680      | 14, 46, 512, 620       | `#E60012`  |
| `wiiu`      | `wiiu_case.png`           | 523×732      | 0, 0, 509, 732         | `#007FAE`  |
| `wii`       | `wii_case.png`            | 513×731      | 0, 21, 513, 710        | `#6E7176`  |
| `gamecube`  | `gamecube_case.png`       | 517×732      | 0, 45, 517, 687        | `#4B4391`  |
| `threeds`   | `3ds_case.png`            | 572×523      | 2, 13, 497, 496        | `#CE181E`  |
| `gba`       | `gameboyadvance_case.png` | 640×375      | 93, 87, 458, 235       | `#3F3A96`  |
| `gameboy`   | `gameboy_case.png`        | 631×621      | 123, 0, 508, 621       | `#2B3287`  |
| `snes`      | `snes_case.png`           | 822×507      | 88, 0, 665, 414        | `#C8102E`  |
| `nes`       | `nes_case.png`            | 467×639      | 46, 44, 376, 321       | `#C4161C`  |
| `atari2600` | `atari2600_case.png`      | 529×697      | 36, 323, 463, 336      | `#D40000`  |

`xbox_case.png` is the Xbox 360's artwork despite its name, and was the `xbox`
entry's file until the Xbox One template arrived. The PS4 window is the whole
face: its shell is translucent blue plastic and the cover shows through to the
edge. `spineColor` is always deep enough for the back's white type — the Wii's
own band is white, so it takes its logo's grey.

**The back follows the front's shape.** It is laid out for a keep case; a
near-square face (3DS, Game Boy) drops the review blurb, and a face on its side
(SNES, GBA) sets the status and the score side by side and drops the played-on
line. The copy's back prints a one-line title and as many whole rows as fit.

**`spineColor` no longer paints a spine.** Nothing draws one. The field survives
because `<GameCaseBack>` uses it for the branding band across the head of the
back face, which is printing on a face and matches the strip the front template
already carries. `spineWidth`, `spineLabel` and `spineTextColor` remain in
`constants/platform-cases.ts` and are read by nothing; they are kept rather than
deleted so a future template that genuinely depicts an edge has its measurements
to hand.

**Template contract.** A template is a PNG of the case's front face: opaque
chrome (border, top band, branding) with the cover window punched out as
transparent pixels. Artwork is drawn *beneath* the template and shows through
that window, which is why `coverArea` is never hardcoded in the component.
Swapping artwork is free provided you:

* keep `templateSize` accurate for the new file,
* keep `coverArea` describing the transparent window, in template pixels,
* keep the window genuinely transparent (alpha 0), not white.

## 4.1.6 Layering

Bottom to top, exactly four layers:

```text
1. drop shadow      — on the outer wrapper, so it follows the whole object
2. cover artwork    — positioned into the template's transparent window
3. platform template PNG
4. soft diagonal gloss
```

## 4.1.7 Materials

**Drop shadow** — applied to the object wrapper so it wraps face and spine as one:

```ts
shadowColor: '#000',
shadowOpacity: 0.45,
shadowRadius: 18,
shadowOffset: { width: 6, height: 12 },
elevation: 12,
```

**Gloss** — a narrow diagonal sheen across the plastic. Low opacity on purpose:
the brief asks for subtle, not a lens flare.

```ts
colors: ['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)'],
start: { x: 0, y: 0 },
end:   { x: 0.9, y: 0.55 },
```

**Perspective / tilt** — **the case rests square, at `0`.** It sat at a permanent
6° for a long time, and that skew was doing one job: saying "this is an object,
not a picture of one". Two things say it better now and neither costs the
artwork anything — the case *lands* on arrival, and it *turns over* on a drag.
Motion is a stronger claim about physicality than a static rotation, and a
permanent one foreshortens an edge of the cover for as long as the page is open,
on the largest rendering of box art in the app.

The prop stays, because it is the seam `<GameCaseFlip>` drives every degree of
rotation through — the landing, the turn, the rubber band — without touching the
protected component.

```ts
transform: [{ perspective: 900 }, { rotateY: `${tilt}deg` }]   // tilt defaults to 0
```

**Spine radius** — `3` on the top-left and bottom-left corners only, with
`overflow: 'hidden'`.

**Cover window** — `overflow: 'hidden'`, backed by `surfaceElevated` before the
image resolves, artwork drawn with `contentFit="cover"`. Cover crops rather than
distorts, because the window is rarely the same aspect ratio as the artwork.

## 4.1.8 Spine typography

The spine text row is rotated `90deg` so the title reads bottom-to-top, the way a
shelved case does. The row is laid out at a width equal to the case **height**,
because it is measured pre-rotation.

```ts
spineTitle: { fontSize: Math.max(7, width * 0.045), fontFamily: FontFamily.semibold, flexShrink: 1 }
spineBrand: { fontSize: Math.max(6, width * 0.038), fontFamily: FontFamily.bold, opacity: 0.85, letterSpacing: 0.5 }
paddingHorizontal: Spacing.x8
justifyContent: 'space-between'
```

The title is `numberOfLines={1}`.

## 4.1.9 Edition badge

An optional band across the bottom of the face — "Collector's Edition", "Deluxe".

```ts
position: 'absolute', left: 0, right: 0, bottom: 0,
backgroundColor: theme.scrim,
paddingVertical: Spacing.x4,
alignItems: 'center',
// text: variant="micro", uppercase, #FFFFFF, letterSpacing 1, numberOfLines 1
```

## 4.1.10 Cover artwork rules

* Artwork is **never stretched**. True aspect ratio always: portrait **2:3**.
* `caseImage` is **12** for the cover art inside the case window. This is the
  case's own radius and is deliberately larger than `Radius.image` (§ 5.3).
* Fallback order for a case's artwork: `coverUrl` → `heroUrl` → lettered
  placeholder (first character of the title, `textMuted`, on `surfaceElevated`).

## 4.1.11 The optical disc

The case's companion object, sharing the same Object Rule.

```ts
DISC_TEMPLATE = { size: 512, artRadius: 248, hubRadius: 78 }
```

Artwork is masked to the `artRadius` circle, centred, matching the template's
annulus. The centre hole is punched out by the template inside `hubRadius`.

## 4.1.12 Case rules — do / don't

* **Do** derive every case offset from the template metadata and the single scale
  factor. Nothing about the geometry belongs in a call site.
* **Do** pass a measured width when the caller knows the viewport.
* **Do** let the case cast — it is the one thing in the system that may.
* **Don't** put the case in a feed, a search result, a notification, a comment or
  a list tile.
* **Don't** render a case for PC, iOS or Android.
* **Don't** stretch cover art. 2:3, always, cropped rather than distorted.
* **Don't** hardcode `coverArea`, `spineWidth` or the template size in a component.
* **Don't** raise the gloss opacity. It is subtle by specification.

---

# 4.2 The dealt card

Surprise Me deals one game at a time. Its art is a **page on a pager**: the
owner's direction (2026-10-21), "Remove the way the artwork moves as a card out
of the screen, just make it a simple slide like SimpMusic when sliding to the
next song inside the now playing screen."

## 4.2.1 What it was, and what it is

It was a depicted object — a card off a face-down deck, leaning ±7° under a
shared `perspective: 900` as it was pulled, a sheen crossing it while it tilted,
flying off the screen on release and springing in from the side. All of that is
gone: no deck, no lean, no lift, no sheen, no flight.

What is left is SimpMusic's `HorizontalPager` round its artwork. The cards either
side are laid out a display's width away; the strip follows the finger one for
one; a release past a third of a card, or a flick, springs it to the next page on
Compose's pager default — `spring(stiffness = 400)`, critically damped — and
anything less springs it back. The art keeps `Elevation.raised`, the square its
18 corner. The words under it fade in when the deck moves on.

## 4.2.2 What a drag shows

The next card's art slides in under the finger, as the next song's cover does in
the reference. It used to be face down — "drawing its cover would spoil the
surprise" — and a pager cannot hide the page it is bringing in without stopping
being the reference's slide. The surprise now lasts until the drag begins.

## 4.2.3 What stays round it

The room's light behind the art (`<SurpriseBloom>`) and the edge lights that say
what letting go will do (`<SwipeEdge>`) — neither moves the artwork. Both are
this screen's alone.

---

# 4.3 The binder and the CD

A person's physical games are kept the way discs are kept: in a zip binder.
Two more depicted objects, under the same Object Rule (§ 4.1.1) and under the
case's ceiling on every axis.

- **The CD** (`<CdDisc>`) is the game's box art printed on `game_cd.png`. The
  PNG follows the case contract — opaque rim and clear hub, the label punched
  out — so the art is drawn beneath it, cropped to a circle, never stretched.
  The hub shows what the disc lies on. Gloss peaks at 0.16, under the case's
  0.20; its cast (0.35 / r8 / (2, 5)) is well under the case's.
- **The binder** (`<CdBinder>`) arrives shut: the surface ladder as padding,
  a dashed stitch, a zip and its pull, the count debossed. Tap and the cover
  swings about the spine and *becomes* the left page. Two sleeves a page, two
  pages a spread; a turned page carries the next spread on its back. Sleeves
  are film — a faint wash, a hairline, a heavier lip over the disc's lower
  third — and discs in sleeves do not cast; the binder does.
- **The showcase** (`copy/[id]`) is a collection screen in § 4.1.2's sense, and
  the one place a case is an object with a depth and an inside. See § 4.3.1.

**Where they may appear:** the library's Physical tab and the copy showcase.
Nowhere else — a profile shows the digital / physical *count*, not the binder.
No colour of their own: everything is the surface ladder and the artwork —
and, on the showcase's floor, the artwork's own hue as light.

## 4.3.1 The copy's stage

The copy stands alone under a lamp and drifts round until a finger takes over.
Its case is a **box** — cover, back, spine, opening edge, and, open, a tray and
the inside of the cover — turned by hand, opened about its spine on the disc in
its tray, and emptied: the disc comes out to stand there alone. The back prints
the copy (release, what is in the box, condition, when it was got, the masked
barcode) and is the only place that is printed.

> **This case is the showcase's own drawing, by the owner's exception to
> § 4.1.** `<GameCase>` and the rest of the protected feature are not edited
> and are unchanged everywhere else. The cover is § 4.1.6's layering restated
> from the same templates by the same scale factor. Nothing in this section
> licenses a change to § 4.1.

What this drawing does that § 4.1's does not:

| | `<GameCase>` (§ 4.1) | the showcase's box |
| --- | --- | --- |
| **shadow** | on the object, 0.45 / r18 / (6, 12) | none on any face; the box casts once, on the floor |
| **rest** | square, at 0 | square on a face whenever it is let go; otherwise turning |
| **gloss** | fixed diagonal, 0.20 peak | the same, plus a reflection that moves |
| **depth** | a face | 0.104 of its shorter side for a keep case, 0.08 a jewel case, 0.20 a cartridge box, 0.21 a clamshell |
| **spine** | never drawn | drawn: it is a side of a box, absent while the cover is square on |
| **artwork** | `t_cover_big`, 264px | `t_1080p`, 811px, over the small one |

**The room.** The page is flat, in the game's own tone (`accent.page`). Two
things are on it, both native gradients, each ending on its own colour at zero
alpha:

- **The lamp** — one soft field up and to the left of the object, the side
  § 4.1.7's shadow has always fallen away from, in M3's `primary` for that
  game. Peak 0.20.
- **The shadow** — `shadowInk`, 0.62 at its centre, lying flat under the
  object and narrowing as it turns edge-on.

> **Nothing else is under the copy.** It was first drawn on a ring of light —
> a turntable's platter, with a pool inside it and marks that went round with
> the object — and the owner had it removed the first time they saw it run.
> No platter, ring or base of any kind: the shadow is what stands the object
> on the floor.

**The light on a face.** A face loses up to 0.50 to `shadowInk` as it turns from
the lamp (0.35 on a disc) — that, not an outline, is what makes the spine a
different side from the cover. Its reflection is a soft leaning band at **0.20,
the case's own gloss and no brighter**, with an echo at 0.11; at rest it waits
off the face, and it crosses as the face comes round to square or as the phone
is tilted. A sealed copy's film takes it to 0.30, and is the only thing that
does.

**Sizes are real objects'.** The case is the smaller of 82% of the display's
width and 58% of its height, with no fixed ceiling. A disc is 120/135 of its
case's width; a GameCube's is 80/135, a UMD's 64/104, and 120/142 in a jewel
case. An open case steps back to 0.9 and its cover stands 100° open, leaving by
the left of the display: an open case is twice as wide as a shut one and a
phone is not.

**Motion.** § 22's "subtle, short" is about the interface. This is an object,
and it has the one continuous animation in the app: a lap in about twenty-four
seconds, slowing on the cover and the back and never stopping on either. It
stops at a touch, waits six seconds, and stays put while the case is open or
after it has been left on its back. A let-go turn carries its momentum and
settles square on a face. The phone's tilt leans the object 5° at most; it is
the light that moves. Reduce Motion and a screen reader get an object that
stands still and turns only when asked.

**The disc's other side** (`<CdDiscUnderside>`) is a mirror with a rainbow in
it: four soft bars of the identity ramp fanned through the hub, swinging round
as the light moves. Its greys are material, stated in the component as the
case's plastic is, and nothing in the interface borrows them.

**Under the stage**, centred on its axis: the game's name, one line that
follows the side facing the reader, and the keys (`<StageKey>`) — the round
tonal key a review and Surprise Me put under their art (`<RoundAction>`), with
its word under it, lit with `primaryContainer` when it has put the copy in a
state. A key the copy can never use is not drawn; one that cannot
act now is dimmed where it stands.

**What stays true.** A sealed copy does not open. A cartridge or card copy
turns and no more, until its console has a cartridge of its own drawn. The
inside of an open case holds what the owner recorded and nothing else.

### In 3D (2026-10-30)

At the owner's request ("a 3D effect for the CD and game case… a dazzling,
iridescent sheen that shifts as the disc/case tilts back and forth… the back
of the CD should have a transparent, clear-plastic appearance… physically
accurate lighting"), the same stage is drawn on the GPU wherever the build can
(`<CopyStageGL>`, three.js on expo-gl). The faces above stay as the stage
until it has drawn, and wherever it cannot be. Every number in this section
still holds; what changes is the material:

- **It rocks.** A few degrees back and forth (7°, every 11.5 s) and less side
  to side (2.2°, 17.3 s), so the light runs over it. The phone's forward tilt
  adds 4°. Not under Reduce Motion or a screen reader.
- **A studio, not a painted gloss.** Four softboxes in a dark room — a strip
  just over the camera, the lamp up and to the left (tinted with the game's
  M3 `primary`, as the floor's lamp is), a tall strip to the right, one
  overhead — and, behind the reader, a soft grey room. The case's plastic and
  the disc's reflect them; nothing else is lit by anything.
- **The case's sheen** is its clear plastic's reflection (4% head on, all of
  it edge-on) carrying a thin film's colours, which lie in soft diagonal bands
  and slide as the angle changes. Square on, the strip's reflection is a band
  near the top of the face; the rock sweeps it down and back. A printed face
  square on to the reader is lit at exactly its own colours.
- **Shrink-wrap** (a sealed copy): more film, uneven, faintly crinkled.
- **The disc's label**: varnished print with a faint pearl laminate; the
  console's silver printing (the rim, the hub ring) as holographic foil with
  glitter; the hub clear.
- **The disc's playing side**: clear polycarbonate over aluminium. From the
  centre: a clear hub with its moulded stacking ring and clamp ridge, a plain
  mirror band, the data (cooler, darker where written, faint rings), a thin
  clear lip showing the label's ink through it. Its highlights stretch along
  the radius, and its rainbow is the track grating's ±1 and ±2 orders, lit by
  the whole studio — at the **real track pitch of the format**: a CD's
  (1.6 µm) is the familiar bow-tie, a DVD's (0.74 µm) throws colour out to
  steep angles, a **Blu-ray's (0.32 µm) is a plain mirror** — no visible
  first order near head on, which is how one looks. A PlayStation disc is
  **black** under its dyed plastic.
- **The disc's edge** pipes the label's colour round its rim.

> Rendered here in a browser through the same shaders; not yet seen on a
> phone. Its strength — the studio's powers, the film's colour, the rock —
> is in `lib/copy-scene/optics.ts`, to be tuned on a device.

> Built without a device to run it on: the geometry is under test and was
> checked on a still, and none of it has been seen moving. The lamp's strength,
> the springs and the direction of the tilt are to be tuned on a phone.

---

# 5. Shapes & Radius

**Two regimes.** Interface is large and soft — the music-app language. Artwork
keeps small, square-ish corners, because a box is a box: rounding a cover to
match the buttons beside it would make it look like one of them.

## 5.1 The scale

| Token  | Value | Used for                                                     |
| ------ | ----: | ------------------------------------------------------------ |
| `none` |     0 |                                                              |
| `xs`   |     2 | Details inside a control                                     |
| `sm`   |     3 |                                                              |
| `md`   |     5 | A checkbox                                                   |
| `lg`   |     8 | The game page's Material 3 seams — preserved                  |
| `pill` |   999 | Chips, filters, tabs, search, badges, tracks, avatar rings   |

## 5.2 Role aliases

Named for **what they wrap**, not for how big they are.

| Alias              | Value | Wraps                                                   |
| ------------------ | ----: | ------------------------------------------------------- |
| `Radius.image`     |     4 | Covers, screenshots, thumbnails                          |
| `Radius.pill`      |   999 | Every button, filter, tab, chip and the search pill      |
| `Radius.control`   |    20 | Pressable controls that are not buttons: toggles, segments|
| `Radius.card`      |    12 | Every card, notice, list tile, selection card, menu row |
| `Radius.review`    |    12 | The review card's — the corner every card was brought to |
| `Radius.input`     |    18 | Every field: text, text area, select, search            |
| `Radius.sheet`     |    24 | Bottom sheets (top corners), dialogs, menus             |

Buttons are full pills, as the reference's are. A radius larger than half a
control's side clamps to a pill, so `control` is a soft stadium on a 48dp toggle
and a true pill on anything 40dp or shorter. Icon-only buttons are circles —
`size / 2`, not a token.

**No one radius for everything.** A field is squarer than the button that
submits it, and a sheet is rounder than the rows in it, so each reads as a
different kind of object. Filters and tabs are pills; buttons are stadiums;
containers are rounded rectangles.

## 5.3 Case exception — **PRESERVED**

The game case does **not** take the scale above. Its radii are properties of a
depicted object and are fixed by § 4.1:

| Token             | Value | Wraps                                        |
| ----------------- | ----: | --------------------------------------------- |
| `caseImage`       |    12 | Cover artwork inside the case window          |
| `caseSpine`       |     3 | Left corners of the case spine (§ 4.1.7)      |

Do not fold `caseImage` into `Radius.image`. They were the same value under the
previous system and are not under this one.

**`caseImage` also covers the PC/mobile framed cover.** When a game has no case
(§ 4.1.3), `game-case-display.tsx` renders the bare cover inside a hairline frame
at `caseImage + 1`. That frame is part of the same feature — it is what stops a
2:3 crop of dark key art dissolving into a near-black page, and it is deliberately
tuned to seat the cover without imitating the case's physicality. It takes
`caseImage`, not `Radius.image`.

---

# 6. Elevation

**Depth is a surface step and a shadow, working together.**

`background` → `surface` → `surfaceElevated` → `surfaceSelected` still does most
of the work: a card reads as lifted mainly because it is lighter than the page.
The shadow is what turns that from *painted on* into *sitting above*. Neither
alone is enough on a near-black screen — the step has no edge, and a shadow
against `#0B0A0D` has almost nothing to darken. That is also why controls do not
use shadows at all: they carry a 1px edge instead (§ 6.1).

## 6.1 The interface scale

Four tiers. Every interactive or grouping element sits on one of them; nothing
that a user can touch should be flat.

| Tier      | Opacity | Radius | Offset Y | Android | Used for                                    |
| --------- | ------: | -----: | -------: | ------: | ------------------------------------------- |
| `none`    |       — |      — |        — |       — | Text, dividers, things inside a lifted block |
| `card`    |    0.20 |      6 |        2 |       2 | A block resting on the page                  |
| `control` |    0.24 |      8 |        3 |       3 | An object *on* the page, rarely used now      |
| `raised`  |    0.30 |     12 |        5 |       6 | Pressed, active, or floating above siblings  |
| `overlay` |    0.38 |     16 |        8 |      10 | Dock, popovers, sheets, modals               |

**Controls do not cast.** Buttons, fields, chips, pills and icon buttons are
drawn by a surface step and a 1px `border`, the way the music-app reference
draws them; a control that needs more presence gets a brighter edge or a fill,
not a tier. The one exception is the game page's review button, which takes
`raised` because its fill and the page behind it are the same hue.

All four use `shadowInk` and a **zero horizontal offset** — light comes from
straight above. The lift comes from a tight radius and a short offset, not from
opacity: a large soft shadow on this background does not read as height, it
reads as a grey smudge.

## 6.2 The Object Rule — now a ceiling, not a ban

The rule used to be *interface may not cast at all*. It is now:

> **Interface may cast, but never as much as a depicted object.**

The **physical game case** (§ 4.1) sits above the whole scale — opacity `0.45`,
radius `18`, offset `(6, 12)`, elevation `12`. It is strictly larger than
`overlay` in opacity, radius and vertical offset, and it is the **only** shadow
in the app with a horizontal component, so it alone looks lit from an angle
rather than from directly overhead.

That gap is load-bearing. The case is the one thing in the app depicting a real
object you could pick up, and it stays special only while nothing else casts as
hard. **No interface tier may be raised past `overlay`.** If something needs to
feel heavier than that, it needs a different design, not a bigger shadow.

## 6.3 Android

`elevation` is the only shadow Android honours, and it needs an opaque
`backgroundColor` on the same view to render at all. It is also **clipped by
`overflow: 'hidden'`** — a very common combination on artwork, which rounds its
corners by clipping. Where both are needed, split them: an outer view carries
the elevation and the background, an inner view does the clipping. `<Poster>` is
the worked example.

---

# 7. Header

The top bar is **SimpMusic's**, at the owner's direction: its size, how it
looks, and what it does as the page scrolls — read from the reference's source
(`NotificationScreen.kt`, `AlbumScreen.kt`, `HomeScreen.kt`, `UIExt.kt`) and
kept as numbers in `constants/top-bar.ts`. It is drawn by `<FrostedTopBar>`,
through `<Screen topBar>`. CLAUDE.md § The top bar is the code-level statement.

```ts
row:      64 high, under the status bar            // Material 3's small app bar
control:  a 24 glyph, 48 to touch, a 40 circle while held
chevron:  chevron-back, its glyph 16 from the edge; a cross on a modal
title:    h3 (18) — one line, starting at 56; at 16 with no control before it
controls: at the far end, the same bare glyphs
frost:    the page behind it, blurred
          the page's own colour over that — 30%, or 85% on a page coloured by artwork
          below Android 12: no blur, that colour, opaque
```

**The bar is never an opaque strip, and it is not always there.** It floats
over the page with nothing behind it and becomes frost only when there is
something under it to frost. How is decided by what the page opens on:

- **A list or a form.** The bar is there from the start: clear while the page
  is at its very top, frost the moment it is not. The two cross-fade over
  300ms on Material's standard curve.
- **Artwork.** No bar at rest — discs of glass in the corners, and they belong
  to the artwork: they scroll away with it. When the artwork has gone under
  where the bar sits, the bar comes in from above — half its own height, on a
  spring that does not overshoot, fading in — already frost, carrying the
  page's name. A long name scrolls rather than being cut.
- **Home.** The first kind, and its row folds away while the page is read
  downward and returns on any move back up. Folded, the frost stays over the
  status bar.

```ts
disc:    48 across, on both platforms
corner:  12 from the edge of the display, 12 under the status bar
glyph:   chevron-back, 24, the page's ink
glass:   what is behind it, blurred lightly
         a 27% black scrim over that
         a one-dp rim of light — bright at the top left, fading round the circle
         a faint sheen across the top left of the pane
reserve: 60 above the safe-area inset, where a page lays itself out under them
```

The reference's glass is a shader — blur, a lens, a scrim and a rim. This app
has no Skia, and at 48dp refraction is not what anyone sees; the rim, the scrim
and the sheen are, and those are drawn. The rim changes round its circle on
purpose: a uniform hairline is the outline of a button, and a rim that catches
light on one side is the edge of a piece of glass.

**A control at the other end of the row is the same object as the back
control** (`<TopBarDisc>`): a disc of glass over artwork and a bare glyph in
the bar — the owner's menu on a collection, Surprise Me's settings, the
scanner's torch. Never an `<IconButton>` there — that is a filled grey circle
beside one of glass.

**A screen's name is its bar's title.** A page that opens on a list or a form
prints no heading of its own under the bar; what it says first is what the name
cannot — which game, ranked by what. A page that opens on artwork, or on its
own mark (a platform's logo, the Must Play badge), says its name there, and the
bar repeats it only once that has scrolled away. The same words are never on
screen twice.

Under Reduce Motion the frost still fades — a fade is not movement — the bar
after artwork fades in without sliding, and Home's row does not fold.

**Apple's glass bar — a game, a studio, a collection, and nowhere else**
(`<FrostedTopBar glass>`, the owner's direction of 2026-10-23). The three pages
whose hero is pinned behind the page (§ 13.1) take Apple Music's bar instead of
the one above:

```ts
discs:  pinned — centred in the 64 row, 12 from the edge; they never leave
glass:  fades in (300ms), never slides — as the hero finishes draining
        iOS: the system's own navigation-bar material
        Android 12+: the page blurred (radius 21); below 12: opaque
        the page's colour over it at 60%
title:  h3, centred on the display between the discs; scrolls when long
```

There is always a way back — the gap between the disc leaving and the bar
arriving, which every other artwork page has, is gone on these three. **The
bar's blur is back on these pages alone**: the owner had it taken off every bar
on 2026-10-14, and every other bar is still the page's colour, solid.

---

# 8. Bottom Navigation

Four destinations — Home, Search, News, Profile — in one capsule: SimpMusic's
bar (`AppBottomNavigationBar.kt`) at its dimensions, drawn by `<AppTabBar>`.
SimpMusic puts Search in a circle of its own; that was tried and taken back, so
the four stay one set in their own order.

```ts
capsule:   64 tall, fully round, 6 in at its ends, theme.surface
indicator: 56 tall, one tab wide, theme.surfaceSelected — slides to the tab
tab:       as wide as the capsule allows, at most 96; glyph 24 over bodySmall
bar:       16 at the sides, 4 above, 8 above the system inset, over the page
```

**It floats.** The bar is drawn over the page with nothing behind the capsule,
so a tab's content runs under it and under the system's navigation keys to the
bottom of the display. Every tab screen pads its scroll content by
`useTabBarClearance()`. Android's own navigation bar is transparent:
expo-navigation-bar's `enforceContrast: false` removes the system's scrim in a
real build (Expo Go applies no config plugins). On Android the bar steps aside
while the keyboard is up, because the window resizes and it would sit on it.

The indicator slides by a CSS transition, so its resting place is a React prop
and cannot be lost to a stalled JS thread the way an animated style's end value
can (see `useLandingArrival`).

Icons above labels — labels shown, not hidden, because an icon-only bar asks
every new user to guess what a newspaper glyph leads to. Selected is the house
blue (`primaryText`) on both glyph and label; unselected is `textMuted`. It
never takes a game's colour. Separated by tone, not a hairline or a shadow.

Five is the ceiling. A sixth destination means something belongs one level down.

## 8.1 The mini player

What is playing, as a second capsule at the foot of the app — drawn only while
**Keep playing** is on and a track is loaded (`<MiniPlayer>`, mounted once in
the root layout, over every screen). The owner's rule is that music stops when
the soundtrack screen is left; the switch is the exception, and this bar is
what the exception looks like.

```ts
capsule:  56 tall, fully round, theme.surface, a hairline edge, 16 at the sides,
          520 at most
contents: artwork 40 · title (itemTitle) over the uploader (bodySmall, muted) ·
          play/pause · next (when there is one) · a cross that stops the music
progress: a 2dp line along its foot, inset by the capsule's corner, primaryText
rests:    8 above the system inset — and a tab bar's footprint (76) higher on
          the four tabs, over the tab capsule
```

- **The tab bar's material and never a game's colour**, for the tab bar's
  reason: it is the app's, on every screen.
- **It moves by a CSS transition on a transform** between its two resting
  places, so where it rests is a React prop.
- **Pages make room for it.** A tab's content ends by `useTabBarClearance()`,
  which grows by the capsule; every other page gives up a band of its own foot
  through `<Screen>`, in its own colour. Nothing is ever left under the bar.
- **It stays off** the soundtrack screen (which has the whole player), Surprise
  Me, the scanner, every modal and the keyboard. The music does not stop there.
- **Pressing it opens the soundtrack it is playing from.** It is a reading and
  a way back, not a second player: the progress line cannot be dragged.
- It names the uploader, as everything of SoundCloud's must (§ 8.3).

## 8.2 The docked player

The whole player, at the foot of the soundtrack screen (`<PlayerBar>`): a sheet
edge rather than a capsule — `Radius.sheet` on its top corners, a hairline, its
fill run to the bottom of the display — in the game's `accent.card`, because
that screen is about one game.

```ts
now:       artwork 44 · title over the uploader · SoundCloud's mark (a link)
scrub:     0:42 ─────●───── 3:21   the line 4dp, touched at 28, a 12dp thumb
controls:  [Keep playing]            ⏮  ▶  ⏭
caption:   what leaving this screen will do, in one quiet line
```

- **Play is the bar's one filled accent** (52, `accent.color`); previous and
  next are bare glyphs at a finger's size, dimmed in place when they cannot act.
- **Keep playing is a choice, so it is outlined** and takes the accent's wash
  and a check when on (§ 9.4). The caption under it states the consequence —
  "Music stops when you leave this screen." / "Music carries on while you use
  the app." — because a switch whose effect is only seen after leaving has to
  say what it will do first.
- **A track that will not play says why where its uploader was**, in one of
  four sentences (`noticeText`): not available here, not connected yet, the
  play limit and when it lifts, or a failure that play retries.

## 8.3 SoundCloud's mark

Wherever a track of SoundCloud's is shown or played there are three things:
its **uploader's name**, **SoundCloud's own logo**, and a **link to the track
on soundcloud.com** — the API's terms ask for all three. `<SoundCloudMark>` is
the logo, and the link when it is given one.

It is the only image in the app that is not ours to restyle. The files in
`assets/images/soundcloud/` are SoundCloud's white marks as published, drawn at
half their pixel size and **never tinted, recoloured, cropped or redrawn** —
there is no `color` prop. Artwork from SoundCloud is drawn through
`<PlayerArtwork>` and kept in memory only; nothing of SoundCloud's is written
to the device.

---

# 9. Buttons & Controls

**Read from the owner's reference, not traced from it.** SimpMusic is open source
(`maxrave-dev/SimpMusic`), and every measurement below comes from its Compose
code: `ListenTogetherScreen.kt` (the name field, "Create room", the disabled
"Join room"), `ListenTogetherSettingsScreen.kt` (the Server options) and
`AnalyticsScreen.kt` (§ 2.4). Go back to those files before changing a control.

**Three families, told apart by fill.** Actions are **filled** grey pills.
Fields are **soft wells**. Choices are **outlined** until chosen. The accent
appears only on what is selected, focused, or — on a game's own page — the one
vivid review button.

**What kept its own treatment.** The game page's Material 3 cluster — the vivid
"Write a review" (`tone="vivid"`), the connected row of tonal action keys, the
platform keys — and `<RoundAction>` on Surprise Me and a review. So did the
collection header's two action circles — share and like, the reference album's
own, filled with the ink at 12% because the page under them changes colour — the
sign-in providers' brand colours (on the shared pill shape), and every *meaning*
colour: a log status fills with the status's hue, a platinum or spoiler toggle
lights in its own colour, a tier chip fills with its tier. The physical game
case is an object, not a control, and is untouched.

## 9.1 Buttons — every action is the same grey pill

The reference's "Create room": **52dp, fully round, filled `controlFill`**
(#181818 on black), a small semibold label (`button`, 13) in the middle. One
object for every action; the variants change the label, not the object:

- **Primary** — the label a step brighter (`text`). At most one per screen.
- **Secondary** — the label in `controlInk`, the reference's soft grey.
- **Danger** — the same pill with a red label.
- **Ghost** — no fill at all: a text action, like the reference's "Connect".
- **Disabled** — the reference's disabled "Join room": no fill, a faint
  `borderStrong` edge, a dimmed label. Told apart by shape as well as by
  brightness, never by opacity alone.

32dp when small — the reference's chip — touched at the floor through slop,
60dp when large. Held, the
fill brightens to `controlPressed` and the pill sinks 3% (`PressableScale`'s
`pressedColor`, eased on the UI thread). Focused from a keyboard, a 3dp ring in
`accent.ring`. Loading keeps the pill and swaps the label for a spinner without
resizing. No shadow.

## 9.2 Icon buttons

The round sibling: a circle in `controlFill` with no edge — the reference's
glyph keys — drawn at 40dp (32 small) and touched at the platform floor through
vertical slop. `active` lights wash, edge and glyph in the accent; `danger`
reddens the glyph; `plain` drops the fill, for rows that already have a
container. The floating back/close disc (`<TopBarDisc>`) is glass — § 7.

## 9.3 Fields

The reference's name field: a label above in `fieldLabel` (12, medium), then a
**soft well** — `input` (#0F0F0F on black), **no border**, `Radius.input` (18),
54dp (`ControlHeight.field`), `fieldText` (13) with 15dp of side padding — and a
hint or error under it, 8dp apart. **Focus** draws the accent's edge (1.5dp, in
`accent.onSurface`), as the reference outlines the code box you are typing in;
an **error** keeps the edge red until it is fixed. Text areas, `<SelectField>`
(a chevron where the typing would be; its open sheet wears the same edge) and
every search field are the same object.

## 9.4 Selection — choices are outlined

**One selected state, everywhere** (`useSelectable()`): at rest a choice has no
fill and a 1px `outline`; chosen, the accent's `wash` inside, its `edge` around,
and the label up from `textSecondary` to `text`. Three carriers, only one of them
a hue — the wash is lighter than the bare page and the edge far brighter than
the resting one, so a choice survives colour blindness and greyscale.

- **Selection cards** (`<SelectionCard>`) — the reference's Server options:
  `Radius.card` (12), 15dp padding, 13dp between parts, **a 34dp circle on the
  leading edge**, then the name (`optionTitle`, 13 medium) and its hint
  (`bodySmall`). The circle is an empty ring at rest; chosen, it fills with the
  accent at 18% and holds a check. A report's reasons, a copy's condition, a
  collection's type, the seven progress choices, a release, a select field's
  options (`compact`, a 26dp circle) and the filter pickers (`frame="row"`,
  bare until chosen) all use it.
- **Filter and sort pills** — `ControlHeight.small`, `Radius.pill`, outlined.
  Wrapped rows are spaced by `SmallControlRowGap`, exactly the two slops that
  meet across the gap, so touch boxes tile and never overlap.
- **Checkboxes** — `<Checkbox>`, 20dp: an empty rounded square in `borderStrong`,
  or the accent's fill with its ink's check. The row around it is the control.
- **Tabs** — SimpMusic's top-bar chips, read from its `ChipGroup.kt`: full
  pills, 32 high, 16 at the sides, 4 apart, the row 15 in. Unselected: no fill,
  a 1dp `outlineVariant` edge, `onSurfaceVariant` label. Selected: solid
  `primary`, poured in (§ 27.3), `onPrimary` label, no check. Label `tab` (14
  medium, sentence case). Roles from `accent.m3`. `<TabBar>` is every in-page
  tab row, News's included; the game page's three share the row — equal widths,
  40 high, a 15 label, 4 apart from margin to margin, never scrolling.
- **Two exceptions, both the owner's (2026-10-15).** The log form's progress
  choices are solid poster-coloured pills that sink when another is chosen
  (§ 27.2) — the game page's progress *sheet* keeps its selection cards. And
  onboarding's choices are the reference's outlined pills that turn off-white
  (§ 27.1). Neither is a pattern to reuse.

## 9.5 Sheets, dialogs and menus

`surface` (or `surfaceElevated` for a centred dialog), `Radius.sheet`, a hairline
edge against the scrim, `Elevation.overlay`. Close is a round key. Menu rows are
flat until pressed and inset from the sheet's edge so their rounded ends show;
a destructive row presses in red. `Alert.alert` stays native — it is the
platform's own dialog and is not ours to restyle.

---

# 10. Search Bar

A field like every other (§ 9.3) with a magnifier leading: the `input` well,
no border, 18dp corners, 54dp, the accent's edge while focused. Every field that
searches — the Search tab, the game pickers, a library's search — is this shape.

---

# 11. Cards

**Every card is the review card** (2026-10-20, the owner's: "make all the cards
in the app with that style of the review ones, with the same size and corner
ratio and stuff. Even the ones in the game page"). One material,
`components/ui/card-material.ts`: a flat fill one step above the page,
`Radius.review` (12), a 1dp hairline in `border` (white at 7%), the card
shadow, 15 in and 12 between parts. `<Card>`, the game page's section cards
and titled panels, the member's and the critics' review cards, and every
screen's own content card read it.

The fill follows the page: `surface` on the app's own pages, and on a game's
page — built from its Material 3 colours — the game's `primaryContainer` at
half brightness, so the card is not the one neutral object on a coloured page.
With game colours off (Settings) a game's page is the app's own room — its
cards `surface`, its accent the owner's grey `#CACACA` (`gameNeutral`) — and a
collection's and a studio's page lose the colour read from their art.

The hairline does not make a card a button: a control's edge is `outline`, at
16%, more than twice as bright. `elevated` puts a card on `surfaceElevated`,
for a card on a card. A card that clips its contents keeps the corner and the
edge and drops the shadow, which Android would clip with them.

---

# 12. Chips

The metadata capsule, and the main reason this app is dense without being
cramped: `📅 Played` · `⏱ 45h` · `🏁 Completed`.

34 tall, `Radius.pill`, on `surfaceSelected`, **no edge and no shadow**. A filter
pill is the same shape *outlined* and unfilled, because a filter is a choice and
a fact is not. Active chips take the accent's wash with accent text.

---

# 13. Hero Image Treatment

A full-bleed hero fills `HeroHeightRatio` (0.38) of the display, sized against
the screen rather than the art's own 16:9. On a tall phone a strict 16:9 is a
26%-high band — a banner above the content rather than a backdrop behind it. At
38% the art carries the top of the screen the way it does on a store page.

The trade is a centre crop: a 16:9 source shown at ~1.2:1 loses its outer thirds.
Key art is composed centrally, and `heroHeightFor` never returns less than the
untouched 16:9 height, so wide displays keep the whole frame.

**The game page's hero is this one too.** For one pass it was a picture instead
— the art whole, at its own shape, no fade, under the status bar — and the owner
took it back: "go back to the hero art old aspect ratio… keep the fade
transition". Do not re-try the uncropped hero.

**Which image is the hero is chosen, not taken** (`lib/games/hero-art.ts`), and
that part of the pass stayed. IGDB's first artwork is as often an icon or a
wordmark as key art — The Witcher 3's is 128×128, which IGDB's `t_1080p`
upscales — so the hero is the game's key art, then artwork, then concept art:
landscape, at least 1000px across, never a logo, a cover or an icon. A 3.1:1
banner (Steam's 1920×620) keeps barely its middle third in this slot, so a sharp
widescreen screenshot is used before one.

The hero ramps into the page beneath it with a `LinearGradient` — and every
gradient stop ends on `withAlpha(colour, 0)`, **never** the keyword
`'transparent'`. `expo-linear-gradient` interpolates through black on Android and
leaves a grey bruise mid-ramp.

**Two fades.** `fade="color"` — a collection, a studio, the Top 10 — ramps to
the page colour over the hero's lower 62%. `fade="mask"` dissolves the art's own
alpha, for a page whose colour is not the app's; the game page is its one
caller, and its curve is that page's:

| | `mask`, as it was | `mask`, now |
| --- | --- | --- |
| Starts | 38% down the hero | 16% down |
| Shape | a straight line | `(1 − u^2.4)²` — flat where it leaves, flat where it lands |
| At 90% down | 16% of the art showing | 7% |
| The last hundredth | 1.6% → 0, an edge | 0.1% → 0 |

A straight line has a corner at each end, and the one at the bottom was a
visible end to the picture just above the billing. The owner asked for it
softer, and for the row to be set into it (§ 14). The curve is fitted to the
reference's own backdrop at the three points it could be measured, drawn as
fourteen stops, and held by `constants/game-masthead.test.ts`.

## 13.1 The pinned hero — a game, a studio, a collection

The owner's direction (2026-10-27), after Apple Music's artist page, and the
one part of it the owner kept (2026-10-28): the hero is **pinned behind the
page**, and the page slides over it. `<PinnedHero>` draws it; CLAUDE.md § One
colour method is the code-level statement.

**The page is one colour, and it is Material 3's** — the game's scheme, seeded
by its box art (a studio's by its banner, a collection's by its cover's box
art): the scheme's background, from the top of the page to its foot, and it
does not change as the page is read. The cards on it are the scheme's
`primaryContainer` at half brightness, the controls its `primary` (§ 14).

```
          the art, sharp — drifting up at a fifth of the page's speed
          ─ its foot gives way to the page's colour (the game page's soft
            dissolve, a studio's and a collection's 70%)
          the masthead floating over it, then the page's solid part rising
```

**As the page scrolls**, over one distance — rest to the lines under the name
reaching the bar's foot (`solidAt`):

| Share of the way | What happens |
| --- | --- |
| 0 → 1 | The art drifts up at 0.2 of the page's speed; the page slides over it |
| 0.15 → 0.75 | A blurred copy (radius fixed) fades in over the art — or over the trailer playing in its place |
| 0.35 → 1 | The art drains into the page's colour, slowly |
| 1 | Solid page colour; the glass bar fades in (§ 7) |

Every step is an opacity or a transform read off the scroll on the UI thread.
**Pulled past the top on iOS the hero stretches**, its top pinned to the display
and its foot with the page; Android's own stretch does that for the whole page.

**With game colours off** the page is the app's own grey room, and everything
else is the same.

---

# 14. Game Page

The masthead is **a film's page in Letterboxd, measured** — the owner's second
reference, a screenshot of a 360dp display at 3×. Every size and interval below
was read off it, is written down in `constants/game-masthead.ts`, and is held to
what it was measured for by that file's tests. Type is matched by capital
height: the reference is set in Graphik, this app in Inter.

It opens on the game's key art (§ 13), dissolving. **Set into the foot of that
dissolve** is one row: the billing from the page's margin — the name, then the
date, the developer and the publisher as three quiet lines, then a score — and
the game's **plain cover** against the far margin, landing on arrival with
nothing to press. Under the row the synopsis stands on the page as three lines
of text, the last fading; then one rule, the numbers, the actions. The tabs
follow; the **physical case** (§ 4.1) is in the Overview's Platforms section
(§ 14.1), beside the control that chooses which platform's case it is.

```text
┌──────────────────────────────────────────┐
│ ◯             HERO (0.38h)               │
│                                          │
│        … dissolving, eased …             │
│ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ░ ┌────────┐ ░ │  ← the row's top: the last tenth
└─────────────────────────────│        │───┘     of the art
  Title, 22 bold, white       │ COVER  │
                              │ 27.8%w │       ← in a soft round halo
  date                        │        │
  developer                   └────────┘
  publisher
  86 IGDB        ← only when nobody here has rated it

  Three lines of synopsis, on the page,
  not in a card. Tap it and it opens in
  place. The third line fades out…
──────────────────────────────────────────── ← the one rule, edge to edge
│   92   │   14   │   27h   │   E10+   │
│  actions (full width)                    │
│  your log, when there is one             │
│  tabs: overview / soundtrack / similar   │
```

| | Reference, measured | Here |
| --- | --- | --- |
| Cover | 100×150dp, 27.8% of the display | `mastheadCoverWidth` — 100 on 360 (it was a third) |
| Cover corner | 3.9dp | `Radius.image` (no edge: § 4.0.1) |
| Halo | black, 20% at the poster's edge, gone 35–40dp out | 30% at the cover's sides, 40dp out (51 above and below) |
| Name | capitals 15.7dp — 22 bold, white | 22/27 bold, `onPrimary` |
| Name under the cover's top | capitals 18dp down | the billing 12 down (18 to its capitals) |
| Lines under it | 12–13, L* 76–81 | `body`, `accent.quietInk` (M3 tone 82) |
| Name → next line | 28dp, baseline to capitals | 20 between the boxes |
| Between the lines | 12dp, baseline to capitals | 4 between the boxes |
| Cover → synopsis | 20dp | 15 between the boxes |
| Synopsis | 13 on a 20dp line, 3 lines | `body` on a 20dp line, `ABOUT_LINES` |
| Its fade | mid line 2 → foot of line 3; line 3 from 54% to 12% | `ABOUT_FADE`: 1.25 lines, to 88% |
| Synopsis → rule → next | 18dp, a hairline, 19dp | 13 + the rule + 2 |
| Row against the fade | poster's top on the last tenth of the backdrop | `ROW_ENTERS_AT` — 11.5% of the hero, ~30dp |
| Page | L* 9.7 | M3 tone 10 |

Seven of the owner's rulings hold this shape. The later ones undid earlier ones;
none is to be "restored":

- **The row is in the fade.** "Not below it, not above it, right into it." It
  was twelve under the hero's bottom edge, on the rule that nothing is laid on
  the art; before that the cover rose half its height into the picture, "a boxed
  copy propped against a poster". Now the top of the cover is on the last tenth
  of the art and the art has gone by the title. Neither a gap under the hero nor
  a cover over visible art.
- **The cover is on the right, and the billing is set left from the margin.**
  The billing was right-*aligned* for one pass and brought back, and that stands:
  it is the cover that changed sides. The row is top-aligned and the billing
  starts twelve under the cover's top, so the name's capitals are eighteen under
  it — the reference's — whatever the billing's length; slack falls under the
  billing, never above the name.
- **It is smaller than it was** — the cover, the name (28 → 22) and the lines
  under it (18 and 15 → 13). The name may run to four lines; it is never cut.
  The box in Platforms kept its third of the display.
- **Three plain lines under the name**, at the owner's choice over the
  reference's "2017 · DEVELOPED BY" and a bold name: no label, no capitals,
  nothing bold but the name. § 2.4's sentence case holds.
- **The inks are the game's own at the reference's lightness** (§ 1.3): white,
  then M3's tone 82 — the reference's ladder, carrying this game's trace where
  the reference carries Letterboxd's blue. Not Letterboxd's hexes.
- **The synopsis is free-standing text**: no card, no heading, no More. The fade
  is the sign there is more, and the text is what you press; it opens with the
  description card's motion (§ 14.1). A game with no synopsis has no block.
- **One score in the masthead, and it is the app's own when there is one.** The
  stats strip carries the app's average and how many ratings are behind it.
  IGDB's aggregate, labelled "IGDB", is printed under the billing **only for a
  game nobody here has rated** — and the strip's empty score cell says
  "Unrated / Be the first" beside it. It was labelled "Community", which read
  as GameLog's own community directly above a cell saying nobody here had
  rated the game (critique, 2026-10-21) — otherwise it was a second, different number about
  the same game, a line above the first. Nothing is printed while that is still
  being asked.

**The cover is a `<Poster>`, and the halo is this page's alone.** The slot used
to draw the case feature's framed cover — a 12dp corner and a frame of its own,
both protected (§ 5.3) — through `<GameCaseFlip>`. The owner asked for the
reference poster's corner and outline here, so the slot changed hands; nothing
in § 4.1 was edited, and the framed cover is still what Platforms draws for a
game with no case. The halo (`<CoverHalo>`) is the exception to § 6.1's "a
large soft shadow reads as a grey smudge": it is not a cast shadow but the page
going dark round the box, centred and without direction, as the reference's is.
It belongs behind one cover on one screen — never on a rail or a grid.

**Not yet seen on a phone.** The geometry is under test and was checked on a
still; the fade's softness, where the row lands in it and the halo's strength
are to be tuned on a device.

## 14.1 The Overview tab — SimpMusic's artist page

Below the tabs the page is the reference's artist page, section for section
(`ArtistScreen.kt`): a bold heading on the page, and under it either a **rail of
art** — screenshots, then further down the game's editions and its franchise —
or a **card** of words and figures, as its "Description" is. A heading may end
in the reference's **More**, one quiet word that goes to the rest of the
section.

**Screenshots first, then what the people here made of the game** — three
things from a film's page in Letterboxd, the owner's redesign (2026-10-09).
Each is absent when it has nothing to show.

```text
Screenshots
[ 16:9 ][ 16:9 ][ 16…                      ← the reference's video height
╭ Ratings ───────────────── 128 ratings ╮   the reviews sheet's own summary,
│ ───────────────────────────────────── │   in a card that opens the sheet
│ Great                            ┌──┐ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▒▒▒▒  ░░      │84│ │
╰───────────────────────────────────────╯
╭ Played by ──── 214 ╮ ╭ From your friends ╮  two faces each; under a face,
│  ◍      ◍          │ │  ◍      ◍         │  the score that person gave
│  84     Playing    │ │  91     77        │
╰────────────────────╯ ╰───────────────────╯
Reviews                              More
┌───────────────────────────────────────┐
│ ◍  Ada                       84  ◔ 12 │   the most liked review, one card
│    Finally a sequel that knows what…  │
│    ♥ 87 likes                         │
└───────────────────────────────────────┘
Details                                More
┌──────────────────────────────────────┐
│ Genres, themes, modes, perspectives, │    ← a door: the full IGDB record
│ engines, age ratings and languages.  │
└──────────────────────────────────────┘
Platforms
┌──────┐  Title                            ← no card: the subject is an object
│ CASE │  is available on PS5, Xbox,
│      │  PC and 2 more
│      │  ( ◉ PS5  ⌄ )                     ← the dropdown, outlined (§ 9.4)
└──────┘                                   ← no price: Where to buy says it
Editions & extras
▯▯▯▯  ▯▯▯▯  ▯▯▯▯  ▯▯▯                      ← a row of games (§ 3.3): on the page,
                                              nothing under a cover, never a card
```

- **Ratings is the rating graph** — a row for 100 and each ten below it, a
  thin pill bar in the score ramp per row (`<RatingDistribution>`, drawn as
  How ratings work's spread). The owner kept a three-part bar on 2026-10-09
  and asked for the graph on 2026-10-21. One component (`<ScoreSummary>`) in
  both places; in the sheet the graph has a card of its own.
- **Ratings and the two squares** are titled inside in `h5` with a hairline
  under the title, as the profile's boxes are; a face is 44, and opens that
  person's record of the game. With players and none of yours, the second
  square says so.
- **The review card** keeps the card it replaced — fill, corner, inset, shadow
  — and takes the reference's contents: a 36 face at the left; the name, and at
  the far end of its line the score (the score ramp's colour, never stars) and
  the reply count; the words in `reviewExcerpt` / `proseInk`; the likes. The
  heart on the likes line lights in `liked` when you liked it. A count of
  nothing is not drawn. Every row of the reviews sheet is this card on the
  sheet's neutral `surface`.
- **No critics and no "Developers" card here.** The critics' quotes are the
  first section of the reviews sheet, over the app's own reviews; the
  companies are links in the header (§ 14), a developer's name in bold.
- **Sizes are fractions of the display**: the reference's dp over the 360dp
  phone it was measured on, where its 180dp album art is half the width
  (`useSectionMetrics`). Inset 20, heading row 40, items 20 apart, card 8 in the
  corner and 16 in. Type stays on the scale — `h4` headings, `itemTitle` over
  `bodySmall` under wide art, `body` in a card.
- **There is no About here, and no "Featured in".** The synopsis moved into
  the masthead as free-standing text (§ 14). **Details** — the full IGDB record,
  which was About's More — took its place as a door card of its own, so nothing
  reachable from the tab was lost. The rail of showcases a game appeared at was
  removed by the owner; events are in Search and on their own screen.
- **Platforms** is the one section that is neither a rail nor a card: the box
  for the chosen platform — the case, which turns over to your record, or the
  plain cover where there is no case — a third of the display wide, beside the
  title (four lines at most, as the masthead's), a sentence naming up to three
  platforms, and the platform button. **No price** (2026-10-21): it repeated
  Where to buy, directly under it. The button is SimpMusic's `DropdownButton` (its Home's chart country):
  an outlined 40dp pill with the platform's glyph, its short name and a chevron
  that turns while open; the menu opens from it — anchored to its left edge,
  below or above, `Radius.sheet`, `Elevation.overlay`, rows with the full name
  and the selected state of § 9.4 plus a check. One platform is a fact, drawn
  as a metadata chip (§ 12), never a one-row menu.
- **The card** is every card's (§ 11): the review card's corner, hairline,
  inset and shadow, filled with the game's `primaryContainer` at half
  brightness — the tone the reference's halved dark-vibrant swatch came to.
  Every ink on it clears AA: `textSecondary` 6.4:1, `controlInk` 10.5:1. With
  game colours off it is `surface`, as everywhere else.
- **Opening in place** animates the height of a window onto the whole text,
  250ms on FastOutSlowIn (`<ExpandableText>`), never the line clamp. The
  masthead's synopsis opens the same way with a fade in place of the More — a
  veil over the foot of the window that reads the window's own height, so it
  lifts as the text opens and has no clock of its own.
- **The art keeps the app's corner** (`Radius.image`): the layout is the
  reference's, the boxes are this app's.

---

# 15. Score Display

**The score is a bare coloured numeral.** No box, no outline, no fill. Digits in a
bordered capsule read as a button, and at feed sizes the container was
consistently bigger than the number inside it.

```text
inline  15
medium  22
large   32
hero    44
```

Always 700 weight. Colour comes from `scoreColor()` — `success` / `accent` /
`danger` by tone (§ 1.5). The verdict label ("Excellent", "Mixed") sits beside it
in the same colour.

Ratings are an integer 0-100 on `logs.rating`, and that is the only score
anything reads.

**The bar is two thicknesses.** `<ScoreBar>` is 14 where a score is read (a
review's page) and **24 where it is set** — the log form's `<ScoreInput>`, at
the owner's direction (2026-10-15: "I also want the review score bar to be
thicker"). A bar that is dragged wants more of itself under the thumb; it is
still 44/48 to touch either way.

## 15.1 The score as a drawing

In three places a score is also **a little man and his gaming chair**, in five
states — the owner's own idea for the app's ratings.

```text
    0   the chair, empty — he has left
   50   asleep in it, the controller still in his hand
   70   sitting up, playing
   80   on the edge of the seat, leaning in
  100   on his feet — and no chair
```

- **Where**: the ratings graph on a game's page, the same graph at the head of
  the reviews sheet, and a review's own page. In each it is the drawing *and*
  the number. Nowhere else: a review card keeps its square with the number in
  it, and a score in a line of text stays the bare numeral above.
- **Nearest wins**: a score shows the drawing whose score it is closest to, so
  the changes fall at 25, 60, 75 and 90.
- **Two colours.** The chair, what shows of the controller, and the small
  marks round him are the score's colour, from the one ramp. The man is the
  page's ink. No surface is drawn behind him.
- **The chair is a silhouette**: one shape — a racing seat's winged back, the
  cushion, the stem, a star base on casters — with nothing drawn inside it.
- **He holds the controller, and it is seen from its side.** He is in profile,
  so it is edge on, its face toward his: what shows is his hand — a thumb over
  the top and three fingers wrapped round — and, over his fingers, a short
  slab that is the edge of its body. Nothing else of it: no trigger, no
  stick, nothing under his fist. Never a gamepad drawn face-on.
- **The man at 80 leans in** on a straight back, clear of the chair's.
- **Never drawn**: a screen, or anything else he could be looking at; a chair
  behind the man on his feet; an arm in the air; a hunch.

The drawings are generated (`scripts/score-figures.mjs`): the same head, torso,
limbs and hand set at different joints, so he is the same man in all five.

---

# 16. Review Card

The structure, top to bottom:

```text
avatar   username                              timestamp
"The review's headline"
82  Halo Infinite   PLAYED  GREAT              ┌────────┐
                                               │ cover  │
Three or four lines of what they actually      │  2:3   │
wrote before it truncates…                     └────────┘
♥  12  💬 4  ↗
```

- The top line is the **review's headline**, never the game's name. The game is
  named in the verdict row below it.
- A review requires **both** a headline and a body. The log form enforces both or
  neither: half a review has nowhere to render.
- Review text truncates at 3–4 lines.
- Box art is 2:3, `Radius.image` (4), and is the tallest object in the card.

Hierarchy, fixed and in this order: **game → rating → review → completion →
playtime → interactions**. Nothing competes equally.

> A review **card** never contains a game case (§ 4.1.2). A review **masthead**
> may.

That is a review in a *list* (`<LogCard>`). On a game's own screens — the head
of its Overview and the reviews sheet — a member's review is
`<MemberReviewCard>`, drawn in § 14.1; the critics' quotes and a copy's screen
keep `<ReviewQuote>`, a card of words with a score in its corner.

---

# 17. Section Headers

**A section's heading is `h4` — 16 / 21 bold, in `text` — and it stands on the
page.** Over a row of games (§ 3.3) and over what is not one: news, the
genres, collections, a studio's grid (`<HomeSection>`). One line; a heading
that leads somewhere is the link and ends in a quiet chevron. A heading over
something that does not explain itself — a grid of genres — may carry one
muted line under it; a row of covers never needs one.

It was `h2` (20), and the argument for it was a real one: a band heading had to
win against a rail of 180dp covers directly underneath it. A row's covers are
123 now, and 20 over them was shouting.

Small labelled cards — the Ratings card and the Played by squares on a game's
page, the profile's boxes — title themselves a step down, in `h5`, with a
hairline under the title.

Metadata-style labels above dense content still use `label` — 10 / 13, medium,
`textMuted`, uppercase, 0.8px tracking. That is a different job: it names a
*column or a group inside* a section, not the section.

The rule that survives: **a page has one page title.** `h1` is the page's
subject, and nothing on a section heading goes above `h4`.

---

# 18. Home

Not a feed. A stack of independently-sourced bands, each answering one
question. Every band is its own query with its own ranking and its own failure —
a dead RSS feed removes one band's contents, says so in place, and leaves the
rest of the page working.

**Four bands, and the order is the argument.** The page opens on *you* and
widens outward:

| # | Band | Question | Source |
|---|---|---|---|
| 1 | Games for you | what might I play | your logs → IGDB similarity |
| 2 | New from friends | what did people play | Postgres |
| 3 | Releases | what came out, what's next | IGDB |
| 4 | Latest news | what happened | RSS |

The first three are rows of games (§ 3.3); the news stands under its own
heading the same way. None of them is in a card.

**Band 2 is a row of covers with a face under each** — the row of that name on
Letterboxd's home, the owner's reference (2026-10-09). It took the place of a
stack of review cards. Under a cover: a 22 face, the person's name, and the
score they gave in the score ramp's colour, with a mark when there are words
behind it. When the people you follow have logged nothing, or you follow
nobody, the same row is headed **"New on GameLog"** and is everyone's — one row
that is honest about whose it is, never two and never blended.

It was seven, and two of those pairs were the same band twice. "Latest releases"
and "Coming soon" were both 92dp poster rails with an inverted date predicate,
stacked back to back. "From people you follow" and "Latest reviews" were the
same component from the same query — `newest` is *defined* as the residue after
`followed` is removed — separated by ~2,900dp of other content, so reaching the
bottom of Home meant finding a band indistinguishable from one you read five
screens earlier. Both pairs are single bands now.

**A band whose only distinction from its neighbour is its heading is not a
band.** Merge it, or make the two look different.

**On a first run, band 1 is the ask, not a rail.** An account with no logs
cannot fill bands 1 or 2, and a home screen for a logging app that never says
"log a game" has no path to its own product. The recommendation slot carries an
empty state with an action until there is one log.

This is the **foundation for recommendations, not the recommender**. Adding a
personalised band means adding a band, not unpicking a merged timeline.

---

# 18.0 Search's Discover

Search with nothing typed, on the Games tab: the answer to "what should I
play". The owner's reference (2026-10-09) is Letterboxd's home; the field and
the seven tabs stay pinned above all of it.

```text
  ⌕ Search games…                 ▥      the field, and the tabs, as before
  GAMES  Reviews  People  …
  ░░░░░░░░░░░░░░░░░░░░░░░░░░ [New]       the slider: 3:2, edge to edge
  ░░░░░░░ landscape art ░░░░░░░░░
  Game name
  Developer
  ━━━━   ────   ────   ────              four segments; the current one fills
  Popular this month               ›
  ▯▯▯▯▯▯   ▯▯▯▯▯▯   ▯▯▯
  Similar to Hades
  ▯▯▯▯▯▯   ▯▯▯▯▯▯   ▯▯▯
  Beloved by the community   Month ▾
  ▯▯▯▯▯▯   ▯▯▯▯▯▯   ▯▯▯
  Highly rated
  ▯▯▯▯▯▯   ▯▯▯▯▯▯   ▯▯▯
  Browse by genre
```

No collections on this page — they have a tab of their own — and **no glow**.

**The slider** (`constants/search-spotlight`, under `npm test`). Up to four
slides: the two biggest games out this month, the most followed game still to
come, and the release calendar. On each, a name in `h2` over two lines with one
developer under it, a badge top right — "New", a countdown, "Calendar" — and
the segments at the foot.

- **The badge is near-black at 82% with white type**, as the edition word on a
  cover is. The reference's is orange; colour on artwork belongs to the game.
- **The words stand on a scrim**: black from nothing to 88% over the lower 72%
  of the art, flat where it starts and full under every line. It holds 3:1
  under the name and 4.5:1 under the small line on *white* art, on the
  narrowest phone. It never blacks the art out.
- **The calendar slide is drawn**, not a picture: the month as the calendar
  screen draws one, the days a notable game is out on lit, today ringed.
- **It moves by itself** every six seconds, the lit segment filling as the
  timer, until it is dragged once. Still under Reduce Motion, for a screen
  reader, and whenever it cannot be seen.

**There is no light under the slider.** The owner asked for one — "a glow like
the one in the home page… like a neon light above a door" — saw two versions of
it on a phone, and had it removed. Home's light is Home's alone.

**"Beloved by the community"** is the one row with a control in its heading:
a 32dp outlined dropdown — Week, Month, Year — where a chevron would be. Under
each cover, GameLog's average in the score ramp's colour, bold.

---

# 18.1 Profile

**The old Instagram-shaped profile, at a margin of ten.** It was a
Letterboxd-style profile for about a week — a 20pt margin, the widgets as cards
forty apart, tabs at the top — and the owner went back (2026-10-12): "go back
to the old profile page layout, remove the widgets being inside cards… make the
margins 10". The numbers are in `constants/profile-layout.ts`.

```text
┌──────────────────────────────────────────┐
│ (+)            handle              (⚙)   │  ← your tab; someone else's: (‹) handle
│                                          │
│ (face)   Name                            │
│          128      12        9            │  ← a bold figure over its word, flush left
│          Logged   Followers Following    │
│ The bio, set tight under the face.       │
│ [ Edit profile                ][ share ] │
│ ──────────────────────────────────────── │
│ ★ Favourites                        Edit │  ← a hairline and a heading; no card
│ [▮▮▮]   [▮▮▮]   [▮▮▮]   [▮▮▮]            │
│ ──────────────────────────────────────── │
│ Ada’s games                  View all ›  │
│ [▮▮▮]   [▮▮▮]   [▮▮▮]   [▮▮▮]            │  ← the favourites' row, with other games
│ 128 digital · 14 physical                │
│ ──────────────────────────────────────── │
│ ★ Starred song                           │
│    ▤         ▥         ◌         ◍       │  ← the tabs: four glyphs, under the widgets
│ ┌ a review ─────────────────────────────┐│  ← the chosen tab's rows
└──────────────────────────────────────────┘
```

| | Here |
| --- | --- |
| Margin | `PROFILE_MARGIN`, **10** — this screen alone; the app's is 15 |
| Between the head's parts | 12 (`HEADER_GAP`): the face's row, the bio, the actions, each widget, the tabs |
| Face | 21% of the display, 72–96; 20 from the column beside it |
| Name | `h4`, one line |
| Counts | three — Logged, Followers, Following — `h5` over `bodySmall`, flush left, 24 apart |
| Widget | a hairline, 12, a heading in `itemTitle`, 8, the content |
| Covers in a widget | four, 8 apart, margin to margin: **79×118** on a 360dp phone |
| Tabs | four glyphs under the widgets (`<TabBar iconOnly>`): Reviews, Collections, Wall, Steam |

- **The widgets are not cards.** Sections of the profile, not objects floating
  on it: a hairline and their own space separate them, which also hands a row
  of covers the page's full width. They were boxed for a week; do not box them.
- **Friends is not a count here.** It was the fourth; the owner had it taken off
  the top of the page and kept as a tab of the screen the Followers and
  Following counts open.
- **The games are drawn exactly as the favourites are**: four separate covers
  at the favourites' size, a dashed slot where there is no fourth. Not a stack
  (§ 4.0.2 is a collection's). Its two caption lines stay under the covers.
- **The tabs are under the widgets and the profile is always above them.** One
  list: pressing a tab changes the rows and leaves the page where it is.
  Reviews is the opening tab; the wall is a tab.
- **The bio is under the row**, clamped at four lines.
- **Headings here are `itemTitle`**, not § 17's `h4`: this is one person's page
  of small sets, not a feed of sections.

---

# 19. Three ways to show a game

Not interchangeable:

- **`<GameCase />`** — a game's own page, the log form, a review masthead,
  collection/shelf screens. See § 4.1.
- **`<GameListItem />`** — a row that needs a surface behind it: search results,
  feeds.
- **`<CoverTile />`** — a grid where the artwork *is* the screen: the Top 10, the
  News chart. A CoverTile has no card, no pill and no badge on purpose — wrapping
  covers in the app's rounded containers turns a wall of art into a list of
  buttons with pictures on them.

---

# 20. Iconography

**Ionicons**, from `@expo/vector-icons`. Not Lucide — there is no DOM here.

```ts
xs: 12,  sm: 16,  md: 20,  lg: 24,  xl: 32
```

Outlined rather than filled. `icon` colour by default is `text` or
`textSecondary`; `primary` only for an active or positive state.

Preload the family in the root layout with `useFonts(Ionicons.font)` and hold the
splash screen — `createIconSet`'s `componentDidMount` otherwise fires one
unhandled font request per mounted icon.

---

# 21. Image Treatment

Artwork is **content**, not UI decoration.

```ts
contentFit: 'cover'
```

Never apply a brightness or saturation filter to a cover. For hero photography a
`scrim` overlay is appropriate so text stays legible on any cover.

Never stretch a hero into a poster slot — that is what `<Poster />`'s fallback is
for.

> The **case gloss** (§ 4.1.7) is not a filter on artwork — it is a sheen on the
> plastic, drawn as a separate layer above the template. It stays.

---

# 22. Motion

Subtle, short, ease-out.

```ts
fast: 150,  normal: 200,  slow: 300,  pressScale: 0.98
```

- Press: scale to **0.98** via `<PressableScale>`.
- Cards and transitions: **150–200ms**.
- Navigation: fade + scale.
- Loading: **skeleton placeholders**, never spinners unless unavoidable.

A spinner says "wait"; a skeleton says "here is what is coming". Prefer the
second every time.

**A skeleton shimmers, and what replaces it rises into its place.** The sweep
is SimpMusic's `Modifier.shimmer()` — a gradient `[fill, skeletonSweep, fill]`
crossing the block over 1000ms, linear, forever, so it has no edge where it
begins and no end value to lose. `<Skeleton>` carries it, so every placeholder
in the app does. Content then fades in over **300ms** (`<Arrive>`, Compose's
own default duration), taking the skeleton's place in the same frame, and a run
of equal-looking cards is staggered 100ms apart so a band fills from the top.

Both are Reanimated CSS animations on the UI thread, and both are still under
Reduce Motion. The whole effect depends on one rule kept elsewhere: **a
skeleton is the shape and the height of what is coming.** A placeholder that
lies about its size makes the page commit to a layout it is about to abandon,
and no amount of motion covers that.

**On the Apple Music pages a shelf arrives as it scrolls into view**
(`<Reveal>`, inside a `<RevealScope>`: a game's Overview, a studio's rails): a
fade and a 16dp rise over 560ms on `cubic-bezier(0.16, 1, 0.3, 1)` — fast away,
a long soft landing — once. Nothing already on screen when the page opens
moves, and under Reduce Motion nothing does.

Reanimated shared values use `.get()` / `.set()`, never `.value =` — the React
Compiler rules flag assignment to `.value` as mutating a captured binding.

> The case's `rotateY` is **motion, not a resting style**: it is 0 at rest, and
> the only things that turn it are the arrival landing and the drag-to-turn
> gesture. Both live on `<GameCaseFlip>`, and neither is a press-scale.

---

# 23. Interaction

Every tap target is at least **44×44** (`TapTarget`). No exceptions and no tiny
buttons — where a control looks smaller, padding is doing the work.

There is no hover on a phone. `hover` and `pressed` are overlays layered *over* a
surface, never replacing it.

Lists scroll with momentum. Cards are touch-friendly. Scanning is the priority: a
user should understand a card without reading it.

---

# 24. Layout Hierarchy Rules

Visual hierarchy follows this priority:

```text
1. Artwork — the game case, or the hero
2. Game title
3. Primary action / score
4. User / developer
5. Metadata
6. Supporting description
7. Section labels
```

Use contrast in this order:

```text
#F5F5F5  →  #A8A8A8  →  #8F8F8F
```

Do not use multiple bright colours for hierarchy. The interface should remain
overwhelmingly:

```text
near-black + near-white + muted grey + one blue
```

Platform case colours are part of the depicted object, not the interface palette
(§ 1.5).

---

# 25. Do's and Don'ts

### Do

- **Do** separate surfaces with a tonal step before reaching for anything else.
- **Do** put metadata in chips. It is how the app stays dense and calm at once.
- **Do** keep the accent rare enough to mean something.
- **Do** use skeletons for every loading state.
- **Do** name spacing and radii from the tokens — `Spacing.x16`, `Radius.card`.
- **Do** end scroll containers with 48 of bottom padding.
- **Do** read colours through `useTheme()`, never a hardcoded hex in a component.
- **Do** use `withAlpha(colour, 0)` as a gradient's transparent stop, never the
  keyword `transparent`.

### Don't

- **Don't** use true black, decorative gradients, neumorphism or skeuomorphism.
  Any of them dates the app instantly. The two exceptions are the ambient glow
  and the frosted bar — both structural, both defined in the frontmatter, both
  argued in § 0.
- **Don't** give a control a shadow. Controls are drawn by a fill and a 1px edge;
  depicted objects cast.
- **Don't** put an edge on a card of content. The edge means "you can press
  this".
- **Don't** hand-roll a selected state. Read it from `useSelectable()`.
- **Don't** introduce a second accent colour, and don't spend the accent on
  anything that is not selected, focused or primary.
- **Don't** set `fontWeight` on text — Inter's weights are separate families and
  `fontWeight` is silently ignored on Android.
- **Don't** shrink type to fit more in. Use chips, spacing and alignment.
- **Don't** put the game case in a feed, a search result or a list tile.
- **Don't** stretch cover art. 2:3, always, cropped rather than distorted.
- **Don't** add a sixth bottom-nav tab.
- **Don't** reach for web idioms — no `className`, no Tailwind, no CSS files.

---

# 27. The poster screens — the owner's reference of 2026-10-15

A set of screenshots of another app's onboarding and two of its screens, with
the direction: "change the onboarding of the app with the exact style of the
images", the event screen laid out as its race page, and the review form's
progress buttons as its coloured blocks. Everything here is scoped; none of
it changes the room the rest of the app is in.

## 27.1 Onboarding

**Its own room, entered once.** The page is black (`onboardingPage`, darker
than the app's), or a poster colour edge to edge. The rule for which: **black
when the app asks about you, a colour when it asks for access** — notifications
on cobalt with butter type, Steam on pink with crimson, and the last page (the
games to start with) on red with near-black navy. The colour washes in as a CSS
transition on the one page the flow keeps mounted.

| Part | How it is drawn |
| --- | --- |
| Headline | `posterHeadline` — lowercase, 40/42, ExtraBold, tracked −3%; types itself out, a letter at a time |
| Instruction over it | `posterLabel`, Geist Mono, quiet — "choose one", "up to four", "welcome, ana" |
| Why it asks | one sentence (`posterNote`) between two tall Inter Light brackets |
| Progress | a dash per step across the top beside the back chevron, lit to the current one |
| Field | `onboardingField` well, a hairline (`onboardingEdge`), radius 14, 56 high |
| Choice | an outlined pill, 42 high, that turns `posterPaper` with navy type when chosen |
| Action | one full-width pill, 56 high: `posterPaper` on black, the page's second colour on a poster page; disabled is the reference's grey |
| Way out | "Not now" as plain text under it |

**The typing never reflows**: the whole line is laid out from the first frame
and the untyped part is drawn in the ink at alpha 0. A letter every 20 ms,
evenly, timed by the frame clock; no vibration; a tap finishes it. The intro's
lines wait for a tap — nothing moves on by itself — with "tap to continue"
under a line once it has typed. Under Reduce Motion the line is just there. A page's controls fade in once its
headline has typed (capped at 0.9 s).

**The voice is the reference's — flirty** ("hello gorgeous.", "nice thumbs.
been gaming?"), chosen by the owner over a cheeky and a deadpan one. It never
promises a feature.

**None of these controls are the app's**, deliberately: the grey action pill
and the accent-wash choice (§ 9) do not apply here, and these do not apply
anywhere else.

## 27.2 The log form's progress pills

Seven pills, icon and title, no description: Want to play violet,
Playing teal, Paused yellow, Completed cobalt, 100% complete orange, Played
pink, Dropped crimson — the reference's blocks, mapped to keep the meaning each
status already has. The label is whichever of white or near-black clears the
fill (the reference's white-on-yellow is under 2:1).

- **Grid**: Want to play across the top, then three equal pairs — Playing ·
  Paused, Completed · 100%, Played · Dropped. One column past a 1.3 font scale.
  40 high (touched at 48), `Radius.pill`, 13 semibold labels and 15 glyphs that
  shrink a little before they wrap — the owner had them made smaller than the
  52 of a button.
- **Choosing — the owner's second rule**: every pill rests as a 1.5dp outline
  in its own colour, its words in that colour lifted to AA on the page; the
  chosen one pours solid (§ 27.3), its words in whichever ink reads on it.
  Tapping it again drains it, and the form will not save without a choice — a
  new log starts with none, not "Played". (The first rule — all solid until one
  was chosen, the rest sinking, the chosen growing 6% — is gone.)

## 27.3 The paint pour

**An outline that turns solid pours**, the owner's rule for every such control:
the colour is born at the pill's middle and spreads to its ends. A circle grows
from its centre over 560 ms on Material's standard ease (it starts gently, so
it is seen as a circle), clipped by the pill, and **stops the moment it has
reached every point inside it** — for a pill, the tips of its round ends
(`paintReach`). It meets the top and bottom first and the far ends last. The words and glyph change ink on a 160 ms ease.
Unchoosing drains it back to the middle. Reduce Motion: instant. Used by the
progress pills and their follow-up, the log form's toggles, every tab row, and
onboarding's chips — never by a choice that only washes (§ 9.4).

# 28. The event page

The reference's race page, as the owner described it: the landscape art at
the top, melting into the page; the name in `display`; a small line of where it
streams and a small-caps tag — Upcoming / Live now (in `danger`) / Ended; then
**bigger**, a stats strip of the date (weekday under it), the start time (the
countdown, or how long it ran, under it) and how many are watching; the faces
of the people watching, friends first, opening the whole list; About; and the
**games shown, only once it is over**. The one action is pinned to the foot
with the page fading under it — "I'll be watching" (and a reminder bell) before,
"Watch live" during, "Watch the replay" after when there is a stream. Going in
person is a quiet line under the faces.

# 26. Platform Reality & Known Deltas

## 26.1 This is React Native, not a web app

Worth restating in a design document because component snippets and design specs
found online almost always assume the opposite. There is **no DOM, no Tailwind,
no NativeWind and no shadcn** here. `src/global.css` defines four font variables
for `react-native-web` and nothing else — it is not a stylesheet.

| Web | Here |
|---|---|
| `<div>`, `<span>`, `<button>` | `<View>`, `<Text>`, `<Pressable>` |
| `className` + `clsx` | `StyleSheet.create` + `useTheme()` |
| CSS custom properties | `constants/theme.ts` tokens |
| media queries | `useWindowDimensions()` |
| `motion/react` | `react-native-reanimated` |
| `backdrop-blur` | `expo-blur`'s `<BlurView>` |
| `lucide-react` | `@expo/vector-icons`' Ionicons |
| `:hover`, `focus-visible` | press states; there is no hover on a phone |
| `box-shadow` | `shadow*` on iOS + `elevation` on Android |

Every value in this document is **dp**, not CSS px.

## 26.2 State of the code

**The frontmatter mirrors `src/constants/theme.ts`.** Colour, typography, radius,
spacing, motion and the score sizes all match. This document is descriptive, not
aspirational — if the two drift, one of them is a bug.

### What the migration changed

Recorded so the diff is explicable a year from now.

| Was | Became | Note |
|---|---|---|
| `title` 24/30 | `h1` 28/34 | Page titles grew |
| `heading` 18/24 semibold | `h3` 18/24 bold | Weight only |
| `section` 16/22 semibold | `h4` 16/22 bold | Weight only |
| `bodyStrong` 15/22 semibold | `h5` 14/20 bold | 52 sites |
| `caption` 13/18 medium | `bodySmall` 13/18 regular | Weight only, 82 sites |
| `micro` 12/16 medium | `caption` 11/15 regular | **147 sites — the largest change** |
| `body` 15/23 | `body` 15/22 | Leading only |
| — | `h2`, `h6`, `label`, `button`, `prose` | New steps |
| `Radius.image` 12 | 4 | |
| `Radius.control` 18 | 6 | |
| `Radius.card` 20 | 6 | |
| `Radius.input` 24 | 6 | |

`micro` did not map wholesale: uppercase section headings were promoted to
`label` rather than demoted to `caption`. `prose` was added rather than folding
article and review bodies onto `body` — see § 2.1.

Two platform facts survived untouched: **weight is a loaded family**, never a
`fontWeight` (Android silently ignores it), and text goes through
`<Text variant="…">`, never a raw `<Text>`.

### The case came through unchanged

Four lines were touched across the protected files, all of them identifier swaps
that render identically: `game-case.tsx` moved to `caseTitle`/`caseEdition`, and
`game-case-display.tsx` moved to `Radius.caseImage`. `platform-cases.ts`,
`game-disc.tsx` and `assets/cases/` were not touched at all.

Under the previous scale `Radius.image` and the case's cover radius were the same
number. They are separate tokens now for exactly that reason — a find-and-replace
on `12` would have silently redesigned the case.

### The control migration

Every generic control moved to the language of a premium music player; the
game page's Material 3 treatment, the brand buttons, the meaning colours and the
physical objects kept theirs (§ 9).

| Was | Became |
|---|---|
| `primary` PlayStation blue `#0070CC`, white ink | Unchanged. Lavender `#C4A1FF` was tried for one pass and the owner took it back to blue; the state roles are built from `primaryText` |
| `background` `#14171b`, ladder on hue 206° | `#0B0A0D`, ladder on a faint cool trace |
| `Radius.control` 6, `card` 6, `input` 6 | 20, 16, 16 — plus `inputArea` 20, `sheet` 24 |
| Selection one surface step lighter, never a hue | The accent's wash + edge + a brighter label (`useSelectable`) |
| Buttons filled, never outlined; `control` shadow | 1px edge on secondary and danger; no shadow |
| Square icon buttons | Circles, touched at the floor through slop |
| Fields: `bodySmall` label, no edge, card shadow | `fieldLabel` above, 1px edge, accent focus ring |
| Filter pills 44/48 tall, 6px corners | 36 tall pills touched at the floor, rows gapped by the slop |
| Home's strong corner glow + a centred ambient light | The soft ambient light alone, moved into the corner glow's place |
| **The reference pass** (SimpMusic's own code) | |
| Buttons: accent-filled primary, grey-with-edge secondary, 48dp | Every action one grey pill: `controlFill`, 52dp, full round, small label; disabled outlined |
| Fields: `input` #111014 + 1px edge, 16 radius, 48dp | A soft well: `input` 6% white, no border, 18 radius, 54dp; focus draws the accent's edge |
| Choices: resting fill + edge; radio on the trailing edge, 20dp | Outlined, no fill; `<SelectionCard>` with a 34dp circle on the leading edge and a check |
| Stat labels: uppercase `h6` (`TO BEAT`) | Sentence case `bodySmall` ("To beat"); rows title in `itemTitle` |
| Home's light at 0.18 | 0.42, near the reference's own top light |

The case came through this one unchanged too: its files were not touched, and
the three text inks and `borderStrong` it reads were deliberately left at their
old values. Its artwork wells use `surfaceElevated`, which darkened with the
room — visible only while a cover is loading or where a game has none.

### Remaining deltas

| # | Delta | Status |
|---|---|---|
| 1 | One score ramp: `scoreColor()` returns `scoreHigh` / `scoreMid` / `scoreLow` everywhere (amber won the neutral band). | Resolved. |
| 2 | The accent is **PlayStation blue** `#0070CC` (lavender was tried and reverted) and the page a near-black `#0B0A0D`, both by owner decision in the control migration (below). The cool `#14171b` is retired. | Decided. |
| 7 | The surface ladder shares the page's hue and its steps are slightly wider than before (1.068 / 1.070 / 1.100). | Resolved. |
| 3 | `MaxContentWidth` is 800 and the layout is phone-first single-column. There is no desktop grid. | By design. |
| 4 | Component geometry, SimpMusic's: 52 buttons (32 small, 60 large), 54 fields, 56 search bar, 32 chips and tabs, a 64 tab-bar capsule floating over the page, 44/48 tap target. | Current. |
| 5 | `game-disc.tsx` is protected, so its stray colour literals and its two bare `'transparent'` gradient stops were left alone. Those stops are the Android black-bruise bug this document warns about in § 1.5. | Knowingly deferred. |
| 6 | Regenerate `.impeccable/design.json` after any frontmatter change. No hook enforces it. | Manual. |
