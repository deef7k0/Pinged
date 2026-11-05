import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { type PlatformKey } from '@/constants/platform-cases';
import { Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useGamePrices } from '@/hooks/use-game-prices';
import { useTheme } from '@/hooks/use-theme';
import { formatPrice, getBestPriceForPlatform } from '@/lib/games/itad';

export type GamePriceProps = {
  /** App-wide game id. */
  gameId: string;
  /** Active platform family (ps5, xbox, pc, switch, etc.). */
  selected: PlatformKey;
  /** Game title for ITAD fallback lookup. */
  title?: string;
};

/**
 * What a game costs on one platform, under the platform button in Overview's
 * Platforms section (`<GamePlatforms>`).
 *
 * The page owns the selection, so picking PS5 swaps the case *and* the price
 * together. It sat in the masthead for a long time, following a platform you
 * picked by holding the case; with the choice made further down the page, a
 * price at the top would change out of sight, so it moved to sit under the
 * control that changes it. It carries no platform glyph of its own: the button
 * directly above it already does. It no longer swaps a store link either:
 * buying is Overview's "Where to buy", which lists every storefront rather than
 * sending the reader to one.
 *
 * Uses IsThereAnyDeal, which tracks PC shops only: the cheapest of them for
 * the PC, the Microsoft Store for an Xbox, and nothing for a platform no ITAD
 * shop sells for — see `PLATFORM_STORE_IDS`. Shares its requests with Where to
 * buy (`useGamePrices`).
 */
export function GamePrice({ gameId, selected, title }: GamePriceProps) {
  const theme = useTheme();
  /* `quietInk` rather than a grey token, throughout. On a tonal accent it
     resolves to M3's `onSurfaceVariant` — the neutral-variant palette at tone
     80, which carries a trace of the seed's hue rather than being a flat grey.
     That is the role M3 has for secondary type, and it belongs to the page in a
     way `textSecondary` does not. */
  const accent = useAccent();
  const { prices, loading } = useGamePrices(gameId, title);

  const deal = getBestPriceForPlatform(prices, selected);
  const isLoading = loading && !deal;

  return (
    <View style={styles.price}>
      <View style={styles.priceLine}>
        {deal ? (
          <>
            {/* `h4`, a step under the title above it in the same column. */}
            <Text variant="h4">{formatPrice(deal.amount, deal.currency)}</Text>
            {deal.cut > 0 && (
              <Text
                variant="caption"
                style={StyleSheet.flatten([styles.struck, { color: accent.quietInk }])}>
                {formatPrice(deal.regular, deal.currency)}
              </Text>
            )}
            {/* Opaque fills, not a 15% wash of their own hue.

                An alpha badge over the old ambient gradient had no fixed
                background — its contrast was whatever the gradient happened to
                be under it, which measured 3.77:1 (discount) and 3.95:1
                (all-time low) at the top of the page. A solid `surface` behind
                them is a known quantity and puts both at ~10:1.
                
                `label`, not `caption` + `fontWeight: '700'`. That weight was a
                no-op: React Native will not synthesise bold from a custom font
                on Android, so the one emphatic element in this row rendered
                regular on half the devices that shipped it. `Type.label` is a
                separately loaded Medium family and carries its weight for real. */}
            {deal.cut > 0 && (
              <View style={[styles.discount, { backgroundColor: theme.surface }]}>
                <Text variant="badge" style={{ color: theme.success }}>
                  −{deal.cut}%
                </Text>
              </View>
            )}
            {deal.isAllTimeLow && (
              <View style={[styles.discount, { backgroundColor: theme.surface }]}>
                <Text variant="badge" style={{ color: theme.identityGold }}>
                  LOWEST
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text variant="h5" style={{ color: accent.quietInk }}>
            {isLoading ? 'Checking prices…' : 'Price on the store'}
          </Text>
        )}
      </View>

      {/*
        No outbound link here any more.

        This used to carry an "Open on Steam" row under the price. It was the
        masthead — the block that answers *what is this game* — quietly turning
        into a storefront, and it duplicated a control that already exists and
        does the job better: Overview's "Where to buy" lists every storefront
        ITAD tracks with its own price beside it, so the reader picks a shop
        rather than being sent to whichever one happened to be cheapest.

        The price stays, because a price is a fact about the game. Buying is an
        action, and actions on this page live under the tabs.
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  price: { gap: Spacing.x4 },
  priceLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, flexWrap: 'wrap' },
  struck: { textDecorationLine: 'line-through' },
  discount: {
    paddingHorizontal: Spacing.x8,
    paddingVertical: 1,
    borderRadius: Radius.image,
  },
});
