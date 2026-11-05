import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { StyleSheet } from 'react-native';

import { PageFlatList } from '@/components/ui/page-scroll';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { DiscoverPeople } from '@/components/discover-people';
import { PersonRow } from '@/components/person-row';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { ArtRowWindow } from '@/constants/list-window';
import { Spacing } from '@/constants/theme';
import { searchProfiles } from '@/lib/api';

const MIN_QUERY_LENGTH = 2;

/**
 * People: three ranked charts before a name is typed, a name search after.
 *
 * One scope, because "find someone" is one intention with two routes. Lifted
 * out of the Search screen when the scopes went from two to six — each is its
 * own component now, and the screen only chooses between them.
 */
export function PeopleResults({ query }: { query: string }) {
  const clearance = useTabBarClearance();
  const isQueryable = query.length >= MIN_QUERY_LENGTH;

  const people = useQuery({
    queryKey: ['search', 'people', query],
    queryFn: ({ signal }) => searchProfiles(query, signal),
    enabled: isQueryable,
    /* Results refine instead of vanishing. Every debounce tick is a new key, so
       without this each pause mid-word tore the list down to a spinner and built
       it again — search felt like it was losing your results rather than
       narrowing them. */
    placeholderData: keepPreviousData,
  });

  if (!isQueryable) return <DiscoverPeople />;
  if (people.isLoading) return <LoadingState />;
  if (people.isLoadingError)
    return <ErrorState error={people.error} onRetry={() => people.refetch()} />;

  return (
    <PageFlatList
      data={people.data ?? []}
      keyExtractor={(profile) => profile.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.x48 + clearance }]}
      {...ArtRowWindow}
      renderItem={({ item, index }) => <PersonRow profile={item} divided={index > 0} />}
      ListEmptyComponent={
        <EmptyState
          icon="search"
          title="No people found"
          message={`Nobody matching “${query}”. Try their @handle.`}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  /* `flexGrow: 1` so the empty state can centre itself rather than pinning to
     the top of a content-sized container. */
  content: { padding: Spacing.x16, flexGrow: 1 },
});
