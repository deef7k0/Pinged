import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { SurpriseBloom, BLOOM_BLEED } from '@/components/surprise-bloom';
import { SurpriseCardArt, type CardArtBox } from '@/components/surprise-card-art';
import { PlatformMarks } from '@/components/ui/platform-chip';
import { MarqueeText } from '@/components/ui/marquee-text';
import { KEY_GROUP_GAP, KEY_HEIGHT, TonalKey } from '@/components/ui/tonal-key';
import { ScoreLine } from '@/components/ui/score';
import { SQUARE_RADIUS, SQUARE_RATIO } from '@/components/ui/square-art';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { platformFamilies } from '@/constants/platform-family';
import { PosterAspectRatio, Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import type { DealDirection } from '@/components/surprise-deal-gesture';
import type { GameSearchResult } from '@/lib/games/types';

/** One of Backlog and Next: wide enough to read as a key, not a dot. */
const META_KEY = 56;

/*
 * `DealDirection` is declared once, by the gesture that produces one, and
 * re-exported here because every consumer imports it from the reveal. It was
 * declared twice with identical text — the same shape of drift CLAUDE.md records
 * for `TargetType`, where the copy silently kept a member out of the barrel.
 */
export type { DealDirection };

/**
 * How far a page must travel before releasing it deals.
 *
 * A fraction of the card rather than of the screen: the card is the thing being
 * moved, and the same 30% feels identical whether it is 150dp wide on an SE or
 * 190 on a Pro Max. A screen fraction would make the gesture heavier on the
 * larger phone, which is backwards.
 */
const COMMIT_FRACTION = 0.3;

/**
 * The new card's words and cards coming in: a short fade, on every deal and
 * under Reduce Motion too — with the slide flattened, a cut is not a
 * transition, and a crossfade is what both platform references prescribe.
 */
const TEXT_IN = FadeIn.duration(180)
  .easing(Easing.out(Easing.quad))
  .reduceMotion(ReduceMotion.Never);

/** How the reveal is sized on this display. */
export type RevealLayout = {
  /**
   * Width of the **portrait fallback**, for a game with no square art.
   *
   * Derived from `squareWidth` so the two shapes are the same height — see where
   * it is computed. Height is 1.5x this; a poster is 2:3.
   */
  artWidth: number;
  /**
   * Edge length of the **square** cover, when the game has one.
   *
   * **The budget, and `artWidth` is derived from it** — not the other way round.
   * A square cover is album art: the reference is a now-playing screen, where
   * the art is the top of the page. Sizing it as a fraction of a poster would
   * give a square the size of a poster, which reads as a cropped poster rather
   * than as a record sleeve.
   */
  squareWidth: number;
  /**
   * Travel at which releasing deals, in dp.
   *
   * Derived here rather than exported as a fraction, because several call
   * sites would otherwise restate `artWidth * 0.3` — the screen's two
   * gestures and its two edge lights. A fraction that travels is a fraction
   * that gets out of step; the *number* lives in the one object every
   * consumer already reads.
   */
  commitAt: number;
  /** How far the room dims over as a page is dragged (`<SurpriseBloom>`). */
  exitDistance: number;
  /** Too short for the standing hint and the metadata row. */
  compact: boolean;
};

/**
 * Sizes the reveal against the viewport it actually has.
 *
 * The one screen in the app that must not scroll, so it is also the one screen
 * whose artwork is a function of the display rather than a fixed dp value.
 * Everywhere else a literal is right — retuning the spacing ladder must not move
 * the art — but here the art has a job the ladder cannot do for it, which is fit.
 *
 * It is a plain `<Poster>` now, not the physical case. That removes the hardest
 * constraint this function had: `<GameCaseDisplay>` is variable-height by
 * platform (a console case is 1.259x its width, a PC cover 1.5x), so every
 * budget here had to reserve the taller shape and live with the gap under the
 * shorter one. A poster is always 2:3, so the height below is exact.
 */
export function revealLayout(width: number, height: number): RevealLayout {
  const compact = height < 700;

  /*
   * The square: the content width, unless the display is too short to spend it.
   *
   * `SQUARE_RATIO` of the width is what normally binds — 328dp on a 390dp phone,
   * leaving a real margin either side rather than running to the gutter. The
   * height factor is a guard rather than a ratio: a square is 1.5x taller than a
   * poster of the same width, and that height comes out of the spacer between
   * the meta block and the support cards.
   *
   * A compact display drops to 0.28 and *does* bind — a 360x640 phone shows a
   * 179dp square rather than a 302dp one. That is the same call `compact` makes
   * everywhere else in this function: the screen must not scroll, so on a short
   * display the artwork is what yields. It was 0.32 until the interface took
   * SimpMusic's spacing and type, which made the blocks under the art ~50dp
   * taller; the four hundredths are that height, given back by the artwork.
   *
   */
  const squareWidth = Math.round(
    Math.max(140, Math.min(width * SQUARE_RATIO, height * (compact ? 0.28 : 0.42)))
  );

  /*
   * The portrait fallback, sized to the **same height** as the square.
   *
   * This used to be its own budget — `min(200, width * 0.42, height * 0.2)` —
   * and that was fine while it was the only shape this screen drew. It is not
   * any more: a game with square art shows a 328dp block and one without showed
   * a 164dp poster, so dealing through the deck changed the size of the subject
   * and moved everything under it by a different amount each time.
   *
   * Matching the *height* rather than the width is what fixes it. A 2:3 poster
   * whose height equals the square's edge is 0.667 as wide — narrower, which is
   * correct, because it is a different object — and the block below it starts at
   * exactly the same y whichever one is on screen. Nothing else moves.
   */
  const artWidth = Math.round(squareWidth * PosterAspectRatio);

  return {
    artWidth,
    squareWidth,
    commitAt: Math.round(artWidth * COMMIT_FRACTION),
    exitDistance: Math.round(width * 1.15),
    /*
     * Short displays drop the standing swipe hint and the metadata row.
     *
     * A 640dp Android phone gives up 48 of it to the navigation bar, and this
     * screen now carries a review as well as a soundtrack. The hint teaches
     * something the `Another game` button already does, and the platform marks
     * repeat what the cover art already shows — those two go before the artwork
     * or the writing does.
     */
    compact,
  };
}

export type SurpriseRevealProps = {
  /** The batch, and which card of it is in front. */
  games: readonly GameSearchResult[];
  cursor: number;
  /**
   * Where this batch's first card stands in the deck: every card of every
   * earlier batch came before it. The deck never jumps back to zero when a new
   * batch arrives — the next batch's first card is laid out exactly where the
   * last one's page was going.
   */
  base: number;
  /** Where the deck stands, in dp — the card at index n is centred at n × `pageWidth`. */
  pageX: SharedValue<number>;
  /** One page: the display's width. */
  pageWidth: number;
  /** False at the start of the deck: swiping back rubber-bands instead. */
  canGoBack: boolean;
  onDeal: (direction: DealDirection) => void;
  /** The finger's travel, owned by the screen: the edge lights read it too. */
  dealX: SharedValue<number>;
  /**
   * Springs to 1 while the swipe is past the point where releasing deals.
   * Owned by the screen for the same reason `dealX` is, and passed down so the
   * room can swell on the same threshold the haptic ticks on.
   */
  bloom: SharedValue<number>;
  /**
   * The card in front has been in place for `SETTLE_MS`
   * (`lib/surprise-prefetch.ts`): its animation may load. A card swiped past
   * on the way to another never starts its download.
   */
  settled: boolean;
  /** A finger is on the deck: the animation in front holds its frame. */
  dragging: boolean;
  onOpenGame: () => void;
  /**
   * Banish this game from every future roll. Double tap on the cover.
   *
   * The gesture is on the artwork rather than on a control because the artwork
   * is the game — this is "not this one", said to the thing itself, and a sixth
   * button under the card would be a permanent affordance for an action most
   * people take rarely. It is not the only route: the same list is editable in
   * Settings, which is also where it can be undone.
   */
  onHide: () => void;
  /**
   * Whether the "you have hidden this game" panel is showing over the cover.
   *
   * Owned by the screen, which also owns the ten-second timer. Note it does
   * **not** mean "this game is hidden": it means the panel is up. A game stays
   * hidden forever; the panel is a ten-second announcement, and the card
   * underneath is fully usable throughout.
   */
  hidden: boolean;
  /**
   * The viewer has already played or dropped this one.
   *
   * Reachable with the exclusion on: `excludeLogged` abandons the filter rather
   * than handing back an empty batch, and `getUserLogs` only covers the hundred
   * most recent logs. Saying so on the card is what keeps that honest.
   */
  alreadyPlayed?: boolean;
  /**
   * The most-liked review of this game, or nothing when it has none.
   *
   * Sits between the title and the music because that is its order of use: what
   * the game *is*, then what one person made of it, then what it sounds like.
   */
  review?: ReactNode;
  /** The soundtrack row, mounted by the screen so this file owns no data. */
  soundtrack: ReactNode;
  /**
   * Put this game on the backlog. The bookmark beside the title — the game
   * page's own key, where the eye already is.
   */
  onBacklog: () => void;
  /** Drives the bookmark's glyph and its disabled state. */
  backlog: { done: boolean; busy: boolean; failed: boolean };
  layout: RevealLayout;
};

/**
 * The dealt game: its art on a strip that slides, and under it what the card
 * says and what can be done with it.
 *
 * ## A filling stack
 *
 * The owner's direction (2026-11-02): reacticx's filling stack
 * (`<StackCard>`). The card in front, and three behind it, each 18 higher and
 * 5% smaller, sunk under the page's colour; a deal sends the front card down
 * and away as the next comes forward. A fling down deals, a fling up goes
 * back, and the sideways swipe still works — it moves the deck one for one,
 * and the stack follows it, since every card is drawn from the deck's one
 * position (`pageX`). It replaced SimpMusic's plain pager (2026-10-21), which
 * had replaced a card that lifted and flew off.
 *
 * What stays is what is not the artwork moving: the room's light behind it
 * (`<SurpriseBloom>`) and the screen's edge lights. The words under the art
 * change when the deck moves on, with a short fade.
 *
 * Five cards are mounted — the one dealt away, the one in front and three
 * behind — each keyed by its place in the deck, so the card that comes
 * forward is the one that was already there, still and looked up. Only the
 * card in front may load its animation (`settled`), and it holds its frame
 * while a finger is on the deck.
 *
 * ## Reduce Motion
 *
 * A swipe is an *input*, so the stack still follows the finger; the release
 * lands at once rather than springing, and the words crossfade. The visible
 * `Another game` key is not the gesture's fallback, it is a primary path —
 * and `accessibilityActions` puts both directions in the rotor besides.
 */
export function SurpriseReveal({
  games,
  cursor,
  base,
  pageX,
  pageWidth,
  canGoBack,
  onDeal,
  dealX,
  bloom,
  settled,
  dragging,
  onOpenGame,
  onHide,
  hidden,
  alreadyPlayed = false,
  review,
  soundtrack,
  onBacklog,
  backlog,
  layout,
}: SurpriseRevealProps) {
  const accent = useAccent();
  const game = games[cursor];
  const cardHeight = layout.squareWidth;

  /* The room is lit from the first frame: nothing lands any more. */
  const lit = useSharedValue(1);

  /*
   * The filling stack's own gesture: a fling down deals the next card, a fling
   * up brings the last one back (reacticx's `FlingStack`, which reads them the
   * same way round). Beside the sideways swipe, not instead of it — that one
   * still drives the deck one for one, and the stack follows it.
   */
  const flingNext = Gesture.Fling()
    .runOnJS(true)
    .direction(Directions.DOWN)
    .onStart(() => onDeal(1));
  const flingBack = Gesture.Fling()
    .runOnJS(true)
    .direction(Directions.UP)
    .enabled(canGoBack)
    .onStart(() => onDeal(-1));

  const families = platformFamilies(game.platforms);

  return (
    <View style={styles.root}>
      {/* See `styles.spacer`: half the slack sits above the artwork, which is
          what lowers it clear of the floating discs. */}
      <View style={styles.spacer} />

      {/*
        The well: the light and the strip of cards, in one box.

        Its height is `card + BLOOM_BLEED * 2` with `-BLOOM_BLEED` of vertical
        margin, so the glow has room to fall off to nothing while the block's
        *layout* footprint stays exactly the card's — nothing below it moves, on
        either shape.
      */}
      <View
        style={[
          styles.well,
          { height: cardHeight + BLOOM_BLEED * 2, marginVertical: -BLOOM_BLEED },
        ]}>
        <SurpriseBloom
          cardEdge={cardHeight}
          dealX={dealX}
          bloom={bloom}
          arrival={lit}
          exitDistance={layout.exitDistance}
        />

        <GestureDetector gesture={Gesture.Race(flingNext, flingBack)}>
          <View style={[styles.stack, { top: BLOOM_BLEED, height: cardHeight }]}>
            {[cursor - 1, cursor, cursor + 1, cursor + 2, cursor + 3].map((index) => {
              const place = base + index;
              /* Past the batch's last card: the next batch, on its way. */
              if (index === games.length) {
                return (
                  <StackCard
                    key={`slot-${place}-next`}
                    place={place}
                    pageX={pageX}
                    pageWidth={pageWidth}
                    height={cardHeight}
                    importantForAccessibility="no">
                    {(veil) => (
                      <View>
                        <Skeleton width={cardHeight} height={cardHeight} radius={SQUARE_RADIUS} />
                        {veil({ width: cardHeight, height: cardHeight, radius: SQUARE_RADIUS })}
                      </View>
                    )}
                  </StackCard>
                );
              }
              const slotGame = games[index];
              if (!slotGame) return null;
              const current = index === cursor;
              return (
                <StackCard
                  key={`slot-${place}-${slotGame.id}`}
                  place={place}
                  pageX={pageX}
                  pageWidth={pageWidth}
                  height={cardHeight}
                  importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
                  accessibilityElementsHidden={!current}>
                  {(veil) => (
                    <CardSlot
                      veil={veil}
                      game={slotGame}
                      current={current}
                      layout={layout}
                      load={current && settled}
                      paused={dragging}
                      hidden={current && hidden}
                      canGoBack={canGoBack}
                      onDeal={onDeal}
                      onOpenGame={onOpenGame}
                      onHide={onHide}
                    />
                  )}
                </StackCard>
              );
            })}
          </View>
        </GestureDetector>
      </View>

      {/*
        Everything the card says about the game, and the two things you can do
        to it — in the artwork's own column, keyed by the game so it fades in
        when the deck moves on.

        Two rows, and they align differently on purpose. The facts pill is
        **centred on the cover**, because a score is a verdict on the object above
        it and belongs on its axis. The title, the credit line and the two
        controls are a **row ranged to the cover's edges**: left is what this is,
        right is what you can do with it, which is how a now-playing bar reads.
      */}
      <Animated.View
        key={`meta-${game.id}`}
        entering={TEXT_IN}
        style={[styles.meta, { width: layout.squareWidth }]}>
        {/*
          The facts, on an opaque tinted fill, and that is not decoration:
          `<ScoreLine>` and `<PlatformMarks>` draw in the score ramp and brand
          colours, and `accent.elevated` is the surface step every one of them
          was measured against.
        */}
        <View style={[styles.facts, { backgroundColor: accent.elevated }]}>
          <PlatformMarks families={families} />
          {game.score !== null && <ScoreLine score={game.score} />}
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            {/* One line, and it scrolls when it does not fit — see `<MarqueeText>`. */}
            <MarqueeText
              text={game.title}
              variant="h3"
              /* The heading for the whole screen: a screen reader lands on the
               game's name, not on a row of platform glyphs. */
              accessibilityRole="header"
            />

            <Text variant="bodySmall" numberOfLines={1} style={{ color: accent.quietInk }}>
              {[game.releaseYear, game.developer, alreadyPlayed ? 'you’ve played this' : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>

          <View style={styles.metaActions}>
            {/* The game page's own keys (`<TonalKey>`), as one connected pair:
                the owner's "the same button style as the game page"
                (2026-10-16). Backlog is a state and lights; Next is an act. */}
            <TonalKey
              icon={backlog.failed ? 'refresh' : 'bookmark'}
              outline={backlog.failed ? 'refresh' : 'bookmark-outline'}
              active={backlog.done}
              busy={backlog.busy}
              label={
                backlog.done
                  ? `${game.title} is in your backlog`
                  : backlog.failed
                    ? 'Could not add to your backlog. Try again.'
                    : `Add ${game.title} to your backlog`
              }
              onPress={onBacklog}
              position="start"
              style={styles.metaKey}
            />
            <TonalKey
              icon="play-skip-forward"
              label="Another game"
              onPress={() => onDeal(1)}
              position="end"
              style={styles.metaKey}
            />
          </View>
        </View>
      </Animated.View>

      {/* One fixed step from the title block to the cards, not a flex hole. */}
      <Animated.View
        key={`support-${game.id}`}
        entering={TEXT_IN}
        style={[styles.support, styles.supportGap, { width: layout.squareWidth }]}>
        {review}
        {soundtrack}
      </Animated.View>

      {/* Absorbs the difference between a 667pt display and an 852 one, so the
          reveal fills either without a scroll view and without a breakpoint. Its
          twin is above the artwork. */}
      <View style={styles.spacer} />

      {/* A standing instruction, not a coach mark. Hidden from screen readers,
          which are told the same thing by the card's own hint. */}
      {!layout.compact && (
        <Text
          variant="caption"
          style={[styles.hint, { color: accent.quietInk }]}
          importantForAccessibility="no"
          accessibilityElementsHidden>
          Swipe for another game · double tap the cover to hide it
        </Text>
      )}
    </View>
  );
}

/**
 * How the filling stack stands, from reacticx's `FlingStack`
 * (`molecules/filling-stack`, MIT): four cards in view, each one behind the
 * card in front 18 higher and 5% smaller, the card dealt away falling a card
 * and a quarter down as it fades, and the one coming forward from behind
 * growing to 1.06 on its way out of the deck's top.
 */
const STACK = {
  visible: 4,
  offset: 18,
  scaleStep: 0.05,
  /** The card in front is clear; one behind is under the page's colour at this. */
  veil: 0.38,
  veilBack: 0.62,
} as const;

/**
 * One card of the filling stack, placed by how deep in the deck it is.
 *
 * The deck has one position, `pageX` in pages — the same number the sideways
 * swipe moves one for one and a deal springs — so a card's depth is its
 * place less that, a fraction while the deck moves: 0 in front, 1, 2, 3
 * behind it, −1 dealt away. Every card is drawn from that one number, which
 * is why the stack follows the finger and a deal alike, and why the batches,
 * the prefetch and the gestures did not change when the strip became a stack.
 *
 * reacticx blurs the cards behind with an `expo-blur` view over each; on
 * Android a blur with no target is a flat slab (CLAUDE.md, gotchas), and the
 * target is the page, which these cards are part of. So the cards behind sink
 * under the page's own colour instead, by the same depths.
 */
function StackCard({
  place,
  pageX,
  pageWidth,
  height,
  children,
  importantForAccessibility,
  accessibilityElementsHidden,
}: {
  place: number;
  pageX: SharedValue<number>;
  pageWidth: number;
  height: number;
  /** The card, handed the veil to lay over its art's own box. */
  children: (veil: (box: CardArtBox) => ReactNode) => ReactNode;
  importantForAccessibility?: 'auto' | 'no' | 'no-hide-descendants';
  accessibilityElementsHidden?: boolean;
}) {
  const accent = useAccent();

  const cardStyle = useAnimatedStyle(() => {
    const depth = place - pageX.get() / Math.max(1, pageWidth);
    const back = Math.max(STACK.visible - 1, 2);
    const translateY = interpolate(
      depth,
      [-1, 0, 1, back],
      [height * 1.25, 0, -STACK.offset, -STACK.offset * back],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      depth,
      [-1, 0, 1, back],
      [1.06, 1, 1 - STACK.scaleStep, 1 - STACK.scaleStep * back],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      depth,
      [-1, -0.35, 0, back, back + 0.65],
      [0, 1, 1, 1, 0],
      Extrapolation.CLAMP
    );
    return { transform: [{ translateY }, { scale }], opacity };
  });

  const veilStyle = useAnimatedStyle(() => {
    const depth = place - pageX.get() / Math.max(1, pageWidth);
    return {
      opacity: interpolate(
        depth,
        [-1, 0, 1, STACK.visible - 1],
        [0, 0, STACK.veil, STACK.veilBack],
        Extrapolation.CLAMP
      ),
    };
  });

  return (
    <Animated.View
      style={[styles.stackCard, { zIndex: 1000 - place }, cardStyle]}
      importantForAccessibility={importantForAccessibility}
      accessibilityElementsHidden={accessibilityElementsHidden}
      collapsable={false}>
      {children((box) => (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.stackVeil,
            { backgroundColor: accent.page, borderRadius: box.radius },
            veilStyle,
          ]}
        />
      ))}
    </Animated.View>
  );
}

/**
 * One card on the strip: its art, and — for the card in front — the two taps
 * on it and everything a screen reader is told.
 *
 * The same tree whether or not it is in front, so a card that slides in is
 * not remounted on arrival: its taps are switched on (`enabled`), not added.
 *
 * Two taps on the same artwork, and the order between them is the trick:
 * `Gesture.Exclusive` holds the single tap until the double has had its
 * chance to fail, so one tap opens the game page and two never do it on the
 * way past. Gesture handlers rather than a `<Pressable>`, which would race
 * the recogniser through React Native's own responder system.
 */
function CardSlot({
  veil,
  game,
  current,
  layout,
  load,
  paused,
  hidden,
  canGoBack,
  onDeal,
  onOpenGame,
  onHide,
}: {
  veil: (box: CardArtBox) => ReactNode;
  game: GameSearchResult;
  current: boolean;
  layout: RevealLayout;
  load: boolean;
  paused: boolean;
  hidden: boolean;
  canGoBack: boolean;
  onDeal: (direction: DealDirection) => void;
  onOpenGame: () => void;
  onHide: () => void;
}) {
  const openGame = Gesture.Tap()
    .runOnJS(true)
    .enabled(current)
    .onEnd((_event, success) => {
      if (success) onOpenGame();
    });

  const hideGame = Gesture.Tap()
    .runOnJS(true)
    .enabled(current)
    .numberOfTaps(2)
    .onEnd((_event, success) => {
      if (!success) return;
      /* The one moment in this feature that removes something permanently, so
         it gets the heavier tick. iOS only: Android's generic buzz reads as an
         error. */
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      onHide();
    });

  return (
    <View
      style={styles.card}
      accessible={current}
      accessibilityRole={current ? 'button' : undefined}
      accessibilityLabel={current ? `${game.title}. Open game page.` : undefined}
      accessibilityHint={
        current
          ? 'Swipe left anywhere or fling the card down for another game; swipe right or fling up to go back. Double tap the cover to hide this game from future rolls.'
          : undefined
      }
      accessibilityActions={current ? ACTIONS : undefined}
      onAccessibilityAction={(event) => {
        if (!current) return;
        if (event.nativeEvent.actionName === 'activate') onOpenGame();
        if (event.nativeEvent.actionName === 'next') onDeal(1);
        if (event.nativeEvent.actionName === 'previous' && canGoBack) onDeal(-1);
        /* A double tap is not performable from the rotor, so hiding is in it as
           an action of its own. A gesture is never the only way here. */
        if (event.nativeEvent.actionName === 'hide') onHide();
      }}>
      <GestureDetector gesture={Gesture.Exclusive(hideGame, openGame)}>
        <View importantForAccessibility="no">
          <SurpriseCardArt
            game={game}
            layout={layout}
            load={load}
            paused={paused}
            overlay={(box) => (
              <>
                {veil(box)}
                {current && <HiddenNotice showing={hidden} box={box} />}
              </>
            )}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const ACTIONS = [
  { name: 'next', label: 'Next game' },
  { name: 'previous', label: 'Previous game' },
  { name: 'hide', label: 'Hide this game from Surprise Me' },
];

/**
 * What the double tap has to say, drawn over the cover it was performed on.
 *
 * ## Why it is on the artwork and not at the edge of the screen
 *
 * Because the artwork is what was pressed, and because nothing else moves. The
 * card is not replaced, not dimmed and not dismissed — so a toast in a corner
 * would be the only evidence a deliberate gesture on a specific object did
 * anything, sixty per cent of a screen away from the object. Covering the cover
 * is the acknowledgement: the thing you said "not this one" about is the thing
 * that goes behind glass.
 *
 * ## Why it is mounted even when it is not showing
 *
 * So it can fade out. An unmounted overlay can only appear and vanish; Reanimated
 * layout animations would give it an exit, but `exiting` on a view inside a
 * gesture-handled, spring-animated subtree is a lot of machinery to buy one
 * crossfade. Zero opacity plus `pointerEvents="none"` costs one static view and
 * leaves the double tap underneath reachable the whole time — which matters,
 * because hiding an already-hidden game is a legal thing to do and simply
 * restarts the ten seconds.
 *
 * The opacity beat runs under Reduce Motion: with every spring flattened, a
 * cut is not a transition.
 */
function HiddenNotice({ showing, box }: { showing: boolean; box: CardArtBox }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(showing ? 1 : 0, { duration: 220, easing: Easing.out(Easing.quad) }));
  }, [showing, progress]);

  const style = useAnimatedStyle(() => ({ opacity: progress.get() }));

  return (
    <Animated.View
      style={[styles.notice, { borderRadius: box.radius }, style]}
      /* Never a touch target. The card underneath keeps every one of its
         gestures while this is up — that is the whole point of not advancing. */
      pointerEvents="none"
      /* The screen announces the same sentence through `AccessibilityInfo` at
         the moment it happens, so reading it again here would be the second
         time. `accessibilityElementsHidden` keeps it out of the rotor without
         keeping it off the display. */
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      {/* Sized off the cover so the glyph scales with the art rather than
          swamping it on a small display. */}
      <Ionicons name="eye-off" size={Math.round(box.width * 0.26)} color="#FFFFFF" />
      <Text variant="h5" style={styles.noticeTitle}>
        You have hidden this game
      </Text>
      <Text variant="caption" style={styles.noticeBody}>
        We won’t recommend you this game anymore, check your settings to undo this.
      </Text>
    </Animated.View>
  );
}

/**
 * The reveal's own shape, held while a fresh batch loads.
 *
 * A skeleton rather than a spinner, per DESIGN.md §22 — and here the rule is
 * earned twice over, because the shape of what is coming is known exactly and
 * the alternative was tearing the whole screen down to a centred
 * `ActivityIndicator` on every fiftieth press.
 */
export function SurpriseRevealSkeleton({ layout }: { layout: RevealLayout }) {
  /*
   * The square, because that is the shape this screen is designed around now.
   *
   * There is no way to know which of the two is coming — the square lookup needs
   * the game the skeleton exists because we do not yet have — so one of the two
   * cases gets a shape change on arrival either way. It goes to the fallback: a
   * game with no SteamGridDB art settles from a square into a poster, which is
   * the less common path and the one where a jump is least surprising, because
   * something visibly different arrived.
   */
  return (
    <View style={styles.root}>
      <View style={styles.spacer} />

      {/* No deck and no bloom here, deliberately: a stack implies a next card
          that has not been dealt, and a lit room implies a game that has not
          arrived. The skeleton describes what is coming, not what is already
          true. Same call as the `game &&` gate on the edge lights. */}
      <View style={[styles.card, { height: layout.squareWidth }]}>
        <Skeleton width={layout.squareWidth} height={layout.squareWidth} radius={SQUARE_RADIUS} />
      </View>

      {/* The meta block's shape, in the artwork's own column: the facts pill
          centred, then the title, the credit line and the two controls. */}
      <View style={[styles.meta, styles.skeletonMeta, { width: layout.squareWidth }]}>
        <View style={styles.skeletonFacts}>
          <Skeleton width={96} height={20} radius={Radius.pill} />
        </View>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Skeleton width={168} height={18} radius={Radius.sm} />
            <Skeleton width={124} height={12} radius={Radius.sm} />
          </View>
          <View style={styles.metaActions}>
            <Skeleton
              width={META_KEY * 2 + KEY_GROUP_GAP}
              height={KEY_HEIGHT}
              radius={Radius.pill}
            />
          </View>
        </View>
      </View>

      <View style={[styles.support, styles.supportGap, { width: layout.squareWidth }]}>
        <Skeleton width="100%" height={64} radius={Radius.card} />
      </View>

      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  /*
   * No `height`. `<GameCaseDisplay>` sizes itself and its height depends on the
   * platform, so a fixed box either leaves a gap under a console case or is
   * overflowed by a PC cover — which is the overlap this screen shipped with.
   * The flex spacer below absorbs whichever it turns out to be.
   */
  /* Stretched, centred, and sized inline — see the well in the JSX. `overflow`
     is deliberately *not* hidden: the glow's whole job is to reach past the card,
     and the bleed is what gives it somewhere to reach into. */
  well: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  /*
   * The strip the cards are laid out on: its origin at the display's left
   * edge, each card at its place in the deck times the display's width — so
   * moving the strip by `-pageX` is the whole slide, and the cards either side
   * are a page away, off the screen until dragged in.
   */
  /* The stack: every card in one box the card's size, centred on the well. */
  stack: { position: 'absolute', left: 0, right: 0 },
  stackCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Over the art's own box, which `SurpriseCardArt` hands its overlay. */
  stackVeil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  card: { alignItems: 'center' },
  /*
   * **Exactly as wide as the artwork**, set inline from `layout.squareWidth`.
   *
   * This is the alignment rule for the whole screen and it is worth stating
   * plainly: the cover is the widest object here, so the cover's edges are the
   * page's margins. Everything else — the facts pill, the title, the credit
   * line, the two cards below — is laid out in that same column and lines up
   * with it on both sides.
   *
   * It used to be `alignSelf: 'stretch'` with a 12dp gutter, which made every
   * block wider than the art it belonged to. Nothing shared an edge with
   * anything, and a column whose items each start at a different x reads as
   * broken rather than as loose.
   */
  meta: { gap: Spacing.x8, marginTop: Spacing.x20 },
  /* The title and the two controls on one line. `center` on the cross axis puts
     the buttons against the middle of the two-line text column rather than
     against its first line. */
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  /* `flex: 1` and `minWidth: 0`. The second is what lets the marquee's clip
     actually clip: without it a long title measures its natural width and pushes
     the buttons off the row instead of being cut by it. */
  titleText: { flex: 1, minWidth: 0, gap: Spacing.x4 },
  /* The game page's connected group: its 4dp seam, keys 56 wide. */
  metaActions: { flexDirection: 'row', gap: KEY_GROUP_GAP },
  metaKey: { width: META_KEY },
  skeletonMeta: { gap: Spacing.x8 },
  /* The facts pill is centred on the artwork; its placeholder is too. */
  skeletonFacts: { alignSelf: 'center' },
  /* Centred on the artwork, on its own line above the title.
     
     `alignSelf: 'center'` inside a column that is exactly the cover's width is
     what makes "91 EXCELLENT" centre *on the cover* rather than on the display —
     the same thing here only because the column is centred too, and the right
     thing to write because it stays true if the column ever moves. */
  facts: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.x12,
    /* Pill, not `Radius.control` — this is metadata, and shape is the only thing
       left distinguishing a run of facts from a row of buttons. */
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.x12,
    paddingVertical: Spacing.x4,
  },
  /*
   * The four offsets written out rather than `StyleSheet.absoluteFillObject` —
   * that is gone from the RN types on SDK 57 (see CLAUDE.md).
   *
   * The art's own corner, set inline from its box, so the scrim ends exactly
   * where the artwork does; a square overlay on a rounded poster leaves four
   * lit corners. The fill is a
   * plain black alpha rather than a theme token on purpose: it sits on *artwork*,
   * which is the one surface in the app whose colour is unknown at build time,
   * and 0.82 is what carries white type over a bright cover as well as a dark one.
   */
  notice: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  noticeTitle: { textAlign: 'center' },
  /* Not `textMuted`: the token is chosen against the app's near-black page, and
     this sits on an 82% scrim over arbitrary artwork. A white at 78% is the same
     idea — quieter than the line above — without borrowing a value measured
     somewhere else. */
  noticeBody: { textAlign: 'center', color: 'rgba(255, 255, 255, 0.78)' },
  /*
   * Two spacers, equal, one above the artwork and one below the cards.
   *
   * There was one, between the meta block and the cards, and it took **all** the
   * slack: the artwork sat hard against the top of the display with the floating
   * discs on top of it, and a 90dp hole opened in the middle of the screen. Slack
   * at both ends instead centres the whole column vertically, which lowers the
   * art clear of the discs and leaves the internal gaps at the fixed, small
   * values they are written as.
   *
   * They collapse to nothing on a short display, where `squareWidth`'s own height
   * guard has already given up artwork to make the content fit.
   */
  spacer: { flex: 1, minHeight: Spacing.x16 },
  /* Width comes from `layout.squareWidth` inline, like the meta block — the
     cards line up with the artwork's edges, not with a page gutter. */
  support: { gap: Spacing.x12 },
  /* The breathing space between the title block and the cards, and all of it. */
  supportGap: { marginTop: Spacing.x24 },
  hint: { marginTop: Spacing.x12 },
});
