import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { memo } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { PING_GLYPH, usePingTo } from '@/components/pings/use-ping-to';
import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Typeface, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayNameFor } from '@/lib/format';
import type { ListSummary } from '@/lib/api';

/** One square of the mosaic, and the gap that keeps the four apart. */
const SQUARE = 46;
const SQUARE_GAP = 4;
/** The mosaic: two squares and the gap between them, each way. */
const MOSAIC = SQUARE * 2 + SQUARE_GAP;
/** The kind's mark on the title line. */
const KIND_GLYPH = 13;

/** No covers yet: the summary a restored cache row may still be missing them from. */
const NO_COVERS: ListSummary['stack'] = [];

export type ListTileProps = { list: ListSummary };

/**
 * A collection, wherever collections are listed: **a mosaic of four squares**
 * — each a game's portrait cover, cropped to the square, a hair apart — and
 * beside it the collection's name and two small lines in capitals.
 *
 * ```
 *  ▮▮ ▮▮   Great Games To Create Screenshots
 *  ▮▮ ▮▮   316 GAMES
 *  ▮▮ ▮▮   BY ADA
 *  ▮▮ ▮▮
 * ───────────────────────────────────────────   a hairline to the next
 * ```
 *
 * The owner's reference (2026-10-22): a list of collections from another game
 * site — "a mosaic, 4 squares with the portrait cover in each square. They are
 * slightly separated, you can make out the squares." Rows on the page with a
 * hairline between them (`<CollectionSeparator>`), not cards. It replaced the
 * review card with a stack of five covers (`<CoverStack>`, a collection's
 * tile from 2026-10-09), and the owner's earlier "remove the mosaic" — that
 * was four covers joined into one picture on the collection's *own* screen,
 * which stays one cover.
 *
 * - **The squares are 46, four apart**: the reference's mosaic is a hundred
 *   pixels of two squares and a visible gap. A cover is cropped to its middle
 *   — IGDB publishes no square, and the squares are thumbnails. The first is
 *   the collection's chosen cover (`list.stack`, the game its screen opens
 *   on), then the rest in order; a collection of fewer than four keeps the
 *   empty squares, drawn as faint tiles, so every mosaic is the same shape.
 * - **The name is `h3`, two lines at most**, top-aligned with the mosaic.
 * - **Two quiet lines in capitals**: how many games, and whose it is. The
 *   reference's second line is a count of its "cakes" — likes. A collection's
 *   likes are not on its summary and cost a request per screenful (the owner
 *   had that request removed once), so the line is the owner, whom the old
 *   card named in its byline.
 * - **No description.** It is on the collection's screen.
 * - **A ⋯ at the far end** (the Apple pass, 2026-11-05): Ping, Share and the
 *   owner's profile, in an anchored menu. The rest of the row opens it.
 */
export const ListTile = memo(function ListTile({ list }: ListTileProps) {
  const theme = useTheme();

  /*
   * `?? NO_COVERS` is for a summary written to the device before it had a
   * `stack` at all — reading `.slice` off that would close the screen.
   */
  const router = useRouter();
  const pingTo = usePingTo();
  const [trigger, menu] = useAnchoredMenu();

  const owner = displayNameFor(list.owner);
  const games = `${list.itemCount} ${list.itemCount === 1 ? 'game' : 'games'}`;

  /* The shapes that are not a plain collection: which of these you are
     looking at changes what the games inside mean. */
  const kindGlyph =
    list.kind === 'awards'
      ? 'trophy'
      : list.kind === 'tier'
        ? 'layers'
        : list.kind === 'captioned'
          ? 'grid'
          : list.is_ranked
            ? 'list'
            : null;

  function act(then: () => void) {
    menu.close();
    then();
  }

  return (
    <View style={styles.row}>
      <Link href={{ pathname: '/list/[id]', params: { id: list.id } }} asChild>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={[list.title, games, `by ${owner}`].join(', ')}
          scaleTo={0.98}
          style={styles.open}>
          <CollectionMosaic list={list} size={MOSAIC} />

          <View style={styles.words}>
            <Text variant="h3" numberOfLines={2}>
              {kindGlyph && (
                /* Inline, so it sits on the title's first line and wraps with it. */
                <Ionicons
                  name={kindGlyph}
                  size={KIND_GLYPH}
                  color={list.kind === 'awards' ? theme.identityGold : theme.textMuted}
                />
              )}
              {kindGlyph ? ` ${list.title}` : list.title}
            </Text>
            <Text variant="body" color="textMuted" numberOfLines={1} style={styles.fact}>
              {games}
            </Text>
            <Text variant="body" color="textMuted" numberOfLines={1} style={styles.fact}>
              {`by ${owner}`}
            </Text>
          </View>
        </PressableScale>
      </Link>

      {/* Apple Music's ⋯ at the end of a row: what else can be done with it. */}
      <View ref={trigger} collapsable={false}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`More for ${list.title}`}
          onPress={menu.open}
          scaleTo={0.9}
          hitSlop={8}
          style={styles.more}>
          <PressGlyph>
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
          </PressGlyph>
        </PressableScale>
      </View>

      <AnchoredMenu menu={menu} label={list.title} align="end" width={240}>
        {pingTo && (
          <AnchoredMenuItem
            icon={PING_GLYPH}
            title="Ping"
            onPress={() =>
              act(() =>
                pingTo({
                  kind: 'collection',
                  targetId: list.id,
                  title: list.title,
                  subtitle: `${games} · by ${owner}`,
                  imageUrl: list.preview?.cover_url ?? list.preview?.hero_url ?? null,
                })
              )
            }
          />
        )}
        <AnchoredMenuItem
          icon="share-outline"
          title="Share"
          onPress={() =>
            act(() => {
              Share.share({ message: `${list.title} — ${games} on Pinged` }).catch(() => undefined);
            })
          }
        />
        <AnchoredMenuItem
          icon="person-circle-outline"
          title={`Go to ${owner}`}
          onPress={() =>
            act(() => router.push({ pathname: '/profile/[id]', params: { id: list.user_id } }))
          }
        />
      </AnchoredMenu>
    </View>
  );
});

/**
 * The four squares on their own, at any size: a row's 96, Explore's shelf's
 * larger square. A hair apart at every size, so the squares still read.
 */
export function CollectionMosaic({ list, size }: { list: ListSummary; size: number }) {
  const theme = useTheme();
  /*
   * `?? NO_COVERS` is for a summary written to the device before it had a
   * `stack` at all — reading `.slice` off that would close the screen.
   */
  const stack = list.stack ?? NO_COVERS;
  const squares = Array.from({ length: 4 }, (_, index) => stack[index] ?? null);
  const square = (size - SQUARE_GAP) / 2;
  return (
    <View style={[styles.mosaic, { width: size, height: size }]}>
      {squares.map((cover, index) => (
        <View
          key={cover?.id ?? `empty-${index}`}
          style={[
            styles.square,
            { width: square, height: square, backgroundColor: theme.surfaceElevated },
          ]}>
          {cover?.cover_url || cover?.hero_url ? (
            <Image
              source={{ uri: (cover.cover_url ?? cover.hero_url)! }}
              recyclingKey={cover.cover_url ?? cover.hero_url}
              cachePolicy="memory-disk"
              contentFit="cover"
              transition={220}
              style={StyleSheet.absoluteFill}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * A collection on a shelf, as Apple Music's playlist shelf draws one: the
 * square — here the mosaic — with its name and who made it under it. Explore's
 * Popular collections.
 */
export const CollectionShelfCard = memo(function CollectionShelfCard({
  list,
  size,
}: {
  list: ListSummary;
  size: number;
}) {
  const owner = displayNameFor(list.owner);
  return (
    <Link href={{ pathname: '/list/[id]', params: { id: list.id } }} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${list.title}, ${list.itemCount} ${
          list.itemCount === 1 ? 'game' : 'games'
        }, by ${owner}`}
        scaleTo={0.97}
        style={StyleSheet.flatten([styles.shelfCard, { width: size }])}>
        <CollectionMosaic list={list} size={size} />
        <Text variant="itemTitle" numberOfLines={1} style={styles.shelfTitle}>
          {list.title}
        </Text>
        <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
          {owner}
        </Text>
      </PressableScale>
    </Link>
  );
});

/**
 * The hairline between two collections — every list of `<ListTile>`s uses it
 * as its separator. Module scope, so a list's separator prop is one component
 * type for the life of the list.
 */
export function CollectionSeparator() {
  const theme = useTheme();
  return <View style={[styles.separator, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  /* The reference's rows: the mosaic and the words, twenty apart, and about as
     much air above and below as the gap the mosaic's squares are spaced by
     makes look intended. */
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  open: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x20,
    paddingVertical: Spacing.x20,
  },
  more: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  mosaic: { flexDirection: 'row', flexWrap: 'wrap', gap: SQUARE_GAP },
  square: { borderRadius: Radius.image, borderCurve: 'continuous', overflow: 'hidden' },
  shelfCard: { gap: 2 },
  shelfTitle: { marginTop: Spacing.x8 },
  words: { flex: 1, gap: Spacing.x4, paddingTop: 2 },
  /* Spaced capitals, as the reference's counts are; a hair of tracking keeps
     the small caps from crowding. */
  fact: { fontFamily: Typeface.medium },
  separator: { height: StyleSheet.hairlineWidth },
});
