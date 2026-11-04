import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList, PageSectionList } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { PosterAspectRatio, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteInboxPing,
  getInboxPings,
  getNotifications,
  groupNotifications,
  markAllPingsRead,
  markAllRead,
  markPingRead,
  type AppNotification,
  type InboxPing,
  type NotificationKind,
} from '@/lib/api';
import type { DirectPingKind } from '@/lib/database.types';
import { displayNameFor, timeAgo } from '@/lib/format';
import { DIRECT_PING_VERB, directPingRoute } from '@/lib/pings';
import { useAuth } from '@/store/auth';
import { showAlert } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';

type InboxTab = 'pings' | 'notifications';

const VERB: Record<NotificationKind, string> = {
  like: 'liked your',
  comment: 'commented on your',
  reply: 'replied to your comment on a',
  follow: 'started following you',
  friend_request: 'sent you a friend request',
  friend_accepted: 'accepted your friend request',
  wall_post: 'posted on your wall',
  ping_suggestion: 'suggested a game for your',
};

const ICON: Record<NotificationKind, keyof typeof Ionicons.glyphMap> = {
  like: 'heart',
  comment: 'chatbubble',
  reply: 'return-down-forward',
  follow: 'person-add',
  friend_request: 'person-add',
  friend_accepted: 'people',
  wall_post: 'create',
  ping_suggestion: 'radio',
};

/** The noun after the verb, by what the notification points at. */
const NOUN: Record<string, string> = { log: ' review', list: ' collection', ping: ' ping' };

/** Kinds that are about a person rather than a post or review. */
const PERSON_KINDS: readonly NotificationKind[] = [
  'follow',
  'friend_request',
  'friend_accepted',
  'wall_post',
];

/** The glyph on a ping's face, by what was sent. */
const KIND_ICON: Record<DirectPingKind, keyof typeof Ionicons.glyphMap> = {
  game: 'game-controller',
  review: 'chatbox-ellipses',
  collection: 'albums',
  event: 'calendar',
  soundtrack: 'musical-notes',
  request: 'radio',
};

/** Box art draws portrait; the rest as a landscape tile. */
const PORTRAIT: readonly DirectPingKind[] = [
  'game',
  'soundtrack',
  'review',
  'collection',
  'request',
];

/**
 * The bell's page: your pings, and your notifications — the owner's brief
 * (2026-10-31): "The notification icon in the home page should open to their
 * pings, and at the top are the two tabs to switch from your pings to your
 * notifications."
 *
 * **Pings** are things people sent you — a game, a review, a collection, an
 * event, a soundtrack, or their request for a game — with their line, newest
 * first; a tap opens it and marks it read, a hold deletes it. **Notifications**
 * are what they always were (likes, replies, follows), plus a suggestion on
 * one of your requests. Each tab has its own unread dot and its own "Mark all
 * as read". Pings first, unless `?tab=notifications`.
 */
export default function InboxScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const userId = useAuth((state) => state.session?.user.id);
  const [tab, setTab] = useState<InboxTab>(
    params.tab === 'notifications' ? 'notifications' : 'pings'
  );

  const pings = useQuery({
    queryKey: ['direct-pings', userId],
    queryFn: () => getInboxPings(userId!),
    enabled: !!userId,
  });
  const notifications = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => getNotifications(userId!),
    enabled: !!userId,
  });

  const tabs = [
    { key: 'pings' as const, label: 'Pings', alert: (pings.data ?? []).some((ping) => !ping.read) },
    {
      key: 'notifications' as const,
      label: 'Notifications',
      alert: (notifications.data ?? []).some((entry) => !entry.read),
    },
  ];

  return (
    <Screen edges={[]} insetHeader topBar={<FrostedTopBar back title="Inbox" largeTitle={false} />}>
      <View style={styles.tabs}>
        <TabBar tabs={tabs} value={tab} onChange={setTab} label="Inbox" />
      </View>
      {tab === 'pings' ? (
        <PingsList query={pings} userId={userId ?? null} />
      ) : (
        <NotificationsList query={notifications} userId={userId ?? null} />
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Pings
// ---------------------------------------------------------------------------

function PingsList({
  query,
  userId,
}: {
  query: UseQueryResult<InboxPing[]>;
  userId: string | null;
}) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['direct-pings'] });
    void queryClient.invalidateQueries({ queryKey: ['inbox', 'unread'] });
  }, [queryClient]);

  const markAll = useMutation({
    mutationFn: () => markAllPingsRead(userId!),
    onSuccess: () => {
      toast.success('All marked as read');
      return refresh();
    },
  });

  const open = useCallback(
    (ping: InboxPing) => {
      if (!ping.read) {
        /* Read at once on the phone; the write follows. */
        queryClient.setQueryData<InboxPing[]>(['direct-pings', userId], (rows) =>
          rows?.map((row) => (row.id === ping.id ? { ...row, read: true } : row))
        );
        void markPingRead(ping.id).finally(refresh);
      }
      router.push(directPingRoute(ping.kind, ping.target_id) as Href);
    },
    [queryClient, refresh, router, userId]
  );

  const remove = useCallback(
    (ping: InboxPing) => {
      showAlert('Delete this ping?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            queryClient.setQueryData<InboxPing[]>(['direct-pings', userId], (rows) =>
              rows?.filter((row) => row.id !== ping.id)
            );
            void deleteInboxPing(ping.id).finally(refresh);
          },
        },
      ]);
    },
    [queryClient, refresh, userId]
  );

  const renderItem = useCallback(
    ({ item }: { item: InboxPing }) => <PingRow ping={item} onOpen={open} onRemove={remove} />,
    [open, remove]
  );

  if (query.isPending) return <LoadingState />;
  if (query.isLoadingError)
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const rows = query.data ?? [];
  const unread = rows.some((ping) => !ping.read);

  return (
    <PageFlatList
      data={rows}
      keyExtractor={pingKey}
      renderItem={renderItem}
      contentContainerStyle={rows.length === 0 ? styles.empty : styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={query.refetch}
          tintColor={theme.primary}
        />
      }
      ListHeaderComponent={
        unread ? (
          <View style={styles.markRead}>
            <Button
              title="Mark all as read"
              variant="secondary"
              size="small"
              icon="checkmark-done"
              loading={markAll.isPending}
              onPress={() => markAll.mutate()}
            />
          </View>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          title="No pings yet"
          message="When someone pings you a game, a review, a collection, an event or a soundtrack, it lands here."
        />
      }
    />
  );
}

const pingKey = (ping: InboxPing) => ping.id;

const PingRow = memo(function PingRow({
  ping,
  onOpen,
  onRemove,
}: {
  ping: InboxPing;
  onOpen: (ping: InboxPing) => void;
  onRemove: (ping: InboxPing) => void;
}) {
  const theme = useTheme();
  const name = displayNameFor(ping.sender);
  const portrait = PORTRAIT.includes(ping.kind);
  const artWidth = portrait ? 40 : 64;
  const artHeight = portrait ? Math.round(40 / PosterAspectRatio) : 36;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${name} ${DIRECT_PING_VERB[ping.kind]}: ${ping.title}${ping.message ? `. “${ping.message}”` : ''}`}
      accessibilityHint="Opens it. Hold to delete"
      onPress={() => onOpen(ping)}
      onLongPress={() => onRemove(ping)}
      scaleTo={0.99}
      style={StyleSheet.flatten([
        styles.row,
        { backgroundColor: ping.read ? 'transparent' : theme.primaryMuted },
      ])}>
      <View>
        <Avatar uri={ping.sender?.avatar_url} name={name} size={44} />
        <View style={[styles.badge, { backgroundColor: theme.background }]}>
          <Ionicons name={KIND_ICON[ping.kind]} size={11} color={theme.primaryText} />
        </View>
      </View>

      <View style={styles.rowText}>
        <Text variant="body" numberOfLines={2}>
          <Text variant="h5">{name}</Text> {DIRECT_PING_VERB[ping.kind]}
        </Text>

        <View style={[styles.thing, { backgroundColor: theme.controlFill }]}>
          {ping.image_url ? (
            <Image
              source={{ uri: ping.image_url }}
              style={[
                styles.art,
                { width: artWidth, height: artHeight, backgroundColor: theme.surfaceElevated },
              ]}
              contentFit="cover"
              transition={150}
              recyclingKey={ping.id}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={[
                styles.art,
                styles.artEmpty,
                { width: artWidth, height: artHeight, backgroundColor: theme.surfaceElevated },
              ]}>
              <Ionicons name={KIND_ICON[ping.kind]} size={16} color={theme.textMuted} />
            </View>
          )}
          <View style={styles.thingText}>
            <Text variant="itemTitle" numberOfLines={2}>
              {ping.title}
            </Text>
            {ping.subtitle ? (
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {ping.subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {ping.message ? (
          <Text variant="body" color="textSecondary">
            “{ping.message}”
          </Text>
        ) : null}

        <Text variant="caption" color="textMuted">
          {timeAgo(ping.created_at)}
        </Text>
      </View>

      {!ping.read && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
    </PressableScale>
  );
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function NotificationsList({
  query,
  userId,
}: {
  query: UseQueryResult<AppNotification[]>;
  userId: string | null;
}) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const sections = useMemo(() => groupNotifications(query.data ?? []), [query.data]);

  const markRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      await markAllRead(userId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'unread'] });
    },
  });

  const hasUnread = (query.data ?? []).some((entry) => !entry.read);

  function open(notification: AppNotification) {
    // Friend requests, follows and wall posts are all resolved on a profile —
    // the request is accepted from there, and wall posts live there too.
    if (PERSON_KINDS.includes(notification.kind)) {
      const target =
        notification.kind === 'wall_post'
          ? (userId ?? notification.actor_id)
          : notification.actor_id;
      router.push({ pathname: '/profile/[id]', params: { id: target } });
      return;
    }
    if (notification.target_type === 'ping' && notification.target_id) {
      router.push({ pathname: '/ping/[id]', params: { id: notification.target_id } });
      return;
    }
    if (notification.target_type && notification.target_id) {
      router.push({
        pathname: '/comments/[type]/[id]',
        params: { type: notification.target_type, id: notification.target_id },
      });
    }
  }

  if (query.isPending) return <LoadingState />;
  if (query.isLoadingError)
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <PageSectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={sections.length === 0 ? styles.empty : styles.content}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={query.refetch}
          tintColor={theme.primary}
        />
      }
      ListHeaderComponent={
        hasUnread ? (
          <View style={styles.markRead}>
            <Button
              title="Mark all as read"
              variant="secondary"
              size="small"
              icon="checkmark-done"
              onPress={() => markRead.mutate()}
            />
          </View>
        ) : null
      }
      renderSectionHeader={({ section }) => (
        <Text variant="h4" style={styles.sectionTitle}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => (
        <PressableScale
          accessibilityRole="button"
          onPress={() => open(item)}
          scaleTo={0.99}
          style={StyleSheet.flatten([
            styles.row,
            styles.rowCentered,
            { backgroundColor: item.read ? 'transparent' : theme.primaryMuted },
          ])}>
          <View>
            <Avatar uri={item.actor?.avatar_url} name={displayNameFor(item.actor)} size={44} />
            <View style={[styles.badge, { backgroundColor: theme.background }]}>
              <Ionicons
                name={ICON[item.kind]}
                size={12}
                color={item.kind === 'like' ? theme.danger : theme.primary}
              />
            </View>
          </View>

          <View style={styles.rowTextTight}>
            <Text variant="body" numberOfLines={2}>
              <Text variant="h5">{displayNameFor(item.actor)}</Text> {VERB[item.kind]}
              {PERSON_KINDS.includes(item.kind) ? '' : (NOUN[item.target_type ?? ''] ?? ' post')}
            </Text>
            <Text variant="caption" color="textMuted">
              {timeAgo(item.created_at)}
            </Text>
          </View>

          {!item.read && <View style={[styles.dotCentered, { backgroundColor: theme.primary }]} />}
        </PressableScale>
      )}
      ListEmptyComponent={
        <EmptyState
          title="Nothing yet"
          message="Likes, comments, new followers and suggestions on your pings show up here."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  tabs: { paddingTop: Spacing.x8 },
  content: { padding: Spacing.x16, gap: Spacing.x4, paddingBottom: Spacing.x48 },
  empty: { flexGrow: 1 },
  sectionTitle: { marginTop: Spacing.x16, marginBottom: Spacing.x8 },
  /* Hugs its label rather than spanning the list. */
  markRead: { alignSelf: 'flex-start', marginBottom: Spacing.x8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x12,
    padding: Spacing.x12,
    borderRadius: Radius.image,
  },
  rowCentered: { alignItems: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: Spacing.x8 },
  rowTextTight: { flex: 1, minWidth: 0, gap: 2 },
  thing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x8,
    borderRadius: Radius.card,
  },
  thingText: { flex: 1, minWidth: 0, gap: 1 },
  art: { borderRadius: Radius.image },
  artEmpty: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: Radius.pill, marginTop: Spacing.x8 },
  dotCentered: { width: 8, height: 8, borderRadius: Radius.pill },
});
