import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  Platform,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { AwardShow } from '@/components/award-show';
import {
  COLLECTION_COVER_FADE,
  COLLECTION_COVER_RATIO,
  COLLECTION_META_LINE,
  COLLECTION_SCRIM_TOP,
  COLLECTION_TITLE_FOOT,
  CollectionHeader,
  CollectionOwnerMenu,
  collectionArt,
  collectionCover,
} from '@/components/collection-header';
import { CaptionedGrid } from '@/components/captioned-grid';
import { CommentSection } from '@/components/comment-section';
import { CollectionRow } from '@/components/collection-row';
import { CollectionToolbar, type CollectionLayout } from '@/components/collection-toolbar';
import { PORTRAIT_COLUMNS, gridItemWidth } from '@/components/gaming/game-tile';
import { Button } from '@/components/ui/button';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { IconButton } from '@/components/ui/icon-button';
import { PageFlatList } from '@/components/ui/page-scroll';
import { PageFill, PinnedHero } from '@/components/ui/pinned-hero';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { ArtRowWindow, CoverGridWindow } from '@/constants/list-window';
import { ControlHeight, Radius, Spacing, Type, type ThemePalette } from '@/constants/theme';
import { AccentProvider, useGameAccent } from '@/hooks/use-accent';
import { useTopBarInset } from '@/hooks/use-header-height';
import { useSquareCover } from '@/hooks/use-square-cover';
import { useTheme } from '@/hooks/use-theme';
import { TOP_BAR_ROW, handoffBand, revealOffset } from '@/constants/top-bar';
import {
  deleteList,
  getEngagement,
  getList,
  getProfile,
  removeFromList,
  removeManyFromList,
  reorderList,
  setListCover,
  TIERS,
  type ListItem,
} from '@/lib/api';
import { sortGames, type GameSort } from '@/lib/games';
import { useAuth } from '@/store/auth';

/** A game's cover in a tier list's row, in dp. */
const POSTER = 58;

/** The collection's name until it is measured: one line of the display step. */
const COLLECTION_TITLE_ESTIMATE = Type.display.lineHeight ?? 34;

/** The mark on a tile while games are being chosen for removal. */
const SELECT_MARK = 24;

/**
 * What the bar of the selection takes off the bottom of the list, so the last
 * row can be scrolled clear of it: the button, and the bar's own padding.
 */
const SELECTION_BAR_SPACE = ControlHeight.medium + Spacing.x12 * 2 + Spacing.x16;

/**
 * Three across — the app's portrait size (`PORTRAIT_COLUMNS`).
 *
 * **This number has been ruled on five times; three stands, and it was seen on
 * a phone both ways.** Three, then four on the argument that a collection is a
 * shelf, then three again: at four each cover was "a thumbnail of the box". The
 * owner then gave a reference for the library — a Letterboxd films tab, four to
 * a row — and asked for it "the same for the collection screen inside"; it was
 * built, they looked at it, and took the collection back: "switch back to the 3
 * row games inside the collection screen. But keep the 4 rows for the library."
 * So the library is four (`SHELF_COLUMNS`) and this is not. Do not make the two
 * match.
 */
const GRID_COLUMNS = PORTRAIT_COLUMNS;
const GRID_GAP = Spacing.x12;

/**
 * The tier ramp, warm → cool so the ordering reads before the letters do.
 *
 * Data rather than chrome, which is what exempts it from the one-accent rule —
 * see DESIGN.md § 1.5. Row-header fills only; the type on top of them is
 * `background`, because these are tuned as backgrounds for near-black text.
 */
function tierColor(tier: string, theme: ThemePalette): string {
  const ramp: Record<string, string> = {
    S: theme.tierS,
    A: theme.tierA,
    B: theme.tierB,
    C: theme.tierC,
    D: theme.tierD,
    F: theme.tierF,
  };
  return ramp[tier] ?? theme.surfaceElevated;
}

export default function ListDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id);
  const [sort, setSort] = useState<GameSort>('default');
  const [layout, setLayout] = useState<CollectionLayout>('grid');
  const [pickingCover, setPickingCover] = useState(false);
  /* The owner's menu: opened from the top right of the screen, drawn with the
     masthead. Here because the bar and the sheet are two different parts of
     this screen and both need to know. */
  const [menuOpen, setMenuOpen] = useState(false);
  /*
   * The games chosen for removal, by id. Empty means nobody is choosing.
   *
   * Removing was one game at a time — a cross on each row, and in the grid no
   * way at all. Holding a game now starts a selection, every tap after that
   * adds to it or takes from it, and one button at the foot of the screen
   * removes the lot. A mode with no state of its own: it is on exactly while
   * something is selected, so unticking the last game leaves it.
   */
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const selecting = selected.size > 0;

  const { width, height: windowHeight } = useWindowDimensions();
  const gridWidth = gridItemWidth(width, GRID_COLUMNS, Spacing.x16, GRID_GAP);

  const list = useQuery({
    queryKey: ['list', id],
    queryFn: () => getList(id!),
    enabled: !!id,
  });

  // The header credits the creator, which `getList` does not join.
  const owner = useQuery({
    queryKey: ['profile', list.data?.user_id],
    queryFn: () => getProfile(list.data!.user_id),
    enabled: !!list.data?.user_id,
  });

  // `getEngagement` is keyed by target, so one call covers this collection.
  const engagement = useQuery({
    queryKey: ['engagement', 'list', id, userId ?? null],
    queryFn: async () => (await getEngagement('list', [id!], userId ?? null))[id!],
    enabled: !!id,
  });

  /*
   * The page's colour: the cover's Material 3 page — every collection has one
   * cover now (`collectionCover`), so every collection with a game in it takes
   * a colour — seeded by that game's *box art*, as the game's own page is
   * (`useGameAccent`), even when the header is drawing its square art: the
   * extractor reads a thumbnail, and SteamGridDB's smallest is 400×400. The
   * two are the same game's artwork and nearly always the same palette.
   * Above the early returns because it is a hook; the app's own page for a
   * collection with no game in it, and with game colours off.
   */
  const cover = list.data ? collectionCover(list.data) : null;
  const boxArt = cover?.cover_url ?? cover?.hero_url ?? null;
  const accent = useGameAccent(boxArt, null);
  const page = boxArt && accent.tonal ? accent.page : theme.background;
  /* The hero: which picture, and where it sits — the header's own rule, so
     the art pinned behind the page is the one the header leaves room for.
     `useSquareCover` is a module store shared with the header, so asking here
     costs no second lookup. */
  const square = useSquareCover({ gameId: cover?.id, title: cover?.title, enabled: !!cover });
  const coverHeight = Math.round(windowHeight * COLLECTION_COVER_RATIO);
  const heroArt = collectionArt(cover, square);
  /* Solid page colour, and the bar in, once the name has gone under the bar
     — the line under it reaching the bar's foot — as on the game page. */
  const topInset = useTopBarInset();
  const barHeader = coverHeight - COLLECTION_TITLE_FOOT - COLLECTION_META_LINE;
  const solidAt = Math.max(1, revealOffset(barHeader, topInset + TOP_BAR_ROW));
  /* The handoff to the glass bar: from the name's top reaching the bar's foot
     to its foot reaching it, as on the game page. */
  const [titleHeight, setTitleHeight] = useState<number | null>(null);
  const handoff = handoffBand(
    barHeader - (titleHeight ?? COLLECTION_TITLE_ESTIMATE),
    barHeader,
    topInset + TOP_BAR_ROW
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['list', id] });
    queryClient.invalidateQueries({ queryKey: ['lists'] });
    queryClient.invalidateQueries({ queryKey: ['favorites'] });
  }

  const remove = useMutation({
    mutationFn: (gameId: string) => removeFromList(id!, gameId),
    onSuccess: (_result, gameId) => {
      invalidate();
      /* The removed game's own page counts the collections it is in and lists
         them. Keyed by game, so `['lists']` above does not reach them — and this
         is the only screen that can take a game *off* a shelf. Not folded into
         `invalidate()`: the other two callers (reorder, cover, caption) change
         nothing about which lists hold what. */
      queryClient.invalidateQueries({ queryKey: ['game-list-count', gameId] });
      queryClient.invalidateQueries({ queryKey: ['game-lists', gameId] });
    },
  });

  /* Stable, as the two under it are: every tile and row is handed these, and a
     memoised tile only stays memoised while its handlers keep their identity. */
  const toggleSelected = useCallback((gameId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(gameId)) next.add(gameId);
      return next;
    });
  }, []);

  const openGame = useCallback(
    (gameId: string) => router.push({ pathname: '/game/[id]', params: { id: gameId } }),
    [router]
  );

  function clearSelection() {
    setSelected(new Set());
  }

  const removeSelected = useMutation({
    mutationFn: (gameIds: string[]) => removeManyFromList(id!, gameIds),
    onSuccess: (_result, gameIds) => {
      clearSelection();
      invalidate();
      /* Each removed game's own page counts and lists the collections it is in,
         keyed by game — the same two keys the single remove above refreshes. */
      for (const gameId of gameIds) {
        queryClient.invalidateQueries({ queryKey: ['game-list-count', gameId] });
        queryClient.invalidateQueries({ queryKey: ['game-lists', gameId] });
      }
    },
    onError: (error) =>
      Alert.alert(
        'Could not remove those games',
        error instanceof Error ? error.message : 'Try again in a moment.'
      ),
  });

  /*
   * Android's back button leaves the selection before it leaves the screen.
   * Subscribed only while something is selected, so back is otherwise the
   * navigator's. The handler sets state; the effect itself does not.
   */
  useEffect(() => {
    if (!selecting) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelected(new Set());
      return true;
    });
    return () => subscription.remove();
  }, [selecting]);

  /**
   * Move an item one slot up or down.
   *
   * Arrow buttons rather than drag-and-drop: a gesture-driven reorder inside a
   * FlatList needs a dedicated library, and this keeps the interaction reliable
   * and accessible. Only the two swapped rows are written back.
   */
  const move = useMutation({
    mutationFn: async ({ index, direction }: { index: number; direction: -1 | 1 }) => {
      const items = list.data?.items ?? [];
      const target = index + direction;
      if (target < 0 || target >= items.length) return;

      const a = items[index];
      const b = items[target];
      await reorderList(id!, [
        { gameId: a.game_id, position: target, tier: a.tier },
        { gameId: b.game_id, position: index, tier: b.tier },
      ]);
    },
    onSuccess: invalidate,
  });

  const setTier = useMutation({
    mutationFn: async ({ item, tier }: { item: ListItem; tier: string | null }) => {
      await reorderList(id!, [
        { gameId: item.game_id, position: item.position, tier: tier as ListItem['tier'] },
      ]);
    },
    onSuccess: invalidate,
  });

  const destroy = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      await deleteList(userId, id!);
    },
    onSuccess: () => {
      invalidate();
      router.back();
    },
  });

  /*
   * Choosing the cover is a *mode* over the existing grid rather than a picker
   * screen. The collection is already a wall of its own games — putting a
   * second copy of that wall behind a modal would be the same list twice, and
   * the owner would be choosing from thumbnails without the context of the
   * collection they are choosing for.
   */
  const setCover = useMutation({
    mutationFn: (gameId: string) => setListCover(id!, gameId),
    onSuccess: () => {
      invalidate();
      setPickingCover(false);
    },
  });
  /* TanStack keeps `mutate` on one identity for the life of the mutation. */
  const { mutate: pickCover } = setCover;
  const { mutate: removeGame } = remove;

  /*
   * Display order only — nothing here is written back.
   *
   * `rankOf` is keyed off the *stored* sequence rather than the rendered index,
   * so a ranked collection sorted by release year still shows each game the
   * number its owner gave it. Renumbering on sort would turn a ranking into a
   * different ranking every time someone changed the view.
   *
   * Both memos run before the early returns below: they are hooks, and hooks
   * cannot sit behind a conditional.
   */
  const items = useMemo(() => list.data?.items ?? [], [list.data]);

  const rankOf = useMemo(
    () => new Map(items.map((item, index) => [item.game_id, index + 1])),
    [items]
  );

  /*
   * Both "Add games" and the header's edit action open the picker.
   *
   * They used to push `/search`, which is browsing, not picking: it lost track
   * of the collection entirely and a tap there opened the game page. There is
   * no other editing surface for a collection, so edit lands here too.
   */
  function openPicker() {
    router.push({ pathname: '/add-to-list/[id]', params: { id: id! } });
  }

  const ordered = useMemo(
    () =>
      sortGames(
        items.map((item) => ({
          item,
          title: item.game?.title ?? '',
          releaseYear: item.game?.release_year ?? null,
          score: item.game?.score ?? null,
        })),
        sort
      ).map((entry) => entry.item),
    [items, sort]
  );

  if (list.isLoading) {
    return (
      <Screen edges={['bottom']} topBar={<FrostedTopBar back glass />}>
        <LoadingState />
      </Screen>
    );
  }

  if (list.isLoadingError) {
    return (
      <Screen edges={['bottom']} topBar={<FrostedTopBar back glass />}>
        <ErrorState error={list.error} />
      </Screen>
    );
  }

  if (!list.data) {
    return (
      <Screen edges={['bottom']} topBar={<FrostedTopBar back glass />}>
        <EmptyState title="List not found" />
      </Screen>
    );
  }

  const data = list.data;
  const isOwner = data.user_id === userId;
  const isTierList = data.kind === 'tier';
  const isAwards = data.kind === 'awards';
  const isCaptioned = data.kind === 'captioned';
  /*
   * Who can start a selection, and where. The owner, on the three shapes this
   * file draws — a shelf as a grid or as rows, and a tier list. Not while a
   * cover is being picked (a tap there already means something else), and never
   * on an award show or a captioned board, which draw themselves: an award's
   * `list_items` are written by a trigger from its ballot, not by this screen.
   */
  const canSelect = isOwner && !pickingCover && !isAwards && !isCaptioned;

  /*
   * The top of the screen, as SimpMusic's album has it: back at the left, and —
   * for whoever made the collection — its menu at the right, in the same disc
   * of glass. A visitor has nothing to edit and gets no second disc.
   *
   * The discs stay where they are — Apple's bar (`glass`): there is always a
   * way back. Once the cover has gone under where the bar sits, and drained
   * to the page's colour, the bar's glass fades in under them with the
   * collection's name centred.
   */
  const topBar = (
    <FrostedTopBar
      back
      glass
      title={list.data?.title}
      header={barHeader}
      handoff={handoff}
      right={
        isOwner ? (
          <TopBarDisc
            icon="ellipsis-vertical"
            label="Edit this collection"
            onPress={() => setMenuOpen(true)}
          />
        ) : undefined
      }
    />
  );

  /*
   * What every branch's screen is: the page's Material 3 colour, and behind
   * the page its colour and the cover pinned at the top of the display
   * (`<PinnedHero>`) — the game page's, here too.
   */
  const screenProps = {
    edges: ['bottom'] as const,
    background: page,
    topBar,
    backdrop: (
      <>
        <PageFill color={page} />
        {heroArt.uri && (
          <PinnedHero
            uri={heroArt.uri}
            height={coverHeight}
            page={page}
            fade={COLLECTION_COVER_FADE}
            solidAt={solidAt}
            scrim={COLLECTION_SCRIM_TOP}
            contentPosition={heroArt.contentPosition}
          />
        )}
      </>
    ),
  };

  const header = (
    /* Cancels the list's horizontal padding so the hero reaches both edges and
       runs under the floating header, the way a game page opens. The header's
       own body re-applies the inset to its text. */
    <View style={styles.headerBleed}>
      {/* Who made it, share and like are the masthead's. What its owner can do
          to it is not: that is the menu below, opened from the top right of
          the screen. */}
      <CollectionHeader
        collection={data}
        owner={owner.data ?? null}
        pageColor={page}
        engagement={engagement.data}
        handoff={handoff}
        onTitleHeight={setTitleHeight}
        onShare={() =>
          Share.share({
            message: `${data.title} — ${items.length} games on GameLog`,
          }).catch(() => undefined)
        }
      />

      {isOwner && (
        <CollectionOwnerMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          collection={data}
          onEdit={openPicker}
          onEditDetails={() =>
            router.push({ pathname: '/edit-list/[id]', params: { id: data.id } })
          }
          onDelete={() => destroy.mutate()}
          onPickCover={() => {
            /* One mode at a time: both change what a tap on a game does. */
            clearSelection();
            setPickingCover(true);
          }}
        />
      )}

      {/* The picking mode's own bar. Only while the mode is on: the control
          that *enters* it is in the owner's menu. */}
      {pickingCover && (
        <View style={styles.controls}>
          <View
            style={[
              styles.coverHint,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
            ]}>
            <Text variant="bodySmall" color="textSecondary" style={styles.coverHintText}>
              Tap a game to use its cover as this collection&rsquo;s artwork.
            </Text>
            <Button
              title="Cancel"
              variant="ghost"
              size="small"
              onPress={() => setPickingCover(false)}
            />
          </View>
        </View>
      )}

      {/*
        Sort and layout, on one row directly above the games.

        A tier list is grouped by tier and an award show's rows come from
        `list_awards`, so neither can be re-ordered by this control — but both
        can still be *drawn* two ways, which is why the toolbar renders for them
        with `showSort` off rather than being suppressed entirely. A captioned
        board is the one shape that gets neither: its arrangement is authored,
        nine tiles answering one question in the order their owner put them, and
        it has its own layout by definition.
      */}
      {!isCaptioned && items.length > 1 && (
        <View style={styles.controls}>
          <CollectionToolbar
            sort={sort}
            onSort={setSort}
            layout={layout}
            onLayout={setLayout}
            showSort={!isTierList && !isAwards}
          />
        </View>
      )}
    </View>
  );

  /*
   * The conversation about the collection, under it.
   *
   * Migration 0018 is what makes this possible — `comments` only accepted a post
   * or a log until then, which is why a collection could be liked but not
   * answered. Curation is an argument (the About says so in the owner's own
   * words) and an argument nobody can reply to is a broadcast.
   *
   * Not rendered while picking a cover or choosing games to remove: both modes
   * turn every tile into a different control, and a composer underneath them is
   * an invitation to tap something that does something else.
   */
  const footer =
    pickingCover || selecting ? null : (
      <View style={styles.comments}>
        <CommentSection targetType="list" targetId={data.id} />
      </View>
    );

  /*
   * The selection's one action, pinned to the foot of the screen while games
   * are selected — on the page's own colour, so it reads as the bottom of this
   * screen rather than as something floating over it. The count is in the
   * button's own words because that is the number the press acts on.
   *
   * No "are you sure": each game was chosen by hand, the button says how many,
   * and a removed game goes back in from "Add games".
   */
  const selectionBar = selecting ? (
    <View
      style={[
        styles.selectionBar,
        /* The page's darker tone: the bar is docked at the foot, where the
           page has long since darkened. */
        { backgroundColor: page, borderTopColor: theme.border },
      ]}>
      <IconButton icon="close" accessibilityLabel="Cancel the selection" onPress={clearSelection} />
      <View style={styles.selectionAction}>
        <Button
          title={`Remove from collection (${selected.size} selected)`}
          variant="danger"
          fullWidth
          loading={removeSelected.isPending}
          onPress={() => removeSelected.mutate([...selected])}
        />
      </View>
    </View>
  ) : null;

  /*
   * Three layouts, one screen.
   *
   * An award show is a ballot of *categories* — rows that exist before there is
   * a game in them — so it reads `list_awards` rather than the items above and
   * lives in its own component. A tier list is a ranking: each entry needs its
   * tier badge, its position and its remove control, so it stays a row.
   * Everything else is a shelf, and a grid of art three across shows far more of
   * it per screen — which is the whole point of a collection.
   *
   * The kind is not known until the list query resolves, which is why this
   * branches here rather than at the top of the file: every tile in the app
   * links to `/list/<id>` without knowing what shape is behind it.
   */
  if (isAwards) {
    return (
      <AccentProvider artwork={boxArt} neutral={!boxArt}>
        <Screen {...screenProps}>
          <AwardShow listId={id!} isOwner={isOwner} header={header} />
        </Screen>
      </AccentProvider>
    );
  }

  /*
   * A captioned board.
   *
   * Its own branch rather than a flag on the grid below, because the two are
   * different objects: that one is a wall of artwork where the cover *is* the
   * row, and this one is a set of statements where the cover illustrates a line
   * of the owner's text. They share a data shape and nothing else — different
   * columns, different tile, different tap target on the caption.
   *
   * Rendered inside a single-item list rather than as its own `numColumns` grid
   * so the masthead, the comments and the board scroll as one column; the grid
   * lays itself out with `flexWrap`, which a `numColumns` FlatList cannot be
   * given without also handing it the tile height in advance.
   */
  if (isCaptioned) {
    return (
      <AccentProvider artwork={boxArt} neutral={!boxArt}>
        <Screen {...screenProps}>
          <PageFlatList
            settle={handoff}
            data={[null]}
            keyExtractor={() => 'board'}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={header}
            ListFooterComponent={footer}
            /* No wrapper and no second padding. `styles.content` already insets
             this list by `Spacing.x16` on both sides; a `board` View adding its
             own put 48dp of padding between the screen edges and the grid while
             the grid was told it had only 24dp taken — so on a 360dp phone it
             sized three 108dp tiles into 312dp of space and the third wrapped.
             The width handed down has to be the width that actually exists. */
            renderItem={() => (
              <CaptionedGrid
                listId={data.id}
                items={ordered}
                isOwner={isOwner}
                width={width - Spacing.x16 * 2}
              />
            )}
          />
        </Screen>
      </AccentProvider>
    );
  }

  /*
   * The list layout: one game per row, cover beside title.
   *
   * Its own return rather than a branch inside the grid's `renderItem`, because
   * `numColumns` is not a runtime-switchable prop — React Native warns and
   * refuses to re-lay-out a `FlatList` whose column count changed. The `key` on
   * each list is what forces a clean remount when the toggle flips, which is the
   * documented way to change it at all.
   *
   * Not while a cover is being picked: that mode is drawn over the grid, where
   * the choice is between pieces of artwork. In rows the hint said "tap a game
   * to use its cover" and a tap opened the game.
   */
  if (!isTierList && layout === 'rows' && !pickingCover) {
    return (
      <AccentProvider artwork={boxArt} neutral={!boxArt}>
        <Screen {...screenProps}>
          <PageFlatList
            settle={handoff}
            data={ordered}
            key="collection-rows"
            keyExtractor={(item) => item.game_id}
            {...ArtRowWindow}
            /* The set is not in `data`, so the list is told it matters. */
            extraData={selected}
            contentContainerStyle={[styles.content, selecting && styles.underBar]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={header}
            ListFooterComponent={footer}
            ItemSeparatorComponent={RowRule}
            renderItem={({ item }) => (
              <CollectionRow
                item={item}
                /* The stored rank, not the rendered index — a ranked collection
                 sorted by year still shows each game the number its owner gave
                 it. Unranked collections show none at all rather than numbering
                 a set, which would claim an order that is not there. */
                rank={data.is_ranked ? (rankOf.get(item.game_id) ?? null) : null}
                selecting={selecting}
                selected={selected.has(item.game_id)}
                onToggle={toggleSelected}
                onStartSelecting={canSelect ? toggleSelected : undefined}
                /* One way to remove at a time: the row's own cross steps aside
                 while a selection is being made. */
                onRemove={isOwner && !selecting ? removeGame : undefined}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                title="Nothing here yet"
                message={
                  isOwner
                    ? 'Tap "Add games", then tap a search result to add it.'
                    : 'This collection is empty.'
                }
              />
            }
          />
          {selectionBar}
        </Screen>
      </AccentProvider>
    );
  }

  const isRanked = data.is_ranked;
  const coverGameId = data.cover_game_id;
  /* Plain functions, not `useCallback`: this is past the rows view's early
     return, where a hook would change the order of hooks between the two
     views. The React Compiler memoises them. */
  const keyExtractor = (item: ListItem) => item.game_id;
  const renderGridItem = ({ item }: { item: ListItem }) => (
    <GridTile
      item={item}
      width={gridWidth}
      rank={isRanked ? (rankOf.get(item.game_id) ?? null) : null}
      mode={pickingCover ? 'pick' : selecting ? 'select' : 'open'}
      isCover={coverGameId === item.game_id}
      isSelected={selected.has(item.game_id)}
      canSelect={canSelect}
      onOpen={openGame}
      onPick={pickCover}
      onToggle={toggleSelected}
    />
  );

  if (!isTierList) {
    return (
      /* The cover runs full-bleed under the bar, so no `insetHeader` and no
         title: the collection's name is set over its own artwork right below. */
      <AccentProvider artwork={boxArt} neutral={!boxArt}>
        <Screen {...screenProps}>
          <PageFlatList
            settle={handoff}
            data={ordered}
            key="collection-grid"
            numColumns={GRID_COLUMNS}
            keyExtractor={keyExtractor}
            {...CoverGridWindow}
            /* The set is not in `data`, so the list is told it matters. */
            extraData={selected}
            columnWrapperStyle={styles.column}
            contentContainerStyle={[styles.grid, selecting && styles.underBar]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={header}
            ListFooterComponent={footer}
            renderItem={renderGridItem}
            removeClippedSubviews={Platform.OS === 'android'}
            ListEmptyComponent={
              <EmptyState
                title="Nothing here yet"
                message={
                  isOwner
                    ? 'Tap “Add games”, then tap a search result to add it.'
                    : 'This collection is empty.'
                }
              />
            }
          />
          {selectionBar}
        </Screen>
      </AccentProvider>
    );
  }

  return (
    <AccentProvider artwork={boxArt} neutral={!boxArt}>
      <Screen {...screenProps}>
        <PageFlatList
          settle={handoff}
          data={items}
          keyExtractor={(item) => item.game_id}
          {...ArtRowWindow}
          extraData={selected}
          contentContainerStyle={[
            items.length === 0 ? styles.empty : styles.content,
            selecting && styles.underBar,
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          renderItem={({ item, index }) => (
            <View style={[styles.row, { borderTopColor: theme.border }]}>
              {data.is_ranked && !isTierList && (
                <Text variant="h3" color="textMuted" style={styles.rank}>
                  {index + 1}
                </Text>
              )}

              {isTierList && item.tier && (
                <View style={[styles.tierBadge, { backgroundColor: tierColor(item.tier, theme) }]}>
                  <Text variant="h5" color="background">
                    {item.tier}
                  </Text>
                </View>
              )}

              {/* The art is the row's one pressable that is about the game: it
                opens it, picks it as the cover, or — once a selection has been
                started by holding one — ticks it. */}
              <PressableScale
                accessibilityRole={selecting ? 'checkbox' : 'button'}
                accessibilityState={selecting ? { checked: selected.has(item.game_id) } : undefined}
                accessibilityLabel={
                  pickingCover
                    ? `Use ${item.game?.title ?? 'this game'} as the preview`
                    : (item.game?.title ?? 'Game')
                }
                accessibilityHint={
                  canSelect && !selecting ? 'Hold to choose games to remove' : undefined
                }
                scaleTo={0.96}
                onPress={
                  pickingCover
                    ? () => setCover.mutate(item.game_id)
                    : selecting
                      ? () => toggleSelected(item.game_id)
                      : () => router.push({ pathname: '/game/[id]', params: { id: item.game_id } })
                }
                onLongPress={
                  canSelect && !selecting ? () => toggleSelected(item.game_id) : undefined
                }>
                <Poster
                  coverUrl={item.game?.cover_url}
                  heroUrl={item.game?.hero_url}
                  title={item.game?.title}
                  width={POSTER}
                  rounded="image"
                />
                {pickingCover && data.cover_game_id === item.game_id && (
                  <View style={[styles.coverMark, { backgroundColor: theme.primary }]}>
                    <Ionicons name="checkmark" size={14} color={theme.onPrimary} />
                  </View>
                )}
                {selecting && (
                  <View
                    style={[
                      styles.selectMark,
                      selected.has(item.game_id)
                        ? { backgroundColor: theme.primary, borderColor: theme.primary }
                        : { backgroundColor: theme.scrim, borderColor: theme.text },
                    ]}
                    pointerEvents="none">
                    {selected.has(item.game_id) && (
                      <Ionicons name="checkmark" size={15} color={theme.onPrimary} />
                    )}
                  </View>
                )}
              </PressableScale>

              {/* The reference's row: a semibold title over a quiet regular
                line, 2 apart. */}
              <View style={styles.rowBody}>
                <Text variant="itemTitle" numberOfLines={2}>
                  {item.game?.title ?? 'Unknown game'}
                </Text>
                {item.game?.release_year && (
                  <Text variant="bodySmall" color="textMuted">
                    {item.game.release_year}
                  </Text>
                )}

                {isOwner && isTierList && (
                  <View style={styles.tierPicker}>
                    {TIERS.map((tier) => (
                      <PressableScale
                        key={tier}
                        accessibilityRole="button"
                        accessibilityLabel={`Set tier ${tier}`}
                        onPress={() =>
                          setTier.mutate({ item, tier: item.tier === tier ? null : tier })
                        }
                        scaleTo={0.88}
                        /* A choice: outlined at rest, filled with the tier's own
                         colour once it is this row's tier. */
                        style={StyleSheet.flatten([
                          styles.tierChip,
                          item.tier === tier
                            ? {
                                backgroundColor: tierColor(tier, theme),
                                borderColor: 'transparent',
                              }
                            : { backgroundColor: 'transparent', borderColor: theme.outline },
                        ])}>
                        <Text
                          variant="caption"
                          style={{
                            color: item.tier === tier ? theme.background : theme.textMuted,
                          }}>
                          {tier}
                        </Text>
                      </PressableScale>
                    ))}
                  </View>
                )}
              </View>

              {/* The row's own controls step aside while a selection is being
                made: one way to remove at a time. */}
              {isOwner && !selecting && (
                <View style={styles.rowActions}>
                  {!isTierList && (
                    <>
                      <IconButton
                        icon="chevron-up"
                        accessibilityLabel="Move up"
                        size="small"
                        tone="plain"
                        disabled={index === 0}
                        onPress={() => move.mutate({ index, direction: -1 })}
                      />
                      <IconButton
                        icon="chevron-down"
                        accessibilityLabel="Move down"
                        size="small"
                        tone="plain"
                        disabled={index === items.length - 1}
                        onPress={() => move.mutate({ index, direction: 1 })}
                      />
                    </>
                  )}
                  {/* `plain`: the row already has its own surface, and a boxed
                    outline around each glyph would make it a grid. */}
                  <IconButton
                    icon="close"
                    accessibilityLabel="Remove from collection"
                    size="small"
                    tone="danger"
                    onPress={() => remove.mutate(item.game_id)}
                  />
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              title="Nothing in this list yet"
              message={isOwner ? 'Search for a game and tap it to add it here.' : undefined}
              action={
                isOwner ? (
                  <Button title="Find games" variant="secondary" onPress={openPicker} />
                ) : undefined
              }
            />
          }
        />
        {selectionBar}
      </Screen>
    </AccentProvider>
  );
}

/** What a tap on a grid tile does. */
type TileMode = 'open' | 'pick' | 'select';

/**
 * One game in the grid: its box, and whichever mark the mode in force draws on
 * it.
 *
 * Portrait, as every game inside a collection is — the header over them is
 * the one place its art goes square (`<CollectionHeader>`). No `gameId` on
 * the `<Poster>`: a collection is one of the two surfaces where a cover never
 * wears the Must Play badge.
 *
 * Memoised, and handed only primitives and handlers that keep their identity.
 * The tile used to be built inside an inline `renderItem`, so ticking one game
 * re-drew every cover in a collection of two hundred.
 */
const GridTile = memo(function GridTile({
  item,
  width,
  rank,
  mode,
  isCover,
  isSelected,
  canSelect,
  onOpen,
  onPick,
  onToggle,
}: {
  item: ListItem;
  width: number;
  /** The owner's number for it, or null for a collection that is not ranked. */
  rank: number | null;
  mode: TileMode;
  /** This game is the collection's chosen cover. */
  isCover: boolean;
  isSelected: boolean;
  /** Holding the tile may start a selection. */
  canSelect: boolean;
  onOpen: (gameId: string) => void;
  onPick: (gameId: string) => void;
  onToggle: (gameId: string) => void;
}) {
  const theme = useTheme();
  const gameId = item.game_id;
  const title = item.game?.title ?? 'this game';
  const selecting = mode === 'select';

  const tile = (
    <View style={{ width }}>
      <Poster
        coverUrl={item.game?.cover_url}
        heroUrl={item.game?.hero_url}
        title={item.game?.title}
        width={width}
        rounded="image"
      />
      {rank !== null && mode === 'open' && (
        <View style={[styles.rankPill, { backgroundColor: theme.scrim }]}>
          <Text variant="caption" color="white">
            {rank}
          </Text>
        </View>
      )}
      {mode === 'pick' && isCover && (
        <View style={[styles.coverMark, { backgroundColor: theme.primary }]}>
          <Ionicons name="checkmark" size={14} color={theme.onPrimary} />
        </View>
      )}
      {selecting && (
        <>
          {/* The chosen tile is edged as well as ticked, so the selection reads
              across a wall of art without hunting for marks; an unchosen one
              keeps an empty ring that says it can be. */}
          {isSelected && (
            <View
              style={[styles.selectedEdge, { borderColor: theme.primaryText }]}
              pointerEvents="none"
            />
          )}
          <View
            style={[
              styles.selectMark,
              isSelected
                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                : { backgroundColor: theme.scrim, borderColor: theme.text },
            ]}
            pointerEvents="none">
            {isSelected && <Ionicons name="checkmark" size={15} color={theme.onPrimary} />}
          </View>
        </>
      )}
    </View>
  );

  if (mode === 'pick') {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Use ${title} as the preview`}
        scaleTo={0.95}
        onPress={() => onPick(gameId)}>
        {tile}
      </PressableScale>
    );
  }

  return (
    <PressableScale
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: isSelected } : undefined}
      accessibilityLabel={item.game?.title ?? 'Game'}
      accessibilityHint={canSelect && !selecting ? 'Hold to choose games to remove' : undefined}
      scaleTo={0.95}
      onPress={() => (selecting ? onToggle(gameId) : onOpen(gameId))}
      onLongPress={canSelect && !selecting ? () => onToggle(gameId) : undefined}>
      {tile}
    </PressableScale>
  );
});

/**
 * The hairline between two rows. Declared once, here: written inline in the
 * list's props it is a new component type on every render, and the list
 * remounts every separator on screen each time.
 */
function RowRule() {
  const theme = useTheme();
  return <View style={[styles.rowRule, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  comments: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x32 },
  rowRule: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.x16 },
  grid: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, gap: GRID_GAP },
  column: { gap: GRID_GAP },
  headerBleed: { marginHorizontal: -Spacing.x16 },
  controls: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x16, gap: Spacing.x12 },
  rankPill: {
    position: 'absolute',
    top: 4,
    left: 4,
    minWidth: 18,
    alignItems: 'center',
    paddingHorizontal: Spacing.x4,
    borderRadius: Radius.image,
  },

  content: { padding: Spacing.x16, paddingBottom: Spacing.x48 },
  empty: { flexGrow: 1 },
  header: { gap: Spacing.x8, marginBottom: Spacing.x16 },
  ownerActions: { flexDirection: 'row', gap: Spacing.x8, marginTop: Spacing.x8 },
  ownerAction: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rank: { minWidth: 26, textAlign: 'center' },
  tierBadge: {
    width: 30,
    height: 30,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowBody: { flex: 1, gap: 2 },
  /* A notice with its one way out: a card's corner and edge, not a button's. */
  coverHint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingLeft: Spacing.x16,
    paddingRight: Spacing.x4,
    paddingVertical: Spacing.x4,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  coverHintText: { flex: 1 },
  /* Sits where the rank pill would, so the two never overlap — the rank is
     hidden while picking. */
  coverMark: {
    position: 'absolute',
    top: Spacing.x4,
    left: Spacing.x4,
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierPicker: { flexDirection: 'row', gap: Spacing.x4, marginTop: Spacing.x4 },
  tierChip: {
    width: 24,
    height: 24,
    borderRadius: Radius.image,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowActions: { gap: Spacing.x4 },

  /* Room for the last row to scroll clear of the selection's bar. */
  underBar: { paddingBottom: Spacing.x48 + SELECTION_BAR_SPACE },
  /* Pinned to the foot of the screen, above the system's own inset — the
     `<Screen>` it sits in already ends there. A hairline on top is what
     separates it from a list scrolling under it. */
  selectionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  selectionAction: { flex: 1 },
  /* Top-right, clear of the rank pill and the cover mark, which are top-left. */
  selectMark: {
    position: 'absolute',
    top: Spacing.x4,
    right: Spacing.x4,
    width: SELECT_MARK,
    height: SELECT_MARK,
    borderRadius: SELECT_MARK / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Over the art rather than around it, so a chosen tile does not change size
     and push the grid about. */
  selectedEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.image,
    borderWidth: 2,
  },
});
