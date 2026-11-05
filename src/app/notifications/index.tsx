import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { memo, useCallback, useMemo, useState, type ReactElement } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { PageFlatList, PageSectionList, PageWithHeader } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
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
  ping_suggestion: 'paper-plane',
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
  request: 'paper-plane',
};

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

  const queryClient = useQueryClient();
  const pingsUnread = (pings.data ?? []).some((ping) => !ping.read);
  const notificationsUnread = (notifications.data ?? []).some((entry) => !entry.read);

  const markAll = useMutation({
    mutationFn: async (which: InboxTab) => {
      if (!userId) return;
      if (which === 'pings') await markAllPingsRead(userId);
      else await markAllRead(userId);
    },
    onSuccess: (_, which) => {
      toast.success('All marked as read');
      void queryClient.invalidateQueries({
        queryKey: [which === 'pings' ? 'direct-pings' : 'notifications'],
      });
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'unread'] });
    },
  });

  const tabs = [
    { key: 'pings' as const, label: 'Pings', alert: pingsUnread },
    { key: 'notifications' as const, label: 'Notifications', alert: notificationsUnread },
  ];

  /* The tabs are the lists' header, under the large title (the Apple pass,
     2026-11-05): the name first, folding into the bar as the page is read. */
  const header = (
    <View style={styles.tabs}>
      <TabBar tabs={tabs} value={tab} onChange={setTab} label="Inbox" inset={0} />
    </View>
  );

  /* "Mark all as read" is a key in the bar, Mail's — it was a button at the
     head of each list. Drawn only while the tab in front has something unread. */
  const unread = tab === 'pings' ? pingsUnread : notificationsUnread;
  const right =
    unread && !markAll.isPending ? (
      <TopBarDisc
        icon="checkmark-done"
        label="Mark all as read"
        onPress={() => markAll.mutate(tab)}
      />
    ) : undefined;

  return (
    <Screen edges={[]} insetHeader topBar={<FrostedTopBar back title="Inbox" right={right} />}>
      {tab === 'pings' ? (
        <PingsList query={pings} userId={userId ?? null} header={header} />
      ) : (
        <NotificationsList query={notifications} userId={userId ?? null} header={header} />
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
  header,
}: {
  query: UseQueryResult<InboxPing[]>;
  userId: string | null;
  header: ReactElement;
}) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['direct-pings'] });
    void queryClient.invalidateQueries({ queryKey: ['inbox', 'unread'] });
  }, [queryClient]);

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

  if (query.isPending || query.isLoadingError) return <ListState query={query} header={header} />;

  const rows = query.data ?? [];

  return (
    <PageFlatList
      data={rows}
      keyExtractor={pingKey}
      renderItem={renderItem}
      ItemSeparatorComponent={RowRule}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={query.refetch}
          tintColor={theme.primary}
        />
      }
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState
          icon="paper-plane-outline"
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

  /* A row on the page, Mail's and Messages': the face, the words, the thing
     at the trailing edge as a 44dp square — not a box inside a box. Unread is
     the dot before the face. */
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${ping.read ? '' : 'Unread. '}${name} ${DIRECT_PING_VERB[ping.kind]}: ${ping.title}${ping.message ? `. “${ping.message}”` : ''}`}
      accessibilityHint="Opens it. Hold to delete"
      onPress={() => onOpen(ping)}
      onLongPress={() => onRemove(ping)}
      scaleTo={0.99}
      style={styles.row}>
      <UnreadDot on={!ping.read} />
      <View>
        <Avatar uri={ping.sender?.avatar_url} name={name} size={AVATAR} />
        <View style={[styles.badge, { backgroundColor: theme.background }]}>
          <Ionicons name={KIND_ICON[ping.kind]} size={11} color={theme.primaryText} />
        </View>
      </View>

      <View style={styles.rowText}>
        <Text variant="body" numberOfLines={3}>
          <Text variant="h5">{name}</Text> {DIRECT_PING_VERB[ping.kind]}{' '}
          <Text variant="h5">{ping.title}</Text>
        </Text>
        {ping.message ? (
          <Text variant="body" color="textSecondary" numberOfLines={3}>
            “{ping.message}”
          </Text>
        ) : null}
        <Text variant="caption" color="textMuted">
          {timeAgo(ping.created_at)}
        </Text>
      </View>

      {ping.image_url ? (
        <Image
          source={{ uri: ping.image_url }}
          style={[styles.thumb, { backgroundColor: theme.surfaceElevated }]}
          contentFit="cover"
          transition={150}
          recyclingKey={ping.id}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: theme.surfaceElevated }]}>
          <Ionicons name={KIND_ICON[ping.kind]} size={18} color={theme.textMuted} />
        </View>
      )}
    </PressableScale>
  );
});

/** The unread mark before a row's face; the same room when read, so rows align. */
function UnreadDot({ on }: { on: boolean }) {
  const theme = useTheme();
  return <View style={[styles.dot, on && { backgroundColor: theme.primaryText }]} />;
}

/** The hairline between rows, from where the words start. */
function RowRule() {
  const theme = useTheme();
  return <View style={[styles.rule, { backgroundColor: theme.border }]} />;
}

/** A list's loading or failed state, under the tabs and the large title. */
function ListState({ query, header }: { query: UseQueryResult<unknown>; header: ReactElement }) {
  return (
    <PageWithHeader header={header} contentContainerStyle={styles.content}>
      {query.isLoadingError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <LoadingState />
      )}
    </PageWithHeader>
  );
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function NotificationsList({
  query,
  userId,
  header,
}: {
  query: UseQueryResult<AppNotification[]>;
  userId: string | null;
  header: ReactElement;
}) {
  const theme = useTheme();
  const router = useRouter();

  const sections = useMemo(() => groupNotifications(query.data ?? []), [query.data]);

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

  if (query.isPending || query.isLoadingError) return <ListState query={query} header={header} />;

  return (
    <PageSectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={RowRule}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={query.refetch}
          tintColor={theme.primary}
        />
      }
      ListHeaderComponent={header}
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
          accessibilityLabel={`${item.read ? '' : 'Unread. '}${displayNameFor(item.actor)} ${VERB[item.kind]}${PERSON_KINDS.includes(item.kind) ? '' : (NOUN[item.target_type ?? ''] ?? ' post')}, ${timeAgo(item.created_at)}`}
          style={StyleSheet.flatten([styles.row, styles.rowCentered])}>
          <UnreadDot on={!item.read} />
          <View>
            <Avatar uri={item.actor?.avatar_url} name={displayNameFor(item.actor)} size={AVATAR} />
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
        </PressableScale>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="notifications-outline"
          title="Nothing yet"
          message="Likes, comments, new followers and suggestions on your pings show up here."
        />
      }
    />
  );
}

/** A face in a row: 40, Mail's. */
const AVATAR = 40;
/** The unread dot and the room it keeps. */
const DOT = 8;

const styles = StyleSheet.create({
  tabs: { paddingBottom: Spacing.x8 },
  content: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, flexGrow: 1 },
  sectionTitle: { marginTop: Spacing.x20, marginBottom: Spacing.x4 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
  },
  rowCentered: { alignItems: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: Spacing.x4 },
  rowTextTight: { flex: 1, minWidth: 0, gap: 2 },
  thumb: { width: 44, height: 44, borderRadius: Radius.image, borderCurve: 'continuous' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
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
  dot: { width: DOT, height: DOT, borderRadius: Radius.pill, alignSelf: 'center', marginRight: -4 },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginLeft: DOT - 4 + Spacing.x12 * 2 + AVATAR,
  },
});
