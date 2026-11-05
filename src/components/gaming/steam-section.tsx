import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { FlatList, Linking, StyleSheet, View } from 'react-native';

import { GameTile, usePortraitWidth } from '@/components/gaming/game-tile';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGamingSync } from '@/hooks/use-gaming';
import {
  getBadges,
  getGamingStats,
  getInventory,
  getInventorySize,
  getMatchedFriends,
  getOwnedGames,
  getProviderFriendCount,
  getRarestUnlocks,
} from '@/lib/api';
import { displayNameFor, timeAgo } from '@/lib/format';
import {
  completionPercent,
  countryFlag,
  formatPlaytime,
  isOnline,
  rarityColor,
  statusLabel,
} from '@/lib/gaming';
import type { LinkedAccount } from '@/lib/gaming';

const SHOWCASE_ICON = 52;

/**
 * The Steam section of a profile.
 *
 * Ordered so the most identifying information comes first and the most niche
 * last: who they are, what their numbers look like, what they have been playing,
 * then achievements, inventory, badges and friends.
 *
 * Every block is independently fed and independently skeletoned, because the
 * sections sync independently — the profile header can be live while the
 * achievement scan is still working through a 900-game library. A section with no
 * data renders nothing rather than an empty shell.
 */
export function SteamSection({
  profileId,
  account,
  isSelf,
}: {
  profileId: string;
  account: LinkedAccount;
  isSelf: boolean;
}) {
  const theme = useTheme();
  const { isSyncing, refresh } = useGamingSync({ userId: profileId, enabled: isSelf });

  const stats = useQuery({
    queryKey: ['gaming-stats', 'steam', profileId],
    queryFn: () => getGamingStats(profileId),
  });
  const recentlyPlayed = useQuery({
    queryKey: ['gaming-library', 'steam', profileId, 'recently-played', ''],
    queryFn: () => getOwnedGames(profileId, { sort: 'recently-played', limit: 8 }),
  });
  const mostPlayed = useQuery({
    queryKey: ['gaming-library', 'steam', profileId, 'most-played', ''],
    queryFn: () => getOwnedGames(profileId, { sort: 'most-played', limit: 8 }),
  });
  const rarest = useQuery({
    queryKey: ['gaming-rarest-unlocks', 'steam', profileId],
    queryFn: () => getRarestUnlocks(profileId, { limit: 8 }),
  });
  const inventory = useQuery({
    queryKey: ['gaming-inventory', 'steam', profileId],
    queryFn: () => getInventory(profileId, { limit: 12 }),
  });
  const inventorySize = useQuery({
    queryKey: ['gaming-inventory', 'steam', profileId, 'size'],
    queryFn: () => getInventorySize(profileId),
  });
  const badges = useQuery({
    queryKey: ['gaming-badges', 'steam', profileId],
    queryFn: () => getBadges(profileId),
  });
  const friends = useQuery({
    queryKey: ['gaming-friends', 'steam', profileId],
    queryFn: () => getMatchedFriends(profileId),
  });
  const friendTotal = useQuery({
    queryKey: ['gaming-friends', 'steam', profileId, 'count'],
    queryFn: () => getProviderFriendCount(profileId),
  });

  const isPrivate = account.visibility === 'private';

  return (
    <View style={styles.section}>
      {/* --- Steam profile ------------------------------------------------ */}
      <View style={[styles.card, { borderTopColor: theme.border }]}>
        <View style={styles.identity}>
          <Avatar uri={account.avatarUrl} name={account.handle ?? 'Steam'} size={54} />

          <View style={styles.identityBody}>
            <View style={styles.handleRow}>
              <Text variant="h5" numberOfLines={1} style={styles.handle}>
                {account.handle ?? 'Steam user'}
              </Text>
              {account.level !== null && <LevelBadge level={account.level} />}
            </View>

            <View style={styles.statusRow}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: isOnline(account.status) ? theme.success : theme.textMuted },
                ]}
              />
              <Text variant="caption" color="textMuted">
                {statusLabel(account.status)}
              </Text>
              {account.country && countryFlag(account.country) && (
                <Text variant="caption" color="textMuted">
                  {countryFlag(account.country)} {account.country}
                </Text>
              )}
            </View>

            {/* Current game is the single most "live" thing on the profile, so it
                gets its own accented line rather than joining the status row. */}
            {account.currentGame && (
              <View style={styles.playingRow}>
                <Ionicons name="game-controller" size={12} color={theme.success} />
                <Text variant="caption" numberOfLines={1} style={{ color: theme.success }}>
                  {account.currentGame.name}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.cardActions}>
          {account.profileUrl && (
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel="Open Steam profile"
              onPress={() => Linking.openURL(account.profileUrl!).catch(() => undefined)}
              scaleTo={0.95}>
              <View style={styles.linkRow}>
                <Ionicons name="open-outline" size={13} color={theme.primaryText} />
                <Text variant="caption" color="primaryText">
                  Steam profile
                </Text>
              </View>
            </PressableScale>
          )}

          {isSelf && (
            <Button
              title={isSyncing ? 'Syncing…' : 'Refresh Steam Data'}
              variant="ghost"
              size="small"
              loading={isSyncing}
              onPress={() => refresh.mutate()}
            />
          )}
        </View>

        {account.lastSyncedAt && (
          <Text variant="caption" color="textMuted">
            Synced {timeAgo(account.lastSyncedAt)}
          </Text>
        )}
      </View>

      {isPrivate && (
        <View style={[styles.notice, { borderColor: theme.border }]}>
          <Ionicons name="lock-closed-outline" size={15} color={theme.textMuted} />
          <Text variant="bodySmall" color="textMuted" style={styles.noticeText}>
            Profile is Private — only what Steam shares publicly is shown here.
            {isSelf
              ? ' Set your Steam profile and game details to Public to import everything.'
              : ''}
          </Text>
        </View>
      )}

      {/* --- Gaming stats ------------------------------------------------- */}
      {stats.isLoading ? (
        <Skeleton width="100%" height={84} radius={Radius.image} />
      ) : stats.data ? (
        <View style={[styles.card, { borderTopColor: theme.border }]}>
          <View style={styles.statRow}>
            <Stat value={formatPlaytime(stats.data.totalPlaytimeMinutes)} label="Hours" />
            <Stat value={stats.data.gamesOwned.toLocaleString()} label="Games" />
            <Stat
              value={stats.data.achievementsUnlocked.toLocaleString()}
              label="Achievements"
              tint={theme.accent}
            />
            <Stat
              value={stats.data.perfectGames.toLocaleString()}
              label="Perfect"
              tint={theme.platinum}
            />
          </View>

          <View style={styles.statFooter}>
            <Text variant="caption" color="textMuted">
              {formatPlaytime(Math.round(stats.data.avgPlaytimeMinutes))} average per played game
            </Text>
            {stats.data.achievementsTotal > 0 && (
              <Text variant="caption" color="textMuted">
                {completionPercent(stats.data.achievementsUnlocked, stats.data.achievementsTotal)}%
                complete
              </Text>
            )}
          </View>
        </View>
      ) : null}

      {/* --- Recently played --------------------------------------------- */}
      <GameRail
        title="Recently played"
        games={recentlyPlayed.data ?? []}
        loading={recentlyPlayed.isLoading}
        ownerId={profileId}
      />

      {/* --- Most played -------------------------------------------------- */}
      <GameRail
        title="Most played"
        games={mostPlayed.data ?? []}
        loading={mostPlayed.isLoading}
        ownerId={profileId}
      />

      {/* --- Achievement showcase ---------------------------------------- */}
      {(rarest.isLoading || (rarest.data && rarest.data.length > 0)) && (
        <Section
          title="Achievement showcase"
          action={
            <Link
              href={{ pathname: '/gaming-achievements/[id]', params: { id: profileId } }}
              asChild>
              <PressableScale accessibilityRole="button" scaleTo={0.94}>
                <Text variant="caption" color="primaryText">
                  See all
                </Text>
              </PressableScale>
            </Link>
          }>
          {rarest.isLoading ? (
            <RailSkeleton size={SHOWCASE_ICON} />
          ) : (
            <FlatList
              data={rarest.data ?? []}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `${item.appId}:${item.key}`}
              contentContainerStyle={styles.rail}
              renderItem={({ item }) => (
                <View style={styles.showcaseItem}>
                  <View style={[styles.showcaseIcon, { backgroundColor: theme.surfaceElevated }]}>
                    {item.iconUrl ? (
                      <Image
                        source={{ uri: item.iconUrl }}
                        style={styles.fillImage}
                        contentFit="cover"
                        transition={180}
                        accessibilityIgnoresInvertColors
                      />
                    ) : (
                      <Ionicons name="trophy" size={20} color={theme.platinum} />
                    )}
                  </View>
                  {item.globalPercent !== null && (
                    <Text variant="caption" style={{ color: theme.accent }}>
                      {item.globalPercent < 1
                        ? `${item.globalPercent.toFixed(1)}%`
                        : `${Math.round(item.globalPercent)}%`}
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </Section>
      )}

      {/* --- Inventory showcase ------------------------------------------ */}
      {inventory.data && inventory.data.length > 0 && (
        <Section
          // The showcase only loads 12 items, so the real total comes from a
          // count query rather than the length of what happens to be rendered.
          title={
            inventorySize.data ? `Inventory · ${inventorySize.data.toLocaleString()}` : 'Inventory'
          }
          action={
            <Link href={{ pathname: '/gaming-inventory/[id]', params: { id: profileId } }} asChild>
              <PressableScale accessibilityRole="button" scaleTo={0.94}>
                <Text variant="caption" color="primaryText">
                  See all
                </Text>
              </PressableScale>
            </Link>
          }>
          <FlatList
            data={inventory.data}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => `${item.appId}:${item.itemId}`}
            contentContainerStyle={styles.rail}
            renderItem={({ item }) => {
              const tint = rarityColor(item.rarityColor) ?? theme.border;
              return (
                <View
                  style={[
                    styles.invItem,
                    { backgroundColor: theme.surfaceElevated, borderColor: tint },
                  ]}>
                  {item.iconUrl ? (
                    <Image
                      source={{ uri: item.iconUrl }}
                      style={styles.fillImage}
                      contentFit="contain"
                      transition={180}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <Ionicons name="cube-outline" size={18} color={theme.textMuted} />
                  )}
                  {item.amount > 1 && (
                    <View style={[styles.amountPill, { backgroundColor: theme.scrim }]}>
                      <Text variant="caption" color="white">
                        ×{item.amount}
                      </Text>
                    </View>
                  )}
                </View>
              );
            }}
          />
        </Section>
      )}

      {/* --- Badges ------------------------------------------------------- */}
      {badges.data && badges.data.length > 0 && (
        <Section title={`Badges · ${badges.data.length}`}>
          <View style={styles.badgeSummary}>
            {account.level !== null && <LevelBadge level={account.level} />}
            {account.xp !== null && (
              <Text variant="caption" color="textMuted">
                {account.xp.toLocaleString()} XP
              </Text>
            )}
          </View>

          <FlatList
            data={badges.data.slice(0, 12)}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(badge) => badge.key}
            contentContainerStyle={styles.rail}
            renderItem={({ item }) => (
              <View style={styles.badgeItem}>
                <View
                  style={[
                    styles.badgeIcon,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: item.isYearsOfService ? theme.accent : theme.border,
                    },
                  ]}>
                  {item.iconUrl ? (
                    <Image
                      source={{ uri: item.iconUrl }}
                      style={styles.fillImage}
                      contentFit="cover"
                      transition={180}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <Ionicons
                      name={item.isYearsOfService ? 'ribbon' : 'shield-checkmark-outline'}
                      size={18}
                      color={item.isYearsOfService ? theme.accent : theme.textMuted}
                    />
                  )}
                </View>

                {item.level !== null && (
                  <Text variant="caption" color="textMuted">
                    {item.isYearsOfService ? `${item.level}y` : `Lv ${item.level}`}
                  </Text>
                )}
              </View>
            )}
          />
        </Section>
      )}

      {/* --- Friends on GameLog ------------------------------------------ */}
      {friends.data && friends.data.length > 0 && (
        <Section
          title="Steam friends here"
          action={
            friendTotal.data ? (
              <Text variant="caption" color="textMuted">
                {friends.data.length} of {friendTotal.data}
              </Text>
            ) : undefined
          }>
          <FlatList
            data={friends.data}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(friend) => friend.externalId}
            contentContainerStyle={styles.rail}
            renderItem={({ item }) =>
              item.matchedUserId ? (
                <Link
                  href={{ pathname: '/profile/[id]', params: { id: item.matchedUserId } }}
                  asChild>
                  <PressableScale
                    accessibilityRole="button"
                    scaleTo={0.94}
                    style={styles.friendItem}>
                    <Avatar
                      uri={item.profile?.avatar_url ?? item.avatarUrl}
                      name={item.profile ? displayNameFor(item.profile) : (item.handle ?? '?')}
                      size={44}
                    />
                    <Text variant="caption" numberOfLines={1} style={styles.friendName}>
                      {item.profile ? displayNameFor(item.profile) : (item.handle ?? 'Friend')}
                    </Text>
                  </PressableScale>
                </Link>
              ) : null
            }
          />
        </Section>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function LevelBadge({ level }: { level: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.levelBadge, { borderColor: theme.primary }]}>
      <Text variant="caption" style={{ color: theme.primary }}>
        {level}
      </Text>
    </View>
  );
}

function Stat({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="h5" style={tint ? { color: tint } : undefined}>
        {value}
      </Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Text variant="label" color="textSecondary">
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/** A horizontal rail of library posters, or nothing when there is nothing. */
function GameRail({
  title,
  games,
  loading,
  ownerId,
}: {
  title: string;
  games: Awaited<ReturnType<typeof getOwnedGames>>;
  loading: boolean;
  ownerId: string;
}) {
  /* The app's portrait width, as every rail's covers are; these were 78. */
  const posterWidth = usePortraitWidth();

  if (loading) {
    return (
      <Section title={title}>
        <RailSkeleton size={posterWidth} portrait />
      </Section>
    );
  }
  if (games.length === 0) return null;

  return (
    <Section title={title}>
      <FlatList
        data={games}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(game) => game.appId}
        contentContainerStyle={styles.rail}
        renderItem={({ item }) => <GameTile game={item} width={posterWidth} ownerId={ownerId} />}
      />
    </Section>
  );
}

function RailSkeleton({ size, portrait = false }: { size: number; portrait?: boolean }) {
  return (
    <View style={styles.rail}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton
          key={index}
          width={size}
          height={portrait ? size / (2 / 3) : size}
          radius={Radius.image}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.x16, paddingTop: Spacing.x16 },
  card: { paddingTop: Spacing.x16, gap: Spacing.x12, borderTopWidth: StyleSheet.hairlineWidth },
  identity: { flexDirection: 'row', gap: Spacing.x12, alignItems: 'center' },
  identityBody: { flex: 1, gap: 2 },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  handle: { flexShrink: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  dot: { width: 7, height: 7, borderRadius: Radius.pill },
  playingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x12,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  levelBadge: {
    minWidth: 26,
    paddingHorizontal: Spacing.x4 + 1,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  /* Still outlined: a privacy warning is an exception in the flow, not another
     section of it, and a rule alone would file it as one. */
  notice: {
    flexDirection: 'row',
    gap: Spacing.x8,
    padding: Spacing.x12,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
  },
  noticeText: { flex: 1 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: 1, flex: 1 },
  statFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.x12 },
  block: { gap: Spacing.x8 },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 1,
  },
  rail: { gap: Spacing.x8, paddingRight: Spacing.x16 },
  showcaseItem: { alignItems: 'center', gap: 2, width: SHOWCASE_ICON },
  showcaseIcon: {
    width: SHOWCASE_ICON,
    height: SHOWCASE_ICON,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fillImage: { width: '100%', height: '100%' },
  invItem: {
    width: 56,
    height: 56,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  amountPill: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    paddingHorizontal: Spacing.x4,
    borderRadius: Radius.image,
  },

  badgeSummary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  badgeItem: { alignItems: 'center', gap: 2 },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  friendItem: { alignItems: 'center', gap: Spacing.x4, width: 56 },
  friendName: { textAlign: 'center' },
});
