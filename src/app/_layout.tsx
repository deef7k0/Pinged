/*
 * One import per weight, from the weight's own path — never from the package.
 *
 * Each `@expo-google-fonts` package's index `require()`s every style it has,
 * and Metro bundles every file a module requires whether or not its export is
 * used: importing seven weights from `@expo-google-fonts/inter` shipped all
 * eighteen — megabytes of fonts in every APK that were never drawn. The
 * subpaths require one file each.
 *
 * Poppins — SimpMusic's own font, read off its `Typo.kt` (one family, pinned
 * to its `poppins_medium` file for every weight) and brought in properly
 * instead: real weight files, same as Inter's were, so `fontWeight` keeps
 * working rather than leaning on Android's fake-bold the way SimpMusic's does.
 * The owner's direction (2026-10-17): replace Inter app-wide. Onboarding's
 * Geist Mono is untouched — it was always its own reference, not SimpMusic's.
 * See `FontFamily` in `constants/theme.ts`.
 */
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { Poppins_300Light } from '@expo-google-fonts/poppins/300Light';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_400Regular_Italic } from '@expo-google-fonts/poppins/400Regular_Italic';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_600SemiBold_Italic } from '@expo-google-fonts/poppins/600SemiBold_Italic';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { Poppins_800ExtraBold } from '@expo-google-fonts/poppins/800ExtraBold';
import Ionicons from '@expo/vector-icons/Ionicons';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { NavigationBar } from 'expo-navigation-bar';
import { DarkTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MiniPlayer } from '@/components/player/mini-player';
import { DialogHost } from '@/components/ui/dialog';
import { PlayerHost } from '@/components/player/player-host';
import { GameColoursWarmup } from '@/hooks/use-game-colours';
import { primeSteamArtwork } from '@/hooks/use-steam-artwork';
import { queryClient } from '@/lib/query-client';
import { forgetRetiredColourStores } from '@/lib/retired-colour-stores';
import { forgetAppleMusicCache } from '@/lib/soundcloud/legacy';
import { useAuth } from '@/store/auth';
import { takeAfterOnboarding, useOnboarding } from '@/store/onboarding';

/*
 * What is drawn when a screen throws while rendering, in place of the app
 * closing. Expo Router wraps this layout in it. See the component for why it
 * also throws away the saved query cache.
 */
export { AppErrorBoundary as ErrorBoundary } from '@/components/app-error-boundary';

SplashScreen.preventAutoHideAsync();

/** A form that opens over the page: a sheet on iOS, sliding up on Android. */
const SHEET = { presentation: 'modal', animation: 'slide_from_bottom' } as const;
/** The scanner: the whole screen, sliding up. */
const FULL_SHEET = { presentation: 'fullScreenModal', animation: 'slide_from_bottom' } as const;

export default function RootLayout() {
  const session = useAuth((state) => state.session);
  const isRestoring = useAuth((state) => state.isRestoring);
  const onboarding = useOnboarding((state) => state.status);
  const onboardingKnown = useOnboarding((state) => state.launchResolved);

  /*
   * Preload the icon font.
   *
   * Left alone, @expo/vector-icons calls Font.loadAsync lazily the first time an
   * icon renders, which means every icon on screen races to fetch the same 380KB
   * file at once and each failure surfaces as an unhandled rejection with no
   * recovery path. One awaited load before first paint replaces all of that, and
   * icons no longer flash in blank while the font arrives.
   */
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    /*
     * Poppins, in the four weights the type scale uses. Each weight is a
     * separate family on purpose — Android will not synthesise a bold from a
     * custom font, so `fontWeight` on Poppins silently renders regular. See
     * `FontFamily`.
     */
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    /*
     * The two italics, for user-written emphasis only — `*italic*` in a
     * collection's description, through `<RichText>`. `fontStyle: 'italic'` is
     * the same silent no-op on Android that `fontWeight` is, for the same
     * reason: a custom family has no oblique to synthesise from.
     */
    Poppins_400Regular_Italic,
    Poppins_600SemiBold_Italic,
    /*
     * Poppins Light, for exactly one thing: the release year beside a review's
     * game title. The brief calls for Graphik Light there, and a year sitting
     * next to a bold title has to recede without shrinking.
     */
    Poppins_300Light,
    /*
     * Onboarding's two (`FontFamily.extraBold`, `FontFamily.mono`). Loaded with
     * the rest rather than on the onboarding screens, because the signed-out
     * pitch is the first thing a new install draws.
     */
    Poppins_800ExtraBold,
    GeistMono_400Regular,
  });

  // Boot anyway if the font cannot be fetched — tofu glyphs beat a dead splash
  // screen, and in dev this usually just means the bundler is restarting.
  /*
   * `onboardingKnown` holds the splash at launch until a signed-in account is
   * known to be onboarded or not (`store/onboarding`), so an existing account
   * never sees the onboarding page flash past. It only ever turns true, so a
   * sign-in later on does not take the whole tree down while it is worked out:
   * the onboarding route draws a holding page for that moment instead.
   */
  const ready = !isRestoring && onboardingKnown && (fontsLoaded || !!fontError);

  // Hold the splash screen until we know whether there is a session, otherwise
  // the sign-in screen flashes before the feed for an already-signed-in user.
  // `isRestoring` also covers reading that account's saved queries back, so the
  // feed that follows the splash is the one that was on screen last time.
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  /*
   * Pull the persisted Steam-artwork map into memory before the first grid
   * paints, so a game whose hashed capsule was resolved on an earlier run draws
   * the right image immediately instead of flashing a 404 and correcting.
   *
   * Not a network prefetch: the direct CDN URL is right for ~95% of appids and
   * costs nothing, so prefetching would spend a request per game to learn that
   * almost none of them needed one. See `hooks/use-steam-artwork`.
   */
  useEffect(() => {
    void primeSteamArtwork();
    /* Soundtracks used to be kept on the device, a row per game. They are not
       kept anywhere now; this clears what earlier versions left. */
    void forgetAppleMusicCache();
    /* So were the answers of the colour methods Material 3 replaced. */
    void forgetRetiredColourStores();
  }, []);

  useEffect(() => {
    if (fontError) {
      console.warn('[gamelog] Icon font failed to load; icons will render blank.', fontError);
    }
  }, [fontError]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/*
        `<SafeAreaProvider>`, declared here rather than inherited.

        Every `<Screen edges>` and every `useSafeAreaInsets()` in this app reads
        from this provider, and until now nothing in the tree rendered one — the
        app was relying on whatever `expo-router` happens to mount internally.
        That held in Expo Go and did not survive a real build: SDK 57 targets
        Android 15, where **edge-to-edge is mandatory**, so the window draws
        under both system bars and the only thing keeping content out from under
        them is the inset the provider reports. With no provider of our own, the
        top bar sat under the status bar and the tab bar sat under the
        navigation bar — which is exactly the shape of the bug.

        It costs nothing in Expo Go (a second provider would be redundant, not
        wrong) and it is the documented requirement of the library. Insets are
        not something to inherit by luck.
      */}
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={DarkTheme}>
            <StatusBar style="light" />
            {/*
              Android's navigation bar: light keys, nothing behind them. The
              window is edge-to-edge, so the app already draws under the bar;
              what made it a black band was Android's contrast scrim, which
              `enforceContrast: false` in app.json removes in a real build, and
              the tab bar painting the page colour under itself, which it no
              longer does (`<AppTabBar>` floats). Expo Go applies no config
              plugins, so there the system may still draw its scrim.
            */}
            <NavigationBar style="light" />

            {/*
            No native header, anywhere.

            Every screen draws its own `<FrostedTopBar>` through `<Screen topBar>`
            instead. Three things the native header could not do, and all three
            are the point:

              - **Blur.** `headerBackground` renders inside the native bar, which
                is not a sibling of the page content and so cannot be given the
                Android `BlurTargetView` to sample. The frosted look was not
                available from there at all.
              - **Hide on scroll.** The native stack header is a platform view;
                Reanimated cannot translate it, and there is no `header` option
                on `@react-navigation/native-stack` to replace it with one that
                can.
              - **The back chevron.** `headerBackButtonDisplayMode: 'minimal'`
                got close on iOS and left Android on its own arrow.

            The trade is that a screen now states its own title rather than
            inheriting one from here. That is a small loss of central bookkeeping
            and a real gain in honesty: a dynamic title used to be declared in
            two places and only one of them was right.
          */}
            {/*
              Every screen slides in from the right and back out — the owner's
              direction (2026-10-15): "a smooth slide animation. Not too fast
              and not too slow". On Android `slide_from_right` runs on the
              system's medium animation time (400ms, eased at both ends);
              `ios_from_right` is the short one (200ms), which read as a jump,
              and the platform default is a fade and zoom, not a slide. iOS
              pushes with its own slide. Forms that open as sheets slide up
              instead (`SHEET` below), as a sheet does.
            */}
            <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
              <Stack.Protected guard={!!session && onboarding === 'done'}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="game/[id]" />
                <Stack.Screen name="profile/[id]" />
                <Stack.Screen name="achievements/[id]" />
                <Stack.Screen name="library/[id]" />
                <Stack.Screen name="game-stats/[user]/[game]" />
                <Stack.Screen name="playthroughs/[game]" />
                <Stack.Screen name="copies/[user]" />
                <Stack.Screen name="submissions" />
                <Stack.Screen name="moderation" />
                <Stack.Screen name="studio/[id]" />
                <Stack.Screen name="top-games" />
                <Stack.Screen name="top-chart" />
                <Stack.Screen name="releases" />
                <Stack.Screen name="upcoming" />
                <Stack.Screen name="surprise" />
                <Stack.Screen name="gaming-achievements/[id]" />
                <Stack.Screen name="gaming-inventory/[id]" />
                <Stack.Screen name="list/[id]" />
                {/* The "See all" behind Discover's Reviews and Collections bands.
                  Both used to be tabs inside Search; a popularity chart is not
                  a search scope, so they are pages now. */}
                <Stack.Screen name="reviews" />
                <Stack.Screen name="collections" />
                {/* Where Search's hub leads that is not a list under the field:
                  a platform's games, page by page; an event and what was shown
                  at it; and the year's releases as a calendar. */}
                <Stack.Screen name="platform/[id]" />
                <Stack.Screen name="event/[id]" />
                <Stack.Screen name="calendar" />
                {/* Every game a moderator has labelled Must Play (0034) — where
                  the badge's cell in a game's stats strip leads. */}
                <Stack.Screen name="must-play" />
                <Stack.Screen name="review/[id]" />
                <Stack.Screen name="soundtrack/[id]" />
                <Stack.Screen name="notifications/index" />
                {/* Pings (0046): a request's page, the news that left the
                    tab bar for it, and three sheets — ask, answer, send. */}
                <Stack.Screen name="ping/[id]" />
                <Stack.Screen name="news" />
                <Stack.Screen name="new-ping" options={SHEET} />
                <Stack.Screen name="suggest-game/[id]" options={SHEET} />
                <Stack.Screen name="send-ping" options={SHEET} />
                <Stack.Screen name="settings" />
                <Stack.Screen name="blocked" />
                <Stack.Screen name="delete-account" />
                {/* How the GameLog score is weighted (0041), and the reader's own
                  weight — from the reviews sheet and from Settings. */}
                <Stack.Screen name="how-ratings-work" />
                {/* Everyone who scored one game, twenty to a page — from the
                  reviews sheet, under the score it is the list behind. */}
                <Stack.Screen name="ratings/[id]" />
                <Stack.Screen name="comments/[type]/[id]" />
                <Stack.Screen name="log/[id]" options={SHEET} />
                <Stack.Screen name="playthrough/[id]" options={SHEET} />
                <Stack.Screen name="add-copy" options={SHEET} />
                {/* From the physical shelf's Cover Flow the cover has already
                    flown to where the case stands, on the copy's moving
                    colours: the stage fades in over it rather than sliding. */}
                <Stack.Screen
                  name="copy/[id]"
                  options={({ route }) =>
                    (route.params as { handover?: string } | undefined)?.handover === '1'
                      ? { animation: 'fade', animationDuration: 260 }
                      : {}
                  }
                />
                <Stack.Screen name="scan" options={FULL_SHEET} />
                <Stack.Screen name="add-release" options={SHEET} />
                <Stack.Screen name="suggest-similar/[id]" options={SHEET} />
                <Stack.Screen name="similar/[id]" />
                {/* Every flag in the app — a pick, a suggestion, a review —
                  opens this one form, over whatever it was on. */}
                <Stack.Screen name="report/[kind]/[id]" options={SHEET} />
                {/* Both are edits to one award category, so both are sheets: you
                  are changing a thing and coming back, not going somewhere. */}
                <Stack.Screen name="award-game/[id]" options={SHEET} />
                <Stack.Screen name="award-edit/[id]" options={SHEET} />
                <Stack.Screen name="new-list" options={SHEET} />
                <Stack.Screen name="edit-list/[id]" options={SHEET} />
                {/* A picker, so it presents as a modal: you are choosing one thing
                  and returning, not navigating somewhere. */}
                <Stack.Screen name="add-to-list/[id]" options={SHEET} />
                {/* The moderators' picker behind the Must Play list's "+". */}
                <Stack.Screen name="label-games" options={SHEET} />
                {/* The library's "+": a game to pin to its head (0043). */}
                <Stack.Screen name="pin-game" options={SHEET} />
                <Stack.Screen name="quick-log" options={SHEET} />
                <Stack.Screen name="edit-profile" options={SHEET} />
              </Stack.Protected>

              {/* Signed in, and not onboarded yet — or not known to be, for the
                  moment after a sign-in while `store/onboarding` asks. One route,
                  and nothing else is reachable until it finishes. */}
              <Stack.Protected guard={!!session && onboarding !== 'done'}>
                <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
              </Stack.Protected>

              <Stack.Protected guard={!session}>
                {/* The pitch, the email and the password, as one route — the
                    owner's onboarding reference. It replaced `welcome`'s
                    carousel and the three sign-in screens behind it. */}
                <Stack.Screen name="welcome" />
              </Stack.Protected>

              {/* Readable signed in or out: the sign-up page links to the terms
                  and the privacy policy (0045, store release). Last, so it is
                  never the first screen a guard falls back to. */}
              <Stack.Screen name="legal/[doc]" />
            </Stack>

            {/*
              The app's one music player, and the bar it shows at the foot of
              the app while music is being kept playing.

              After the navigator and beside it, on purpose. `<PlayerHost>`
              draws nothing — it owns the native audio object for as long as
              the app is open, which is what lets a song outlive the screen it
              started on. `<MiniPlayer>` is a sibling drawn over every screen
              rather than a part of any; it knows which routes to stay off
              (`lib/player-queue.ts`), and pages make room for it through
              `<Screen>` and the tab bar's clearance.
            */}
            <PlayerHost />
            <MiniPlayer />
            {/* Every alert in the app (`showAlert`), over everything. */}
            <DialogHost />
            <AfterOnboarding />
            {/* Settings → Game colours, read once there is an account, so the
                first game's page never opens in colour and then turns grey. */}
            <GameColoursWarmup />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Where onboarding's last page sent somebody — a review of their first
 * favourite, or Search — once the app has taken its place.
 *
 * The flow cannot navigate there itself: finishing is what swaps the
 * onboarding route for the app, and a push issued in the same breath lands in
 * the stack that is being torn down. So the destination is left in the store
 * and taken here, a frame after the app's own routes exist.
 */
function AfterOnboarding() {
  const status = useOnboarding((state) => state.status);
  const after = useOnboarding((state) => state.after);

  useEffect(() => {
    if (status !== 'done' || !after) return;
    const timer = setTimeout(() => {
      const destination = takeAfterOnboarding();
      if (destination) router.push(destination);
    }, 60);
    return () => clearTimeout(timer);
  }, [status, after]);

  return null;
}
