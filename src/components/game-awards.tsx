import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Linking, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { useCardMaterial } from '@/components/ui/card-material';
import { InfoCard } from '@/components/ui/info-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import {
  getSteamAwards,
  type SteamAwardBanner,
  type SteamAwardImage,
} from '@/lib/games/steam-store';

/**
 * How much of the publisher's graphic the folded card shows.
 *
 * Steam folds the same section at 400px (`game_page_autocollapse`,
 * `max-height: 400px`), for the same reason: Disco Elysium's is 1,792px tall
 * and Baldur's Gate 3's 6,008. Unfolded, it is all of it.
 */
const FOLDED = 400;

/** Folding a graphic only a little taller than the fold hides a sliver behind a button. */
const FOLD_SLACK = 96;

/** How tall the fade over the fold is. */
const FADE = 72;

/** Between two images, as Steam stacks them. */
const IMAGE_GAP = Spacing.x8;

/** Material's standard ease, the window's motion everywhere a card opens. */
const EASE = cubicBezier(0.4, 0, 0.2, 1);
const OPEN_MS = 250;

/**
 * The game's awards, from its Steam store page: the graphic the publisher put
 * in the page's Awards section, and the Steam Awards it won.
 *
 * ```text
 *   Awards                                                Steam
 *   ╭──────────────────────────────────────────────────────╮
 *   │            ⟨ the publisher's own laurels ⟩            │
 *   │            ⟨ … folded at 400, fading out ⟩            │
 *   │ Show all ⌄                                           │
 *   │ 🏆 The Steam Awards 2022 · Winner                    │
 *   │    Game of the Year Award · Best Game You Suck At …  │
 *   │ From the game’s page on Steam.                       │
 *   ╰──────────────────────────────────────────────────────╯
 * ```
 *
 * The owner's request (2026-10-16): "add a card in the game page overview tab
 * for awards. You will use Steam's award image that they have in a game's
 * page." The images are the page's own (`#awardsTable`, read by the
 * `steam-store` function — see `supabase/functions/_shared/steam-store.ts`),
 * hot-linked from Steam's CDN as Steam draws them and never re-hosted, and the
 * card says where they are from and links there.
 *
 * - **Each image is drawn at the size Steam draws it**, at most the card's
 *   width, centred: Steam sets them at their own pixel width with
 *   `max-width: 100%`, so a 276px badge is not blown up to fill a phone.
 * - **They are made for Steam's dark page** — white laurels on a transparent
 *   ground — which this card is too. Nothing is drawn behind them.
 * - **Steam's own awards are words**: the section draws them as a banner
 *   around a generic trophy, so the trophy is left out and the banner read
 *   as text. Counter-Strike 2's section is only that.
 *
 * Absent for a game with no Steam listing, a page with no Awards section, or
 * a function that is not deployed — and while it loads: it is far enough down
 * the Overview that arriving late moves nothing in view.
 */
export function GameAwards({ appId, title }: { appId: string | null; title: string }) {
  const awards = useQuery({
    queryKey: ['steam-awards', appId],
    queryFn: ({ signal }) => getSteamAwards(appId!, signal),
    enabled: !!appId,
    /* A game's awards change a few times in its life; the function keeps them
       a week and this asks it once a day. */
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  });

  const data = awards.data;
  if (!data || (data.awardsImages.length === 0 && data.steamAwards.length === 0)) return null;

  const openPage = () => {
    Linking.openURL(data.pageUrl).catch(() => {
      // No browser to take it; nothing useful to say.
    });
  };

  return (
    <InfoCard
      title="Awards"
      more={{
        label: 'Steam',
        accessibilityLabel: `See the awards of ${title} on its Steam page`,
        onPress: openPage,
      }}>
      {data.awardsImages.length > 0 && <AwardImages images={data.awardsImages} title={title} />}

      {data.steamAwards.map((banner, index) => (
        <SteamAward key={`${banner.year ?? 'year'}-${index}`} banner={banner} />
      ))}
    </InfoCard>
  );
}

/**
 * The publisher's images, stacked, folded at Steam's own 400 when they run
 * longer, and unfolded in place.
 *
 * The window's height is a CSS transition on a React prop — the open or the
 * folded height — so it rests on whatever was last rendered and cannot be left
 * half open (CLAUDE.md, § Gotchas: an animated style's end value can be lost).
 */
function AwardImages({ images, title }: { images: SteamAwardImage[]; title: string }) {
  const accent = useAccent();
  const fill = useCardMaterial().fill;
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState(false);
  /* Sizes learnt on load, for an image the page gave no width and height. */
  const [loaded, setLoaded] = useState<Record<string, { width: number; height: number }>>({});

  const sizes = images.map((image) => {
    const natural =
      image.width && image.height
        ? { width: image.width, height: image.height }
        : (loaded[image.url] ?? { width: 16, height: 9 });
    const drawn = Math.min(width, natural.width);
    return { width: drawn, height: Math.round((drawn * natural.height) / natural.width) };
  });

  const total = sizes.reduce((sum, size) => sum + size.height, 0) + IMAGE_GAP * (images.length - 1);
  const folds = width > 0 && total > FOLDED + FOLD_SLACK;
  const height = folds && !open ? FOLDED : total;

  const label = [
    images.length === 1
      ? `The awards graphic from the Steam page of ${title}`
      : `${images.length} awards graphics from the Steam page of ${title}`,
    ...images.flatMap((image) => (image.alt ? [image.alt] : [])),
  ].join('. ');

  return (
    <View>
      <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && (
          <Animated.View
            accessible
            accessibilityRole="image"
            accessibilityLabel={label}
            style={[
              styles.window,
              {
                height,
                transitionProperty: 'height',
                transitionDuration: reduceMotion ? 0 : OPEN_MS,
                transitionTimingFunction: EASE,
              },
            ]}>
            <View style={styles.stack}>
              {images.map((image, index) => (
                <Image
                  key={image.url}
                  source={{ uri: image.url }}
                  style={sizes[index]}
                  contentFit="contain"
                  transition={200}
                  accessibilityIgnoresInvertColors
                  onLoad={(event) => {
                    if (image.width && image.height) return;
                    const { width: w, height: h } = event.source;
                    if (w > 0 && h > 0) {
                      setLoaded((known) => ({ ...known, [image.url]: { width: w, height: h } }));
                    }
                  }}
                />
              ))}
            </View>

            {folds && !open && (
              /* Into the card's own colour, from the same colour at nothing —
                 never `transparent`, which Android fades through black. */
              <LinearGradient
                pointerEvents="none"
                colors={[withAlpha(fill, 0), fill]}
                style={styles.fade}
              />
            )}
          </Animated.View>
        )}
      </View>

      {folds && (
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? 'Show less of the awards' : 'Show all of the awards'}
          onPress={() => setOpen((value) => !value)}
          scaleTo={0.98}
          style={styles.toggle}>
          <Text variant="h5" style={{ color: accent.onSurface }}>
            {open ? 'Show less' : 'Show all'}
          </Text>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={accent.onSurface}
          />
        </PressableScale>
      )}
    </View>
  );
}

/** "The Steam Awards 2022 · Winner", and under it what it won. A link to that year's awards. */
function SteamAward({ banner }: { banner: SteamAwardBanner }) {
  const theme = useTheme();
  const accent = useAccent();

  const heading = [
    banner.year ? `The Steam Awards ${banner.year}` : 'The Steam Awards',
    banner.result,
  ]
    .filter(Boolean)
    .join(' · ');
  const won = banner.awards.join(' · ');

  const body = (
    <>
      <Ionicons name="trophy" size={18} color={theme.identityGold} style={styles.trophy} />
      <View style={styles.bannerText}>
        <Text variant="itemTitle">{heading}</Text>
        {!!won && (
          <Text variant="bodySmall" style={{ color: accent.quietInk }}>
            {won}
          </Text>
        )}
      </View>
    </>
  );

  if (!banner.url) {
    return (
      <View style={styles.banner} accessible accessibilityLabel={`${heading}. ${won}`}>
        {body}
      </View>
    );
  }

  const url = banner.url;
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${heading}. ${won}. Opens the Steam Awards.`}
      onPress={() => {
        Linking.openURL(url).catch(() => {
          // No browser to take it; nothing useful to say.
        });
      }}
      scaleTo={0.98}
      style={styles.banner}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  window: { overflow: 'hidden' },
  stack: { alignItems: 'center', gap: IMAGE_GAP },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: FADE },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x4,
    minHeight: TapTarget,
  },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x12 },
  /* Level with the heading's capitals rather than the top of its line box. */
  trophy: { marginTop: 1 },
  bannerText: { flex: 1, gap: 2 },
});
