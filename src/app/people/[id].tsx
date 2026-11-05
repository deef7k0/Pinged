import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { PersonRow } from '@/components/person-row';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { Button } from '@/components/ui/button';
import { PageFlatList } from '@/components/ui/page-scroll';
import { Spacing } from '@/constants/theme';
import { getFollowers, getFollowing, getFriends, getProfile } from '@/lib/api';
import { displayNameFor } from '@/lib/format';

type PeopleTab = 'followers' | 'following' | 'friends';

const TABS: { key: PeopleTab; label: string }[] = [
  { key: 'followers', label: 'Followers' },
  { key: 'following', label: 'Following' },
  { key: 'friends', label: 'Friends' },
];

function isTab(value: string | undefined): value is PeopleTab {
  return value === 'followers' || value === 'following' || value === 'friends';
}

/**
 * The people behind a profile's counts.
 *
 * This screen did not exist. The profile has rendered Followers, Following and
 * Friends in the tappable-count idiom every social app uses — bold number, muted
 * label, side by side — since it was written, and none of them led anywhere,
 * because there was no route to lead to. The layout made a promise the app could
 * not keep, and it stranded the product's own social pillar: you could
 * accumulate followers and never once see who they were.
 *
 * **One screen, three lists, not three screens.** Followers, Following and
 * Friends are the same shape — a list of people — and the question a visitor has
 * is usually comparative ("do we know the same people?"). Splitting them across
 * routes would make that a back-and-forth; a tab strip makes it a tap. It is
 * also why the count that was tapped preselects its own tab rather than always
 * opening on the first.
 */
export default function PeopleScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();

  /* Seeded from the param, then owned locally — the tab is a starting point
     rather than a controlled value, so switching tabs does not push a new route
     and fill the back stack with the same screen three times. */
  const [tab, setTab] = useState<PeopleTab>(isTab(initialTab) ? initialTab : 'followers');

  /* Shares `['profile', id]` with the profile screen, so naming the bar is free
     when you arrived from there — which is the only way in. */
  const profile = useQuery({
    queryKey: ['profile', id],
    queryFn: () => getProfile(id!),
    enabled: !!id,
  });

  const people = useQuery({
    queryKey: ['people', tab, id],
    queryFn: () =>
      tab === 'followers'
        ? getFollowers(id!)
        : tab === 'following'
          ? getFollowing(id!)
          : getFriends(id!),
    enabled: !!id,
  });

  const owner = profile.data ? displayNameFor(profile.data) : null;

  /*
   * Empty copy names the person and the relationship.
   *
   * "No results" would be the lazy version and it is the one thing an empty
   * social list must not say — the reader wants to know whether *this person*
   * has no followers or whether the app failed, and a generic line answers
   * neither. Failure has its own state below.
   */
  const emptyMessage: Record<PeopleTab, string> = {
    followers: owner ? `Nobody follows ${owner} yet.` : 'No followers yet.',
    following: owner ? `${owner} does not follow anyone yet.` : 'Not following anyone yet.',
    friends: owner ? `${owner} has no friends here yet.` : 'No friends yet.',
  };

  if (!id) {
    return (
      <Screen edges={[]} insetHeader topBar={<FrostedTopBar back title="People" />}>
        <EmptyState icon="search" title="Profile not found" />
      </Screen>
    );
  }

  return (
    /* `insetHeader`: this screen leads with a tab strip rather than artwork, so
       content starts below the bar instead of running under it. The bar names
       whose people these are — the thing the tabs underneath are filtering. */
    <Screen edges={[]} insetHeader topBar={<FrostedTopBar back title={owner ?? 'People'} />}>
      {/* The tabs are the list's header, under the large title, so the name
          is the first thing on the page and folds into the bar (the Apple
          pass, 2026-11-05). */}
      <PageFlatList
        ListHeaderComponent={
          <TabBar tabs={TABS} value={tab} onChange={setTab} inset={0} label="People" />
        }
        data={people.data ?? []}
        keyExtractor={(person) => person.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => <PersonRow profile={item} divided={index > 0} />}
        ListEmptyComponent={
          people.isLoading ? (
            <LoadingState />
          ) : people.isLoadingError ? (
            <ErrorState
              error={people.error}
              action={
                <Button
                  title="Try again"
                  variant="secondary"
                  onPress={() => void people.refetch()}
                />
              }
            />
          ) : (
            <EmptyState title="Nobody here yet" message={emptyMessage[tab]} />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, flexGrow: 1 },
});
