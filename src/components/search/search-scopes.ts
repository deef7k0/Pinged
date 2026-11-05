import type { SearchScope } from '@/lib/search-history';

/** One thing the Search field can look through, and the words for it. */
export type ScopeInfo = {
  key: SearchScope;
  /** The name on the scope's tab. */
  label: string;
  /** What the field says while this scope is reading it. */
  placeholder: string;
};

/**
 * The six kinds of thing Search finds, after Top results (all of them at
 * once), in the order the tabs list them.
 *
 * Events was a seventh; the owner moved it to the News tab (2026-10-14),
 * where `<EventResults>` is drawn untyped.
 *
 * One statement of the vocabulary: the tabs under the field, the field's
 * placeholder and the history's "in Studios" all read it, so an eighth kind is
 * an entry here and a results component, and none of those drift.
 *
 * Top results is first because it is where the tab rests; Games next. The rest follow in the order they were asked for.
 */
export const SEARCH_SCOPE_INFO: readonly ScopeInfo[] = [
  /* Apple Music's search (the Apple pass, 2026-11-05): a Top Result and a
     section of every kind, each leading to its own tab (`<TopResults>`). */
  { key: 'top', label: 'Top results', placeholder: 'Games, studios, people…' },
  { key: 'games', label: 'Games', placeholder: 'Search games…' },
  { key: 'reviews', label: 'Reviews', placeholder: 'Search reviews…' },
  { key: 'people', label: 'People', placeholder: 'Search people…' },
  { key: 'collections', label: 'Collections', placeholder: 'Search collections…' },
  { key: 'studios', label: 'Studios', placeholder: 'Search studios…' },
  { key: 'platforms', label: 'Platforms', placeholder: 'Search platforms…' },
];

export function scopeInfo(scope: SearchScope): ScopeInfo {
  return SEARCH_SCOPE_INFO.find((entry) => entry.key === scope) ?? SEARCH_SCOPE_INFO[0];
}

/**
 * How many of a chart an untyped tab shows before its "See all": the top of
 * Popular reviews on Reviews, the top of Most popular on Collections. Three
 * tall cards is a screenful — enough to say what the chart is — and leaves the
 * newest, under it, a thumb away instead of twenty cards down.
 */
export const CHART_PREVIEW = 3;
