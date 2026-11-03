import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, Screen } from '@/components/ui/screen';
import { SelectionCard } from '@/components/ui/selection-card';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useAnimatedArtwork } from '@/hooks/use-animated-artwork';
import { useCopyStage3d } from '@/hooks/use-copy-stage-3d';
import { STAGE_3D_AVAILABLE, THIRTY_TWO_BIT } from '@/lib/copy-stage-3d';
import { useGameColours } from '@/hooks/use-game-colours';
import { useTheme } from '@/hooks/use-theme';
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
  const gameColours = useGameColours();
  const animatedArtwork = useAnimatedArtwork();
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
          <AccordionItem value="colours">
            <AccordionTrigger
              icon="color-palette-outline"
              title="Game colours"
              summary={gameColours.on ? 'The game’s colours' : 'Pinged’s colours'}
            />
            <AccordionContent>
              <View style={styles.choices} accessibilityRole="radiogroup">
                <SelectionCard
                  title="The game’s colours"
                  hint="A game’s page, its reviews, Surprise Me, collections and studios take their colours from their art."
                  selected={gameColours.on}
                  onPress={() => gameColours.setOn(true)}
                />
                <SelectionCard
                  title="Pinged’s colours"
                  hint="Every screen in the app’s own dark grey, with a light grey accent, whatever the art."
                  selected={!gameColours.on}
                  onPress={() => gameColours.setOn(false)}
                />
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
              <View style={styles.choices} accessibilityRole="radiogroup">
                <SelectionCard
                  title="Animated"
                  hint="Surprise Me and a review’s art play a game’s animated cover when it has one."
                  selected={animatedArtwork.on}
                  onPress={() => animatedArtwork.setOn(true)}
                />
                <SelectionCard
                  title="Still"
                  hint="Every cover stays still, and nothing is downloaded for it. A game’s cover can still be played from its page."
                  selected={!animatedArtwork.on}
                  onPress={() => animatedArtwork.setOn(false)}
                />
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
                <View style={styles.choices} accessibilityRole="radiogroup">
                  <SelectionCard
                    title="In 3D"
                    hint={
                      THIRTY_TWO_BIT
                        ? 'A copy’s case and disc are drawn in 3D, catching the light as they turn. Off by default on this phone: it is 32-bit, and 3D is heavy for it.'
                        : 'A copy’s case and disc are drawn in 3D, catching the light as they turn.'
                    }
                    selected={copyStage3d.on}
                    onPress={() => copyStage3d.setOn(true)}
                  />
                  <SelectionCard
                    title="Flat"
                    hint="A copy’s case and disc are drawn flat. Lighter on the phone; they still turn and open."
                    selected={!copyStage3d.on}
                    onPress={() => copyStage3d.setOn(false)}
                  />
                </View>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="pings">
            <AccordionTrigger icon="radio-outline" title="Pings" summary="Who can ping you" />
            <AccordionContent>
              <PingAudienceSetting userId={userId} />
            </AccordionContent>
          </AccordionItem>

          <ReadingLanguages value="languages" userId={userId} />
          <SurpriseHiddenList value="hidden" userId={userId} />
        </Accordion>

        <View style={styles.group}>
          <Text variant="label" color="textMuted">
            RATINGS
          </Text>
          <Link href="/how-ratings-work" asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel="How ratings work, and how much your own ratings count"
              scaleTo={0.98}
              pressedColor={theme.controlPressed}
              style={StyleSheet.flatten([styles.row, { backgroundColor: theme.controlFill }])}>
              <Ionicons name="stats-chart-outline" size={20} color={theme.textSecondary} />
              <View style={styles.rowText}>
                <Text variant="h5">How ratings work</Text>
                <Text variant="caption" color="textMuted">
                  And how much your own ratings count
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </PressableScale>
          </Link>
        </View>

        {moderator.data === true && (
          <View style={styles.group}>
            <Text variant="label" color="textMuted">
              MODERATION
            </Text>
            <Link href="/moderation" asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel="Review community submissions"
                scaleTo={0.98}
                pressedColor={theme.controlPressed}
                style={StyleSheet.flatten([styles.row, { backgroundColor: theme.controlFill }])}>
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.textSecondary} />
                <View style={styles.rowText}>
                  <Text variant="h5">Review queue</Text>
                  <Text variant="caption" color="textMuted">
                    Barcode submissions waiting for a decision
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </PressableScale>
            </Link>

            {/* The list the Must Play badge leads to, which is also where a
                moderator adds to it and takes from it (0034). */}
            <Link href="/must-play" asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel="Manage the Must Play games"
                scaleTo={0.98}
                pressedColor={theme.controlPressed}
                style={StyleSheet.flatten([styles.row, { backgroundColor: theme.controlFill }])}>
                <Ionicons name="thumbs-up-outline" size={20} color={theme.textSecondary} />
                <View style={styles.rowText}>
                  <Text variant="h5">Must Play games</Text>
                  <Text variant="caption" color="textMuted">
                    Label games, and take labels off
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </PressableScale>
            </Link>
          </View>
        )}

        <View style={styles.group}>
          <Text variant="label" color="textMuted">
            PRIVACY AND SAFETY
          </Text>
          <NavRow
            href="/blocked"
            icon="ban-outline"
            title="Blocked accounts"
            hint="People you and they can’t see or reach"
          />
          <NavRow
            href={{ pathname: '/legal/[doc]', params: { doc: 'privacy' } }}
            icon="shield-outline"
            title="Privacy policy"
            hint="What Pinged keeps, who sees it, and deleting it"
          />
          <NavRow
            href={{ pathname: '/legal/[doc]', params: { doc: 'terms' } }}
            icon="document-text-outline"
            title="Terms of use"
            hint="The rules for what is posted here"
          />
        </View>

        <View style={styles.group}>
          <Text variant="label" color="textMuted">
            ACCOUNT
          </Text>
          {/* Confirmed first, and its failure reported — see `confirmSignOut`. */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            accessibilityState={{ busy: signingOut, disabled: signingOut }}
            disabled={signingOut}
            onPress={confirmSignOut}
            scaleTo={0.98}
            pressedColor={theme.controlPressed}
            style={StyleSheet.flatten([styles.row, { backgroundColor: theme.controlFill }])}>
            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
            <View style={styles.rowText}>
              <Text variant="h5" color="danger">
                Sign out
              </Text>
            </View>
            {signingOut && <Loader size="small" color={theme.textMuted} />}
          </PressableScale>
          {/* Google Play's requirement for any app an account can be made in. */}
          <NavRow
            href="/delete-account"
            icon="trash-outline"
            title="Delete account"
            hint="Your account and everything in it, for good"
            danger
          />
        </View>
      </PageScrollView>
    </Screen>
  );
}

/** A row that opens another screen, in the action grey, as the others here. */
function NavRow({
  href,
  icon,
  title,
  hint,
  danger = false,
}: {
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  danger?: boolean;
}) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${title}. ${hint}`}
        scaleTo={0.98}
        pressedColor={theme.controlPressed}
        style={StyleSheet.flatten([styles.row, { backgroundColor: theme.controlFill }])}>
        <Ionicons name={icon} size={20} color={danger ? theme.danger : theme.textSecondary} />
        <View style={styles.rowText}>
          <Text variant="h5" color={danger ? 'danger' : undefined}>
            {title}
          </Text>
          <Text variant="caption" color="textMuted">
            {hint}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.x32, paddingTop: Spacing.x24, paddingBottom: Spacing.x48 },
  group: { gap: Spacing.x8 },
  choices: { gap: Spacing.x8 },
  /* The same row as the hidden-games one above it: a card's corner and the
     action grey — it opens something, so it is filled, not outlined. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget + Spacing.x8,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.card,
  },
  rowText: { flex: 1, gap: 1 },
});
