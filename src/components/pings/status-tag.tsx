import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PingFeedRow } from '@/lib/database.types';
import { PING_STATUS_LABEL } from '@/lib/pings';

/** Found or Closed, quiet: a fact about the request, not a control. */
export function StatusTag({ status }: { status: PingFeedRow['status'] }) {
  const theme = useTheme();
  const found = status === 'found';
  return (
    <View
      style={[
        styles.status,
        { backgroundColor: found ? theme.primaryMuted : theme.surfaceSelected },
      ]}>
      <Ionicons
        name={found ? 'checkmark-circle' : 'lock-closed'}
        size={11}
        color={found ? theme.primaryText : theme.textMuted}
      />
      <Text variant="caption" style={{ color: found ? theme.primaryText : theme.textSecondary }}>
        {PING_STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x8,
    height: 22,
    borderRadius: Radius.pill,
  },
});
