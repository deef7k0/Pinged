import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ArtRail, Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import {
  EVENT_KIND_LABEL,
  eventPhaseOf,
  getSteamEvents,
  type SteamEvent,
  type SteamEventKind,
} from '@/lib/games/steam-store';

/** A glyph for a post that has no picture of its own (Valve's patch notes have none). */
const KIND_GLYPH: Record<SteamEventKind, keyof typeof Ionicons.glyphMap> = {
  update: 'construct-outline',
  news: 'megaphone-outline',
  event: 'calendar-outline',
  release: 'rocket-outline',
  sale: 'pricetag-outline',
  stream: 'videocam-outline',
};

/**
 * The game's recent events and announcements on Steam, as a rail: each post's
 * capsule, its title, and what it is and when.
 *
 * ```text
 *   Events & announcements                                   Steam
 *   ┌────────────┐ ┌────────────┐ ┌────────────┐
 *   │  capsule   │ │  capsule   │ │     🛠     │
 *   └────────────┘ └────────────┘ └────────────┘
 *   Patch Notes    Community      October 2
 *   Version 1.17   Quests         Update
 *   Update · Aug 27  On now · …   Update · Oct 2, 2024
 * ```
 *
 * The owner's request (2026-10-16): "fetching recent events and announcements
 * from a Steam game's page, and display them". It is the store page's own
 * "Recent Events & Announcements" block, from the endpoint that block is
 * filled from, read by the `steam-store` function and kept an hour (see
 * `supabase/functions/_shared/steam-store.ts` for why that endpoint and not
 * the public news API, which has no pictures and does not tell an event from
 * a post).
 *
 * A rail because these are pictures — Steam's capsules are 16:9, the
 * screenshot rail's shape — and nothing here is read in the app: a post opens
 * on Steam, where its full text, images and comments are. Absent for a game
 * with no Steam listing and for one that has never posted.
 */
export function SteamEvents({ appId, title }: { appId: string | null; title: string }) {
  const theme = useTheme();
  const accent = useAccent();
  /* The clock once, as the screen opens — what Search's events read too. A
     render may not call it (the React Compiler's purity rule). */
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  const events = useQuery({
    queryKey: ['steam-events', appId],
    queryFn: ({ signal }) => getSteamEvents(appId!, signal),
    enabled: !!appId,
    /* The function keeps an answer an hour; this asks it at most twice in
       that time. */
    staleTime: 30 * 60_000,
    retry: 1,
  });

  const data = events.data;
  if (!data || data.events.length === 0) return null;

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {
      // No browser to take it; nothing useful to say.
    });
  };

  return (
    <Section
      title="Events & announcements"
      more={{
        label: 'Steam',
        accessibilityLabel: `See every post about ${title} on Steam`,
        onPress: () => open(data.newsUrl),
      }}>
      <ArtRail
        data={data.events}
        keyOf={(event) => event.id}
        shape="wide"
        titleOf={(event) => event.title}
        subtitleOf={(event) => lineOf(event, now)}
        labelOf={(event) =>
          [event.title, lineOf(event, now), event.summary, 'Opens it on Steam.']
            .filter(Boolean)
            .join('. ')
        }
        onPressItem={(event) => open(event.url)}
        renderArt={(event, size) => {
          const phase = eventPhaseOf(event, now);
          return (
            <View style={[size, styles.art, { backgroundColor: accent.m3.surfaceContainerHigh }]}>
              {event.imageUrl ? (
                <Image
                  source={{ uri: event.imageUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={styles.glyph}>
                  <Ionicons name={KIND_GLYPH[event.kind]} size={28} color={accent.quietInk} />
                </View>
              )}
              {/* Near-black at 82% with white type, as the edition word on a
                  cover is (`<Poster>`): the colour on the art belongs to it. */}
              {phase && (
                <View style={[styles.badge, { backgroundColor: withAlpha(theme.shadowInk, 0.82) }]}>
                  <Text variant="badge" color="white">
                    {phase === 'live' ? 'ON NOW' : 'UPCOMING'}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
      />
    </Section>
  );
}

/** "Update · Aug 27", "On now · until Dec 28", "Starts Oct 20". */
function lineOf(event: SteamEvent, now: number): string {
  const phase = eventPhaseOf(event, now);
  if (phase === 'upcoming')
    return `${EVENT_KIND_LABEL[event.kind]} · starts ${dayOf(event.startsAt)}`;
  if (phase === 'live') {
    return event.endsAt ? `On now · until ${dayOf(event.endsAt)}` : 'On now';
  }
  return `${EVENT_KIND_LABEL[event.kind]} · ${dayOf(event.postedAt ?? event.startsAt)}`;
}

/** The day, with the year only when it is not this one. */
function dayOf(seconds: number): string {
  const date = new Date(seconds * 1000);
  const thisYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(thisYear ? {} : { year: 'numeric' }),
  });
}

const styles = StyleSheet.create({
  art: { borderRadius: Radius.image, overflow: 'hidden' },
  glyph: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: Spacing.x8,
    left: Spacing.x8,
    paddingHorizontal: Spacing.x8,
    paddingVertical: 2,
    borderRadius: Radius.image,
  },
});
