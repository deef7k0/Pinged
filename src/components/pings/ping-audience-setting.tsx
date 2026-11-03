import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { SelectionCard } from '@/components/ui/selection-card';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { getPingAudience, isPingsNotReady, setPingAudience } from '@/lib/api';
import type { PingAudience } from '@/lib/database.types';
import { DEFAULT_PING_AUDIENCE, PING_AUDIENCES } from '@/lib/pings';

/**
 * Settings → Pings: who may ping you. Anyone who follows you (the default),
 * people you follow back, or friends only — the owner's three, in their order.
 *
 * It is a real switch over something the database enforces (0046's
 * `can_ping`), which is this screen's test for being here: the sender's sheet
 * stops offering you the moment it changes, and a ping already on its way is
 * refused with the reason in words.
 *
 * Kept in `ping_preferences`, readable only by you — who you take pings from
 * is not on your public profile. Chosen optimistically: the card moves at
 * once, and goes back if the write fails.
 */
export function PingAudienceSetting({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const key = ['ping-audience', userId];

  const audience = useQuery({
    queryKey: key,
    queryFn: () => getPingAudience(userId),
  });

  const choose = useMutation({
    mutationFn: (next: PingAudience) => setPingAudience(userId, next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PingAudience>(key);
      queryClient.setQueryData(key, next);
      return { previous };
    },
    onError: (_error, _next, context) => {
      queryClient.setQueryData(key, context?.previous ?? DEFAULT_PING_AUDIENCE);
    },
    onSuccess: () => {
      /* Your own picker answers about the people you can ping, not who can
         ping you; nothing else on this phone reads it. */
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  if (audience.isLoadingError && isPingsNotReady(audience.error)) {
    return (
      <Text variant="bodySmall" color="textMuted">
        Choosing who can ping you arrives with the database’s next update. Until then, anyone who
        follows you can.
      </Text>
    );
  }

  const value = audience.data ?? DEFAULT_PING_AUDIENCE;

  return (
    <View style={styles.group}>
      <Text variant="bodySmall" color="textSecondary">
        Who can send you games, reviews, collections, events and soundtracks.
      </Text>
      <View style={styles.choices} accessibilityRole="radiogroup">
        {PING_AUDIENCES.map((option) => (
          <SelectionCard
            key={option.value}
            title={option.label}
            hint={option.hint}
            selected={value === option.value}
            disabled={audience.isPending}
            onPress={() => {
              if (option.value !== value) choose.mutate(option.value);
            }}
          />
        ))}
      </View>
      {choose.isError && !isPingsNotReady(choose.error) && (
        <Text variant="bodySmall" color="danger">
          {choose.error instanceof Error ? choose.error.message : 'Could not save that.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.x8 },
  choices: { gap: Spacing.x8 },
});
