import type { AccentRoles } from '../constants/theme';
import { ensureContrast, mix, saturate } from './color';

/**
 * A control filled with the game's colour, and the ink on it — SimpMusic's
 * rule, read from its Now Playing (`ExpressiveTransportRow.kt`): a filled
 * Material button draws its icon and its words in the fill's own paired role,
 * `onPrimary` on `primary`, never a plain black or white. So the ink is the
 * seed's hue at its darkest tone, and the button reads as one object in one
 * colour (the owner's direction, 2026-10-17).
 *
 * The game page's filled pills take it: the review button, an action key
 * once it is on, and the platform dropdown. A key that is off stays on the
 * page's neutral surface.
 *
 * **The fill is `primary` with its saturation lifted to `VIVID_FLOOR`.** A
 * muted cover lands its primary around 0.45 HSL saturation, which on a
 * near-black page reads closer to slate than to the game's colour; 0.72 is a
 * floor, so an already vivid extraction is left where it was. Lifting it
 * moves the fill's luminance a little, so the ink is checked against the fill
 * that ships and pushed to 4.5:1 only if it fell short — `onPrimary` is tone
 * 10 against tone 60 and measures about 5.4:1 before the lift.
 */
export const VIVID_FLOOR = 0.72;

/** How far a filled control deepens toward its ink while held. */
const PRESSED_DEPTH = 0.14;

export type FilledRoles = { fill: string; ink: string; pressed: string };

export function filledRoles(accent: AccentRoles): FilledRoles {
  const fill = saturate(accent.color, VIVID_FLOOR);
  const ink = ensureContrast(accent.ink, fill, 4.5);
  return { fill, ink, pressed: mix(fill, ink, PRESSED_DEPTH) };
}
