import { BlurTargetView } from 'expo-blur';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { MINI_PLAYER_BAND } from '@/constants/player';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useHeaderHeight } from '@/hooks/use-header-height';
import { ScreenChromeProvider } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';
import { useMiniPlayerActive } from '@/store/player';

export type ScreenProps = {
  children: ReactNode;
  /** Which safe-area edges to inset. Tab screens usually want top only. */
  edges?: readonly Edge[];
  padded?: boolean;
  /**
   * Reserve the top bar's row.
   *
   * The bar floats over the page and pushes nothing down. Screens that open on
   * artwork — a game, a collection, the Top 10 — want exactly that and leave
   * this off, **and that is also what makes their bar the artwork kind**: glass
   * discs that leave with the art, and a bar that comes in once it has gone.
   * Screens that open on a list, a form or a grid would otherwise have their
   * first row under the title, and set it; theirs is a bar from the start,
   * clear until the page moves. Includes the status bar, so it replaces a
   * `'top'` edge rather than stacking with one.
   */
  insetHeader?: boolean;
  /**
   * Decoration painted behind the page, *outside* the safe-area inset.
   *
   * For an ambient glow or wash that has to reach the very top of the display
   * rather than stopping at the status bar. `children` cannot do this: the
   * safe-area padding is applied to the container they sit in, so even an
   * `absoluteFill` child starts below the notch — and a glow that stops on the
   * status-bar boundary draws exactly the hard horizontal line it was meant to
   * avoid.
   *
   * Whatever goes here must be inert. It is under the content and, on most
   * screens, under the status bar; nothing in it can be reached.
   */
  backdrop?: ReactNode;
  /**
   * The page's floating top bar — a `<FrostedTopBar>`.
   *
   * Its own slot rather than a child, and the reason is structural: the bar
   * blurs the page, so it has to be a *sibling* of the content it blurs and sit
   * outside the `<BlurTargetView>` below. A bar rendered as a child would be
   * inside its own blur source.
   *
   * It draws over the content and reserves no space — screens that do not open
   * on artwork pair it with `insetHeader`. **A page that scrolls under it uses
   * a page scroller** (`ui/page-scroll`), which is how the bar learns to frost.
   */
  topBar?: ReactNode;
  /**
   * This page is presented as a modal.
   *
   * Only affects where the top bar's content sits: an iOS sheet already starts
   * below the status bar and must not be inset again. Set it on the four modal
   * routes and nowhere else — `useTopBarInset` has the reasoning.
   */
  modal?: boolean;
  /**
   * The page fill, when it is not the app's `background`.
   *
   * For the screens that are about one game. Those used to paint their colour
   * with a scroll-driven gradient in `backdrop`; they now fill flat with
   * `accent.page`, the darkest tone of the game's own hue. A prop rather than a
   * `backdrop` child because this *is* the page — it has to be the colour the
   * Android blur target samples, and an `absoluteFill` child of the blur target
   * is a layer on top of a fill that is still the wrong colour underneath it.
   */
  background?: string;
  /**
   * Whether this page makes room for the mini player while music is being kept
   * playing. On by default, and a page almost never says otherwise.
   *
   * The mini player (`<MiniPlayer>`) floats over the foot of the app. A page
   * gives up that much of its own foot while it is there, so its last row and
   * anything docked at its bottom — a save button, a selection bar — end above
   * the bar instead of under it. Nothing is asked of the page itself.
   *
   * `false` on exactly the routes the bar is not drawn over, which would
   * otherwise keep an empty band for it: the soundtrack screen, Surprise Me
   * and the scanner. A `modal` page is one of those already and needs no flag.
   * `lib/player-queue.ts` lists the routes, and its test reads the route files
   * to hold the two in step.
   */
  miniPlayer?: boolean;
};

/** Page shell: themed background, safe-area insets, centred max-width column. */
export function Screen({
  children,
  edges = ['top'],
  padded = false,
  insetHeader = false,
  backdrop,
  topBar,
  modal = false,
  background,
  miniPlayer = true,
}: ScreenProps) {
  const theme = useTheme();
  const headerHeight = useHeaderHeight(modal);
  const insets = useSafeAreaInsets();

  /*
   * Room for the mini player, on a page pushed over the tabs.
   *
   * A tab's own screens do not pad here: their content scrolls *under* the
   * floating tab bar and ends by `useTabBarClearance()`, which already grows
   * by the mini player's height. That hook answers zero anywhere outside the
   * tab navigator, which is how this tells the two apart.
   *
   * The band is in the page's own colour — the padding is inside the fill
   * below — so on a game's page the bar rests on that game's tone.
   */
  const tabClearance = useTabBarClearance();
  const miniPlayerActive = useMiniPlayerActive();
  const miniPlayerRoom =
    miniPlayer && !modal && tabClearance === 0 && miniPlayerActive
      ? MINI_PLAYER_BAND + (edges.includes('bottom') ? 0 : insets.bottom)
      : 0;

  return (
    <ScreenChromeProvider
      modal={modal}
      background={background ?? theme.background}
      insetHeader={insetHeader}>
      {({ blurTargetRef }) => (
        <View style={styles.flex}>
          {/*
            Everything the top bar is allowed to blur, and nothing else.

            On iOS and the web this is a plain `<View>` — those platforms sample
            whatever is behind a translucent layer without being told. On Android
            it is a native `BlurTarget`, the only thing `expo-blur` can read
            from; see `hooks/use-screen-chrome`. The bar is deliberately outside
            it.

            **The page fill lives here, not on the view above.** Android's blur
            renders this subtree and nothing else, so a background painted on an
            ancestor is not part of what the bar samples — on a screen with no
            `backdrop` the glass would come back with whatever the window's own
            drawable happens to be rather than `background`. It also keeps the
            backdrop over the fill and under the safe area, which is what
            `backdrop` is for; `SafeAreaView` stays transparent and does insets
            and nothing else.
          */}
          <BlurTargetView
            ref={blurTargetRef}
            style={[styles.flex, { backgroundColor: background ?? theme.background }]}>
            {backdrop}

            <SafeAreaView style={styles.flex} edges={edges}>
              <View
                style={[
                  styles.flex,
                  styles.column,
                  padded && styles.padded,
                  insetHeader && { paddingTop: headerHeight },
                  miniPlayerRoom > 0 && { paddingBottom: miniPlayerRoom },
                ]}>
                {children}
              </View>
            </SafeAreaView>
          </BlurTargetView>

          {topBar}
        </View>
      )}
    </ScreenChromeProvider>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.primary} />
      {label && (
        <Text variant="bodySmall" color="textMuted" style={styles.centeredText}>
          {label}
        </Text>
      )}
    </View>
  );
}

export type EmptyStateProps = {
  title: string;
  message?: string;
  action?: ReactNode;
  /** Developer-facing detail. Rendered only where the caller passes one. */
  footnote?: string;
};

export function EmptyState({ title, message, action, footnote }: EmptyStateProps) {
  return (
    <View style={styles.centered}>
      <Text variant="h3" style={styles.centeredText}>
        {title}
      </Text>
      {message && (
        <Text variant="body" color="textMuted" style={styles.centeredText}>
          {message}
        </Text>
      )}
      {action && <View style={styles.action}>{action}</View>}
      {footnote && (
        <Text variant="caption" color="textMuted" style={[styles.centeredText, styles.footnote]}>
          {footnote}
        </Text>
      )}
    </View>
  );
}

/**
 * What the reader is told when a request fails.
 *
 * Not `error.message`. That string is written for whoever is holding the stack
 * trace — "failed to parse logic tree", "JWT expired", a PostgREST error code —
 * and printing it as the body of a page tells the one person who cannot act on
 * it. The distinction the reader actually needs is whether to try again, so
 * that is what this decides; the raw text stays available in `__DEV__`.
 */
function readableError(error: unknown): string {
  const raw = error instanceof Error ? error.message.toLowerCase() : '';

  if (raw.includes('network') || raw.includes('fetch') || raw.includes('timeout')) {
    return 'No connection to GameLog. Check your network and try again.';
  }
  if (raw.includes('jwt') || raw.includes('unauthorized') || raw.includes('not signed in')) {
    return 'Your session expired. Sign in again to continue.';
  }
  return 'Something went wrong on our side. Try again in a moment.';
}

export function ErrorState({
  error,
  action,
  onRetry,
}: {
  error: unknown;
  action?: ReactNode;
  /** Renders a "Try again" button. Prefer this over hand-rolling one as `action`. */
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      title="Could not load"
      message={readableError(error)}
      /* Every failure on a read-only surface is worth one more attempt, and
         before this not a single `ErrorState` in the app offered one — a failed
         screen was a dead end with a stack trace on it. */
      action={action ?? (onRetry ? <Button title="Try again" onPress={onRetry} /> : undefined)}
      footnote={__DEV__ && error instanceof Error ? error.message : undefined}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  padded: { paddingHorizontal: Spacing.x16 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.x24,
    gap: Spacing.x8,
  },
  centeredText: { textAlign: 'center' },
  action: { marginTop: Spacing.x12 },
  footnote: { marginTop: Spacing.x8, opacity: 0.7 },
});
