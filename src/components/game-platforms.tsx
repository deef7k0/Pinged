import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { caseHeightFor } from '@/components/game-case';
import { GameCaseFlip } from '@/components/game-case-flip';
import { DropdownButton, type DropdownOption } from '@/components/ui/dropdown-button';
import { Section, useSectionInset, useSectionMetrics } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { editionLabel } from '@/constants/game-editions';
import { PLATFORMS, hasCase, type PlatformKey } from '@/constants/platform-cases';
import { PosterAspectRatio, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import type { GameLog } from '@/lib/database.types';
import type { Game } from '@/lib/games';

/**
 * The protected case, memoised from the outside — its props are the game's own
 * fields, the selection and the log, so a page update that changes none of them
 * does not re-render the object and its animated transform.
 */
const CaseFlip = memo(GameCaseFlip);

/** How many platforms the sentence names before it counts the rest. */
const NAMED = 3;

/**
 * `PLATFORMS` calls both Xboxes "Xbox", which is right on a log's printed back
 * and ambiguous in a list holding both. `platform-cases.ts` is protected, so
 * the distinction is made here.
 */
const NAME_OVERRIDES: Partial<Record<PlatformKey, string>> = { xboxOriginal: 'Original Xbox' };

function nameOf(key: PlatformKey): string {
  return NAME_OVERRIDES[key] ?? PLATFORMS[key].label;
}

/**
 * "is available on PlayStation 5, Xbox, PC and 2 more" — the line under the
 * title, continuing it.
 *
 * Full names, because this is a sentence; the button under it carries the short
 * form. `other` is never named — it stands for every platform the app has no
 * name for, so it is counted in "more" instead.
 */
export function availabilityLine(keys: readonly PlatformKey[]): string {
  const named = keys.filter((key) => key !== 'other').map(nameOf);
  const shown = named.slice(0, NAMED);
  const more = named.length - shown.length + (keys.includes('other') ? 1 : 0);
  if (shown.length === 0) return 'is available on a system not listed here';

  const parts = more > 0 ? [...shown, `${more} more`] : shown;
  const last = parts[parts.length - 1];
  return parts.length === 1
    ? `is available on ${last}`
    : `is available on ${parts.slice(0, -1).join(', ')} and ${last}`;
}

export type GamePlatformsProps = {
  game: Game;
  log: GameLog | null;
  /** Every platform the game is on, in `PLATFORM_PRIORITY` order. */
  platforms: readonly PlatformKey[];
  selected: PlatformKey;
  onSelect: (platform: PlatformKey) => void;
  /** The object's width: the page's case width, so it is the masthead's size. */
  artWidth: number;
};

/**
 * Which machines a game is on, and the box it comes in on each.
 *
 * A section of the Overview, on the page and not in a card: the object on the
 * left, and beside it the game's name continuing into a sentence about where it
 * is available, and the platform button. Choosing a platform re-draws the box —
 * a console case for PS5, PS4, Xbox and Switch, the plain cover for everything
 * else (DESIGN.md § 4.1.3).
 *
 * **No price here** (critique, 2026-10-21): it printed one platform's price
 * directly above Where to buy, which prices every store — the same figure
 * twice in a row. Where to buy is the one place a price is said.
 *
 * **This is where the case lives now.** The masthead always shows the plain
 * cover, and the turn-over came here with the case: tap or drag the box and it
 * shows your record on its back. A plain cover has no back, so it does not turn.
 *
 * **The slot is the height of the tallest shape this game can show**, with the
 * object at its top, level with the game's name beside it — the owner's
 * direction (2026-10-15): "every case must be aligned to the top of the
 * section, aligned with the game title". It stood at the slot's foot, as boxes
 * stand on a shelf, which left a short box (a SNES one, 0.62× its width) sunk
 * at the bottom with empty space over it. A PS5 case is 1.25× its width, a
 * plain cover 1.5×, a Switch 2 case 1.62×, so without the reservation switching
 * platform would move everything under the section.
 */
export function GamePlatforms({
  game,
  log,
  platforms,
  selected,
  onSelect,
  artWidth,
}: GamePlatformsProps) {
  const accent = useAccent();
  const inset = useSectionInset();
  const metrics = useSectionMetrics();

  if (platforms.length === 0) return null;

  /* The tallest shape this game can show: each platform's own case — they are
     not one proportion — or the plain cover where a platform has none. */
  const slotHeight = Math.max(
    ...platforms.map((key) =>
      hasCase(key) ? caseHeightFor(artWidth, key) : artWidth / PosterAspectRatio
    )
  );

  const options: DropdownOption<PlatformKey>[] = platforms.map((key) => ({
    value: key,
    label: nameOf(key),
    short: PLATFORMS[key].short,
    icon: PLATFORMS[key].icon,
  }));

  const line = availabilityLine(platforms);

  return (
    <Section title="Platforms">
      <View
        style={[
          styles.row,
          { paddingHorizontal: inset, paddingTop: metrics.artTop, paddingBottom: Spacing.x8 },
        ]}>
        <View style={[styles.slot, { width: artWidth, height: slotHeight }]}>
          <CaseFlip
            coverUrl={game.coverUrl}
            heroUrl={game.heroUrl}
            title={game.title}
            edition={game.edition ? editionLabel(game.edition) : null}
            platform={selected}
            width={artWidth}
            log={log}
          />
        </View>

        <View style={styles.column}>
          {/* One sentence to a screen reader, as it reads on the page. */}
          <View accessible accessibilityLabel={`${game.title} ${line}`} style={styles.claim}>
            {/* Four lines, as the masthead allows: a game's name is not cut
                on its own page. */}
            <Text variant="h3" numberOfLines={4}>
              {game.title}
            </Text>
            <Text variant="body" style={{ color: accent.quietInk }}>
              {line}
            </Text>
          </View>

          <View style={styles.controls}>
            <DropdownButton
              label="Platform"
              value={selected}
              options={options}
              onChange={onSelect}
              filled
            />
          </View>
        </View>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  /* Top-aligned, as the masthead's identity row is: the box is the fixed shape,
     and the words start level with the top of the tallest box it can be. */
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x16 },
  slot: { justifyContent: 'flex-start' },
  column: { flex: 1, gap: Spacing.x16 },
  /* The name and the sentence it runs into are one statement, so they sit
     closer to each other than to the control under them. */
  claim: { gap: Spacing.x4 },
  controls: { gap: Spacing.x12 },
});
