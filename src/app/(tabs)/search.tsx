import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, StyleSheet, View, type TextInput } from 'react-native';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { GameSearchResults, MIN_QUERY_LENGTH } from '@/components/game-search-results';
import { CollapsingField } from '@/components/search/collapsing-field';
import { CatalogueResults } from '@/components/search/catalogue-results';
import { CollectionResults } from '@/components/search/collection-results';
import {
  FacetBar,
  FacetPicker,
  FacetSuggestions,
  SearchBy,
} from '@/components/search/facet-search';
import { PeopleResults } from '@/components/search/people-results';
import { PlatformDirectory } from '@/components/search/platform-directory';
import { ReviewResults } from '@/components/search/review-results';
import { SEARCH_SCOPE_INFO, scopeInfo } from '@/components/search/search-scopes';
import { SearchBrowse } from '@/components/search/search-browse';
import { TopResults } from '@/components/search/top-results';
import { StudioResults } from '@/components/search/studio-results';
import { SearchHistory } from '@/components/search-history';
import { Avatar } from '@/components/ui/avatar';
import { HeaderFade } from '@/components/ui/frosted-top-bar';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Text } from '@/components/ui/text';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import {
  FACET_INFO,
  facetsFromParams,
  facetsParams,
  sameFacet,
  type Facet,
  type FacetKind,
} from '@/lib/games/facets';
import {
  addSearchHistory,
  clearSearchHistory,
  loadSearchHistory,
  removeSearchHistory,
  type SearchScope,
} from '@/lib/search-history';
import { useAuth } from '@/store/auth';
import { Loader } from '@/components/ui/loader';

/**
 * How long a query has to stand still before it counts as a search worth
 * remembering.
 *
 * Longer than the debounce on purpose. 350ms is "stop typing for a moment";
 * this is "stop and look at what came back". Recording on the debounce instead
 * would fill the history with the keystrokes on the way to a search rather than
 * the search — and while `addSearchHistory` collapses prefixes and would tidy
 * most of that up, a term abandoned halfway is not something anyone meant to ask.
 */
const HISTORY_RECORD_MS = 1400;

/** The scopes as the tab row draws them. */
const SCOPE_TABS = SEARCH_SCOPE_INFO.map((scope) => ({ key: scope.key, label: scope.label }));

/**
 * Search: a field, and the six things it can look through as tabs under it.
 *
 * ## At rest it is Apple TV's Search
 *
 * The owner's reference (2026-11-03): "Search" large at the top left, your
 * avatar at the right, the field, and under it a grid of landscape tiles two
 * across (`<SearchBrowse>`) — no tabs. What the tab used to show before a word
 * was typed (Discover, and the Reviews and Collections charts) moved to the
 * Explore tab, whose page is `<DiscoverFeed>`; "This explore tab does not have
 * any searchable stuff", and this one now has nothing else.
 *
 * ## The tabs come in with a search
 *
 * Games, Reviews, People, Collections, Studios, Platforms — a row of pills
 * under the field (`<TabBar>`) the moment the field is touched or holds
 * anything, and while any scope but Games is chosen, whose untyped view is
 * still its own list (`*Results`). A tap on the Search key while it is open
 * returns it to rest. A menu of buttons in front of the field was tried once
 * and taken out by the owner; this is not that — the field is always there.
 *
 * ## One field, shared
 *
 * Every scope reads the same words. Switching from Games to Studios with
 * "nintendo" typed runs "nintendo" against studios, and the placeholder names
 * whichever scope is reading — so the field never disappears, never clears
 * behind the reader's back, and never strands a term in a scope that cannot
 * use it: all six can.
 *
 * ## Recent searches answer the field being touched
 *
 * Focus is the signal for "about to search", so that is when the history takes
 * the place of whatever the scope was showing — and only while there is
 * nothing typed to show results for. Blurring the field brings the scope back.
 */
export default function SearchScreen() {
  const theme = useTheme();
  const clearance = useTabBarClearance();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);
  const me = useAuth((state) => state.profile);

  /*
   * A facet — a genre, a theme, an engine… — whose games the Games tab shows
   * (`lib/games/facets.ts`). It lives in the route, not in state: a game's
   * details card sends the reader here with one ("Thriller" → this tab, its
   * thrillers), and picking one here sets the same params, so there is one
   * way in and one source of truth.
   */
  const params = useLocalSearchParams<{ facets?: string; match?: string }>();
  /* Several at once since the owner's selection mode (2026-10-16): combined —
     a game that is all of them — or any of them. */
  const { facets, match } = facetsFromParams(params);
  const facet = facets.length > 0;
  const facetKey = facets.map((entry) => `${entry.kind}:${entry.id}`).join(',');

  const [chosenScope, setScope] = useState<SearchScope>('top');
  /* A facet's games are games, whatever tab the reader left open. */
  const scope: SearchScope = facet ? 'games' : chosenScope;

  /*
   * What is typed, and what "Search by" is set to, each belong to the facet
   * they were set under. A facet arriving from a game's page starts on its
   * own games — not filtered by whatever was left in the field — and picking
   * one leaves the picker, with no effect to reset either: they are simply
   * not this facet's (`owner`).
   */
  const [typed, setTyped] = useState({ owner: '', text: '' });
  const input = typed.owner === facetKey ? typed.text : '';
  const setInput = (text: string) => setTyped({ owner: facetKey, text });
  const [looking, setLooking] = useState<{ owner: string; kind: FacetKind | null }>({
    owner: '',
    kind: null,
  });
  const lookup = looking.owner === facetKey ? looking.kind : null;
  const setLookup = (kind: FacetKind | null) => setLooking({ owner: facetKey, kind });

  /* Tracked here rather than read off the input, because the panel it controls
     is a sibling of the field, not a child. */
  const [focused, setFocused] = useState(false);
  const field = useRef<TextInput>(null);
  const query = useDebouncedValue(input.trim());
  const isQueryable = query.length >= MIN_QUERY_LENGTH;
  const info = scopeInfo(scope);

  /* Platforms filter a list already in memory; every other scope asks a
     server, and those are the searches worth a spinner and a history row. */
  const remote = scope !== 'platforms';

  /* The history is of titles searched in a scope; looking up a theme, or
     searching within one, is not one of those. */
  const recordable = remote && !lookup && !facet;

  const history = useQuery({
    queryKey: ['search-history', userId],
    queryFn: () => loadSearchHistory(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  /*
   * Remember a search once it has been left alone long enough to have been read.
   *
   * An effect rather than a call inside the results components: six scopes
   * search through six code paths and all of them should be remembered, and
   * threading a callback down through each would give shared components a
   * reason to know about the Search tab's history.
   */
  useEffect(() => {
    if (!userId || !recordable || !isQueryable) return;

    const timer = setTimeout(() => {
      void addSearchHistory(userId, query, scope).then(() =>
        queryClient.invalidateQueries({ queryKey: ['search-history', userId] })
      );
    }, HISTORY_RECORD_MS);

    return () => clearTimeout(timer);
  }, [userId, recordable, isQueryable, query, scope, queryClient]);

  function refreshHistory() {
    queryClient.invalidateQueries({ queryKey: ['search-history', userId] });
  }

  /*
   * Tapping the Search tab while it is already open returns it to where it
   * rests — Games, nothing typed — the platform convention for a tab's own
   * button, as Home's returns to its top. Only then: arriving from another tab
   * keeps whatever search was left here.
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener(
      // @ts-expect-error — `tabPress` is contributed by the Tabs navigator and
      // is not in the generic navigation event map this hook is typed against.
      'tabPress',
      () => {
        if (!navigation.isFocused()) return;
        Keyboard.dismiss();
        setTyped({ owner: '', text: '' });
        setLooking({ owner: '', kind: null });
        setScope('top');
        router.setParams({ facets: undefined, match: undefined });
      }
    );
    return unsubscribe;
  }, [navigation, router]);

  /** Add a facet to the ones whose games are shown — the same params a game's details card sends. */
  function pickFacet(next: Facet) {
    setTyped({ owner: '', text: '' });
    setLooking({ owner: '', kind: null });
    setScope('games');
    Keyboard.dismiss();
    setFocused(false);
    const list = facets.some((known) => sameFacet(known, next)) ? facets : [...facets, next];
    router.setParams(facetsParams(list, match));
  }

  function removeFacet(gone: Facet) {
    const list = facets.filter((known) => !sameFacet(known, gone));
    if (list.length === 0) clearFacet();
    else router.setParams(facetsParams(list, match));
  }

  function clearFacet() {
    router.setParams({ facets: undefined, match: undefined });
  }

  const entries = history.data ?? [];

  /* The panel takes over only when there is nothing to show results for and
     something to offer instead — an empty history would leave a focused field
     above a blank screen, which is worse than the browse content it replaced.
     Never over Platforms: nothing is recorded from that scope, and its field
     filters the directory on the first letter. */
  const showHistory = focused && remote && !isQueryable && entries.length > 0;

  /* "Search by" answers the field being touched in Games, before anything is
     typed — the owner's "the app tells the user a few options" — over the
     recent searches when there are some, alone when there are none. */
  const showSearchBy = focused && (scope === 'games' || scope === 'top') && !isQueryable;
  const searchBy = <SearchBy value={lookup} onChange={setLookup} />;

  /*
   * Is the screen busy on the reader's behalf right now?
   *
   * `input !== query` is the debounce window, and it is the half that had no
   * feedback at all: for 350ms after a keystroke the screen sat completely inert
   * showing the previous answer, which reads as "it did not register that I
   * typed". Each results list shows its own fetch; the glyph in the field covers
   * the wait before one starts.
   */
  const searching = remote && input.trim() !== query;

  /*
   * Browsing: nothing typed, nothing focused, the Games scope — Apple TV's
   * Search at rest (the owner's reference, 2026-11-03): the field and a grid
   * of tiles, no tabs. The scopes come in as soon as there is a search to
   * scope, and stay while one other than Games is chosen, whose untyped
   * view is still its own.
   */
  const browsing =
    !focused && input === '' && (scope === 'top' || scope === 'games') && !facet && !lookup;

  /** What a focused field brings over the scope: "Search by", a kind's values, the history. */
  function renderPanel() {
    /* A kind chosen in "Search by": its values, matching what is typed. */
    if (lookup) {
      return (
        <FacetPicker
          kind={lookup}
          typed={input}
          settled={query}
          header={searchBy}
          onPick={pickFacet}
        />
      );
    }

    /* Over a facet's games, "Search by" is in their header instead. */
    if (facet) return null;

    if (showSearchBy && !showHistory) {
      return (
        <PageScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.panel, { paddingBottom: Spacing.x48 + clearance }]}>
          {searchBy}
        </PageScrollView>
      );
    }

    if (showHistory) {
      return (
        <PageScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Spacing.x48 + clearance }}>
          {showSearchBy && <View style={styles.panel}>{searchBy}</View>}
          <SearchHistory
            entries={entries}
            onSelect={(entry) => {
              /* Restores the scope as well as the term — a search is both. */
              setScope(entry.scope);
              setInput(entry.term);
              Keyboard.dismiss();
              setFocused(false);
            }}
            onFill={(entry) => {
              setScope(entry.scope);
              setInput(entry.term);
            }}
            onRemove={(entry) => {
              if (!userId) return;
              void removeSearchHistory(userId, entry.term).then(refreshHistory);
            }}
            onClear={() => {
              if (!userId) return;
              void clearSearchHistory(userId).then(refreshHistory);
            }}
          />
        </PageScrollView>
      );
    }

    return null;
  }

  function renderScope() {
    /* Every game a facet holds — none left out for being obscure or new —
       paged, sorted, narrowed by platform and drawn as rows or a grid, and
       within them the ones whose names hold what is typed. The platform
       page's system (`<CatalogueResults>`). */
    if (facet) {
      return (
        <CatalogueResults
          facets={facets}
          match={match}
          term={isQueryable ? query : ''}
          header={
            <View>
              {showSearchBy && searchBy}
              <FacetBar
                facets={facets}
                match={match}
                onRemove={removeFacet}
                /* Opens the picker on genres; "Search by" over it changes kind. */
                onAdd={() => setLookup('genre')}
                onClearAll={clearFacet}
                onMatchChange={(next) => router.setParams(facetsParams(facets, next))}
              />
            </View>
          }
        />
      );
    }

    switch (scope) {
      case 'top':
        return isQueryable ? <TopResults query={query} onSeeAll={setScope} /> : <SearchBrowse />;
      case 'reviews':
        return <ReviewResults query={query} />;
      case 'people':
        return <PeopleResults query={query} />;
      case 'collections':
        return <CollectionResults query={query} />;
      case 'studios':
        return <StudioResults query={query} />;
      case 'platforms':
        /* The field as it stands, not the settled query: this one filters a
           list in memory, so it can answer on the keystroke. */
        return <PlatformDirectory filter={input} />;
      default:
        /* Games, before a title is typed, is Discover: the most useful thing
           this scope can do then is answer "what should I play next". */
        return isQueryable ? (
          <GameSearchResults
            query={query}
            layoutToggle
            header={<FacetSuggestions query={query} onPick={pickFacet} />}
          />
        ) : (
          <SearchBrowse />
        );
    }
  }

  const panel = renderPanel();

  return (
    /*
     * No `topBar` and no `insetHeader`.
     *
     * Search is a root tab with nothing to go back to, so it takes the top edge
     * the way Home does and spends the band on content.
     */
    <Screen edges={['top']}>
      {/* Folds away as the page is read and comes back on the way up; the
          tabs under it stay — SimpMusic's Home (`<CollapsingField>`). */}
      {/* reacticx's scrollable search (2026-11-02): focusing the field
          folds the title away on its spring, so the field rises to the top,
          and the panel under it fades in; pulling the page down past its top
          focuses the field (iOS — Android's scroller stops at zero). The
          title folds with the scroll in a fold of its own, so the focus fold
          never leaves a gap under the field. */}
      <FocusFold focused={focused}>
        <CollapsingField pinned={false}>
          {/* The owner's reference (2026-11-02): the tab's name large at the
            top left, a capsule of two keys at the right, then the field and
            the tabs under it. The keys are the two doors this screen has
            that are not searches — the release calendar and the scanner,
            which resolves a barcode to a release, so it is its own screen. */}
          <View style={styles.titleRow}>
            <Text variant="largeTitle" accessibilityRole="header">
              Search
            </Text>
            {/* The reference's avatar at the right: your profile. */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Your profile"
              onPress={() => router.navigate('/profile')}
              scaleTo={0.94}>
              <Avatar
                uri={me?.avatar_url ?? null}
                name={me?.display_name ?? me?.username}
                size={34}
              />
            </PressableScale>
          </View>
        </CollapsingField>
      </FocusFold>
      <CollapsingField pinned={focused} onPull={() => field.current?.focus()}>
        <View style={styles.header}>
          <TextField
            ref={field}
            value={input}
            onChangeText={setInput}
            icon="search"
            /* The pill: here the field *is* the screen's primary control. */
            variant="search"
            placeholder={
              lookup
                ? `Search ${FACET_INFO[lookup].plural}`
                : facet
                  ? 'Search within these games'
                  : info.placeholder
            }
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            /* Results are already live as you type, so committing *is* getting
             the keyboard out of the way; saying so explicitly makes the key's
             behaviour a decision. */
            onSubmitEditing={() => {
              /* Submitting is a definite search, so it is remembered immediately
               rather than waiting out `HISTORY_RECORD_MS`. */
              if (userId && recordable && isQueryable) {
                void addSearchHistory(userId, query, scope).then(refreshHistory);
              }
              Keyboard.dismiss();
              setFocused(false);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            accessibilityLabel={`Search ${info.label.toLowerCase()}`}
            /* Two jobs, one slot: progress while a search is settling,
             otherwise a way to empty the field. `clearButtonMode` is
             **iOS-only** — on Android the only way out of a thirty-character
             query was holding backspace. The scanner moved to the keys beside
             the title. */
            trailing={
              searching ? (
                <Loader size="small" color={theme.textMuted} />
              ) : Platform.OS !== 'ios' && input.length > 0 ? (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Clear the search"
                  onPress={() => setInput('')}
                  scaleTo={0.85}>
                  <Ionicons name="close-circle" size={20} color={theme.textMuted} />
                </PressableScale>
              ) : input.length === 0 ? (
                /* The scanner, back in the field's trailing slot: a barcode
                   is a search too. */
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Scan a game's barcode"
                  onPress={() => router.push('/scan')}
                  scaleTo={0.85}>
                  <PressGlyph>
                    <Ionicons name="barcode-outline" size={21} color={theme.textMuted} />
                  </PressGlyph>
                </PressableScale>
              ) : undefined
            }
          />
        </View>
      </CollapsingField>

      {/* Under the field, as the reference has them: a segmented control
          (`<TabBar>`) that scrolls, since six scopes are wider than a phone.
          The placeholder names the scope too. Outside the header's padding:
          the bar brings the page margin itself. */}
      {!browsing && (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)}>
          <TabBar
            tabs={SCOPE_TABS}
            value={scope}
            onChange={(next) => {
              /* Another tab is another search: the facet was the Games tab's. */
              if (facet) clearFacet();
              setScope(next);
            }}
            label="What to search"
          />
        </Animated.View>
      )}

      {/* The scope stays mounted, keeping its place, and what a focused
          field brings fades in over it — 350ms in, 400 out — on the page's
          own colour: reacticx's overlay and focused screen. */}
      <View style={styles.body}>
        {renderScope()}
        {/* The list dissolving into the header as it scrolls — reacticx's
            header fade, which every other page's bar has. */}
        <HeaderFade />
        {panel && (
          <Animated.View
            entering={FadeIn.duration(350)}
            exiting={FadeOut.duration(400)}
            style={[styles.panelLayer, { backgroundColor: theme.background }]}>
            {panel}
          </Animated.View>
        )}
      </View>
    </Screen>
  );
}

/** reacticx's search spring: 18 / 120 at 0.6. */
const FOCUS_SPRING = { damping: 18, stiffness: 120, mass: 0.6 } as const;

/**
 * Folds its content away while the field is focused, on reacticx's spring,
 * and back when it is not. Unfocused it is as tall as its content (which
 * folds with the scroll on its own); focused, it springs to nothing from
 * the height it last had.
 */
function FocusFold({ focused, children }: { focused: boolean; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);
  const measured = useSharedValue(0);

  useEffect(() => {
    progress.set(reduceMotion ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, FOCUS_SPRING));
  }, [focused, progress, reduceMotion]);

  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.get()));
    if (p === 0 || measured.get() === 0) return { opacity: 1, transform: [{ translateY: 0 }] };
    return {
      height: measured.get() * (1 - p),
      opacity: 1 - p,
      transform: [{ translateY: -12 * p }],
    };
  });

  return (
    <Animated.View style={[styles.fold, style]}>
      <View
        onLayout={(event) => {
          if (progress.get() === 0) measured.set(event.nativeEvent.layout.height);
        }}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fold: { overflow: 'hidden' },
  body: { flex: 1 },
  panelLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x8,
  },
  /* The reference's capsule: two 44dp keys in one pill. */
  header: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x12 },
  panel: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x16 },
});
