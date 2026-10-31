import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';

import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Radius } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

/** Edge of a round action. Past both tap floors. */
export const ROUND_ACTION = 48;

/**
 * A round control beside the title of the one game a screen is about.
 *
 * Not `<IconButton>`: that primitive is the toolbar circle — 40dp, the house
 * control surface and a 1px edge. These are Material 3 tonal transport keys for
 * the artwork above them, filled from the game's own palette at 48dp — the same
 * argument the vivid review button makes on the game page.
 *
 * **Two screens have them, in pairs, and nowhere else**: Surprise Me (bookmark
 * and skip) and a review (like and share). Both are one game's square art with
 * its title underneath. They kept their Material 3 treatment through the
 * control migration, as the game page's action row did.
 */
export function RoundAction({
  icon,
  label,
  onPress,
  selected = false,
  busy = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  selected?: boolean;
  busy?: boolean;
}) {
  const accent = useAccent();
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      scaleTo={0.96}
      style={StyleSheet.flatten([
        styles.round,
        busy && styles.busy,
        {
          /* M3's filled-tonal → filled pair, the same one the game page's action
             row uses. A saved bookmark or a like is a *state*, so it lights; skip
             and share are acts and stay tonal however many times they are
             pressed. */
          backgroundColor: selected ? accent.m3.primaryContainer : accent.m3.surfaceContainerHigh,
        },
      ])}>
      {/* It wobbles under the finger, and a like or a save pops (Convx's). */}
      <PressGlyph pop={selected}>
        <Ionicons
          name={icon}
          size={22}
          /* Measured against the fill directly behind it rather than against the
             page — the fill is the only thing under the glyph. */
          color={selected ? accent.m3.onPrimaryContainer : theme.text}
        />
      </PressGlyph>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  /* Circular: these are the transport controls for the card above them, not
     form buttons, and the round key is what every music player uses to say so. */
  round: {
    width: ROUND_ACTION,
    height: ROUND_ACTION,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { opacity: 0.5 },
});
