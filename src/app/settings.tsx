import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { PingAudienceSetting } from '@/components/pings/ping-audience-setting';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ReadingLanguages } from '@/components/reading-languages';
import { SurpriseHiddenList } from '@/components/surprise-hidden-list';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { EmptyState, Screen } from '@/components/ui/screen';
import { useLiquidGlass } from '@/components/ui/liquid-glass';
import { InsetGroup, Row } from '@/components/ui/inset-group';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useAnimatedArtwork } from '@/hooks/use-animated-artwork';
import { useGameTitle } from '@/hooks/use-game-title';
import { Segmented } from '@/components/ui/segmented';
import { setLiquidGlass } from '@/lib/liquid-glass';
import { useCopyStage3d } from '@/hooks/use-copy-stage-3d';
import { STAGE_3D_AVAILABLE, THIRTY_TWO_BIT } from '@/lib/copy-stage-3d';
import { useGameColours } from '@/hooks/use-game-colours';
import { useChosenColorScheme, useTheme } from '@/hooks/use-theme';
import { setColorScheme, type ColorScheme } from '@/lib/color-scheme';
import { isModerator } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Loader } from '@/components/ui/loader';
import { showAlert } from '@/components/ui/dialog';

/**
 * Settings — a few sections, and each is a real one.
 *
 * This screen was deliberately empty for a long time, and the reason it gave is
 * still the rule: a settings screen listing Notifications, Privacy, Appearance
 * and Account with every one of them inert is worse than an honest blank,
 * because it invites someone to turn something off and then ignores them.
 * PRODUCT.md's second principle — never present a control for a thing the system
 * cannot actually do.
 *
 * What it holds now passes that test. The hidden-games list is the *only* undo
 * for a gesture that is otherwise permanent: double-tapping a cover in Surprise
 * Me removes that game from every future roll, and without a screen that can
 * show and reverse it, the app would have a one-way door in it. It is in
 * Settings rather than on the Surprise Me screen because it is an account-shaped
 * thing you visit occasionally, not part of a roll.
 *
 * **Privacy and safety** and **Delete account** (0045, 2026-10-29) are the
 * ones the product owed for a store release: the people you blocked, the
 * privacy policy and terms of use (`constants/legal.ts`), and deleting the
 * account — each a working screen, not a promise.
 *
 * **Review languages** passes it too, and is here for the same reason the
 * hidden list is: it is the control for something the app otherwise does by
 * itself. The popular reviews, the people suggested and the review a game's
 * page leads with are picked in the languages the reader reads (0038,
 * `lib/language`) — worked out from the phone and from what they write, which
 * is right nearly always and silently wrong for somebody who also reads
 * French. A filter nobody can see or change is the inert control's mirror
 * image: the system doing a thing with no control for it. Every chart links
 * here from the line that says which languages it is in.
 *
 * **How ratings work** passes it for the same reason as the languages: the
 * GameLog score weights ratings by itself (0041), and somebody whose ratings
 * count a little less is owed a place that says so, why, and by how much.
 * The row is the way to that page; nothing on it can be switched off, because
 * the score is the same for everybody.
 *
 * **Game colours** passes it because it is a real switch over something the
 * app does everywhere by itself: every screen about one game is built from a
 * Material 3 scheme read off its box art (`<AccentProvider>`). Off, each of
 * them is the app's own room. The owner's (2026-10-20): "Add a setting to
 * turn off the material expressive colors in the app." Two choices, as
 * selection cards — the app's one control for a choice with words to it.
 *
 * **Animated artwork** passes it the same way: Surprise Me's card and a
 * review's hero play a game's animated cover by themselves, which costs data
 * and moves on its own. Asked at sign-up over three real examples, the
 * owner's (2026-10-21); changed here. The game page's Animated button is not
 * governed by it — that is somebody asking for one game's animation by hand.
 *
 * **Copies in 3D** passes it too: a physical copy's case and disc are drawn
 * on the GPU, which is the heaviest drawing in the app. The owner's
 * (2026-10-30): a setting to turn it off, off by default on a 32-bit phone
 * and still able to be turned on there. Not offered on a build that cannot
 * draw it — a choice that changes nothing is the inert control this screen
 * avoids.
 *
 * **Pings** passes it as the hidden list does — it is the only control for
 * something the database does on its own: whether a ping reaches you (0046's
 * `can_ping`). Anyone who follows you, by default; people you follow back; or
 * friends only. The owner's (2026-10-31).
 *
 * **Moderation** passes the same test from the other side: it is a row only for
 * the people it works for. Everyone else never sees it — a link to a queue the
 * database would refuse them is exactly the inert control this screen avoids.
 *
 * **Sign out** is the last row. It was a button on the profile beside Edit
 * profile, a thumb's width from it; signing out is an account act you do rarely
 * and on purpose, which is what this screen is for.
 */
export default function SettingsScreen() {
  const userId = useAuth((state) => state.session?.user.id);
  const signOut = useAuth((state) => state.signOut);
  const theme = useTheme();
  const router = useRouter();
  const gameColours = useGameColours();
  const animatedArtwork = useAnimatedArtwork();
  const gameTitle = useGameTitle();
  const liquidGlass = useLiquidGlass();
  const colorScheme = useChosenColorScheme();
  const copyStage3d = useCopyStage3d();
  const [signingOut, setSigningOut] = useState(false);

  function confirmSignOut() {
    showAlert('Sign out?', 'You will need your email and password to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch (error) {
            /* Reported rather than swallowed. The session survives a failed
               sign-out, so silence would leave someone believing they had
               signed out on a shared device. */
            showAlert(
              'Could not sign out',
              error instanceof Error ? error.message : 'Check your connection and try again.'
            );
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  }

  const moderator = useQuery({
    queryKey: ['is-moderator', userId],
    queryFn: isModerator,
    enabled: !!userId,
  });

  /* Everything here is per-account and keyed by user id. Signed out there is
     genuinely nothing to configure, which is the state this screen used to be
     in permanently. */
  if (!userId) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Settings" />}>
        <EmptyState title="Settings" message="Sign in to change how the app behaves." />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} insetHeader padded topBar={<FrostedTopBar back title="Settings" />}>
      <PageScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* The owner's (2026-11-02): reacticx's bouncy accordion wherever it
            fits. Settings is where it does — six things to set, each a
            handful of choices; one open at a time, the rest folded to the
            line that says what is set. */}
        <Accordion>
          <AccordionItem value="appearance">
            <AccordionTrigger
              icon={colorScheme === 'light' ? 'sunny-outline' : 'moon-outline'}
              title="Appearance"
              summary={colorScheme === 'light' ? 'Light' : 'Dark'}
            />
            <AccordionContent>
              <View style={styles.choices}>
                <Segmented
                  label="Appearance"
                  options={APPEARANCE_OPTIONS}
                  value={colorScheme}
                  onChange={setColorScheme}
                />
                <Text variant="bodySmall" color="textSecondary" style={styles.note}>
                  {colorScheme === 'light'
                    ? 'The app is light. A game’s own screens — its page, reviews, Surprise Me, collections and studios — stay dark, built from its art.'
                    : 'The app is dark, on a black page.'}
                </Text>
              </View>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="colours">
            <AccordionTrigger
              icon="color-palette-outline"
              title="Game colours"
              summary={gameColours.on ? 'The game’s colours' : 'Pinged’s colours'}
            />
            <AccordionContent>
              <View style={styles.choices}>
                <Row
                  title="Use the game’s colours"
                  toggle={{ value: gameColours.on, onValueChange: gameColours.setOn }}
                />
                <Text variant="bodySmall" color="textSecondary" style={styles.note}>
                  {gameColours.on
                    ? 'A game’s page, its reviews, Surprise Me, collections and studios take their colours from their art.'
                    : 'Every screen is in the app’s own dark grey, with a light grey accent, whatever the art.'}
                </Text>
              </View>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="animated">
            <AccordionTrigger
              icon="play-circle-outline"
              title="Animated artwork"
              summary={animatedArtwork.on ? 'Animated' : 'Still'}
            />
            <AccordionContent>
              <View style={styles.choices}>
                <Row
                  title="Play animated covers"
                  toggle={{ value: animatedArtwork.on, onValueChange: animatedArtwork.setOn }}
                />
                <Text variant="bodySmall" color="textSecondary" style={styles.note}>
                  {animatedArtwork.on
                    ? 'Surprise Me and a review’s art play a game’s animated cover when it has one.'
                    : 'Every cover stays still, and nothing is downloaded for it. A game’s cover can still be played from its page.'}
                </Text>
              </View>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="title">
            <AccordionTrigger
              icon="text-outline"
              title="Game title"
              summary={gameTitle.shown ? 'Shown' : 'Hidden'}
            />
            <AccordionContent>
              <View style={styles.choices}>
                <Row
                  title="Show the game’s name"
                  toggle={{ value: gameTitle.shown, onValueChange: gameTitle.setShown }}
                />
                <Text variant="bodySmall" color="textSecondary" style={styles.note}>
                  {gameTitle.shown
                    ? 'A game’s page shows its logo or its name over the cover, and the name in the bar as you scroll.'
                    : 'A game’s page never shows its name: the cover speaks for itself. Other screens still name it.'}
                </Text>
              </View>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="glass">
            <AccordionTrigger
              icon="water-outline"
              title="Liquid glass"
              summary={liquidGlass ? 'On' : 'Off'}
            />
            <AccordionContent>
              <View style={styles.choices}>
                <Row
                  title="Liquid glass"
                  toggle={{ value: liquidGlass, onValueChange: setLiquidGlass }}
                />
                <Text variant="bodySmall" color="textSecondary" style={styles.note}>
                  {Platform.OS === 'ios'
                    ? 'The back button, the tab bar, menus and the round keys are drawn in Apple’s liquid glass.'
                    : 'The back button, the tab bar, menus and the round keys are drawn as glass: the page blurred behind them, a rim of light round them.'}
                </Text>
              </View>
            </AccordionContent>
          </AccordionItem>

          {STAGE_3D_AVAILABLE && (
            <AccordionItem value="copies">
              <AccordionTrigger
                icon="disc-outline"
                title="Physical copies"
                summary={copyStage3d.on ? 'In 3D' : 'Flat'}
              />
              <AccordionContent>
                <View style={styles.choices}>
                  <Row
                    title="Draw copies in 3D"
                    toggle={{ value: copyStage3d.on, onValueChange: copyStage3d.setOn }}
                  />
                  <Text variant="bodySmall" color="textSecondary" style={styles.note}>
                    {copyStage3d.on
                      ? THIRTY_TWO_BIT
                        ? 'A copy’s case and disc are drawn in 3D, catching the light as they turn. Off by default on this phone: it is 32-bit, and 3D is heavy for it.'
                        : 'A copy’s case and disc are drawn in 3D, catching the light as they turn.'
                      : 'A copy’s case and disc are drawn flat. Lighter on the phone; they still turn and open.'}
                  </Text>
                </View>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="pings">
            <AccordionTrigger icon="paper-plane-outline" title="Pings" summary="Who can ping you" />
            <AccordionContent>
              <PingAudienceSetting userId={userId} />
            </AccordionContent>
          </AccordionItem>

          <ReadingLanguages value="languages" userId={userId} />
          <SurpriseHiddenList value="hidden" userId={userId} />
        </Accordion>

        <InsetGroup header="Ratings">
          <Row
            icon="stats-chart"
            tint={theme.identityGold}
            title="How ratings work"
            accessibilityLabel="How ratings work, and how much your own ratings count"
            onPress={() => router.push('/how-ratings-work')}
          />
        </InsetGroup>

        {moderator.data === true && (
          <InsetGroup header="Moderation">
            <Row
              icon="shield-checkmark"
              tint={theme.identityJade}
              title="Review queue"
              onPress={() => router.push('/moderation')}
            />
            {/* The list the Must Play badge leads to, which is also where a
                moderator adds to it and takes from it (0034). */}
            <Row
              icon="thumbs-up"
              tint={theme.mustPlay}
              title="Must Play games"
              onPress={() => router.push('/must-play')}
            />
          </InsetGroup>
        )}

        <InsetGroup header="Privacy and safety">
          <Row
            icon="ban"
            tint={theme.danger}
            title="Blocked accounts"
            onPress={() => router.push('/blocked')}
          />
          <Row
            icon="shield"
            tint={theme.identitySky}
            title="Privacy policy"
            onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })}
          />
          <Row
            icon="document-text"
            tint={theme.identityCobalt}
            title="Terms of use"
            onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })}
          />
        </InsetGroup>

        {/* Confirmed first, and its failure reported — see `confirmSignOut`. */}
        <InsetGroup>
          <Row
            title="Sign out"
            destructive
            centred
            disabled={signingOut}
            onPress={confirmSignOut}
            trailing={signingOut ? <Loader size="small" color={theme.textMuted} /> : undefined}
          />
        </InsetGroup>

        {/* Google Play's requirement for any app an account can be made in. */}
        <InsetGroup footer="Your account and everything in it, for good.">
          <Row
            title="Delete account"
            destructive
            centred
            onPress={() => router.push('/delete-account')}
          />
        </InsetGroup>
      </PageScrollView>
    </Screen>
  );
}

const APPEARANCE_OPTIONS: readonly { value: ColorScheme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const styles = StyleSheet.create({
  content: { gap: Spacing.x32, paddingTop: Spacing.x24, paddingBottom: Spacing.x48 },
  choices: { gap: Spacing.x4 },
  /* The switch's explanation, under its row: what Settings puts in a footer. */
  note: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x8 },
});
