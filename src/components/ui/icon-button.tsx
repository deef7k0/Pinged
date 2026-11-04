import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';

import { GlassSurface, useLiquidGlass } from '@/components/ui/liquid-glass';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { TapTarget } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

export type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  /** Required: there is no label to fall back on. */
  accessibilityLabel: string;
  onPress?: () => void;
  size?: 'medium' | 'small';
  /** `danger` reddens the glyph; `plain` drops the fill. */
  tone?: 'default' | 'danger' | 'plain';
  active?: boolean;
  disabled?: boolean;
};

const SIZES = {
  medium: { box: 40, glyph: 19 },
  small: { box: 32, glyph: 16 },
} as const;

/**
 * A round button holding one glyph — close, more, add, remove, up, down.
 *
 * The owner's reference, SimpMusic's glyph keys: a circle in the same grey as
 * every action button (`controlFill`) and no edge — the round sibling of
 * `<Button>`. Drawn at 40 or 32 and touched at the platform floor's height —
 * the slop makes up the difference, so a row of these stays light without a
 * thumb missing one.
 *
 * `active` lights it in the accent — wash, edge and glyph — the same carriers
 * every selected control in the app uses. `danger` reddens the glyph. `plain`
 * drops the fill, for icons inside an already-drawn container — a row's
 * up/down/remove controls — where a disc behind each glyph would turn a tidy
 * row into a string of beads.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  size = 'medium',
  tone = 'default',
  active = false,
  disabled = false,
}: IconButtonProps) {
  const theme = useTheme();
  const accent = useAccent();
  const liquid = useLiquidGlass();
  const { box, glyph } = SIZES[size];
  /* Vertical only. These sit in rows — up, down, remove — and sideways slop
     would overlap a neighbour and hand its tap to whichever was drawn last. */
  const slop = Math.max(0, (TapTarget - box) / 2);
  const hitSlop = { top: slop, bottom: slop };

  const plain = tone === 'plain';
  const danger = tone === 'danger';

  const color = disabled
    ? theme.textMuted
    : danger
      ? theme.danger
      : active
        ? accent.onSurface
        : plain
          ? theme.textSecondary
          : theme.text;

  /* The reference's glyph key: the action fill and no edge. Only `active` —
     a key that is *on* — takes the selected look, wash and edge. */
  const glass = liquid && !plain && !active;
  const fill = plain || glass ? 'transparent' : active ? accent.wash : theme.controlFill;
  const edge = active ? accent.edge : 'transparent';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      /* Light: the glyph is what answers (`<PressGlyph>`, Convx's wobble). */
      scaleTo={0.96}
      pressedColor={plain ? theme.pressed : active ? accent.ring : theme.controlPressed}
      focusRing={accent.ring}
      style={StyleSheet.flatten([
        styles.base,
        { width: box, height: box, borderRadius: box / 2 },
        { backgroundColor: fill, borderColor: edge },
        disabled && styles.inert,
      ])}>
      {/* Settings → Liquid glass: a resting key is glass; an "on" key keeps
          its wash, so its state still reads. */}
      {glass && <GlassSurface radius={box / 2} flat />}
      <PressGlyph pop={active}>
        <Ionicons name={icon} size={glyph} color={color} />
      </PressGlyph>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  /* The glyph goes to `textMuted` as well, so a disabled key is not told apart
     by opacity alone. */
  inert: { opacity: 0.6 },
});
