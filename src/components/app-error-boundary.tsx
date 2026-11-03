import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { queryClient } from '@/lib/query-client';
import { forgetQueryCache } from '@/lib/query-persist';

/**
 * What the app shows when a screen throws while rendering.
 *
 * Exported from the root layout as `ErrorBoundary`, which Expo Router wraps
 * the whole app in. There was none: a render error closed a release build.
 *
 * ## Why it empties the query cache
 *
 * Since queries are kept on the device between launches (`lib/query-persist`),
 * a screen can be handed data an older build wrote. Everything written is
 * checked to be plain JSON and stamped with a version, and a launch that dies
 * early drops the lot — but a screen deep in the app that cannot read an old
 * row would otherwise throw every time it was opened, for a week, because the
 * refetch that would replace the row never gets to finish. So a render error
 * anywhere forgets what was saved, in memory and on disk. If the cache was the
 * cause, "Try again" works; if it was not, nothing was lost but a warm start.
 *
 * ## Why it is built from so little
 *
 * It replaces the root layout, so nothing the layout provides exists here: no
 * safe-area provider, no query provider, no navigator. Hence a plain `<View>`
 * with its own padding rather than `<Screen>`, which reads the insets.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();

  useEffect(() => {
    queryClient.clear();
    void forgetQueryCache();
  }, []);

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <Text variant="h2" accessibilityRole="header">
        Something went wrong
      </Text>
      <Text variant="body" color="textSecondary">
        This screen could not be shown. What Pinged had saved on this phone to open faster has been
        cleared, in case that was the cause — nothing in your account is affected.
      </Text>
      {__DEV__ && (
        <Text variant="bodySmall" color="textMuted" numberOfLines={6}>
          {error.message}
        </Text>
      )}
      <Button title="Try again" onPress={() => void retry()} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.x16,
    paddingHorizontal: Spacing.x24,
  },
});
