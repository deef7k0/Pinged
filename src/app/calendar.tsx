import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeInLeft,
  FadeInRight,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { GameGridTile } from '@/components/game-grid-tile';
import { PORTRAIT_COLUMNS, gridItemWidth } from '@/components/gaming/game-tile';
import { Button } from '@/components/ui/button';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ErrorState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { scoreColor } from '@/constants/score';
import { MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { calendarCover, getReleaseCalendar } from '@/lib/games/browse';
import {
  MONTH_COLUMNS,
  gamesByDay,
  gamesOfMonth,
  monthRows,
  monthTense,
  undatedOf,
  type CalendarGame,
} from '@/lib/games/calendar';
import { EARLIEST_IGDB_YEAR } from '@/lib/games/igdb';

/** How much of a sideways drag the grid follows, and what turns the month. */
const SWIPE_FOLLOW = 0.5;
const SWIPE_TURN = 0.2;
const SWIPE_FLICK = 600;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Between two days of the month, across; and between two rows of them. */
const CELL_GAP = Spacing.x4;
const ROW_GAP = Spacing.x8;

/** The band a day's number sits in, over its square: today's disc fits in it. */
const NUMBER_BAND = 22;

/** Between covers in the month's grid, across and down — the collection grid's. */
const GRID_GAP = Spacing.x12;

/** How many of a month's games are shown under it before "Show all": four rows. */
const MONTH_LIMIT = 12;
/** How many games with no date are shown for the year: three rows. */
const UNDATED_LIMIT = 9;

/** A cover's width in the list a chosen day opens. */
const ROW_COVER = 56;

/**
 * How much of a chosen day's list is brought into view: its heading and the
 * first two games. The month's grid is most of a screen, so without this a
 * touched day changed a list nobody could see.
 */
const DAY_REVEAL = 280;

/** How far ahead the calendar goes: IGDB dates little beyond next year. */
const YEARS_AHEAD = 2;

/**
 * A year of releases as a calendar: twelve months, and on each day the biggest
 * game that came out — or is due — on it.
 *
 * Opened from the Calendar button at the top of Search.
 *
 * ## One list, read on either side of today
 *
 * Behind today a month shows its **top releases**; ahead of today it shows the
 * **most anticipated** games still to come. They are one ranking: IGDB's
 * follows-before-release plus its ratings-after (`calendarWeight`), so a month
 * moves from "awaited" to "played" without anything on this screen changing
 * how it sorts. The heading under the month is the only thing that says which
 * side of today you are on.
 *
 * ## The month, then the games
 *
 * The grid is the days of the month and nothing else: five rows of seven, each
 * square under its number, the day's biggest game as its cover and a count
 * where there are more (`monthRows`). No weekdays — it had a row of them and
 * started each month on the day its 1st fell on, which cost a sixth row and a
 * header for a fact nobody reads a release calendar for; the owner had both
 * taken out, and the squares grew into the room.
 *
 * Under the grid are the month's games, biggest first, **as covers three
 * across** — the app's grid, titled and dated, because a month is browsed.
 * **Touching a day turns that into a list**: the day's games as rows, each with
 * the number that put it there. A day holds one to five games and is read; a
 * month holds dozens and is looked through.
 *
 * ## What is not on a square
 *
 * A game IGDB knows only as "November 2026" is in November's list with no day,
 * and one known only as "2026" is in the year's own list at the foot. IGDB
 * stores both as a real timestamp — the last day of the month, 31 December —
 * and a calendar that believed it would release forty games on New Year's Eve
 * (`precisionOf`).
 *
 * One request pair per year, kept for hours; every month and every day is read
 * out of it in memory.
 */
export default function CalendarScreen() {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { width: windowWidth } = useWindowDimensions();

  /* Read once, when the screen mounts: "today" must not move between renders,
     and a lazy initialiser is the one place a clock may be read during one. */
  const [now] = useState(() => new Date());
  const thisYear = now.getUTCFullYear();

  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(() => now.getUTCMonth());
  /** The day the list is narrowed to, or null for the whole month. */
  const [day, setDay] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const calendar = useQuery({
    queryKey: ['release-calendar', year],
    queryFn: ({ signal }) => getReleaseCalendar(year, signal),
    staleTime: 6 * 60 * 60_000,
    gcTime: 6 * 60 * 60_000,
  });

  const games = calendar.data;
  const rows = useMemo(() => monthRows(year, month), [year, month]);
  const byDay = useMemo(() => gamesByDay(games ?? [], year, month), [games, year, month]);
  const ofMonth = useMemo(() => gamesOfMonth(games ?? [], year, month), [games, year, month]);
  const undated = useMemo(() => undatedOf(games ?? []), [games]);

  const tense = monthTense(year, month, now);
  const today = year === thisYear && month === now.getUTCMonth() ? now.getUTCDate() : null;

  const pageWidth = Math.min(windowWidth, MaxContentWidth);
  const cell = Math.floor(
    (pageWidth - Spacing.x16 * 2 - CELL_GAP * (MONTH_COLUMNS - 1)) / MONTH_COLUMNS
  );
  const tileWidth = gridItemWidth(pageWidth, PORTRAIT_COLUMNS, Spacing.x16, GRID_GAP);

  /* One handler for all thirty-one squares, so a memoised square stays
     memoised: touching the chosen day again lets go of it. */
  const toggleDay = useCallback(
    (date: number) => setDay((current) => (current === date ? null : date)),
    []
  );

  /*
   * Choosing a day scrolls just far enough to show its list — the day's
   * heading and its first games — and no further, so the grid it was chosen
   * from stays above it. Never back up: somebody already reading the list is
   * left where they are. The three figures are measured by the scroller as it
   * lays out and moves; nothing here is state.
   */
  const scroller = useRef<ScrollView>(null);
  const listTop = useRef(0);
  const viewport = useRef(0);
  const scrolled = useRef(0);

  useEffect(() => {
    if (day === null) return;
    const target = listTop.current - (viewport.current - DAY_REVEAL);
    if (target > scrolled.current) scroller.current?.scrollTo({ y: target, animated: true });
  }, [day]);

  /*
   * A month at a time, across the years (the Apple pass, 2026-11-05: the
   * month is the large title, a ‹ › capsule beside it, and a swipe between
   * months — the twelve pills and the year row are gone). Bounded by what
   * IGDB has and by how far ahead anything is announced.
   */
  const [direction, setDirection] = useState<1 | -1>(1);
  const atStart = year <= EARLIEST_IGDB_YEAR && month === 0;
  const atEnd = year >= thisYear + YEARS_AHEAD && month === 11;

  function stepMonth(by: 1 | -1) {
    if (by < 0 ? atStart : atEnd) return;
    const index = year * 12 + month + by;
    setDirection(by);
    setYear(Math.floor(index / 12));
    setMonth(index % 12);
    setDay(null);
    setShowAll(false);
  }

  /* The grid follows a sideways finger a little, and a swipe past a fifth of
     the page — or a flick — turns the month. A vertical drag is the page's. */
  const drag = useSharedValue(0);
  const swipe = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      drag.set(event.translationX * SWIPE_FOLLOW);
    })
    .onEnd((event) => {
      const far = Math.abs(event.translationX) > pageWidth * SWIPE_TURN;
      const fast = Math.abs(event.velocityX) > SWIPE_FLICK;
      if (far || fast) runOnJS(stepMonth)(event.translationX < 0 ? 1 : -1);
      drag.set(withSpring(0, { damping: 22, stiffness: 260 }));
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drag.get() }] }));

  const dayGames = day === null ? null : (byDay.get(day) ?? []);
  const listed = dayGames ?? (showAll ? ofMonth : ofMonth.slice(0, MONTH_LIMIT));

  const heading =
    day !== null
      ? `${day} ${MONTHS[month]}`
      : tense === 'past'
        ? 'Top releases'
        : tense === 'future'
          ? 'Most anticipated'
          : 'This month';

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      topBar={
        <FrostedTopBar
          back
          title={`${MONTHS[month]} ${year}`}
          right={
            <>
              <TopBarDisc
                icon="chevron-back"
                label={atStart ? 'No earlier months' : `${MONTHS[(month + 11) % 12]}`}
                onPress={() => stepMonth(-1)}
              />
              <TopBarDisc
                icon="chevron-forward"
                label={atEnd ? 'No later months' : `${MONTHS[(month + 1) % 12]}`}
                onPress={() => stepMonth(1)}
              />
            </>
          }
        />
      }>
      <PageScrollView
        ref={scroller}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onLayout={(event) => {
          viewport.current = event.nativeEvent.layout.height;
        }}
        onScroll={(event) => {
          scrolled.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={64}>
        {calendar.isLoadingError ? (
          <ErrorState error={calendar.error} onRetry={() => calendar.refetch()} />
        ) : (
          <>
            <GestureDetector gesture={swipe}>
              {/* The drag's transform on the outer view, the month's entrance
                  on the inner one: a layout animation would overwrite a
                  transform on its own view (Reanimated's warning). */}
              <Animated.View style={dragStyle}>
                <Animated.View
                  key={`${year}-${month}`}
                  entering={
                    reduceMotion
                      ? undefined
                      : (direction > 0 ? FadeInRight : FadeInLeft).duration(240)
                  }
                  style={styles.grid}
                  accessibilityHint="Swipe left or right for another month">
                  {rows.map((row, index) => (
                    <View key={index} style={styles.week}>
                      {row.map((date, column) =>
                        date === null ? (
                          /* Past the month's last day: the square's room, kept, so
                         a short month is the same height as a long one. */
                          <View
                            key={`blank-${column}`}
                            style={{ width: cell, height: NUMBER_BAND + Math.round(cell * 1.5) }}
                          />
                        ) : (
                          <DayCell
                            key={date}
                            date={date}
                            games={byDay.get(date)}
                            size={cell}
                            selected={day === date}
                            today={today === date}
                            loading={calendar.isLoading}
                            label={`${date} ${MONTHS[month]}`}
                            onSelect={toggleDay}
                          />
                        )
                      )}
                    </View>
                  ))}
                </Animated.View>
              </Animated.View>
            </GestureDetector>

            <View
              style={styles.section}
              onLayout={(event) => {
                listTop.current = event.nativeEvent.layout.y;
              }}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionTitle}>
                  <Text variant="h4" accessibilityRole="header">
                    {heading}
                  </Text>
                  <Text variant="bodySmall" color="textMuted">
                    {day !== null
                      ? `${listed.length} ${listed.length === 1 ? 'release' : 'releases'}`
                      : `${MONTHS[month]} ${year}`}
                  </Text>
                </View>
                {day !== null && (
                  <Button
                    title={`All of ${MONTHS[month]}`}
                    variant="ghost"
                    size="small"
                    onPress={() => setDay(null)}
                  />
                )}
              </View>

              {calendar.isLoading ? (
                <GridSkeleton fill={theme.skeleton} width={tileWidth} />
              ) : listed.length === 0 ? (
                <Text variant="body" color="textSecondary">
                  {day !== null
                    ? 'Nothing notable came out on this day.'
                    : `IGDB has no notable releases dated in ${MONTHS[month]} ${year}.`}
                </Text>
              ) : day !== null ? (
                /* A day: its few games as rows, to be read. */
                listed.map((game, index) => (
                  <CalendarRow
                    key={game.id}
                    game={game}
                    divided={index > 0}
                    released={game.releasedAt * 1000 <= now.getTime()}
                  />
                ))
              ) : (
                /* A month: its games as covers three across, to be looked
                   through. Each is dated underneath, since the square it
                   belongs to is no longer beside it. */
                <View style={styles.covers}>
                  {listed.map((game) => (
                    <GameGridTile
                      key={game.id}
                      id={game.id}
                      title={game.title}
                      coverUrl={calendarCover(game, 'cover_big')}
                      heroUrl={null}
                      caption={shortDate(game)}
                      width={tileWidth}
                    />
                  ))}
                </View>
              )}

              {day === null && !showAll && ofMonth.length > MONTH_LIMIT && (
                <Button
                  title={`Show all ${ofMonth.length}`}
                  variant="secondary"
                  onPress={() => setShowAll(true)}
                />
              )}
            </View>

            {/* Announced for the year and nothing closer. Only ahead of today:
                behind it, a game with no date is a game IGDB never dated. */}
            {tense !== 'past' && day === null && undated.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitle}>
                  <Text variant="h4" accessibilityRole="header">
                    No date yet
                  </Text>
                  <Text variant="bodySmall" color="textMuted">
                    Announced for {year}, with no month named
                  </Text>
                </View>
                <View style={styles.covers}>
                  {undated.slice(0, UNDATED_LIMIT).map((game) => (
                    <GameGridTile
                      key={game.id}
                      id={game.id}
                      title={game.title}
                      coverUrl={calendarCover(game, 'cover_big')}
                      heroUrl={null}
                      caption={shortDate(game)}
                      width={tileWidth}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </PageScrollView>
    </Screen>
  );
}

/**
 * One day of the month: its number, and under it the cover of the biggest game
 * out that day.
 *
 * The number is the square's heading, not a badge on the art — it is what a
 * calendar is read by, so it is set over the cover at a size that can be, and
 * the cover is left whole. A day with nothing on it is a quiet square you
 * cannot press, its number dimmed: most days are, and a month of thirty
 * tappable empties would bury the ones that lead somewhere. The count in the
 * corner is how many more share the day.
 *
 * Today's number sits on a disc of the accent — a shape as well as a colour, so
 * it can be found without reading thirty of them — and the chosen day takes
 * the accent's edge.
 */
const DayCell = memo(function DayCell({
  date,
  games,
  size,
  selected,
  today,
  loading,
  label,
  onSelect,
}: {
  date: number;
  games: CalendarGame[] | undefined;
  size: number;
  selected: boolean;
  today: boolean;
  loading: boolean;
  label: string;
  /** Choose this day, or let go of it when it is already chosen. */
  onSelect: (date: number) => void;
}) {
  const theme = useTheme();
  const height = Math.round(size * 1.5);
  const lead = games?.[0];
  const cover = lead ? calendarCover(lead, 'cover_small_2x') : null;

  const number = (
    <View style={styles.dayNumber}>
      <View style={[styles.dayDisc, today && { backgroundColor: theme.primary }]}>
        <Text
          variant="itemTitle"
          style={[
            styles.dayDigits,
            { color: today ? theme.onPrimary : lead ? theme.text : theme.textMuted },
          ]}>
          {date}
        </Text>
      </View>
    </View>
  );

  if (!lead) {
    return (
      <View
        accessible
        accessibilityLabel={`${label}${today ? ', today' : ''}. No releases.`}
        style={{ width: size }}>
        {number}
        <View
          style={[
            styles.day,
            { width: size, height, backgroundColor: loading ? theme.skeleton : theme.surface },
          ]}
        />
      </View>
    );
  }

  const more = games!.length - 1;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}${today ? ', today' : ''}. ${lead.title}${
        more > 0 ? ` and ${more} more` : ''
      }.`}
      onPress={() => onSelect(date)}
      scaleTo={0.94}
      style={{ width: size }}>
      {number}
      <View style={[styles.day, { width: size, height, backgroundColor: theme.surfaceElevated }]}>
        {cover && (
          <Image
            source={{ uri: cover }}
            recyclingKey={lead.id}
            style={styles.dayCover}
            cachePolicy="memory-disk"
            contentFit="cover"
            transition={160}
            accessibilityIgnoresInvertColors
          />
        )}
        {more > 0 && (
          <View style={[styles.dayMore, { backgroundColor: theme.scrim }]}>
            <Text variant="h6" color="white">
              +{more}
            </Text>
          </View>
        )}
        {selected && (
          <View
            style={[styles.daySelected, { borderColor: theme.primaryText }]}
            pointerEvents="none"
          />
        )}
      </View>
    </PressableScale>
  );
});

/** "19 Nov", "November" or "2026" — as much of the date as IGDB actually has. */
function dateLine(game: CalendarGame): string {
  const date = new Date(game.releasedAt * 1000);
  if (game.precision === 'year') return String(date.getUTCFullYear());
  if (game.precision === 'month') return `${MONTHS[date.getUTCMonth()]}, day to be announced`;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()].slice(0, 3)}`;
}

/** The same, at the width of a cover's caption: "19 Nov", "Nov, no day yet", "2026". */
function shortDate(game: CalendarGame): string {
  const date = new Date(game.releasedAt * 1000);
  if (game.precision === 'year') return String(date.getUTCFullYear());
  const month = MONTHS[date.getUTCMonth()].slice(0, 3);
  return game.precision === 'month' ? `${month}, no day yet` : `${date.getUTCDate()} ${month}`;
}

/**
 * One game under the month: its cover, its name, when, and the number that put
 * it on this list — its score once it is out and rated, how many people are
 * following it until then.
 */
const CalendarRow = memo(function CalendarRow({
  game,
  divided,
  released,
}: {
  game: CalendarGame;
  divided: boolean;
  released: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();

  const standing =
    released && game.ratings > 0
      ? `${game.ratings.toLocaleString()} ${game.ratings === 1 ? 'rating' : 'ratings'}`
      : game.hypes > 0
        ? `${game.hypes.toLocaleString()} following`
        : null;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[game.title, dateLine(game), standing].filter(Boolean).join(', ')}
      onPress={() => router.push({ pathname: '/game/[id]', params: { id: game.id } })}
      scaleTo={0.98}
      style={StyleSheet.flatten([
        styles.row,
        divided && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ])}>
      <Poster
        coverUrl={calendarCover(game, 'cover_big')}
        title={game.title}
        gameId={game.id}
        width={ROW_COVER}
        rounded="image"
      />

      <View style={styles.rowText}>
        <Text variant="itemTitle" numberOfLines={2}>
          {game.title}
        </Text>
        <Text variant="bodySmall" color="textSecondary">
          {dateLine(game)}
        </Text>
        {standing && (
          <Text variant="bodySmall" color="textMuted">
            {standing}
          </Text>
        )}
      </View>

      {released && game.score !== null && game.ratings > 0 && (
        <Text variant="h3" style={{ color: scoreColor(game.score, theme) }}>
          {game.score}
        </Text>
      )}
    </PressableScale>
  );
});

/** Two rows of covers' worth of structure while the year is on its way. */
function GridSkeleton({ fill, width }: { fill: string; width: number }) {
  return (
    <View
      style={styles.covers}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading the year’s releases">
      {[0, 1, 2, 3, 4, 5].map((tile) => (
        <View key={tile} style={{ width }}>
          <View
            style={[styles.ghostCover, { width, height: width * 1.5, backgroundColor: fill }]}
          />
          <View style={styles.ghostCaption}>
            <View style={[styles.ghostLine, { width: '80%', backgroundColor: fill }]} />
            <View style={[styles.ghostLine, { width: '45%', backgroundColor: fill }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.x16,
    paddingBottom: Spacing.x48,
    gap: Spacing.x24,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  grid: { gap: ROW_GAP },
  week: { flexDirection: 'row', gap: CELL_GAP },
  /* The band over a square that holds its number, centred on it. */
  dayNumber: { height: NUMBER_BAND, alignItems: 'center', justifyContent: 'flex-start' },
  /* Sized for two digits; filled only for today. */
  dayDisc: {
    minWidth: Type.itemTitle.lineHeight,
    height: Type.itemTitle.lineHeight,
    paddingHorizontal: 3,
    borderRadius: Type.itemTitle.lineHeight / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDigits: { fontVariant: ['tabular-nums'], textAlign: 'center' },
  /* The app's box-art corner: a day with a game on it is that game's cover. */
  day: { borderRadius: Radius.image, overflow: 'hidden' },
  dayCover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dayMore: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    paddingHorizontal: 3,
    borderRadius: Radius.image,
  },
  daySelected: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.image,
    borderWidth: 2,
  },

  section: { gap: Spacing.x12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  sectionTitle: { flex: 1, gap: 2 },
  /* The month's games: three across, wrapping, a browsed grid's twelve across
     and a little more down, where each cover carries two lines. */
  covers: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GRID_GAP, rowGap: Spacing.x16 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  ghostCover: { borderRadius: Radius.image },
  ghostCaption: { paddingTop: Spacing.x8, gap: Spacing.x4 },
  ghostLine: { height: 12, borderRadius: Radius.xs },
});
