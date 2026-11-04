import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { memo } from 'react';

import { InfoCard } from '@/components/ui/info-card';
import { SelectionCard } from '@/components/ui/selection-card';
import { Text } from '@/components/ui/text';
import { GAME_LABEL_TEXT, type GameLabel } from '@/constants/game-labels';
import { setGameLabelLocally, useGameLabel } from '@/hooks/use-game-labels';
import { isModerator, setGameLabel } from '@/lib/api';
import type { Game } from '@/lib/games';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

const LABEL: GameLabel = 'must_play';

/**
 * A moderator's controls for one game, at the foot of its Overview.
 *
 * Today that is one box: Must Play (0034). Ticking it puts the badge on the
 * game's cover across the app, swaps the stats strip's last cell for the label,
 * and adds the game to the Must Play list; unticking takes all three back.
 *
 * **Nothing at all for anybody else** — not a disabled control, not a hint that
 * one exists. Whether you are a moderator is asked once and kept for the
 * session (the key Settings and the queue share), and the answer only decides
 * whether this draws: the write itself is refused by the table's policies for
 * everyone outside `public.moderators`.
 *
 * Its own component so the page that hosts it does not hold the query, the
 * mutation or the label's state — a game page re-rendering to tick a box would
 * re-render its masthead and every section with it.
 */
export const GameModeratorCard = memo(function GameModeratorCard({ game }: { game: Game }) {
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);
  const labelled = useGameLabel(game.id, LABEL);

  const moderator = useQuery({
    queryKey: ['is-moderator', userId],
    queryFn: isModerator,
    enabled: !!userId,
    /* Who moderates changes in the SQL editor, a few times ever. Without this
       every game page anybody opened would ask again. */
    staleTime: 30 * 60_000,
  });

  const label = useMutation({
    mutationFn: (on: boolean) => setGameLabel(userId!, game, LABEL, on),
    onSuccess: (_result, on) => {
      toast.success(on ? 'Labelled Must Play' : 'Must Play label removed');
      setGameLabelLocally(game.id, LABEL, on);
      queryClient.invalidateQueries({ queryKey: ['labelled-games', LABEL] });
      queryClient.invalidateQueries({ queryKey: ['labelled-game-ids', LABEL] });
    },
  });

  if (!userId || moderator.data !== true) return null;

  return (
    <InfoCard title="Moderation">
      <SelectionCard
        role="checkbox"
        title={GAME_LABEL_TEXT[LABEL].title}
        hint="Puts the badge on this game’s cover everywhere and lists it under Must Play."
        selected={labelled}
        disabled={label.isPending}
        onPress={() => label.mutate(!labelled)}
      />

      {label.isError && (
        <Text variant="bodySmall" color="danger">
          {label.error instanceof Error ? label.error.message : 'Could not change the label.'}
        </Text>
      )}
    </InfoCard>
  );
});
