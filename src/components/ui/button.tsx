import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View, type PressableProps } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import {
  ControlHeight,
  Elevation,
  Radius,
  SmallControlSlop,
  Spacing,
  Type,
  withAlpha,
} from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { filledRoles } from '@/lib/filled';
import { Loader } from '@/components/ui/loader';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'large' | 'medium' | 'small';
type Tone = 'default' | 'vivid';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  /**
   * `default` is the grey pill every button is.
   *
   * `vivid` fills the pill with the accent in force (`filledRoles`), its words
   * and icon in the fill's own `onPrimary`. **For the game page's "Write a review", and nothing else** —
   * the one button whose Material 3 treatment was kept through the move to the
   * grey pill: it sits above a row of tonal keys built from the same palette,
   * on a page filled with that palette's darkest tone, and it is the button the
   * whole screen exists for. A second vivid button anywhere would spend the one
   * signal this has.
   */
  tone?: Tone;
  loading?: boolean;
  /** Stretch to fill the parent's cross axis. */
  fullWidth?: boolean;
  /** Leading glyph. Sits inside the label group, not pinned to the edge. */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Trailing count, in a recessed pill — "Messages 18".
   *
   * A darker inset rather than a coloured badge: the number is context for the
   * label, not an alert. Anything that genuinely demands attention uses a
   * `danger` dot instead, which is why this one is deliberately quiet.
   */
  count?: number | null;
  /**
   * Which depth tier to cast at. **`none` by default** — a control in this
   * language is drawn by its fill and its 1px edge, not by a shadow.
   *
   * Exists for one situation and should not spread past it: a `primary` button
   * on a screen whose *background carries the same hue as its fill*. On a game
   * page the page is read out of the box art and the accent is read out of the
   * same art, so the button and the page behind it are the same colour and the
   * edge between them stops existing. There is no fill or ink change available —
   * both are already the accent by design — so the separation has to come from
   * depth. The game page's review button passes `raised`, and nothing else
   * passes anything. Ghost keeps `none` whatever is passed — Android needs an
   * opaque background to draw a shadow against.
   */
  elevation?: keyof typeof Elevation;
};

/**
 * The app's button. Four variants, one object.
 *
 * **Every action is the same grey pill** — the owner's reference, SimpMusic's
 * "Create room", measured: 52dp, fully round, filled `controlFill` (#181818 on
 * black), a small semibold label in the middle. The variants change the label,
 * not the object:
 *
 *  - `primary`   the label a step brighter (`text`). The one thing on a screen
 *                you are most likely to want; at most one per screen.
 *  - `secondary` the label in `controlInk`, the reference's soft grey.
 *  - `ghost`     no fill at all — a text action, like the reference's
 *                "Connect". It gains a faint fill only while held.
 *  - `danger`    the same pill with a red label. Destructive must not look safe,
 *                and must not outshout the artwork beside it either.
 *
 * Choices are never drawn like this: a selectable control is outlined
 * (`useSelectable`, `<SelectionCard>`), so an action and a choice cannot be
 * mistaken for each other.
 *
 * **The one exception is `tone="vivid"`**, the game page's "Write a review":
 * the Material 3 cluster there keeps its own treatment, a pill filled with the
 * game's colour.
 *
 * **Every state is drawn, not faded.** Held, the fill brightens a step
 * (`controlPressed`) and the button sinks 3%. Focused from a keyboard, it wears
 * the accent's ring. Disabled, it is the reference's disabled "Join room": no
 * fill, a faint edge and a dimmed label — told apart by shape as well as by
 * brightness, and still readable enough to say why it is there.
 *
 * 52dp tall (60 when large, 36 when small — lifted to the tap floor by slop).
 */
export function Button({
  title,
  variant = 'primary',
  size = 'medium',
  tone = 'default',
  loading = false,
  fullWidth = false,
  icon,
  count,
  disabled,
  elevation = 'none',
  hitSlop,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const accent = useAccent();
  const isInert = disabled || loading;
  /* Loading keeps the button's own colours — it is working, not unavailable —
     so only a genuinely disabled button takes the inert treatment. */
  const unavailable = !!disabled && !loading;
  const small = size === 'small';
  const large = size === 'large';

  /* The game's colour, and its words and icon in the fill's own `onPrimary`
     — SimpMusic's rule, in `filledRoles`. */
  const vivid = tone === 'vivid';
  const filled = filledRoles(accent);

  /*
   * One look for every action, the owner's reference measured: SimpMusic's
   * "Create room" — a grey pill (`controlFill`, #181818 on black) with a small
   * soft label. Variants change the *label*, not the object: `primary` is a
   * step brighter, `danger` is red. The only fill that is not grey is the game
   * page's vivid review button, whose Material 3 treatment is preserved.
   */
  const look = unavailable
    ? {
        /* The reference's disabled "Join room": no fill, a faint edge, and the
           label dimmed — told apart from an enabled button by shape as well as
           by brightness, never by opacity alone. */
        background: 'transparent',
        edge: variant === 'ghost' ? 'transparent' : theme.borderStrong,
        foreground: theme.textMuted,
        pressed: undefined,
      }
    : vivid
      ? {
          background: filled.fill,
          /* Transparent rather than the fill: the background paints under the
             border, so the edge deepens with the fill while held instead of
             staying behind as a lighter 1px ring. */
          edge: 'transparent',
          foreground: filled.ink,
          pressed: filled.pressed,
        }
      : {
          primary: {
            background: theme.controlFill,
            edge: 'transparent',
            foreground: theme.text,
            pressed: theme.controlPressed,
          },
          secondary: {
            background: theme.controlFill,
            edge: 'transparent',
            foreground: theme.controlInk,
            pressed: theme.controlPressed,
          },
          ghost: {
            background: 'transparent',
            edge: 'transparent',
            foreground: theme.text,
            pressed: theme.pressed,
          },
          danger: {
            background: theme.controlFill,
            edge: 'transparent',
            foreground: theme.danger,
            pressed: theme.controlPressed,
          },
        }[variant];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isInert, busy: loading }}
      accessibilityLabel={count != null ? `${title}, ${count}` : title}
      disabled={isInert}
      scaleTo={0.97}
      pressedColor={look.pressed}
      focusRing={accent.ring}
      /* A small button is drawn at 32 and touched at the platform floor. */
      hitSlop={hitSlop ?? (small ? SmallControlSlop : undefined)}
      style={StyleSheet.flatten([
        styles.base,
        small ? styles.small : large ? styles.large : styles.medium,
        /* Ghost has no fill, so it stays flat — Android's elevation needs an
           opaque background to draw against, and a floating transparent
           rectangle would read as a bug rather than as depth. */
        variant === 'ghost' || unavailable ? Elevation.none : Elevation[elevation],
        { backgroundColor: look.background, borderColor: look.edge },
        fullWidth && styles.fullWidth,
      ])}
      {...rest}>
      {/* Keep the label mounted while loading so the button does not resize. */}
      {loading && (
        <View style={styles.spinner}>
          <Loader size="small" color={look.foreground} />
        </View>
      )}

      <View style={[styles.content, { opacity: loading ? 0 : 1 }]}>
        {icon && (
          <Ionicons name={icon} size={small ? 15 : large ? 20 : 17} color={look.foreground} />
        )}

        <Text
          style={[
            styles.label,
            small && styles.labelSmall,
            large && styles.labelLarge,
            { color: look.foreground },
          ]}
          numberOfLines={1}>
          {title}
        </Text>

        {count != null && (
          <View
            style={[
              styles.count,
              {
                // A recess in the label's own ink, so it reads on the grey
                // pill and on the vivid fill alike.
                backgroundColor: withAlpha(look.foreground, 0.12),
              },
            ]}>
            <Text style={[styles.countLabel, { color: look.foreground }]}>{count}</Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  /* A full pill at every size, as the reference's buttons are. A 1px edge on
     every variant, transparent where the variant has none, so switching to the
     outlined disabled look never moves the label by a pixel. */
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  /* 52, the reference's — past both platforms' floors on its own. */
  medium: {
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x20,
    minHeight: ControlHeight.medium,
  },
  /* 32 drawn, the tap floor through `SmallControlSlop`. `small` is for a button
     inside a row or a card, where a 52dp pill would outweigh what it acts on. */
  small: {
    paddingVertical: Spacing.x4,
    paddingHorizontal: Spacing.x16,
    minHeight: ControlHeight.small,
  },
  /* 60, for the one action a screen is *about*. Well past the tap floor, which
     is not the point — the point is that it has to out-weigh a row of tonal
     controls sitting directly under it and still read as the thing you came to
     press. */
  large: {
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x20,
    minHeight: ControlHeight.large,
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  label: { ...Type.button },
  /* `body`'s 13 on `button`'s family — the same size as a medium label now that
     `body` is the reference's 13. A small button is smaller by its height. */
  labelSmall: { fontSize: Type.body.fontSize, lineHeight: Type.body.lineHeight },
  /* `h4`'s size on `button`'s family: the hero has to hold the middle of a 60dp
     slab without the word floating in it. 16, the reference's `labelMedium`. */
  labelLarge: { fontSize: Type.h4.fontSize, lineHeight: Type.h4.lineHeight },
  count: {
    minWidth: 22,
    paddingHorizontal: Spacing.x4,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countLabel: { ...Type.h6 },
  spinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
