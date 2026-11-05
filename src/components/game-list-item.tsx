import { Link } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PlatformChip, platformSummary } from '@/components/ui/platform-chip';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScoreLine } from '@/components/ui/score';
import { Text } from '@/components/ui/text';
import { platformFamilies } from '@/constants/platform-family';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GameSearchResult } from '@/lib/games';

const POSTER_WIDTH = 84;

/**
 * Chips shown before the row starts counting instead.
 *
 * Three, not four: four is what it takes to wrap onto a second line of capsules
 * on a narrow phone, and the overflow only has to be *legible* — "and 2 more" is
 * as informative as a fourth mark and costs a fraction of the width.
 */
const MAX_FAMILIES = 3;

/**
 * A release date a reader can act on.
 *
 * The month matters — "Mar 2026" is a different fact from "2026" when the
 * question is whether to pre-order — but the day does not, at this altitude, so
 * a full date would just be three more characters of noise on a muted line.
 * Falls back to the bare year when that is genuinely all IGDB published, which
 * is common for anything older than about 2005.
 */
function releaseLabel(releaseDate: string | null, releaseYear: number | null): string | null {
  if (releaseDate) {
    const parsed = new Date(releaseDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  }

  return releaseYear ? String(releaseYear) : null;
}

export type GameListItemProps = {
  game: GameSearchResult;
  /** Small marker shown when the viewer has already logged this game. */
  badge?: string | null;
  /**
   * What tapping the row does instead of opening the game page.
   *
   * Exists for pickers — choosing a game to add to a collection has to *return*
   * a game, not navigate to it. Everywhere else omits this, because a search
   * result leading anywhere other than the game is a surprise.
   */
  onPress?: () => void;
  disabled?: boolean;
};

/**
 * One game, everywhere a list of games appears: search results, "Similar
 * games", a studio's catalogue, the news tab's release lists.
 *
 * Box art left; title, status, platforms, release, studio and score stacked
 * right. The stack is deliberately one fact per line rather than a run-on
 * metadata string — a reader scanning twenty rows for a platform or a year is
 * scanning a *column*, and "2024 · FromSoftware · PS5, PC" makes them read a
 * sentence to find one word.
 *
 * ## There is no price here, and that was a decision
 *
 * It was built and taken out. Pricing one game is up to three chained requests
 * — IGDB for its store links, ITAD to resolve an id, ITAD again for the deals —
 * and only the last of those can be batched across a list. A twenty-row list is
 * twenty id lookups against a rate-limited Edge Function shared with search,
 * every time someone opens Discover. `getStorePricesBatch` survives in
 * `lib/games/itad.ts` because the game page still wants it, and because it is
 * the piece that would make this affordable if the id lookups ever became
 * batchable or precomputed. Until then the row is free to render.
 *
 * ## What is allowed to be coloured
 *
 * Two things, and they are both data. The score, via the app's one score ramp.
 * And the status capsule — "Coming soon", "In your library" — which gets the
 * row's single solid fill. Everything else, platform chips included, is grey:
 * this row already sits under box art, which is the loudest thing on any screen
 * in this app, and a run of vendor-coloured capsules under it reads as confetti
 * rather than as information.
 *
 * ## Platforms collapse to families
 *
 * A game on PS4, PS5, Xbox One and Xbox Series is two chips, not four — one
 * PlayStation mark and one Xbox mark. See `constants/platform-family.ts`; the
 * generational distinction is real and belongs on the game's own page, where
 * the reader is choosing which version they own.
 *
 * Memoised: it is always in a list, and `game` comes straight out of query
 * data. Without it every row re-ran its platform folding and rebuilt its chips
 * whenever the list around it rendered — a sort, a filter, a query settling.
 */
export const GameListItem = memo(function GameListItem({
  game,
  badge,
  onPress,
  disabled,
}: GameListItemProps) {
  const theme = useTheme();

  /*
   * All of them, then the row decides how many to draw.
   *
   * This used to `.slice()` here and the remainder simply vanished — a game on
   * PC, PlayStation, Xbox, Switch and mobile rendered as four chips and looked
   * exactly like a game on four platforms. The count below is the difference
   * between "these are the platforms" and "these are some of the platforms",
   * which is the whole reason the row carries them.
   */
  const families = platformFamilies(game.platforms);
  const shownFamilies = families.slice(0, MAX_FAMILIES);
  const hiddenFamilies = families.length - shownFamilies.length;
  const release = releaseLabel(game.releaseDate, game.releaseYear);

  const row = (
    <PressableScale
      accessibilityRole={onPress ? 'button' : 'link'}
      accessibilityLabel={game.title}
      onPress={onPress}
      disabled={disabled}
      // Flattened: <Link asChild> clones this element and cannot merge an
      // array style prop — it throws rather than guessing a precedence.
      style={StyleSheet.flatten([
        styles.row,
        { borderTopColor: theme.border },
        disabled && styles.disabled,
      ])}>
      <Poster
        coverUrl={game.coverUrl}
        heroUrl={game.heroUrl}
        title={game.title}
        edition={game.edition}
        gameId={game.id}
        steamAppId={game.steamAppId}
        width={POSTER_WIDTH}
        rounded="image"
      />

      <View style={styles.body}>
        {/* The row title the owner's reference uses — semibold 13 — with the
            facts under it regular and quieter. */}
        <Text variant="itemTitle" numberOfLines={2}>
          {game.title}
        </Text>

        {/* A solid capsule rather than a coloured word — this is a *state*
            ("Coming soon", "In your library"), which is the one thing on the
            row allowed to shout. It sits directly under the title, where a
            storefront puts it. */}
        {badge && (
          <View style={[styles.badge, { backgroundColor: theme.success }]}>
            <Text variant="badge" style={{ color: theme.background }}>
              {badge}
            </Text>
          </View>
        )}

        {families.length > 0 && (
          /* One accessible name for the set. Three chips plus a count read out
             individually is four announcements for one fact. */
          <View
            style={styles.chips}
            accessible
            accessibilityLabel={platformSummary(families, MAX_FAMILIES)}>
            {shownFamilies.map((family) => (
              <PlatformChip key={family.key} family={family} />
            ))}

            {/* Type, not a fourth chip. A capsule reading "and 2 more" would
                look like a platform called "and 2 more"; the point of the line
                is that it is *not* one of the things it is counting. */}
            {hiddenFamilies > 0 && (
              <Text variant="label" color="textMuted" style={styles.overflow}>
                and {hiddenFamilies} more
              </Text>
            )}
          </View>
        )}

        {/* One fact per line, muted, in the order a reader asks for them:
            when, then who. */}
        {release && (
          <Text variant="bodySmall" color="textMuted">
            {release}
          </Text>
        )}

        {game.developer && (
          <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
            {game.developer}
          </Text>
        )}

        {/* The word, not just the number — a 100-point scale has fifteen
            verdicts and "78" alone asks the reader to supply the scale. */}
        {game.score !== null && <ScoreLine score={game.score} />}
      </View>
    </PressableScale>
  );

  // A row that already has an onPress must not also be wrapped in a Link — the
  // Link would win and navigate away instead of running the handler.
  if (onPress) return row;

  return (
    <Link href={{ pathname: '/game/[id]', params: { id: game.id } }} asChild>
      {row}
    </Link>
  );
});

const styles = StyleSheet.create({
  /* A rule, not a container — see the note on <Card>. Rows in a list are a
     list, and giving each one an edge makes twenty objects out of one.

     `flex-start`, not `center`: the stack beside the art is now six lines deep
     at its tallest and one line at its shortest, and centring a variable column
     against fixed art makes the title drift down the row as metadata fills in. */
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x16,
    paddingVertical: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  disabled: { opacity: 0.55 },
  body: { flex: 1, gap: Spacing.x8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.x4 + 2 },
  /* Nudged in from the last chip: the capsules carry their own horizontal
     padding, so the gap alone puts this closer to the chip than the chips are to
     each other. */
  overflow: { marginLeft: Spacing.x4 },
  /* `flex-start` so the capsule is the width of its word rather than the width
     of the column — a full-bleed status bar would read as a section header. */
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.x8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
});
