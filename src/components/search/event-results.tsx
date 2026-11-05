import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { memo, useMemo, useState, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { PageSectionList, PageWithHeader } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { ArtRowWindow } from '@/constants/list-window';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getEvents, type EventSummary } from '@/lib/games/browse';

const MIN_QUERY_LENGTH = 2;

/** An event's picture in its row: 16:9, as IGDB's event art is drawn. */
const THUMB = { width: 128, height: 72 };

/** A run of events under one heading — or under none, for search results. */
type EventSection = { title: string | null; data: EventSummary[] };

/** "10 Dec 2025" — the day is what a list of events is scanned for. */
export function formatEventDay(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Showcases, conferences and award shows — the ones coming, the ones just
 * gone, and any of them by name.
 *
 * The News tab's Events section (it was a scope of Search until the owner moved
 * it, 2026-10-14). There it is drawn untyped; `query` is kept so a field could
 * narrow it again. It is the page's scroller (`<PageSectionList>`), so the
 * News bar knows when it moves.
 *
 * Untyped, the list is split around today: what is still to come, soonest
 * first, then what has happened, latest first. A single newest-first list would
 * open on an event four months away and bury tonight's. Typed, it is one list
 * of the events whose name holds the term, newest first — a search for "game
 * awards" wants this year's before 2014's.
 *
 * Every row has a picture. IGDB carries key art for nearly every event now, and
 * a frame of the stream stands in for the rest (`getEvents`); the lettered
 * panel is the last rung, so a row never has a hole where its picture goes.
 */
/**
 * @param header drawn at the head of the list, under the page's large title —
 *   News's tab row; also over the loading and error states, so the tabs never
 *   leave the page while the events load.
 */
export function EventResults({ query = '', header }: { query?: string; header?: ReactElement }) {
  const clearance = useTabBarClearance();
  const term = query.length >= MIN_QUERY_LENGTH ? query : '';
  /* Read once, when the list mounts: "today" must not move between renders, and
     a lazy initialiser is the one place a clock may be read during one. */
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  const events = useQuery({
    queryKey: ['events', term],
    queryFn: ({ signal }) => getEvents(term, signal),
    placeholderData: keepPreviousData,
    staleTime: 30 * 60_000,
  });

  const sections = useMemo((): EventSection[] => {
    const rows = events.data ?? [];
    if (term) return rows.length > 0 ? [{ title: null, data: rows }] : [];

    const upcoming = rows
      .filter((event) => event.startTime !== null && event.startTime > now)
      .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
    const past = rows.filter((event) => event.startTime === null || event.startTime <= now);

    return [
      ...(upcoming.length > 0 ? [{ title: 'Coming up', data: upcoming }] : []),
      ...(past.length > 0 ? [{ title: 'Recent', data: past }] : []),
    ];
  }, [events.data, term, now]);

  const state = events.isLoading ? (
    <LoadingState />
  ) : events.isLoadingError ? (
    <ErrorState error={events.error} onRetry={() => events.refetch()} />
  ) : null;
  if (state)
    return header ? (
      <PageWithHeader header={header} contentContainerStyle={styles.content}>
        {state}
      </PageWithHeader>
    ) : (
      state
    );

  return (
    <PageSectionList
      ListHeaderComponent={header}
      sections={sections}
      keyExtractor={(event) => String(event.id)}
      {...ArtRowWindow}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
      renderSectionHeader={({ section }) =>
        section.title ? (
          <Text variant="h4" accessibilityRole="header" style={styles.heading}>
            {section.title}
          </Text>
        ) : null
      }
      renderItem={({ item }) => <EventRow event={item} upcoming={(item.startTime ?? 0) > now} />}
      ListEmptyComponent={
        <EmptyState
          title={term ? 'No events found' : 'No events listed'}
          message={
            term
              ? `No showcase or award show is called anything like “${term}”.`
              : 'IGDB has no events to show right now.'
          }
        />
      }
    />
  );
}

const EventRow = memo(function EventRow({
  event,
  upcoming,
}: {
  event: EventSummary;
  upcoming: boolean;
}) {
  const theme = useTheme();
  const day = event.startTime !== null ? formatEventDay(event.startTime) : null;
  const games =
    event.gameCount > 0 ? `${event.gameCount} ${event.gameCount === 1 ? 'game' : 'games'}` : null;

  return (
    <Link href={{ pathname: '/event/[id]', params: { id: String(event.id) } }} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={[event.name, day, games].filter(Boolean).join(', ')}
        scaleTo={0.98}
        style={styles.row}>
        {event.thumbnailUrl ? (
          <Image
            source={{ uri: event.thumbnailUrl }}
            recyclingKey={String(event.id)}
            style={[styles.thumb, { backgroundColor: theme.surfaceElevated }]}
            cachePolicy="memory-disk"
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            style={[styles.thumb, styles.thumbEmpty, { backgroundColor: theme.surfaceElevated }]}>
            <Text variant="h2" color="textMuted">
              {event.name.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.text}>
          <Text variant="itemTitle" numberOfLines={2}>
            {event.name}
          </Text>
          {day && (
            /* A date still ahead is the row's news, so it is a step brighter
               than one that has passed. */
            <Text variant="bodySmall" color={upcoming ? 'textSecondary' : 'textMuted'}>
              {day}
            </Text>
          )}
          {games && (
            <Text variant="bodySmall" color="textMuted">
              {games}
            </Text>
          )}
        </View>
      </PressableScale>
    </Link>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x8, flexGrow: 1 },
  heading: { paddingTop: Spacing.x16, paddingBottom: Spacing.x8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x8,
  },
  /* The app's box-art corner: it is a picture, not a control. */
  thumb: { width: THUMB.width, height: THUMB.height, borderRadius: Radius.image },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
