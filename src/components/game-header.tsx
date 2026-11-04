import Ionicons from '@expo/vector-icons/Ionicons';
import MaskedView from '@react-native-masked-view/masked-view';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutRectangle } from 'react-native';

import { AddToCollection } from '@/components/add-to-collection';
import { MustPlayStar } from '@/components/must-play-badge';
import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { HandoffTitle } from '@/components/ui/handoff-title';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { editionLabel } from '@/constants/game-editions';
import { GAME_LABEL_TEXT } from '@/constants/game-labels';
import { PROGRESS_META, progressChoiceFor } from '@/constants/progress';
import { clampScore, labelFor, scoreColor } from '@/constants/score';
import { FontFamily, Palette, Spacing, withAlpha } from '@/constants/theme';
import { useGameLabel } from '@/hooks/use-game-labels';
import { useLogoInk } from '@/hooks/use-logo-ink';
import { useTheme } from '@/hooks/use-theme';
import { getListMembership, getRatingBreakdown, toggleSingletonMembership } from '@/lib/api';
import type { GameLog } from '@/lib/database.types';
import { parseGameId, type Game } from '@/lib/games';
import { getGameDetails, getTimeToBeat, type GameCompany } from '@/lib/games/igdb';
import { gameLogoLook, logoBox } from '@/lib/games/logo-art';
import { formatReleaseDate, isUnreleased } from '@/lib/games/release';
import { hasWriting } from '@/lib/review-quote';
import { useAuth } from '@/store/auth';
import { errorText, listToastFor, toast } from '@/lib/toast';

/*
 * The words of the game page's Apple TV header, top to bottom (the owner's
 * references, 2026-11-03 — PRIMETIME, F1 The Movie, Resident Evil): the
 * game's logo where Apple TV sets the film's (`<TitleMark>`; its name in type
 * when it has none), the genres under
 * it, the white pill and the round key beside it, the synopsis in two lines
 * with MORE, then the facts in one line — year, playtime, score, age rating —
 * and who developed it. Centred down to the keys, set left from the synopsis
 * on, as the references are.
 */

const PILL_HEIGHT = 52;
const PILL_MIN_WIDTH = 172;
const ABOUT_SIZE = 15;
const ABOUT_LINE = 21;
const LINK_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };
const SECONDS_PER_HOUR = 3600;
const BOARD_ORDER = ['ESRB', 'PEGI', 'USK', 'CERO', 'ACB', 'CLASS_IND', 'GRAC'];
/** The logo is never wider than this, on any display. */
const LOGO_MAX_WIDTH = 360;

/* White on the art, at the references' strengths: the name pure, the genres
   and the synopsis a step under, the facts a step under that. */
const INK = Palette.white;
const SOFT = withAlpha(Palette.white, 0.86);
const QUIET = withAlpha(Palette.white, 0.7);

export type GameHeaderWordsProps = {
  game: Game;
  log: GameLog | null;
  /** IGDB's companies, once `getGameExtras` has answered. */
  companies: readonly GameCompany[];
  /** Where the top bar takes the name over (`handoffBand`). */
  band: { from: number; to: number };
  /** The name's box in the words, for the bar. */
  onTitleBox: (box: LayoutRectangle) => void;
  /**
   * False when Settings → Game title hides the name: its box stays, at no
   * height, so the page still knows where the words begin — and the name
   * is still what a screen reader hears.
   */
  showTitle?: boolean;
  onOpenProgress: () => void;
  onOpenLists: () => void;
  onReadMore: () => void;
  /**
   * Where the rows the blur's band is set by stand in the words: the genres,
   * the Log pill's row and the synopsis (`<PinnedHero band>`).
   */
  onRows?: (row: 'genres' | 'keys' | 'about', y: number) => void;
};

export function GameHeaderWords({
  game,
  log,
  companies,
  band,
  onTitleBox,
  showTitle = true,
  onOpenProgress,
  onOpenLists,
  onReadMore,
  onRows,
}: GameHeaderWordsProps) {
  const unreleased = isUnreleased(game);
  const kind = game.edition ? editionLabel(game.edition) : null;
  const genres = [kind, ...game.genres.slice(0, 3)].filter(Boolean);
  const developers = companies.filter((company) => company.role === 'developer');

  return (
    <View style={styles.words} pointerEvents="box-none">
      {/* F1's "Coming To Theaters": the one thing said before the name. */}
      {unreleased && (
        <View style={styles.badge}>
          <Text variant="h5" style={{ color: INK }}>
            {game.releaseDate ? `Coming ${formatReleaseDate(game.releaseDate)}` : 'Coming soon'}
          </Text>
        </View>
      )}

      {showTitle ? (
        <View
          style={styles.centred}
          onLayout={(event) => onTitleBox(event.nativeEvent.layout)}
          pointerEvents="none">
          <HandoffTitle band={band}>
            <TitleMark game={game} />
          </HandoffTitle>
        </View>
      ) : (
        <View
          onLayout={(event) => onTitleBox(event.nativeEvent.layout)}
          pointerEvents="none"
          accessible
          accessibilityRole="header"
          accessibilityLabel={game.title}
        />
      )}

      <Text
        style={styles.genres}
        numberOfLines={1}
        onLayout={(event) => onRows?.('genres', event.nativeEvent.layout.y)}>
        {genres.length > 0 ? genres.join(' · ') : 'Game'}
      </Text>

      <View onLayout={(event) => onRows?.('keys', event.nativeEvent.layout.y)}>
        <HeaderKeys
          game={game}
          log={log}
          onOpenProgress={onOpenProgress}
          onOpenLists={onOpenLists}
        />
      </View>

      {!!game.description && (
        <View onLayout={(event) => onRows?.('about', event.nativeEvent.layout.y)}>
          <About text={game.description} onMore={onReadMore} />
        </View>
      )}

      <FactLine game={game} />

      {developers.length > 0 ? (
        <DevelopedBy companies={developers} />
      ) : game.developer ? (
        <Text style={styles.developed} numberOfLines={2}>
          {'Developed by '}
          <Text style={styles.developedName}>{game.developer}</Text>
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The game's name — as its logo, where IGDB has one (the owner's, 2026-11-03:
 * "replacing the plain title with the png custom game logo"), else in type.
 *
 * Every logo is measured once (`useLogoInk`, kept on the device) before it is
 * drawn, and the measurement says two things:
 *
 *  - **Where the drawing is in its file** (`bounds`): many are uploaded on a
 *    canvas far larger than themselves — Kingdom Come: Deliverance II's fills
 *    half its height, Phantom Blade Zero's is a thin strip across a 16:9
 *    canvas — so the file is cropped to its ink, and the drawing alone is
 *    sized (`logoBox`: every logo at the same area, Red Dead Redemption 2's,
 *    which the owner called "decent").
 *  - **How to draw it** (`gameLogoLook`): as it is; white, if it is dark all
 *    over (a black logo always is); or the name in type, if it brought its
 *    own rectangle of ground. A file that will not load is the name too.
 *
 * Until it is measured, on a logo's first sighting, its place is held empty.
 */
function TitleMark({ game }: { game: Game }) {
  const { width } = useWindowDimensions();
  const logo = game.logo ?? null;
  const [failed, setFailed] = useState<string | null>(null);
  const measured = useLogoInk(logo?.url ?? null);

  const name = (
    <Text
      accessibilityRole="header"
      numberOfLines={3}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
      style={styles.title}>
      {game.title}
    </Text>
  );
  if (!logo || failed === logo.url) return name;

  const bounds = measured.ink?.bounds ?? FULL;
  const aspect = (logo.width * bounds.width) / Math.max(1, logo.height * bounds.height);
  const box = logoBox(aspect, Math.min(width - Spacing.x16 * 2, LOGO_MAX_WIDTH));
  /* The logo's first sighting: an empty place, for the moment it is measured. */
  if (!measured.resolved) return <View style={box} />;

  const look = logo.tint ? 'white' : gameLogoLook(measured.ink);
  if (look === 'name') return name;

  /* The whole file, scaled so its ink fills the box, and moved so the ink is
     in it: the box clips the empty canvas round it. */
  const drawn = { width: box.width / bounds.width, height: box.height / bounds.height };
  return (
    <View
      style={[box, styles.logoBox]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={game.title}>
      <Image
        source={{ uri: logo.url }}
        style={[
          drawn,
          { position: 'absolute', left: -bounds.x * drawn.width, top: -bounds.y * drawn.height },
        ]}
        contentFit="fill"
        tintColor={look === 'white' ? INK : undefined}
        transition={200}
        cachePolicy="memory-disk"
        priority="high"
        onError={() => setFailed(logo.url)}
      />
    </View>
  );
}

/** No crop: a logo measured before `bounds` existed, or not measured at all. */
const FULL = { x: 0, y: 0, width: 1, height: 1 };

/**
 * The white pill and the round key beside it — Apple TV's Play and its check.
 *
 * **The pill logs**: "Log" with a plus until there is a log, then the answer
 * you gave ("Playing", "Completed") with its glyph. It opens a menu — write or
 * edit the review, log or change the progress, read the review. An unreleased
 * game cannot be reviewed or progressed (the owner's rule), so there the pill
 * is the wishlist, the one thing worth doing about a game that is not out.
 *
 * **The round key is ⋯**: favourite, wishlist, add to a collection — the
 * three keys the old action row held — and the collections it is in.
 */
function HeaderKeys({
  game,
  log,
  onOpenProgress,
  onOpenLists,
}: {
  game: Game;
  log: GameLog | null;
  onOpenProgress: () => void;
  onOpenLists: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);
  const [logTrigger, logMenu] = useAnchoredMenu();
  const [moreTrigger, moreMenu] = useAnchoredMenu();
  const [picking, setPicking] = useState(false);

  const membership = useQuery({
    queryKey: ['list-membership', userId, game.id],
    queryFn: () => getListMembership(userId!, game.id),
    enabled: !!userId,
  });

  const toggleList = useMutation({
    mutationFn: async ({ kind, next }: { kind: 'favorites' | 'wishlist'; next: boolean }) => {
      if (!userId) throw new Error('You must be signed in.');
      await toggleSingletonMembership(userId, kind, game, next);
    },
    onError: (error) =>
      toast.error('Couldn’t update your lists', { description: errorText(error) }),
    onSuccess: (_result, { kind, next }) => {
      toast.success(listToastFor(kind, next));
      for (const key of [
        ['list-membership', userId, game.id],
        ['my-log', userId, game.id],
        ['favorites', userId],
        ['lists', userId],
        ['feed'],
        ['user-logs', userId],
        ['game-audience', game.id],
      ]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  const favourited = membership.data?.favorited ?? false;
  const wishlisted = membership.data?.wishlisted ?? false;
  const listsKnown = !membership.isLoading && !toggleList.isPending;
  const unreleased = isUnreleased(game);
  const progress = progressChoiceFor(log);
  const meta = progress ? PROGRESS_META[progress] : null;
  const written = !!log && hasWriting(log);

  const pill = unreleased
    ? {
        icon: (wishlisted ? 'bookmark' : 'bookmark-outline') as keyof typeof Ionicons.glyphMap,
        label: wishlisted ? 'On your wishlist' : 'Wishlist',
        spoken: wishlisted ? 'On your wishlist. Take it off.' : 'Add it to your wishlist',
        onPress: () => {
          if (listsKnown) toggleList.mutate({ kind: 'wishlist', next: !wishlisted });
        },
      }
    : {
        icon: (meta?.icon ?? 'add') as keyof typeof Ionicons.glyphMap,
        label: meta?.label ?? 'Log',
        spoken: meta
          ? `Your progress: ${meta.label}. Log or review it.`
          : 'Log this game or write a review',
        onPress: logMenu.open,
      };

  return (
    <View style={styles.keys}>
      <View ref={logTrigger} collapsable={false}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={pill.spoken}
          onPress={pill.onPress}
          scaleTo={0.96}
          style={StyleSheet.flatten([styles.pill, { backgroundColor: INK }])}>
          <PressGlyph>
            <Ionicons name={pill.icon} size={22} color={theme.shadowInk} />
          </PressGlyph>
          <Text style={[styles.pillLabel, { color: theme.shadowInk }]} numberOfLines={1}>
            {pill.label}
          </Text>
        </PressableScale>
      </View>

      <View ref={moreTrigger} collapsable={false}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="More: favourite, wishlist, add to a collection"
          onPress={moreMenu.open}
          scaleTo={0.94}
          style={StyleSheet.flatten([styles.round, { backgroundColor: withAlpha(INK, 0.2) }])}>
          <PressGlyph>
            <Ionicons name="ellipsis-horizontal" size={24} color={INK} />
          </PressGlyph>
        </PressableScale>
      </View>

      <AnchoredMenu menu={logMenu} label={`Log ${game.title}`}>
        <AnchoredMenuItem
          icon="create-outline"
          title={written ? 'Edit your review' : 'Write a review'}
          onPress={() => {
            logMenu.close();
            router.push({ pathname: '/log/[id]', params: { id: game.id } });
          }}
        />
        <AnchoredMenuItem
          icon={meta?.outline ?? 'add-circle-outline'}
          title={meta ? 'Change your progress' : 'Log your progress'}
          hint={meta ? `Now: ${meta.label}` : 'Playing, completed, dropped…'}
          onPress={() => {
            logMenu.close();
            onOpenProgress();
          }}
        />
        {written && log && (
          <AnchoredMenuItem
            icon="document-text-outline"
            title="Read your review"
            onPress={() => {
              logMenu.close();
              router.push({ pathname: '/review/[id]', params: { id: log.id } });
            }}
          />
        )}
        {log && (
          <AnchoredMenuItem
            icon="repeat-outline"
            title="Your playthroughs"
            onPress={() => {
              logMenu.close();
              router.push({ pathname: '/playthroughs/[game]', params: { game: game.id } });
            }}
          />
        )}
      </AnchoredMenu>

      <AnchoredMenu menu={moreMenu} label={`More for ${game.title}`} align="end">
        <AnchoredMenuItem
          icon={favourited ? 'star' : 'star-outline'}
          title={favourited ? 'Remove from favourites' : 'Add to favourites'}
          onPress={() => {
            moreMenu.close();
            if (listsKnown) toggleList.mutate({ kind: 'favorites', next: !favourited });
          }}
        />
        <AnchoredMenuItem
          icon={wishlisted ? 'bookmark' : 'bookmark-outline'}
          title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          onPress={() => {
            moreMenu.close();
            if (listsKnown) toggleList.mutate({ kind: 'wishlist', next: !wishlisted });
          }}
        />
        <AnchoredMenuItem
          icon="albums-outline"
          title="Add to a collection"
          onPress={() => {
            moreMenu.close();
            setPicking(true);
          }}
        />
        <AnchoredMenuItem
          icon="list-outline"
          title="Collections it’s in"
          onPress={() => {
            moreMenu.close();
            onOpenLists();
          }}
        />
      </AnchoredMenu>

      <AddToCollection game={game} visible={picking} onClose={() => setPicking(false)} />
    </View>
  );
}

/**
 * The synopsis in two lines, the second fading out under MORE — the
 * references' own. The fade is a mask on the words, not a colour laid over
 * them: what is behind them is the art's blurred foot, which no flat colour
 * matches. MORE opens the whole of it.
 */
function About({ text, onMore }: { text: string; onMore: () => void }) {
  const [lines, setLines] = useState<number | null>(null);
  const long = lines !== null && lines > 2;
  const words = (
    <Text style={styles.about} numberOfLines={2}>
      {text}
    </Text>
  );

  return (
    <View style={styles.aboutBox}>
      {/* Laid out whole, unseen, to know whether it runs past two lines. */}
      <Text
        style={[styles.about, styles.measure]}
        onTextLayout={(event) => setLines(event.nativeEvent.lines.length)}
        accessible={false}
        importantForAccessibility="no-hide-descendants">
        {text}
      </Text>

      {long ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${text.slice(0, 160)}… Read the whole description.`}
          onPress={onMore}
          scaleTo={0.99}>
          <MaskedView
            maskElement={
              <View style={styles.maskBox}>
                <View style={[styles.maskLine, styles.maskWhole]} />
                <LinearGradient
                  colors={MASK_FADE}
                  locations={MASK_STOPS}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.maskLine}
                />
              </View>
            }>
            {words}
          </MaskedView>
          <View style={styles.more} pointerEvents="none">
            <Text style={styles.moreLabel}>MORE</Text>
          </View>
        </PressableScale>
      ) : (
        words
      )}
    </View>
  );
}

const MASK_FADE = ['#000', '#000', 'rgba(0,0,0,0)'] as const;
const MASK_STOPS = [0, 0.6, 0.82] as const;

/**
 * The facts in one line: "2017 · 50 h · ★ 87 · PEGI 16" — Apple TV's year,
 * running time, scores and rating boxes. The score is Pinged's when anybody
 * here has scored it, else IGDB's, named. Each is its own query, shared by
 * key with the sheets that use the same answer.
 */
function FactLine({ game }: { game: Game }) {
  const theme = useTheme();
  const router = useRouter();
  const mustPlay = useGameLabel(game.id, 'must_play');
  const parsed = parseGameId(game.id);
  const igdbId = parsed?.source === 'igdb' ? parsed.sourceId : null;

  const gameId = game.id;
  const breakdown = useQuery({
    queryKey: ['rating-breakdown', gameId],
    queryFn: () => getRatingBreakdown(gameId),
  });
  const times = useQuery({
    queryKey: ['time-to-beat', igdbId],
    queryFn: ({ signal }) => getTimeToBeat(igdbId!, signal),
    enabled: !!igdbId,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });
  const details = useQuery({
    queryKey: ['game-details', igdbId],
    queryFn: ({ signal }) => getGameDetails(igdbId!, signal),
    enabled: !!igdbId,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });

  const year = game.releaseYear;
  const seconds = times.data
    ? (times.data.normally ?? times.data.hastily ?? times.data.completely)
    : null;
  const hours = seconds !== null ? hoursFor(seconds) : null;
  const ours = breakdown.data ? clampScore(breakdown.data.average) : null;
  const igdb = ours === null && !breakdown.isPending && game.score !== null ? game.score : null;
  const score = ours ?? (igdb !== null ? Math.round(igdb) : null);
  const board = boardOf(details.data?.ageRatings);

  const parts: ReactNode[] = [];
  if (year)
    parts.push(
      <Text key="year" style={styles.fact}>
        {year}
      </Text>
    );
  if (hours) {
    parts.push(
      <Text key="hours" style={styles.fact} accessibilityLabel={`About ${hours} to beat`}>
        {hours}
      </Text>
    );
  }

  return (
    <View style={styles.facts}>
      {parts.map((part, index) => (
        <View key={index} style={styles.factPart}>
          {index > 0 && <Text style={styles.fact}>·</Text>}
          {part}
        </View>
      ))}

      {score !== null && (
        <View
          style={styles.factPart}
          accessible
          accessibilityLabel={`${ours !== null ? 'Pinged' : 'IGDB'}: ${score} out of 100, ${labelFor(score)}`}>
          {parts.length > 0 && <Text style={styles.fact}>·</Text>}
          <Ionicons
            name={ours !== null ? 'people' : 'star'}
            size={15}
            color={scoreColor(score, theme)}
          />
          <Text style={[styles.fact, styles.figure, { color: scoreColor(score, theme) }]}>
            {score}
          </Text>
          {ours === null && <Text style={styles.fact}>IGDB</Text>}
        </View>
      )}

      {board && (
        <View
          style={[styles.box, { borderColor: QUIET }]}
          accessible
          accessibilityLabel={`Rated ${board.rating} by ${board.organization}`}>
          <Text style={styles.boxLabel}>{`${board.organization} ${board.rating}`}</Text>
        </View>
      )}

      {mustPlay && (
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={`${GAME_LABEL_TEXT.must_play.spoken}. Opens every Must Play game.`}
          onPress={() => router.push('/must-play')}
          hitSlop={LINK_SLOP}
          scaleTo={0.96}
          style={StyleSheet.flatten(styles.factPart)}>
          <MustPlayStar size={16} labelled={false} />
          <Text style={styles.fact}>{GAME_LABEL_TEXT.must_play.title}</Text>
        </PressableScale>
      )}
    </View>
  );
}

/** "Developed by FromSoftware, Bandai Namco" — each name the way to its games. */
function DevelopedBy({ companies }: { companies: readonly GameCompany[] }) {
  const router = useRouter();
  return (
    <View style={styles.developedRow}>
      <Text style={styles.developed}>Developed by </Text>
      {companies.map((company, index) => (
        <PressableScale
          key={company.id}
          accessibilityRole="link"
          accessibilityLabel={`${company.name}, developer. See their games.`}
          hitSlop={LINK_SLOP}
          scaleTo={0.97}
          onPress={() =>
            router.push({
              pathname: '/studio/[id]',
              params: { id: String(company.id), name: company.name },
            })
          }>
          <Text style={[styles.developed, styles.developedName]}>
            {company.name}
            {index < companies.length - 1 ? ',' : ''}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

function hoursFor(seconds: number): string {
  const hours = seconds / SECONDS_PER_HOUR;
  if (hours < 2) return `${Math.round(hours * 10) / 10} h`;
  return `${Math.round(hours)} h`;
}

function boardOf(
  ratings: { organization: string; rating: string }[] | undefined
): { organization: string; rating: string } | null {
  if (!ratings || ratings.length === 0) return null;
  const rank = (name: string) => {
    const index = BOARD_ORDER.indexOf(name.toUpperCase());
    return index === -1 ? BOARD_ORDER.length : index;
  };
  return ratings.reduce((best, entry) =>
    rank(entry.organization) < rank(best.organization) ? entry : best
  );
}

const SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 10,
} as const;

const styles = StyleSheet.create({
  words: { paddingHorizontal: Spacing.x16, gap: Spacing.x8 },
  centred: { alignItems: 'center' },
  logoBox: { overflow: 'hidden' },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.x12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    marginBottom: Spacing.x4,
  },
  /* Where Apple TV sets the film's logo: the name, large and heavy. */
  title: {
    fontFamily: FontFamily.extraBold,
    /* A step under its first 32 (the owner's, 2026-11-03: "a little bit
       smaller"). */
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
    textAlign: 'center',
    color: INK,
    ...SHADOW,
  },
  genres: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    color: SOFT,
    ...SHADOW,
  },
  keys: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x16,
    marginTop: Spacing.x12,
    marginBottom: Spacing.x8,
  },
  pill: {
    height: PILL_HEIGHT,
    minWidth: PILL_MIN_WIDTH,
    paddingHorizontal: Spacing.x24,
    borderRadius: PILL_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
  },
  pillLabel: { fontFamily: FontFamily.semibold, fontSize: 17, lineHeight: 22 },
  round: {
    width: PILL_HEIGHT,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutBox: {},
  about: {
    fontFamily: FontFamily.regular,
    fontSize: ABOUT_SIZE,
    lineHeight: ABOUT_LINE,
    color: SOFT,
  },
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  maskBox: { height: ABOUT_LINE * 2 },
  maskLine: { height: ABOUT_LINE },
  /* The mask reads alpha: the first line is drawn whole, so it must be filled. */
  maskWhole: { backgroundColor: '#000' },
  more: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    height: ABOUT_LINE + 2,
    paddingHorizontal: Spacing.x8 + 2,
    borderRadius: (ABOUT_LINE + 2) / 2,
    justifyContent: 'center',
    backgroundColor: withAlpha(Palette.white, 0.2),
  },
  moreLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.4,
    color: INK,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: Spacing.x8,
    rowGap: Spacing.x4,
    marginTop: Spacing.x4,
  },
  factPart: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  fact: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 20, color: QUIET },
  figure: { fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
  box: {
    borderWidth: 1.2,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  boxLabel: { fontFamily: FontFamily.bold, fontSize: 11, lineHeight: 15, color: QUIET },
  developedRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4 },
  developed: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, color: QUIET },
  developedName: { fontFamily: FontFamily.bold, color: SOFT },
});
