import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ReportTarget } from '@/lib/api';
import { useAuth } from '@/store/auth';

/**
 * The one screen every flag opens, for any target.
 *
 * `game` is only read for a pick: it is the side of the pair you came from, so
 * the form can say "Hades, as a game like Cult of the Lamb" rather than a bare
 * pair of titles.
 */
export function reportHref(target: ReportTarget, game?: string) {
  const pathname = '/report/[kind]/[id]' as const;
  switch (target.kind) {
    case 'pick':
      return { pathname, params: { kind: 'pick', id: target.pairId, ...(game ? { game } : {}) } };
    case 'suggestion':
      return {
        pathname,
        params: { kind: 'suggestion', id: target.pairId, author: target.authorId },
      };
    case 'review':
      return { pathname, params: { kind: 'review', id: target.logId } };
    case 'comment':
    case 'wall_post':
    case 'profile':
    case 'ping':
    case 'ping_suggestion':
      return {
        pathname,
        params: { kind: target.kind, id: target.targetId, author: target.authorId },
      };
  }
}

/**
 * Whether the person looking can report something `authorId` wrote: signed in,
 * and not its author. For callers that lay out around the flag — the flag
 * itself asks the same question and draws nothing when the answer is no.
 */
export function useCanReport(authorId: string | null | undefined): boolean {
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  return !!viewerId && viewerId !== authorId;
}

/**
 * Lifts a 14px glyph to the platform floor without making the row it sits in
 * any taller — the same trade the heart beside it makes.
 *
 * Short on the left, because the flag always ends a row whose other control —
 * a heart, an upvote — is to its left, and two touch areas that overlap send a
 * tap meant for one to the other. A caller keeps the gap to that neighbour wider
 * than the two slops reaching into it.
 */
const FLAG_SLOP = { top: 14, bottom: 14, left: 8, right: 12 };

/**
 * Report this. A flag, and on its own page a word beside it.
 *
 * **Quiet on purpose.** It sits on every review and every suggestion, and the
 * right number of times to use it is almost never: `textMuted`, the size of the
 * heart it usually sits beside, and never a hue — red would read as an alarm
 * already raised rather than one you could raise.
 *
 * It opens a screen rather than an alert. The first version was an alert with
 * a button per reason, and Android draws at most three buttons: with three
 * reasons and Cancel, Cancel was the one it dropped, so the dialog could not be
 * dismissed without filing a report.
 *
 * Draws nothing when signed out or when the viewer wrote the thing.
 */
export function ReportFlag({
  target,
  authorId,
  label,
  game,
  withWord = false,
  onBeforeOpen,
}: {
  target: ReportTarget;
  /** Who wrote it. Omit for a pick, which belongs to nobody. */
  authorId?: string | null;
  /** Says what is being reported: "Report Ada’s review". */
  label: string;
  game?: string;
  /** "⚑ Report", for a page with room for the word; a bare flag otherwise. */
  withWord?: boolean;
  /** Called first — a sheet closing itself before the report form opens over it. */
  onBeforeOpen?: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const canReport = useCanReport(authorId);

  if (!canReport) return null;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the report form"
      onPress={() => {
        onBeforeOpen?.();
        router.push(reportHref(target, game));
      }}
      hitSlop={FLAG_SLOP}
      scaleTo={0.9}
      style={StyleSheet.flatten(styles.flag)}>
      <Ionicons name="flag-outline" size={withWord ? 15 : 14} color={theme.textMuted} />
      {withWord && (
        <Text variant="bodySmall" color="textMuted">
          Report
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
});
