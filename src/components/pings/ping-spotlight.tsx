import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/icon-button';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { PosterAspectRatio, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PingFeedRef, PingFeedRow } from '@/lib/database.types';
import { displayNameFor, timeAgoPosted } from '@/lib/format';
import { canSuggest, nextStageIndex, playedFraction, spotlightClaim } from '@/lib/pings';

/** The front cover of the fan; the two behind it are `SIDE` of it. */
const FAN_WIDTH = 100;
const FAN_HEIGHT = Math.round(FAN_WIDTH / PosterAspectRatio);
const SIDE = 0.84;
/** The fan's two back cards: how far out, and how far turned. Placed by hand. */
const FAN_SPREAD = 58;
const FAN_TURN = { right: 11, left: -13 };
/** Room the turned back cards need above and below the front one. */
const FAN_ROOM = 12;
/** The one action, as tall as a field. */
const ACTION_HEIGHT = 52;
/** The queue under the stage: how many, and how their covers sit. */
const UP_NEXT = 3;
const QUEUE_COVER = { width: 17, height: 26, step: 19 };
const QUEUE_ROW = 42;
/** A swipe is a quarter of the stage, or a flick. */
const SWIPE = 0.25;
const FLICK = 600;

/**
 * For You, one request at a time — "The One You’re For" (the owner's hybrid,
 * 2026-11-01: "The For You tab will display the One You’re For style, and
 * swiping/pressing a button will bring the next ping from another user,
 * always displaying the best match for what the user is searching for").
 * Drawn from `.impeccable/mocks/pings/spotlight.png`.
 *
 * The stage is the request that leads `ping_feed`'s For You order — the
 * games you have played the most of first, newest within that, never your
 * own, narrowed by the filters above it. Top to bottom:
 *
 *   1. **Its games, fanned** — the first in front, the others turned behind
 *      it; one you have not played loses its colour. A request on no games
 *      shows its asker's face instead.
 *   2. **Why it is in front of you**, in the screen's largest type
 *      (`spotlightClaim`: "You’ve played both of these").
 *   3. **Who asks**, and **what they want**.
 *   4. **Suggest a game** — the one filled action, the house white.
 *
 * Swiping the stage sideways, or Next, brings the next request; back, the one
 * before. At the end of everything loaded the next page is asked for, and at
 * the true end Next starts over. Under it, quietly, the next three — a tap on
 * one brings it up.
 */
export function PingSpotlight({
  rows,
  viewerId,
  width,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  rows: readonly PingFeedRow[];
  viewerId: string | null;
  /** The stage's width — the page's, less its margins. */
  width: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const x = useSharedValue(0);
  const shown = useSharedValue(1);

  /* The list can shrink under the index (a refresh, a request closed). */
  const current = Math.min(index, rows.length - 1);
  const ping = rows[current];
  /* Null when there is nowhere else to go — one request, and nothing more coming. */
  const stepped = nextStageIndex(current, rows.length, hasMore);
  const next = stepped === current ? null : stepped;

  const prefetch = (target: number) => {
    if (hasMore && !loadingMore && target >= rows.length - UP_NEXT) onLoadMore();
  };

  const arrive = (target: number, direction: 1 | -1) => {
    setIndex(target);
    x.set(direction * width * 0.18);
    x.set(withSpring(0, { damping: 26, stiffness: 260 }));
    /* Held a frame, so the old request is never seen at the new one's place. */
    shown.set(withDelay(32, withTiming(1, { duration: 220 })));
  };

  const go = (target: number | null, direction: 1 | -1) => {
    if (target === null || target === current) {
      if (direction === 1 && hasMore && !loadingMore) onLoadMore();
      x.set(withSpring(0));
      return;
    }
    prefetch(target);
    if (reduceMotion) {
      setIndex(target);
      x.set(0);
      return;
    }
    shown.set(withTiming(0, { duration: 160 }));
    x.set(
      withTiming(-direction * width * 0.5, { duration: 180 }, (finished) => {
        if (finished) runOnJS(arrive)(target, direction);
      })
    );
  };

  const goNext = () => go(next, 1);
  const goBack = () => go(current > 0 ? current - 1 : null, -1);

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      /* Resistance where there is nothing to go to. */
      const edge = event.translationX > 0 ? current === 0 : next === null;
      x.set(edge ? event.translationX * 0.25 : event.translationX);
    })
    .onEnd((event) => {
      const far = Math.abs(event.translationX) > width * SWIPE;
      const flick = Math.abs(event.velocityX) > FLICK;
      if (far || flick) {
        if (event.translationX < 0) runOnJS(goNext)();
        else runOnJS(goBack)();
      } else {
        x.set(withSpring(0, { damping: 26, stiffness: 260 }));
      }
    });

  const stageStyle = useAnimatedStyle(() => ({
    opacity: shown.get() * (1 - Math.min(Math.abs(x.get()) / (width * 1.4), 0.6)),
    transform: [{ translateX: x.get() }, { rotate: `${x.get() / width / 20}rad` }],
  }));

  if (!ping) return null;
  const queue = rows.slice(current + 1, current + 1 + UP_NEXT);

  return (
    <View>
      <GestureDetector gesture={pan}>
        <Animated.View style={stageStyle}>
          <Stage ping={ping} viewerId={viewerId} width={width} />
        </Animated.View>
      </GestureDetector>

      <View style={styles.steps}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel="The ping before"
          onPress={goBack}
          disabled={current === 0}
        />
        <Text variant="caption" color="textMuted" style={styles.position}>
          {`${current + 1} of ${rows.length}${hasMore ? '+' : ''}`}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={next === 0 ? 'Start over from the best match' : 'Next ping'}
          accessibilityState={{ disabled: next === null && !hasMore }}
          disabled={next === null && !hasMore}
          onPress={goNext}
          scaleTo={0.95}
          pressedColor={theme.controlPressed}
          hitSlop={{ top: 6, bottom: 6 }}
          style={StyleSheet.flatten([styles.next, { backgroundColor: theme.controlFill }])}>
          <Text variant="button" style={{ color: theme.controlInk }}>
            {next === null
              ? loadingMore
                ? 'Loading…'
                : 'Next ping'
              : next === 0
                ? 'Start over'
                : 'Next ping'}
          </Text>
          <PressGlyph motion="skip">
            <Ionicons
              name={next === 0 ? 'refresh' : 'arrow-forward'}
              size={16}
              color={theme.controlInk}
            />
          </PressGlyph>
        </PressableScale>
      </View>

      {queue.length > 0 && (
        <View style={[styles.queue, { borderTopColor: theme.border }]}>
          <Text variant="label" color="textMuted" style={styles.queueHead}>
            Up next
          </Text>
          {queue.map((row, offset) => (
            <QueueRow key={row.id} ping={row} onPress={() => go(current + 1 + offset, 1)} />
          ))}
        </View>
      )}
    </View>
  );
}

/** One request, staged: the fan, the claim, who asks and what, the action. */
function Stage({
  ping,
  viewerId,
  width,
}: {
  ping: PingFeedRow;
  viewerId: string | null;
  width: number;
}) {
  const theme = useTheme();
  const router = useRouter();
  const name = displayNameFor(ping);
  const answerable = canSuggest(ping, viewerId);
  const open = () => router.push({ pathname: '/ping/[id]', params: { id: ping.id } });

  return (
    <View style={styles.stage}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${name} asks: ${ping.description}`}
        accessibilityHint="Opens the ping and its suggestions"
        onPress={open}
        scaleTo={0.97}
        style={StyleSheet.flatten([styles.fan, { width }])}>
        {ping.refs.length > 0 ? (
          <Fan refs={ping.refs} width={width} />
        ) : (
          <Avatar uri={ping.avatar_url} name={name} size={88} />
        )}
      </PressableScale>

      <Text variant="h2" style={styles.claim} numberOfLines={2}>
        {spotlightClaim(ping)}
      </Text>

      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${name}’s profile`}
        onPress={() => router.push({ pathname: '/profile/[id]', params: { id: ping.user_id } })}
        hitSlop={8}
        scaleTo={0.96}
        style={styles.asker}>
        <Avatar uri={ping.avatar_url} name={name} size={22} />
        <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.askerName}>
          {`${name} asks · ${timeAgoPosted(ping.created_at)}`}
        </Text>
      </PressableScale>

      <Text variant="body" color="textSecondary" numberOfLines={3} style={styles.words}>
        {ping.description}
      </Text>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={answerable ? `Suggest a game for ${name}` : 'See the suggestions'}
        onPress={
          answerable
            ? () => router.push({ pathname: '/suggest-game/[id]', params: { id: ping.id } })
            : open
        }
        scaleTo={0.97}
        style={StyleSheet.flatten([styles.action, { backgroundColor: theme.primary }])}>
        {answerable && (
          <PressGlyph>
            <Ionicons name="add" size={22} color={theme.onPrimary} />
          </PressGlyph>
        )}
        <Text variant="h5" style={{ color: theme.onPrimary }}>
          {answerable ? 'Suggest a game' : 'See the suggestions'}
        </Text>
      </PressableScale>

      {ping.my_suggestion_count > 0 && (
        <Text variant="caption" color="textMuted" style={styles.yours}>
          {ping.my_suggestion_count === 1
            ? 'You suggested one here'
            : `You suggested ${ping.my_suggestion_count} here`}
        </Text>
      )}
    </View>
  );
}

/**
 * The request's games, fanned: the first in front, the second turned out to
 * the right, the third to the left, behind. Each stands on a ring of page.
 */
function Fan({ refs, width }: { refs: readonly PingFeedRef[]; width: number }) {
  const mid = width / 2;
  const cards = refs.slice(0, 3).map((ref, at) => ({
    ref,
    scale: at === 0 ? 1 : SIDE,
    dx: at === 0 ? 0 : at === 1 ? FAN_SPREAD : -FAN_SPREAD,
    turn: at === 0 ? 0 : at === 1 ? FAN_TURN.right : FAN_TURN.left,
  }));
  /* Back to front: the third, the second, then the first over both. */
  const order = [cards[2], cards[1], cards[0]].filter(Boolean);

  return (
    <View style={{ width, height: FAN_HEIGHT + FAN_ROOM * 2 }}>
      {order.map((card) => (
        <FanCard
          key={card.ref.game_id}
          gameRef={card.ref}
          width={FAN_WIDTH * card.scale}
          left={mid + card.dx - (FAN_WIDTH * card.scale) / 2}
          turn={card.turn}
        />
      ))}
    </View>
  );
}

function FanCard({
  gameRef,
  width,
  left,
  turn,
}: {
  gameRef: PingFeedRef;
  width: number;
  left: number;
  turn: number;
}) {
  const theme = useTheme();
  const height = width / PosterAspectRatio;
  const top = FAN_ROOM + (FAN_HEIGHT - height) / 2;

  return (
    <View
      accessibilityLabel={`${gameRef.title}${gameRef.played ? ', played' : ', not played'}`}
      style={[
        styles.fanCard,
        {
          left,
          top,
          width,
          height,
          borderColor: theme.background,
          backgroundColor: theme.surfaceElevated,
          transform: [{ rotate: `${turn}deg` }],
        },
      ]}>
      {gameRef.cover_url && (
        <View style={[StyleSheet.absoluteFill, !gameRef.played && styles.unplayed]}>
          <Image
            source={{ uri: gameRef.cover_url }}
            contentFit="cover"
            recyclingKey={gameRef.cover_url}
            transition={220}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
      {!gameRef.played && (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.background, 0.5) }]}
        />
      )}
    </View>
  );
}

/** A request waiting behind the stage: its covers, its words, how many you played. */
function QueueRow({ ping, onPress }: { ping: PingFeedRow; onPress: () => void }) {
  const theme = useTheme();
  const lit = ping.matched_count > 0;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Bring up: ${ping.description}`}
      onPress={onPress}
      scaleTo={0.98}
      style={styles.queueRow}>
      <View style={styles.queueCovers}>
        {ping.refs.slice(0, 3).map((ref, at) => (
          <View
            key={ref.game_id}
            style={[
              styles.queueCover,
              { left: at * QUEUE_COVER.step, backgroundColor: theme.surfaceElevated },
            ]}>
            {ref.cover_url && (
              <View style={[StyleSheet.absoluteFill, !ref.played && styles.unplayed]}>
                <Image
                  source={{ uri: ref.cover_url }}
                  contentFit="cover"
                  recyclingKey={ref.cover_url}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            )}
            {!ref.played && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: withAlpha(theme.background, 0.58) },
                ]}
              />
            )}
          </View>
        ))}
      </View>
      <Text variant="body" color="textSecondary" numberOfLines={1} style={styles.queueWords}>
        {ping.description}
      </Text>
      {ping.reference_count > 0 && (
        <Text variant="label" style={{ color: lit ? theme.primaryText : theme.textMuted }}>
          {playedFraction(ping)}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center' },
  fan: { alignItems: 'center', justifyContent: 'center', minHeight: FAN_HEIGHT + FAN_ROOM * 2 },
  fanCard: {
    position: 'absolute',
    borderRadius: Radius.image,
    borderWidth: 1,
    overflow: 'hidden',
  },
  /* Android 12+ draws it; elsewhere the dim alone carries "not played". */
  unplayed: { filter: [{ grayscale: 0.96 }] },
  claim: { marginTop: Spacing.x24, textAlign: 'center' },
  asker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    marginTop: Spacing.x8,
    maxWidth: '100%',
  },
  askerName: { flexShrink: 1 },
  words: { marginTop: Spacing.x8, textAlign: 'center', paddingHorizontal: Spacing.x12 },
  action: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    height: ACTION_HEIGHT,
    marginTop: Spacing.x20,
    borderRadius: Radius.pill,
  },
  yours: { marginTop: Spacing.x8 },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.x16,
  },
  position: { flex: 1, textAlign: 'center' },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    height: 40,
    paddingLeft: Spacing.x16,
    paddingRight: Spacing.x12,
    borderRadius: Radius.pill,
  },
  queue: {
    marginTop: Spacing.x24,
    paddingTop: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  queueHead: { marginBottom: Spacing.x8 },
  queueRow: { flexDirection: 'row', alignItems: 'center', height: QUEUE_ROW, gap: Spacing.x12 },
  queueCovers: { width: QUEUE_COVER.step * 2 + QUEUE_COVER.width, height: QUEUE_COVER.height },
  queueCover: {
    position: 'absolute',
    top: 0,
    width: QUEUE_COVER.width,
    height: QUEUE_COVER.height,
    borderRadius: 2,
    overflow: 'hidden',
  },
  queueWords: { flex: 1 },
});
