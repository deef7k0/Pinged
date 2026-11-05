import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageSectionList } from '@/components/ui/page-scroll';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGamingSync, useLinkedAccount } from '@/hooks/use-gaming';
import { getInventory } from '@/lib/api';
import { rarityColor } from '@/lib/gaming';
import { useAuth } from '@/store/auth';
import type { InventoryItem } from '@/lib/gaming';

const ITEM_ICON = 48;

/**
 * Labels for the inventories we sync.
 *
 * Duplicated from the Edge Function's `SUPPORTED_INVENTORIES` rather than shared,
 * because the app bundle and the Deno function do not share a module graph. Only
 * the display name lives here — appids and context ids stay server-side where the
 * fetching happens.
 */
const APP_LABELS: Record<string, string> = {
  '730': 'Counter-Strike 2',
  '440': 'Team Fortress 2',
  '570': 'Dota 2',
  '252490': 'Rust',
  '753': 'Steam Community',
};

function appLabel(appId: string): string {
  return APP_LABELS[appId] ?? `App ${appId}`;
}

/**
 * Steam inventory, grouped by game.
 *
 * Items arrive pre-ranked by rarity from the sync service, so the most
 * interesting things in each backpack lead. There is deliberately no value
 * column: no pricing API is integrated, and inventing a number would be worse
 * than omitting one. `marketHashName` is carried on every item so a price
 * provider can be layered on later without touching this screen's data flow.
 */
export default function GamingInventoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isSelf = viewerId === id;

  const account = useLinkedAccount(id ?? null);
  useGamingSync({ userId: id ?? null, enabled: isSelf, sections: ['inventory'] });

  const inventory = useQuery({
    queryKey: ['gaming-inventory', 'steam', id],
    queryFn: () => getInventory(id!),
    enabled: !!id,
  });

  if (!id) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Inventory" />}>
        <EmptyState icon="search" title="Not found" />
      </Screen>
    );
  }

  const items = inventory.data ?? [];

  // Group into sections, preserving the rarity ordering the query returned.
  const grouped = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const bucket = grouped.get(item.appId);
    if (bucket) bucket.push(item);
    else grouped.set(item.appId, [item]);
  }

  const sections = Array.from(grouped, ([appId, data]) => ({
    appId,
    title: appLabel(appId),
    data,
  }));

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Inventory" />}>
      <PageSectionList
        sections={sections}
        keyExtractor={(item) => `${item.appId}:${item.itemId}`}
        renderItem={({ item }) => <ItemRow item={item} />}
        renderSectionHeader={({ section }) => (
          <SectionHeading title={section.title} count={section.data.length} />
        )}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          items.length > 0 ? (
            <Text variant="bodySmall" color="textMuted" style={styles.summary}>
              {items.length.toLocaleString()} {items.length === 1 ? 'item' : 'items'} across{' '}
              {sections.length} {sections.length === 1 ? 'inventory' : 'inventories'}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          inventory.isLoading ? (
            <View style={styles.skeleton}>
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} width="100%" height={64} radius={Radius.image} />
              ))}
            </View>
          ) : inventory.isLoadingError ? (
            <ErrorState error={inventory.error} />
          ) : !account.data ? (
            <EmptyState
              icon="logo-steam"
              title="No Steam account linked"
              message={isSelf ? 'Connect Steam from your profile.' : 'Nothing to show.'}
            />
          ) : (
            <EmptyState
              title="Profile is Private"
              message="Steam inventories must be public to import them. An empty inventory looks the same from outside."
            />
          )
        }
      />
    </Screen>
  );
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeading}>
      <Text variant="label" color="textSecondary">
        {title}
      </Text>
      <Text variant="caption" color="textMuted">
        {count}
      </Text>
    </View>
  );
}

function ItemRow({ item }: { item: InventoryItem }) {
  const theme = useTheme();
  // Steam sends rarity colour as bare hex; fall back to a border colour rather
  // than painting the accent stripe transparent.
  const tint = rarityColor(item.rarityColor) ?? theme.borderStrong;

  return (
    <View style={[styles.item, { borderTopColor: theme.border }]}>
      {/* Rarity as a colour stripe — Steam's own hex, so a Covert skin reads red
          and a Mil-Spec reads blue exactly as it does in game. */}
      <View style={[styles.rarityStripe, { backgroundColor: tint }]} />

      <View style={[styles.itemIcon, { backgroundColor: theme.surfaceElevated }]}>
        {item.iconUrl ? (
          <Image
            source={{ uri: item.iconUrl }}
            style={styles.itemImage}
            contentFit="contain"
            transition={180}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Ionicons name="cube-outline" size={20} color={theme.textMuted} />
        )}
      </View>

      <View style={styles.itemBody}>
        <Text variant="h5" numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.itemMeta}>
          {item.rarity && (
            <Text variant="caption" style={{ color: tint }}>
              {item.rarity}
            </Text>
          )}
          {item.type && (
            <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.itemType}>
              {item.type}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.itemRight}>
        {item.amount > 1 && (
          <Text variant="bodySmall" color="textSecondary">
            ×{item.amount}
          </Text>
        )}
        {item.marketable && <Ionicons name="pricetag-outline" size={12} color={theme.textMuted} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48 },
  summary: { paddingVertical: Spacing.x12 },
  skeleton: { gap: Spacing.x8, paddingTop: Spacing.x16 },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.x16,
    paddingBottom: Spacing.x8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  /* The rarity stripe survived the de-bubble: it is data — Steam's own colour
     for the item — not decoration on a container. */
  rarityStripe: { width: 3, alignSelf: 'stretch', borderRadius: Radius.pill },
  itemIcon: {
    width: ITEM_ICON,
    height: ITEM_ICON,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.x8,
    overflow: 'hidden',
  },
  itemImage: { width: '100%', height: '100%' },
  itemBody: { flex: 1, gap: 1, paddingVertical: Spacing.x8 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  itemType: { flex: 1 },
  itemRight: { alignItems: 'flex-end', gap: Spacing.x4 },
});
