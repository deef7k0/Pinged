import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ROUND_ACTION } from '@/components/ui/round-action';
import { Spacing, Type } from '@/constants/theme';
import { useDiscRoom } from '@/hooks/use-header-height';

/**
 * What a copy's first screen holds under its stage, in dp, so the stage can be
 * given the rest: the caption (a title line and the line under it), the keys
 * (a round key and its word), and enough of whatever comes next to say there
 * is more.
 *
 * Here, not in `copy/[id]`, because the physical shelf's Cover Flow lands its
 * cover exactly where that screen's case will stand, and has to work the
 * stage out the same way.
 */
export const CAPTION_ROOM = Spacing.x16 + Type.h2.lineHeight + Spacing.x4 + Type.body.lineHeight;
export const KEYS_ROOM = Spacing.x20 + ROUND_ACTION + Spacing.x4 + 2 + Type.caption.lineHeight;
export const PEEK = Spacing.x48;

/** The height a copy's stage may take on this display: the first screen, less what sits under it. */
export function useStageRoom(): number {
  const { height } = useWindowDimensions();
  const header = useDiscRoom();
  const insets = useSafeAreaInsets();
  return height - header - insets.bottom - CAPTION_ROOM - KEYS_ROOM - PEEK;
}
