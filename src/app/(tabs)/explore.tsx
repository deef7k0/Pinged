import { DiscoverFeed } from '@/components/discover-feed';
import { Screen } from '@/components/ui/screen';

/**
 * Explore (the owner's, 2026-11-03): what the Search tab showed before
 * anything was typed, with nothing to type into — "It shows things on the
 * app." Its page is `<DiscoverFeed>`, from the top of the display: the hero
 * runs under the status bar, with the tab's name over it.
 */
export default function ExploreScreen() {
  return (
    <Screen edges={[]}>
      <DiscoverFeed />
    </Screen>
  );
}
