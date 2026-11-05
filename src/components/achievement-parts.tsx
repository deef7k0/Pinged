import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Text } from '@/components/ui/text';
import { rarityFor } from '@/constants/rarity';
import { MaxContentWidth, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Three medallions across, as the Games app sets them. */
export const MEDALLION_COLUMNS = 3;
export const MEDALLION_GAP = Spacing.x12;

/** A medallion's width on this display, inside the page's margin. */
export function useMedallionWidth(): number {
  const { width } = useWindowDimensions();
  const inner = Math.min(width, MaxContentWidth) - Spacing.x16 * 2;
  return Math.floor((inner - MEDALLION_GAP * (MEDALLION_COLUMNS - 1)) / MEDALLION_COLUMNS);
}

/** A figure in a rounded tile: the value large, its label under it. */
export type AchievementFigure = { label: string; value: string };

/**
 * The head of an achievements page — the Games app's and Fitness' (the Apple
 * pass, 2026-11-05): the game's art across the top dissolving into the page,
 * an 88 ring of how much is unlocked with the count in it, and the figures as
 * rounded tiles in a row. It was a card holding "12 / 40", a percentage and a
 * thin bar.
 */
export function AchievementHead({
  artUrl,
  unlocked,
  total,
  color,
  background,
  figures,
  children,
}: {
  artUrl: string | null | undefined;
  unlocked: number;
  total: number;
  /** The ring's fill — the game's colour on its page. */
  color: string;
  /** The page's colour, which the art dissolves into. */
  background: string;
  figures: AchievementFigure[];
  /** Under the figures: a sync button, a notice. */
  children?: ReactNode;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const artHeight = Math.round(Math.min(width, MaxContentWidth) * 0.42);
  const share = total > 0 ? unlocked / total : 0;
  const complete = total > 0 && unlocked === total;

  return (
    <View style={styles.head}>
      {artUrl ? (
        <View style={[styles.art, { height: artHeight }]}>
          <Image
            source={{ uri: artUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            pointerEvents="none"
            colors={[withAlpha(background, 0.1), withAlpha(background, 0.55), background]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      <View style={[styles.ringRow, artUrl ? { marginTop: -Math.round(artHeight * 0.45) } : null]}>
        <ProgressRing
          progress={share}
          color={complete ? theme.platinum : color}
          accessibilityLabel={`${unlocked} of ${total} unlocked`}>
          {complete ? (
            <Ionicons name="trophy" size={28} color={theme.platinum} />
          ) : (
            <>
              <Text variant="h3">{unlocked}</Text>
              <Text variant="caption" color="textSecondary">
                {`of ${total}`}
              </Text>
            </>
          )}
        </ProgressRing>
      </View>

      {figures.length > 0 && (
        <View style={styles.figures}>
          {figures.map((figure) => (
            <View
              key={figure.label}
              accessible
              accessibilityLabel={`${figure.value} ${figure.label}`}
              style={[styles.figure, { backgroundColor: withAlpha(theme.text, 0.07) }]}>
              <Text variant="h3" numberOfLines={1} adjustsFontSizeToFit>
                {figure.value}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {figure.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {children}
    </View>
  );
}

/**
 * One achievement as a medallion: its round icon (35% while locked), its
 * name in two lines, and its rarity as a word in sentence case with the share
 * of players. A tap does what the page lets it — ticks one off, or nothing.
 */
export const AchievementMedallion = memo(function AchievementMedallion({
  name,
  description,
  iconUrl,
  unlocked,
  percent,
  width,
  accent,
  onPress,
  disabled,
}: {
  name: string;
  description?: string | null;
  iconUrl: string | null;
  unlocked: boolean;
  percent: number | null;
  width: number;
  /** The ring round an unlocked medallion. */
  accent: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const face = Math.min(72, width - Spacing.x16);
  const band = percent !== null ? rarityFor(percent) : null;
  const label = `${name}. ${unlocked ? 'Unlocked' : 'Locked'}${
    band ? `. ${band.label}, ${percent!.toFixed(1)}% of players` : ''
  }${description ? `. ${description}` : ''}`;

  const body = (
    <>
      <View>
        <View
          style={[
            styles.medal,
            {
              width: face,
              height: face,
              borderRadius: face / 2,
              borderColor: unlocked ? accent : 'transparent',
              backgroundColor: theme.surfaceElevated,
            },
          ]}>
          {iconUrl ? (
            <Image
              source={{ uri: iconUrl }}
              style={[styles.medalArt, { opacity: unlocked ? 1 : 0.35 }]}
              contentFit="cover"
              transition={150}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Ionicons
              name={unlocked ? 'medal' : 'medal-outline'}
              size={face * 0.42}
              color={unlocked ? theme.text : theme.textMuted}
            />
          )}
        </View>
        {!unlocked && (
          <View style={[styles.lock, { backgroundColor: theme.surfaceSelected }]}>
            <Ionicons name="lock-closed" size={11} color={theme.textSecondary} />
          </View>
        )}
      </View>
      <Text
        variant="bodySmall"
        color={unlocked ? 'text' : 'textSecondary'}
        numberOfLines={2}
        style={styles.centred}>
        {name}
      </Text>
      {band ? (
        <Text variant="caption" style={[styles.centred, { color: theme[band.token] }]}>
          {`${band.label} · ${percent!.toFixed(1)}%`}
        </Text>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={[styles.medallion, { width }]}>
        {body}
      </View>
    );
  }
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: unlocked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.95}
      style={StyleSheet.flatten([styles.medallion, { width }])}>
      {body}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  head: { gap: Spacing.x20, marginBottom: Spacing.x24 },
  art: { marginHorizontal: -Spacing.x16, overflow: 'hidden' },
  ringRow: { alignItems: 'center' },
  artHead: { marginBottom: Spacing.x20 },
  artTitle: { marginTop: -Spacing.x24 },
  figures: { flexDirection: 'row', gap: Spacing.x8 },
  figure: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x8,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  medallion: { alignItems: 'center', gap: Spacing.x4, paddingBottom: Spacing.x8 },
  medal: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: Spacing.x4,
  },
  medalArt: { width: '100%', height: '100%' },
  lock: {
    position: 'absolute',
    right: 0,
    bottom: Spacing.x4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centred: { textAlign: 'center' },
});

/**
 * A game's art across the top of a page about somebody's record of it,
 * dissolving into the page, with its name over the foot — the Games app's
 * (the Apple pass, 2026-11-05). Playthroughs' head.
 */
export function GameArtHead({
  artUrl,
  title,
  background,
}: {
  artUrl: string | null | undefined;
  title: string | null | undefined;
  background: string;
}) {
  const { width } = useWindowDimensions();
  const height = Math.round(Math.min(width, MaxContentWidth) * 0.42);
  return (
    <View style={styles.artHead}>
      {artUrl ? (
        <View style={[styles.art, { height }]}>
          <Image
            source={{ uri: artUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            pointerEvents="none"
            colors={[withAlpha(background, 0.1), withAlpha(background, 0.55), background]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      {title ? (
        <Text variant="h2" accessibilityRole="header" style={artUrl ? styles.artTitle : undefined}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}
