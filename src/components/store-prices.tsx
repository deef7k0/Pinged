import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, StyleSheet, View } from 'react-native';

import { ArtRail, Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { OFFICIAL_STORES, storeBrand, storeInitial, type StoreBrand } from '@/constants/stores';
import { Typeface, Spacing, readableInk } from '@/constants/theme';
import { useGamePrices } from '@/hooks/use-game-prices';
import { useTheme } from '@/hooks/use-theme';
import { formatPrice, type StorePrice } from '@/lib/games/itad';
import { ITAD_SHOP_OF_STORE, arrangeOffers } from '@/lib/games/storefronts';

/** The tile's corner — the trailers row's, so the two rails read as one family. */
const TILE_RADIUS = 12;
/** The store's mark inside its square. */
const GLYPH = 44;

export type StorePricesProps = {
  /** App-wide game id. */
  gameId: string;
  /** For the price lookup when the game has no Steam listing. */
  title: string;
};

/** One store in the rail, official or not. */
type Offer = {
  key: string;
  name: string;
  brand: StoreBrand;
  url: string;
  price: StorePrice | null;
  /** The price is still being asked for. */
  pending: boolean;
};

/**
 * Where to buy the game, as the trailers row is drawn (the owner's,
 * 2026-11-03): a rail of squares you swipe through — each the store's mark
 * on its own colour, its name under it, then the price.
 *
 * ```text
 *   Where to buy                                  from $9.99
 *   ▣▣▣▣▣  ▣▣▣▣▣  ▣▣▣▣▣  ▣▣
 *   Steam   GOG    PlayStation Store
 *   $49.99  $9.99  Price on the store
 * ```
 *
 * ## The owner's rule (2026-10-16), unchanged
 *
 * The **official stores, and their links, are IGDB's**: every platform shop
 * IGDB lists the game on is a tile, priced or not. **IsThereAnyDeal prices
 * the ones it can** — Steam, GOG, Epic and the Microsoft Store; it tracks no
 * console or phone shop — and **the other shops are ITAD's**, after them,
 * with its links. `arrangeOffers` (`lib/games/storefronts.ts`) is the rule.
 * A rail holds every store, so there is no "Show all" any more.
 */
export function StorePrices({ gameId, title }: StorePricesProps) {
  const { storefronts, prices, loading } = useGamePrices(gameId, title);

  const { official, others } = arrangeOffers(storefronts.stores, prices);
  if (official.length === 0 && others.length === 0) return null;

  const offers: Offer[] = [
    ...official.map((row) => {
      const store = OFFICIAL_STORES[row.key];
      /* Whether ITAD could price this store at all: while it is still being
         asked, those tiles say so rather than "Price on the store". */
      const priceable = ITAD_SHOP_OF_STORE[row.key] !== undefined;
      return {
        key: row.key,
        name: store.name,
        brand: store,
        url: row.url,
        price: row.price,
        pending: loading && priceable && !row.price,
      };
    }),
    ...others.map((deal) => ({
      key: `${deal.shopId}:${deal.url}`,
      name: deal.shopName,
      brand: storeBrand(deal.shopId),
      url: deal.url,
      price: deal,
      pending: false,
    })),
  ];

  /* The heading's "from": the best price anywhere in the rail. */
  const best = offers
    .flatMap((offer) => (offer.price ? [offer.price] : []))
    .sort((a, b) => a.amount - b.amount)[0];

  return (
    <Section
      title="Where to buy"
      action={
        best ? (
          <Text variant="bodySmall" color="textMuted">
            from {formatPrice(best.amount, best.currency)}
          </Text>
        ) : undefined
      }>
      <ArtRail
        data={offers}
        keyOf={(offer) => offer.key}
        shape="square"
        titleOf={(offer) => offer.name}
        subtitleOf={(offer) =>
          offer.price
            ? formatPrice(offer.price.amount, offer.price.currency)
            : /* No number: IsThereAnyDeal does not track this store (every
                 console and phone shop), or does not have this game there.
                 The link is still the answer to "where". */
              offer.pending
              ? 'Checking the price…'
              : 'Price on the store'
        }
        labelOf={(offer) =>
          offer.price
            ? `${offer.name}, ${formatPrice(offer.price.amount, offer.price.currency)}${
                offer.price.cut > 0 ? `, ${offer.price.cut} percent off` : ''
              }. Opens the store.`
            : `${offer.name}. Opens the store.`
        }
        onPressItem={(offer) => {
          Linking.openURL(offer.url).catch(() => {
            // No handler for the scheme, or the link is dead. Nothing useful
            // to say about it on a store tile.
          });
        }}
        renderArt={(offer, size) => <StoreTile offer={offer} size={size} />}
      />
    </Section>
  );
}

/**
 * The square: the store's own colour, its glyph (or its initial where
 * Ionicons ships none) in the middle — and, when there is a cut, the
 * discount in its corner, the one coloured word on it: a price cut is
 * meaning, and the reason somebody is scanning the row at all.
 */
function StoreTile({ offer, size }: { offer: Offer; size: { width: number; height: number } }) {
  const theme = useTheme();
  const ink = readableInk(offer.brand.color);
  const cut = offer.price && offer.price.cut > 0 ? offer.price.cut : null;

  return (
    <View style={[size, styles.tile, { backgroundColor: offer.brand.color }]}>
      {offer.brand.icon ? (
        <Ionicons name={offer.brand.icon} size={GLYPH} color={ink} />
      ) : (
        <Text style={[styles.initial, { color: ink }]}>{storeInitial(offer.name)}</Text>
      )}
      {cut !== null && (
        <View style={[styles.cut, { backgroundColor: theme.surface }]}>
          <Text variant="label" style={{ color: theme.success }}>
            −{cut}%
          </Text>
        </View>
      )}
      {offer.price?.isAllTimeLow && (
        <View style={[styles.low, { backgroundColor: theme.surface }]}>
          <Text variant="h6" style={{ color: theme.identityGold }}>
            Lowest
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: TILE_RADIUS,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: Typeface.extraBold, fontSize: 40, lineHeight: 46 },
  /* Opaque: a wash of its own hue has no fixed ground to be measured on. */
  cut: {
    position: 'absolute',
    top: Spacing.x8,
    right: Spacing.x8,
    paddingHorizontal: Spacing.x8 - 2,
    paddingVertical: 1,
    borderRadius: 6,
  },
  low: {
    position: 'absolute',
    bottom: Spacing.x8,
    left: Spacing.x8,
    paddingHorizontal: Spacing.x8 - 2,
    paddingVertical: 1,
    borderRadius: 6,
  },
});
