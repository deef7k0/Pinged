import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import Ionicons from '@expo/vector-icons/Ionicons';

import {
  CARD_GAP,
  CARD_INSET,
  cardShape,
  useCardMaterial,
  useCardless,
} from '@/components/ui/card-material';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Text } from '@/components/ui/text';
import { MaxContentWidth, TapTarget, Type, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The width SimpMusic's artist page was measured at: the owner's phone, 360dp
 * across, where its 180dp album art is exactly half the display.
 *
 * Every size below is one of SimpMusic's dp values over this — a *fraction of
 * the window* — so a wider phone draws the same composition larger, rather than
 * the same numbers with more air around them. Type is the exception and stays
 * on `Type`: text follows the reader's font size, never the width of the glass.
 * Read from `ArtistScreen.kt`, `AdapterItems.kt` and `DescriptionView.kt`.
 */
const REFERENCE_WIDTH = 360;

export type SectionMetrics = ReturnType<typeof metricsFor>;

function metricsFor(windowWidth: number) {
  const width = Math.min(windowWidth, MaxContentWidth);
  const at = (dp: number) => Math.round((dp / REFERENCE_WIDTH) * width);

  return {
    /** A heading, a card and a rail's first item all start this far in: the reference's 20. */
    inset: at(20),
    /**
     * The sides of an album or playlist's body — its actions and description,
     * under a centred header: the reference's 32 (`AlbumScreen.kt`).
     */
    bodyInset: at(32),
    /** A heading row, with or without its More: the height of the reference's `TextButton`. */
    headerHeight: at(40),
    /** The More's own padding, the `TextButton`'s 12, so its word sits in from the edge. */
    moreInset: at(12),
    /** Between two items in a rail — each carries 10 either side. */
    itemGap: at(20),
    /** From a heading down to the art under it: an item's 10 of top padding. */
    artTop: at(10),
    /** From the art down to its title. */
    titleTop: at(8),
    /** Under an item's last line. */
    itemBottom: at(6),
    /**
     * 16:9 — screenshots, a review's card — at the reference's video height.
     * Box art is not here: a row of covers has its own measurements, from
     * another reference (`constants/cover-rail`).
     */
    wide: { width: at(284.5), height: at(160) },
    /** A square tile — a store in Where to buy — a little shorter than a wide one. */
    square: { width: at(120), height: at(120) },
    /**
     * From a card's text to its More (`<ExpandableText>`). A card's own corner,
     * inset and gaps are the review card's now, fixed dp (`card-material`).
     */
    cardGap: at(8),
    /** Between one section and the next heading. */
    sectionGap: at(10),
  };
}

/** SimpMusic's section geometry for this window. See `REFERENCE_WIDTH`. */
export function useSectionMetrics(): SectionMetrics {
  const { width } = useWindowDimensions();
  return useMemo(() => metricsFor(width), [width]);
}

/**
 * How far in a section's heading and card sit from the edges of whatever holds
 * them, and where a rail's first item starts.
 *
 * Zero unless a screen says otherwise: a container that pads itself — the
 * Similar tab — keeps its own margin. The Overview tab sets the reference's
 * inset and pads nothing, so its rails can run the full width and still start
 * in line with the headings above them. A `<Panel>` reads this too: an inset
 * is how it knows it is on a game's page.
 */
const SectionInsetContext = createContext(0);

export function SectionInsetProvider({ inset, children }: { inset: number; children: ReactNode }) {
  return <SectionInsetContext.Provider value={inset}>{children}</SectionInsetContext.Provider>;
}

export function useSectionInset(): number {
  return useContext(SectionInsetContext);
}

export type SectionMoreProps = {
  /** "More" unless the section's way onward has a name of its own. */
  label?: string;
  accessibilityLabel: string;
  onPress: () => void;
};

/**
 * The heading's way onward: the reference's `TextButton` — one small word in
 * the quiet ink, no fill, no edge — at the right end of the heading row.
 */
export function SectionMore({ label = 'More', accessibilityLabel, onPress }: SectionMoreProps) {
  const metrics = useSectionMetrics();
  /* The row is the reference's 40; a finger needs the platform floor. */
  const reach = Math.max(0, Math.ceil((TapTarget - metrics.headerHeight) / 2));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={{ top: reach, bottom: reach, left: 0, right: 0 }}
      scaleTo={0.95}
      style={StyleSheet.flatten([
        styles.more,
        { minHeight: metrics.headerHeight, paddingHorizontal: metrics.moreInset },
      ])}>
      <Text variant="bodySmall" color="textSecondary">
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * A section's heading, Apple's (the Apple pass, 2026-11-04): the name in
 * `h2` — Title 2, 22 bold — and, where it leads somewhere, a chevron straight
 * after it ("Trailers ›"), the whole line the door. A quiet fact about it
 * (`action`) or a trigger that owns what it opens (`moreSlot`) goes at the
 * far end.
 *
 * It was Apple TV's heading on the game page only (`CardlessContext`), and
 * SimpMusic's artist-page heading everywhere else — `h4` 16 with a small
 * "More" at the far end. One heading now.
 */
export function SectionHeader({
  title,
  action,
  more,
  moreSlot,
}: {
  title: string;
  action?: ReactNode;
  more?: SectionMoreProps;
  /**
   * A More that owns what it opens — a sheet's own trigger, drawn with
   * `<SectionMore>` — set at the far end of the row.
   */
  moreSlot?: ReactNode;
}) {
  const inset = useSectionInset();
  const theme = useTheme();

  const words = (
    <>
      <Text variant="h2" accessibilityRole="header" numberOfLines={1} style={styles.tvTitle}>
        {title}
      </Text>
      {more && <Ionicons name="chevron-forward" size={20} color={withAlpha(theme.text, 0.6)} />}
    </>
  );
  return (
    <View style={[styles.tvHeader, { paddingHorizontal: inset }]}>
      {more ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={more.accessibilityLabel}
          onPress={more.onPress}
          hitSlop={TV_SLOP}
          scaleTo={0.98}
          style={StyleSheet.flatten(styles.tvDoor)}>
          {words}
        </PressableScale>
      ) : (
        <View style={styles.tvDoor}>{words}</View>
      )}
      <View style={styles.title} />
      {action}
      {moreSlot}
    </View>
  );
}

/**
 * A section's card: what the heading over it names, in the review card's
 * material (`useCardMaterial`) — the corner, the hairline, fifteen in and
 * twelve between its parts.
 *
 * It was the reference's description card for a while — SimpMusic's
 * `ElevatedCard`, 8 in the corner and 16 in, scaled with the display — and the
 * owner had every card in the app made the review card (2026-10-20), "even
 * the ones in the game page". On a game's page the fill is still the game's
 * own dark tone, its `primaryContainer` at half brightness, which is what
 * SimpMusic's halved dark-vibrant swatch came to; every ink on it clears AA
 * with room (`textSecondary` 6.4:1, `controlInk` 10.5:1, across eight seeds).
 * With game colours off it is `surface`, as everywhere else.
 *
 * `onPress` makes the whole card the way onward, for a card that summarises
 * where its heading's More goes.
 */
export function SectionCard({
  children,
  padded = true,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  /** Off for content that reaches the card's own edges. */
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const inset = useSectionInset();
  const material = useCardMaterial();
  const cardless = useCardless();

  const card = StyleSheet.flatten([
    !cardless && cardShape,
    {
      marginHorizontal: inset,
      backgroundColor: material.fill,
      borderColor: material.edge,
      gap: CARD_GAP,
    },
    padded && !cardless && { padding: CARD_INSET },
    style,
  ]);

  if (!onPress) return <View style={card}>{children}</View>;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      scaleTo={0.98}
      style={card}>
      {children}
    </PressableScale>
  );
}

/**
 * A heading and what it heads — a card, a rail — as the reference stacks them.
 * The heading row is the only space between the two.
 */
export function Section({
  title,
  action,
  more,
  moreSlot,
  children,
}: {
  title: string;
  action?: ReactNode;
  more?: SectionMoreProps;
  moreSlot?: ReactNode;
  children: ReactNode;
}) {
  /* A `<Reveal>`: on a page that opts in (`<RevealScope>`), the section rises
     into place as it scrolls into view; everywhere else it is a plain view. */
  return (
    <Reveal>
      <SectionHeader title={title} action={action} more={more} moreSlot={moreSlot} />
      {children}
    </Reveal>
  );
}

/**
 * Wide (screenshots, trailers) or square (a store). Box art was another, at
 * the reference's album height; rows of games are `<GameCoverRail>` now.
 */
export type ArtShape = 'wide' | 'square';

/**
 * A row of artwork under a heading: the reference's `LazyRow` of
 * `HomeItemContentPlaylist` — the art, then its title (two lines, always
 * reserved, so a rail is one height whatever its titles) and one quiet line.
 *
 * Full width, starting at the section inset so the first piece of art is in
 * line with the heading above it, and running off both edges as it scrolls.
 * `renderArt` draws the art at the size it is handed; the shape sets that size
 * (see `useSectionMetrics`).
 *
 * Windowed like every rail in the app: a screenful and a little more up front,
 * one screen either side after that.
 */
/** What an item's art is drawn with, beyond its size. */
export type ArtRailContext = {
  index: number;
  /** The rail's scroll offset, when it runs the parallax; null when it does not. */
  scrollX: SharedValue<number> | null;
  /** Where the first item starts and how far apart items sit — for `useRailDrift`. */
  inset: number;
  itemGap: number;
};

export function ArtRail<T>({
  data,
  keyOf,
  shape,
  renderArt,
  titleOf,
  subtitleOf,
  onPressItem,
  labelOf,
  inset: insetProp,
  parallax = false,
}: {
  data: readonly T[];
  keyOf: (item: T) => string;
  shape: ArtShape;
  renderArt: (
    item: T,
    size: { width: number; height: number },
    context: ArtRailContext
  ) => ReactNode;
  /** A caption under the art; `undefined` for an item leaves that one bare. */
  titleOf?: (item: T) => string | undefined;
  subtitleOf?: (item: T) => string | null;
  onPressItem?: (item: T) => void;
  /** What a screen reader says for an item; defaults to its title. */
  labelOf?: (item: T) => string;
  /**
   * Where the first item starts, when the screen's margin is not the section
   * inset in force — Home and Search keep the app's 10.
   */
  inset?: number;
  /**
   * Let the art sit behind its frame and slide as the rail moves (`<Poster
   * parallax>`), as Home's rails always have. Off under a reduced-motion
   * preference.
   */
  parallax?: boolean;
}) {
  const metrics = useSectionMetrics();
  const contextInset = useSectionInset();
  const inset = insetProp ?? contextInset;
  const size = metrics[shape];
  const reduceMotion = useReducedMotion();

  /* Written and read on the UI thread, so a drag never enters JS. */
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });
  const driver = parallax && !reduceMotion ? scrollX : null;

  return (
    <Animated.FlatList
      data={data}
      horizontal
      keyExtractor={keyOf}
      showsHorizontalScrollIndicator={false}
      initialNumToRender={4}
      windowSize={3}
      onScroll={driver ? onScroll : undefined}
      scrollEventThrottle={16}
      contentContainerStyle={{
        paddingHorizontal: inset,
        paddingTop: metrics.artTop,
        paddingBottom: metrics.itemBottom,
        gap: metrics.itemGap,
      }}
      renderItem={({ item, index }) => {
        const title = titleOf?.(item);
        const subtitle = subtitleOf?.(item);
        const body = (
          <View style={{ width: size.width }}>
            {renderArt(item, size, { index, scrollX: driver, inset, itemGap: metrics.itemGap })}
            {title !== undefined && (
              <View style={{ paddingTop: metrics.titleTop }}>
                <Text variant="itemTitle" numberOfLines={2} style={styles.itemTitle}>
                  {title}
                </Text>
                {!!subtitle && (
                  <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
                    {subtitle}
                  </Text>
                )}
              </View>
            )}
          </View>
        );

        if (!onPressItem) return body;
        return (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={labelOf?.(item) ?? title}
            onPress={() => onPressItem(item)}
            scaleTo={0.96}>
            {body}
          </PressableScale>
        );
      }}
    />
  );
}

const TV_SLOP = { top: 12, bottom: 12, left: 0, right: 0 };

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  tvHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    marginBottom: 2,
  },
  tvDoor: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  tvTitle: { flexShrink: 1 },
  title: { flex: 1 },
  more: { justifyContent: 'center' },
  /* Two lines held open, the reference's `heightIn(min = thumbSize + 70.dp)`:
     a one-line title does not make its item shorter than its neighbours. */
  itemTitle: { minHeight: Type.itemTitle.lineHeight * 2 },
});
