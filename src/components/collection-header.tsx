import Ionicons from '@expo/vector-icons/Ionicons';
import { type ImageContentPosition } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { HandoffTitle } from '@/components/ui/handoff-title';
import { Avatar } from '@/components/ui/avatar';
import { ExpandableText } from '@/components/ui/expandable-text';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSectionMetrics } from '@/components/ui/section';
import { SmoothScrim } from '@/components/ui/smooth-scrim';
import { Text } from '@/components/ui/text';
import { HEADER_ART_SHARE } from '@/constants/header-art';
import { Palette, Radius, Spacing, TapTarget, Type, withAlpha } from '@/constants/theme';
import { useLikeToggle } from '@/hooks/use-like-toggle';
import { useTheme } from '@/hooks/use-theme';
import { displayNameFor } from '@/lib/format';
import { footFade, smoothScrimStops } from '@/lib/scrim';
import type { Engagement, ListCover, ListItem, ListWithItems } from '@/lib/api';
import type { Profile } from '@/lib/database.types';

/**
 * How much of the display the artwork block occupies: half, SimpMusic's album
 * and playlist header (`screenInfo.hDP / 2`), full width and cropped. Shared
 * with a review's hero (`constants/header-art`).
 */
export const COLLECTION_COVER_RATIO = HEADER_ART_SHARE;

/**
 * How much of the artwork the scrim covers, from the bottom: 70%, the
 * reference's `hDP * 0.35` of an `hDP / 2` frame. Long on purpose — the shorter
 * the ramp, the steeper its alpha, and a steep ramp is what reads as an edge.
 * The title sits over its last third, where the page colour has taken over.
 */
const SCRIM_RATIO = 0.7;

/** The quiet line under the title — "Collection · 12 games" — at the reference's 77% white. */
const META_ALPHA = 0.77;

/**
 * Where a *box* is anchored in the banner, top to bottom — the stand-in for a
 * game with no square art.
 *
 * A 2:3 cover in a banner this shape loses most of its height to the crop, and a
 * centred crop keeps the box's middle — usually a torso, or nothing. A cover's
 * subject and its logo sit high, so the crop is weighted a fifth of the way down.
 * Square art is composed for a square and is drawn from its centre.
 */
export const COLLECTION_BOX_ANCHOR = 0.22;
const SINGLE_ANCHOR = `${COLLECTION_BOX_ANCHOR * 100}%` as const;

/** The art giving way to the page over its bottom `SCRIM_RATIO`, eased at both ends. */
export const COLLECTION_COVER_FADE = footFade(SCRIM_RATIO);

/** How much of the cover, from the top, is darkened for the status bar and the glass discs. */
export const COLLECTION_SCRIM_TOP = 0.22;

/**
 * The two actions under the art: the reference album's 48dp circles
 * (`Modifier.size(48.dp).clip(CircleShape)`), 12 apart, glyphs at 22.
 */
const ACTION = 48;
const ACTION_GLYPH = 22;
/**
 * What an action is filled with: white at 12%, the reference's
 * `Color.White.copy(alpha = 0.12f)`. A wash of the ink rather than a grey of
 * the app's, because the page under it is a different colour for every
 * collection — a translucent fill is a step up from whichever.
 */
const ACTION_FILL = 0.12;
/** The owner's picture in the byline. */
const AVATAR = 36;
/** The mark on a collection with no cover to draw: its initial, or an award show's trophy. */
const EMPTY_GLYPH = 72;

/**
 * Lines of description shown before "See more".
 *
 * Three, and it is the reference's number. One line is a caption and cannot
 * carry an argument; the whole thing unclamped pushes the list itself off the
 * screen on any collection whose owner actually wrote something.
 */
const DESCRIPTION_LINES = 3;

export type CollectionHeaderProps = {
  collection: ListWithItems;
  owner: Profile | null;
  /**
   * The page's colour once its artwork has gone — the darker of the two tones
   * the screen fills with (`<Screen tone>`), or the app's own page for a
   * collection with no games. The artwork's foot fades into the page's colour
   * itself, read off the chrome; this is only what an *empty* collection's
   * well melts into, which has no artwork and so no tone.
   */
  pageColor?: string | null;
  /** Like count and whether the viewer is one of them. */
  engagement?: Engagement;
  onShare?: () => void;
  /** Ping it to somebody (0046) — a circle beside share's. */
  onPing?: () => void;
  /**
   * The glass bar's handoff (`handoffBand`): the name fades over its first
   * half as it goes under the bar, and the bar's name comes in over the
   * second. The page builds it from the name's height, `onTitleHeight`.
   */
  handoff?: { from: number; to: number };
  onTitleHeight?: (height: number) => void;
};

/**
 * Collection masthead — the owner's layout, top to bottom:
 *
 * ```
 * [               ART                ]   back at its top left, and — for
 * [        Collection title          ]   its owner — Edit at its top right
 *      Collection type · x games
 *
 * (picture) username        (share) (like)
 * About
 * ```
 *
 * Half a screen of artwork — one game's, the one that represents the
 * collection — melting into the page through a smoothstep scrim over its bottom
 * 70%, with the name and what it is set *over* the bottom of it, centred. That much is SimpMusic's
 * album header, read from `AlbumScreen.kt`. Under it, on the page's solid
 * colour, one row: who made it on the left, share and like on the right. Then
 * the description. The sort tools and the games are the screen's, below.
 *
 * ## What the owner changed, and it is three things
 *
 * **The byline came off the art.** It was the middle line of the title stack —
 * name, owner, kind — printed over the cover. It is under the art now, on solid
 * ground, at the left of a row of its own: a person is somebody to go and see,
 * and that is a control, not a caption.
 *
 * **Like is no longer the page's one big button.** The row was circle, white
 * pill, circle — share, a filled "Like" pill in the reference's Play slot, and
 * an overflow. The pill is gone: share and like are the reference's two quiet
 * 48dp circles at the right of the byline's row, and the like carries its count
 * beside its heart once it has one.
 *
 * **The owner's menu left the row for the top of the screen.** Rename, add
 * games, change the cover, delete: SimpMusic's album keeps "more" in a glass
 * control at the top right, opposite the back button, and that is where it is —
 * the screen's top bar, as a `<TopBarDisc>`. So this component no longer knows
 * whether the viewer owns the collection: the menu is `<CollectionOwnerMenu>`,
 * exported below, and the screen that owns the top bar opens it. The row here
 * measures the same for everybody.
 *
 * ## One left edge
 *
 * The byline, the description, the sort tools and the games all start on the
 * page's margin. The body used to be the reference's own column, 32 in, which
 * suited a row centred on the art's axis; a row with a name at one end and
 * buttons at the other belongs to the edges the list under it keeps.
 *
 * ## One game, always
 *
 * The owner's ruling: "inside the collection screen only have one game
 * displayed". The art is the collection's cover (`collectionCover`) — the game
 * its owner chose, or its first — for every kind of collection, an award show
 * included. It used to be that *or* a 2×2 mosaic of the first four, a setting on
 * each collection (`lists.cover_style`, 0033) with a trophy laid over the mosaic
 * of an award show. The mosaic was removed from the app with the setting; what
 * says "Award show" is the line under the title.
 *
 * ## The page takes that cover's colour
 *
 * The screen is the cover's Material 3 page — the box art's seed, as the
 * game's own page is (`useGameAccent`) — and the art melts into it: every
 * collection with a game in it. The controls wear the same scheme, through
 * the screen's `<AccentProvider>`; the two actions keep their wash of the ink.
 *
 * ## The art is pinned behind the page
 *
 * The game page's hero (`<PinnedHero>`): the art stays at the top of the
 * display, drifting slowly, while the title floats up over it; a blurred copy
 * fades in and the art drains into the page's colour, solid as the glass bar
 * comes in. This header leaves the room for it and draws the title over it.
 */
/**
 * Which picture a collection's hero is, and where it sits: its cover game's
 * square art where SteamGridDB has any, from its centre; else the box,
 * anchored a fifth of the way down (`COLLECTION_BOX_ANCHOR`). Null until the
 * square lookup has answered, so the box is never drawn and then swapped. The
 * header and the page's pinned hero both read it, so they cannot disagree.
 */
export function collectionArt(
  cover: { cover_url?: string | null; hero_url?: string | null } | null,
  square: { uri: string | null; resolved: boolean }
): { uri: string | null; contentPosition: ImageContentPosition } {
  const uri =
    cover && square.resolved ? (square.uri ?? cover.cover_url ?? cover.hero_url ?? null) : null;
  return {
    uri,
    contentPosition: square.uri ? 'center' : { top: SINGLE_ANCHOR, left: '50%' },
  };
}

/** The line under the title, and the four above it: where the name ends, for the bar. */
export const COLLECTION_META_LINE = (Type.body.lineHeight ?? 19) + Spacing.x4;

/** Where the title block's foot is above the art's: its padding. */
export const COLLECTION_TITLE_FOOT = Spacing.x24;

/** The solid part's soft top edge, and its stops. */
const LIP = 40;
const LIP_STOPS = smoothScrimStops();
function lipColours(page: string) {
  return LIP_STOPS.alphas.map((alpha) => withAlpha(page, alpha)) as unknown as readonly [
    string,
    string,
    ...string[],
  ];
}

export function CollectionHeader({
  collection,
  owner,
  pageColor = null,
  engagement,
  onShare,
  onPing,
  handoff,
  onTitleHeight,
}: CollectionHeaderProps) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const sections = useSectionMetrics();

  const items = collection.items ?? [];
  const cover = collectionCover(collection);
  const page = pageColor ?? theme.background;
  const description = collection.description?.trim();

  const { liked, likeCount, toggle } = useLikeToggle('list', collection.id, engagement);

  const coverHeight = Math.round(height * COLLECTION_COVER_RATIO);

  const actionFill = withAlpha(theme.text, ACTION_FILL);
  const ownerName = owner ? displayNameFor(owner) : null;

  const titleBlock = (
    <View style={styles.titleBlock} pointerEvents="none">
      {handoff ? (
        <HandoffTitle band={handoff} onHeight={onTitleHeight} style={styles.handoff}>
          <Text variant="display" numberOfLines={2} style={styles.title} accessibilityRole="header">
            {collection.title}
          </Text>
        </HandoffTitle>
      ) : (
        <Text variant="display" numberOfLines={2} style={styles.title} accessibilityRole="header">
          {collection.title}
        </Text>
      )}

      <Text variant="body" style={[styles.meta, { color: withAlpha(theme.text, META_ALPHA) }]}>
        {collectionKindLabel(collection)} · {items.length} {items.length === 1 ? 'game' : 'games'}
      </Text>
    </View>
  );

  return (
    <View>
      {/* The solid part's soft top edge, under the name: the art the name
          floats on gives way to the page here. First, so it is under it. */}
      {cover && (
        <View pointerEvents="none" style={[styles.lip, { top: coverHeight - LIP }]}>
          <LinearGradient
            colors={lipColours(page)}
            locations={LIP_STOPS.locations as unknown as readonly [number, number, ...number[]]}
            style={styles.fill}
          />
        </View>
      )}

      {/*
        The name and what it is, set over the artwork.

        Anchored to the bottom of the cover block rather than placed after it,
        so they sit on ground the fade has already turned — printed on the
        cover rather than captioned beneath it. `paddingBottom` is what keeps
        them clear of the very bottom edge, where the fade is wholly the ground
        and the text would look like it had fallen out of the image.

        Two lines of the reference's three: the name, then the kind and count
        at 77% white — "2007 • Album" in SimpMusic, "Collection · 12 games"
        here. Its middle line, the artist, is this collection's owner, and the
        owner asked for that under the art.
      */}
      {cover ? (
        /*
          Where the artwork shows through, with the name over its foot.

          The art is not drawn here any more: it is pinned behind the page
          (`<PinnedHero>`, the screen's backdrop — `collectionArt` is which
          picture), as the game page's and the studio's are, so the name
          floats up over it as the page scrolls and the page's solid part
          rises and swallows it. This is the room the page leaves it at rest.
        */
        <View style={{ height: coverHeight }}>{titleBlock}</View>
      ) : (
        /*
          A collection with no games in it yet has no cover to draw. It gets the
          app's well and its own initial — or a trophy, for an award show
          nobody has filled in — so the title has ground to stand on and the
          page does not open on a hole.
        */
        <View style={[styles.cover, { height: coverHeight }]}>
          <View style={[styles.single, styles.empty, { backgroundColor: theme.surfaceElevated }]}>
            {collection.kind === 'awards' ? (
              <Ionicons name="trophy" size={EMPTY_GLYPH} color={theme.identityGold} />
            ) : (
              <Text variant="display" color="textMuted" style={styles.emptyLetter}>
                {collection.title.trim().charAt(0).toUpperCase() || '?'}
              </Text>
            )}
          </View>
          <SmoothScrim color={page} style={[styles.fade, { height: `${SCRIM_RATIO * 100}%` }]} />
          {titleBlock}
        </View>
      )}

      {/* Under the art, on the page's own colour, at the page's margin — the
          left edge the sort tools and the games below it keep. */}
      <View style={[styles.body, { paddingTop: sections.cardGap, backgroundColor: page }]}>
        {/*
          Who made it, and the two things a reader can do about it.

          The byline is only as wide as its picture and its name, so a press in
          the empty middle of the row is a press on nothing. A long name gives
          way before the buttons do.
        */}
        <View style={styles.byRow}>
          {owner && ownerName ? (
            <Link href={{ pathname: '/profile/[id]', params: { id: owner.id } }} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`${ownerName}'s profile`}
                scaleTo={0.98}
                style={StyleSheet.flatten(styles.byline)}>
                <Avatar uri={owner.avatar_url} name={ownerName} size={AVATAR} />
                <Text variant="itemTitle" numberOfLines={1} style={styles.bylineName}>
                  {ownerName}
                </Text>
              </PressableScale>
            </Link>
          ) : (
            /* Holds the row's height, and the actions at its right, while the
               owner is still being fetched. */
            <View style={styles.bylineSpacer} />
          )}

          <View style={styles.actions}>
            {onPing && (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Ping this collection to someone"
                onPress={onPing}
                pressedColor={theme.pressed}
                scaleTo={0.92}
                style={StyleSheet.flatten([styles.action, { backgroundColor: actionFill }])}>
                <PressGlyph motion="skip">
                  <Ionicons name="paper-plane-outline" size={ACTION_GLYPH} color={theme.text} />
                </PressGlyph>
              </PressableScale>
            )}
            {onShare && (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Share this collection"
                onPress={onShare}
                pressedColor={theme.pressed}
                scaleTo={0.92}
                style={StyleSheet.flatten([styles.action, { backgroundColor: actionFill }])}>
                <PressGlyph>
                  <Ionicons name="share-outline" size={ACTION_GLYPH} color={theme.text} />
                </PressGlyph>
              </PressableScale>
            )}

            {/*
              The like: a circle while nobody has liked it, and the same circle
              drawn out to hold its count once somebody has.

              Liked is the app's amber and a solid heart — `liked`, never
              `danger`, which means "this destroys something". The solid-versus-
              outline glyph is the second carrier, so the state never rests on
              hue alone; the count stays in the ink, because it is everybody's
              number and not a statement about the reader.
            */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                likeCount > 0
                  ? `${liked ? 'Unlike' : 'Like'} this collection. ${likeCount} ${likeCount === 1 ? 'like' : 'likes'}.`
                  : `${liked ? 'Unlike' : 'Like'} this collection`
              }
              accessibilityState={{ selected: liked }}
              onPress={toggle}
              pressedColor={theme.pressed}
              scaleTo={0.92}
              style={StyleSheet.flatten([
                styles.action,
                likeCount > 0 && styles.actionCounted,
                { backgroundColor: actionFill },
              ])}>
              <PressGlyph pop={liked}>
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={ACTION_GLYPH}
                  color={liked ? theme.liked : theme.text}
                />
              </PressGlyph>
              {likeCount > 0 && <Text variant="button">{likeCount}</Text>}
            </PressableScale>
          </View>
        </View>

        {/*
          The description: the reference's `DescriptionView`, three lines and
          then its More, opening in place (`<ExpandableText>`). With nothing
          written the same slot says so, in the same type and the same place,
          as the reference's does.
        */}
        <View style={[styles.about, { paddingVertical: sections.cardGap }]}>
          {description ? (
            <ExpandableText rich lines={DESCRIPTION_LINES} subject="the description">
              {description}
            </ExpandableText>
          ) : (
            <Text variant="body" color="textSecondary">
              No description
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

/** What kind of thing this is, in the reference's "Playlist · 2026" slot. */
function collectionKindLabel(collection: ListWithItems): string {
  switch (collection.kind) {
    case 'awards':
      return 'Award show';
    case 'tier':
      return 'Tier list';
    case 'captioned':
      return 'Board';
    case 'favorites':
      return 'Favourites';
    case 'wishlist':
      return 'Wishlist';
    default:
      return collection.is_ranked ? 'Ranked list' : 'Collection';
  }
}

export type CollectionOwnerMenuProps = {
  open: boolean;
  onClose: () => void;
  collection: ListWithItems;
  /** Rename the collection and rewrite its About. */
  onEditDetails?: () => void;
  /** Add games. */
  onEdit?: () => void;
  /** Enter the "tap a game to use its cover" mode. */
  onPickCover?: () => void;
  onDelete?: () => void;
};

/**
 * Everything an owner can do to a collection, on a sheet.
 *
 * Opened from the top right of the screen — a glass disc opposite the back
 * button, where SimpMusic's album keeps its "more" — and rendered by the screen
 * that owns that bar, which is why it is exported and why the masthead above
 * knows nothing about it.
 *
 * These are administration — rename it, add to it, change its cover, delete
 * it — and none of them is what a person opening a collection came to do. In
 * the masthead's own row they cost a wrapped second line on every phone and put
 * a delete button a thumb's width from the like.
 */
export function CollectionOwnerMenu({
  open,
  onClose,
  collection,
  onEditDetails,
  onEdit,
  onPickCover,
  onDelete,
}: CollectionOwnerMenuProps) {
  const theme = useTheme();

  const count = (collection.items ?? []).length;
  /* Which cover — the game the collection opens on, and the front of its stack
     wherever it is listed — once there is more than one to pick from. It was
     offered only after switching a collection from four covers to one; there
     is no four any more, so it is simply there. */
  const canPickCover = !!onPickCover && count > 1;

  function run(action?: () => void) {
    onClose();
    action?.();
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      {/* The scrim dismisses. A sheet with no way out but its own buttons is a
          trap on Android, where there is no swipe-down to close a transparent
          modal. */}
      <Pressable
        style={[styles.backdrop, { backgroundColor: withAlpha(Palette.shadowInk, 0.6) }]}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
          ]}
          /* Swallows the tap so pressing the sheet itself does not dismiss it. */
          onPress={() => {}}>
          {onEditDetails && (
            <MenuRow
              icon="create-outline"
              label="Edit name and description"
              onPress={() => run(onEditDetails)}
            />
          )}
          {onEdit && <MenuRow icon="add" label="Add games" onPress={() => run(onEdit)} />}
          {canPickCover && onPickCover && (
            <MenuRow
              icon="images-outline"
              label="Choose the cover"
              onPress={() => run(onPickCover)}
            />
          )}
          {onDelete && (
            <MenuRow
              icon="trash-outline"
              label="Delete collection"
              danger
              onPress={() => run(onDelete)}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const theme = useTheme();
  const ink = danger ? theme.danger : theme.text;

  /* A menu row: flat until pressed, then a soft inset fill — the rounded ends
     show because the row sits inset from the sheet's edges. */
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.98}
      pressedColor={danger ? withAlpha(theme.danger, 0.12) : theme.pressed}
      style={StyleSheet.flatten([styles.menuRow, { backgroundColor: 'transparent' }])}>
      <Ionicons name={icon} size={20} color={ink} />
      <Text variant="h5" style={{ color: ink }}>
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * The one cover a collection shows, or null for a collection with no art to
 * show. The screen reads it too — the page colour comes from this game's box
 * art — so the two cannot disagree about which game it is.
 *
 * The owner's pick while it is still in the list, otherwise the first item with
 * art: `resolvePreview` in `api/lists.ts`, over the full items the page has
 * rather than the summary's. The two must stay in agreement — it is the same
 * game that stands in front of the collection's stack wherever it is listed,
 * and a tile has to lead to the cover it was showing.
 *
 * This used to answer "one cover, or several?" as well: null meant the header
 * drew a mosaic of the first four, which an owner chose per collection
 * (`cover_style`, 0033). The mosaic is gone and so is the question — every
 * collection, an award show included, is this one game.
 */
export function collectionCover(collection: ListWithItems): ListCover | null {
  return singleCover(collection.items ?? [], collection.cover_game_id);
}

function singleCover(items: ListItem[], chosenId: string | null): ListCover | null {
  const games = items
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item) => item.game)
    .filter((game): game is NonNullable<typeof game> => !!(game?.cover_url ?? game?.hero_url));
  const game = games.find((entry) => entry.id === chosenId) ?? games[0];
  return game
    ? { id: game.id, title: game.title, cover_url: game.cover_url, hero_url: game.hero_url }
    : null;
}

const styles = StyleSheet.create({
  cover: { position: 'relative', width: '100%', overflow: 'hidden' },
  single: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /* Centred a little high: the title block is printed over the bottom third. */
  empty: { alignItems: 'center', justifyContent: 'center', paddingBottom: '18%' },
  /* The letter is the picture here, so it is larger than any heading — and it
     states its line height, which Android clips a glyph to. */
  emptyLetter: { fontSize: EMPTY_GLYPH, lineHeight: EMPTY_GLYPH + 12 },
  /* `height` is supplied inline — `SCRIM_RATIO` of the artwork, from the bottom. */
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  /* The reference's title block: 20 in from each side, 16 up from the edge
     (`x24`, the ladder's 15), and 4 between its two lines. */
  lip: { position: 'absolute', left: 0, right: 0, height: LIP },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  titleBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x32,
    paddingBottom: Spacing.x24,
  },
  title: { textAlign: 'center' },
  /* The name's own width, as the column had it: the text centres in it. */
  handoff: { alignSelf: 'stretch' },
  meta: { textAlign: 'center' },

  /* The page's margin: one left edge for the byline, the description, the sort
     tools and the games. */
  body: { paddingHorizontal: Spacing.x16 },
  byRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x12,
    minHeight: ACTION,
  },
  /* Shrinks, so a long name is cut before the buttons are pushed off the row;
     never grows, so the link is no wider than what it shows. */
  byline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    flexShrink: 1,
    minHeight: ACTION,
  },
  bylineName: { flexShrink: 1 },
  bylineSpacer: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  /* `AlbumScreen.kt`'s action circles: 48 across, fully round. */
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    minWidth: ACTION,
    height: ACTION,
    borderRadius: ACTION / 2,
  },
  /* With a count beside the heart the circle is a capsule, and the two need
     room at its ends that a lone glyph did not. */
  actionCounted: { paddingHorizontal: Spacing.x16 },

  /* Start-aligned across the column: a paragraph, not a caption. */
  about: { alignSelf: 'stretch' },

  backdrop: { flex: 1, justifyContent: 'flex-end' },
  /* The menu surface: `Radius.sheet` and a hairline on the three sides that
     meet the scrim. */
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingVertical: Spacing.x16,
    paddingHorizontal: Spacing.x8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x16,
    minHeight: TapTarget + Spacing.x4,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.card,
  },
});
