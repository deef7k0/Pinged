import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { ProfileWidget } from '@/components/profile-section';
import { Button } from '@/components/ui/button';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { FAVOURITES, favouriteCoverWidth } from '@/constants/profile-layout';
import { FontFamily, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { removeFromList, type ListItem } from '@/lib/api';
import type { ProfileAchievementStats } from '@/lib/database.types';
import { toast } from '@/lib/toast';

/** Four across the page: a set of four, not a grid that happens to have four columns. */
const FAVORITE_COLUMNS = FAVOURITES.columns;

/**
 * The four favourites: a widget on the profile, its covers spanning the page.
 *
 * Under a hairline and a small heading (`<ProfileWidget>`), not in a card. For
 * about a week it was a box after a Letterboxd-style reference; the owner went
 * back to this layout and had the cards removed.
 */

/* Memoised: `items` comes through a shared empty-array constant while the
 * query is pending, so a loading profile does not defeat the compare. */
export const FavoritesWidget = memo(function FavoritesWidget({
  items,
  listId,
  isSelf,
  profileId,
}: {
  items: ListItem[];
  listId?: string;
  isSelf: boolean;
  /** Whose favourites: where Top 10 opens. */
  profileId?: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();

  /*
   * Editing your four, in place.
   *
   * Edit used to open the favourites collection, where nothing let you say
   * which game sat in which slot. Now it turns the row into a picker: tap a
   * game, then Replace it — the new game takes the same slot, so the order is
   * yours — or Remove it. An empty slot offers a +. Done puts it back.
   */
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /*
   * Four covers spanning the page: 79dp each on a 360dp phone, at the
   * profile's margin of ten. They were a fixed 52dp once, which left most of
   * the width empty and made someone's top four look like a footnote — this is
   * the one thing on a profile people screenshot.
   */
  const posterWidth = favouriteCoverWidth(Math.min(width, MaxContentWidth));
  const posterHeight = posterWidth / (2 / 3);

  const shown = items.slice(0, FAVORITE_COLUMNS);
  const selected = shown.find((item) => item.game_id === selectedId) ?? null;
  const canEdit = isSelf && !!listId;

  const remove = useMutation({
    mutationFn: (gameId: string) => removeFromList(listId!, gameId),
    onSuccess: () => {
      toast.success('Removed from your favourites');
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
      queryClient.invalidateQueries({ queryKey: ['list-membership'] });
    },
  });

  /** The picker, told to put its game in this one's slot and take this one out. */
  function replace(item: ListItem) {
    setSelectedId(null);
    router.push({
      pathname: '/add-to-list/[id]',
      params: { id: listId!, position: String(item.position), replace: item.game_id },
    });
  }

  /** The picker, told to put its game after the last of the four. */
  function addToEmptySlot() {
    const last = items.reduce((max, item) => Math.max(max, item.position), -1);
    router.push({
      pathname: '/add-to-list/[id]',
      params: { id: listId!, position: String(last + 1) },
    });
  }

  function toggleEditing() {
    setEditing((value) => !value);
    setSelectedId(null);
    remove.reset();
  }

  return (
    <ProfileWidget
      title="Favourites"
      icon="star"
      action={
        <View style={styles.actions}>
          {/* Their Top 10: every favourite, full screen (the owner's,
              2026-11-03). Anyone's, once there is one to show. */}
          {items.length > 0 && !editing && profileId && (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={isSelf ? 'Your Top 10' : 'Their Top 10'}
              onPress={() => router.push({ pathname: '/top-ten/[id]', params: { id: profileId } })}
              scaleTo={0.92}
              hitSlop={Spacing.x12}
              style={StyleSheet.flatten([styles.topTen, { backgroundColor: theme.controlFill }])}>
              <Ionicons name="trophy-outline" size={13} color={theme.text} />
              <Text variant="bodySmall" style={styles.topTenLabel}>
                Top 10
              </Text>
            </PressableScale>
          )}
          {canEdit && (
            /* `hitSlop` rather than padding so the word stays small while the
             target clears the floor. */
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={editing ? 'Done editing favourites' : 'Edit favourites'}
              accessibilityState={{ expanded: editing }}
              onPress={toggleEditing}
              scaleTo={0.9}
              hitSlop={Spacing.x16}
              style={styles.editLink}>
              <Text variant="bodySmall" color="primaryText">
                {editing ? 'Done' : 'Edit'}
              </Text>
            </PressableScale>
          )}
        </View>
      }>
      {shown.length > 0 || editing ? (
        <View style={styles.posters}>
          {shown.map((item, index) => {
            const title = item.game?.title ?? 'Favourite game';
            const poster = (
              <Poster
                coverUrl={item.game?.cover_url}
                heroUrl={item.game?.hero_url}
                title={item.game?.title}
                /* No `gameId`, so no Must Play badge: the owner took it off
                   the profile's two rows of covers (2026-10-15). */
                width={posterWidth}
                rounded="image"
              />
            );

            if (!editing) {
              return (
                <Link
                  key={item.game_id}
                  href={{ pathname: '/game/[id]', params: { id: item.game_id } }}
                  asChild>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={title}
                    scaleTo={0.94}>
                    {poster}
                  </PressableScale>
                </Link>
              );
            }

            const isSelected = item.game_id === selectedId;
            return (
              <PressableScale
                key={item.game_id}
                accessibilityRole="button"
                accessibilityLabel={`${title}, favourite ${index + 1}`}
                accessibilityHint="Select it to replace or remove it"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedId(isSelected ? null : item.game_id)}
                scaleTo={0.94}
                /* The others step back while one is chosen, so it is clear which
                   one Replace and Remove are about. */
                style={selected && !isSelected ? styles.dimmed : undefined}>
                {poster}
                {/* A ring drawn over the art, inside its edge, so choosing a
                    game never moves the row. */}
                <View
                  pointerEvents="none"
                  style={[
                    styles.ring,
                    { borderColor: isSelected ? theme.primaryText : theme.borderStrong },
                    isSelected && styles.ringSelected,
                  ]}
                />
              </PressableScale>
            );
          })}

          {/* Empty slots so the row keeps its shape below four picks. While
              editing, each is a way to add one. */}
          {Array.from({ length: Math.max(0, FAVORITE_COLUMNS - shown.length) }).map((_, index) =>
            editing ? (
              <PressableScale
                key={`slot-${index}`}
                accessibilityRole="button"
                accessibilityLabel="Add a favourite"
                onPress={addToEmptySlot}
                scaleTo={0.94}
                style={StyleSheet.flatten([
                  styles.emptySlot,
                  styles.addSlot,
                  {
                    width: posterWidth,
                    height: posterHeight,
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.borderStrong,
                  },
                ])}>
                <Ionicons name="add" size={24} color={theme.textSecondary} />
              </PressableScale>
            ) : (
              <View
                key={`slot-${index}`}
                style={[
                  styles.emptySlot,
                  {
                    width: posterWidth,
                    height: posterHeight,
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                  },
                ]}
              />
            )
          )}
        </View>
      ) : (
        <Text variant="caption" color="textMuted">
          {isSelf
            ? 'Star up to ten games: your Top 10, the first four pinned here.'
            : 'No favourites yet.'}
        </Text>
      )}

      {/* What to do with the chosen game — or, until one is chosen, how. */}
      {editing &&
        (selected ? (
          <View style={[styles.editBar, styles.below]}>
            <Text variant="itemTitle" numberOfLines={1} style={styles.flex}>
              {selected.game?.title ?? 'Favourite game'}
            </Text>
            <Button
              title="Replace"
              variant="secondary"
              size="small"
              onPress={() => replace(selected)}
            />
            <Button
              title="Remove"
              variant="danger"
              size="small"
              loading={remove.isPending}
              onPress={() => remove.mutate(selected.game_id)}
            />
          </View>
        ) : (
          <Text variant="bodySmall" color="textMuted" style={styles.below}>
            Tap a game to replace or remove it.
          </Text>
        ))}

      {remove.isError && (
        <Text variant="bodySmall" color="danger" style={styles.below}>
          {remove.error instanceof Error
            ? remove.error.message
            : 'Could not remove it. Check your connection and try again.'}
        </Text>
      )}
    </ProfileWidget>
  );
});

/**
 * Achievements widget.
 *
 * Tapping through opens the per-game Steam achievement breakdown when a
 * `profileId` is supplied. The numbers shown here are the app's own logged
 * achievements; the screen behind it is the imported Steam picture, which is the
 * richer of the two and the one worth drilling into.
 */
export function AchievementsWidget({
  stats,
  profileId,
}: {
  stats?: ProfileAchievementStats;
  profileId?: string;
}) {
  const theme = useTheme();

  const body = (
    <View style={[styles.widget, { borderTopColor: theme.border }]}>
      <View style={styles.widgetHead}>
        <View style={styles.widgetTitle}>
          <Ionicons name="trophy" size={13} color={theme.platinum} />
          <Text variant="caption" color="textSecondary">
            ACHIEVEMENTS
          </Text>
        </View>
        {profileId && <Ionicons name="chevron-forward" size={13} color={theme.textMuted} />}
      </View>

      <View style={styles.statRow}>
        <Stat value={stats?.platinums} label="Platinum" tint={theme.platinum} />
        <Stat value={stats?.completions} label="100%" tint={theme.success} />
        <Stat value={stats?.achievements_unlocked} label="Unlocked" tint={theme.accent} />
        <Stat
          value={stats ? Math.round(stats.hours_played) : undefined}
          label="Hours"
          tint={theme.text}
        />
      </View>
    </View>
  );

  if (!profileId) return body;

  return (
    <Link href={{ pathname: '/gaming-achievements/[id]', params: { id: profileId } }} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Open achievements"
        scaleTo={0.98}
        style={styles.flex}>
        {body}
      </PressableScale>
    </Link>
  );
}

function Stat({ value, label, tint }: { value?: number; label: string; tint: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="h5" style={{ color: tint }}>
        {value ?? '—'}
      </Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  widget: {
    flex: 1,
    gap: Spacing.x8,
    paddingTop: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  widgetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  widgetTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  /* Padded on the side facing the title only, so the word ends on the page's
     margin — where the last cover ends, and "View all" under it. Nothing
     vertical: the heading row's height is set by the title beside it, and
     `hitSlop` is what reaches the tap floor. */
  editLink: { paddingStart: Spacing.x8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  topTen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.x8 + 2,
    paddingVertical: 3,
    borderRadius: 999,
  },
  topTenLabel: { fontFamily: FontFamily.semibold },
  /* `space-between`, with eight as the least they may stand apart: the covers
     are whole dp, so a display that does not divide evenly has a dp or two left
     over, and it goes between them rather than after the last one. */
  posters: { flexDirection: 'row', justifyContent: 'space-between', gap: FAVOURITES.gap },
  /* What appears under the covers while they are being edited. */
  below: { marginTop: Spacing.x12 },
  emptySlot: {
    borderRadius: Radius.image,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  addSlot: { alignItems: 'center', justifyContent: 'center' },
  /* Over the art, at its corner, so it never changes the cover's size. */
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.image,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ringSelected: { borderWidth: 2 },
  dimmed: { opacity: 0.45 },
  editBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: 1, flex: 1 },
});
