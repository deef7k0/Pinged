import { memo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { ReviewLandscapeCard } from '@/components/review-landscape-card';
import { Spacing } from '@/constants/theme';
import type { LogWithRelations } from '@/lib/database.types';

export type LogCardProps = {
  log: LogWithRelations;
  /** The card's width, when the list knows it; else it measures its place. */
  width?: number;
};

/**
 * A review, everywhere it appears in a list: Search's Reviews tab, a
 * profile's Reviews tab, the popular and latest pages, the log form's
 * preview — and Home's and Explore's rails, which draw the same card
 * (`<ReviewLandscapeCard>`) at their own width.
 *
 * **One card, the coloured one** (the owner's, 2026-11-06: "Remove the other
 * card style, with the full screen cover art and only keep the new colored
 * card for reviews"): the game's landscape art at the top, fading into the
 * art's own key colour, and the review, the score and the writer on that
 * colour. The poster card and Settings → Review cards are deleted, and so is
 * the classic card this file used to draw (box art, title, score, the review
 * under them on a grey card).
 *
 * A game's own screens keep theirs: the game page and the reviews sheet draw
 * `<MemberReviewCard>`, and a copy's screen `<ReviewQuote>`.
 */
export const LogCard = memo(function LogCard({ log, width }: LogCardProps) {
  const { width: window } = useWindowDimensions();
  const [measured, setMeasured] = useState(window - Spacing.x16 * 2);

  if (width !== undefined) return <ReviewLandscapeCard log={log} width={width} />;
  return (
    <View
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== measured) setMeasured(next);
      }}>
      <ReviewLandscapeCard log={log} width={measured} />
    </View>
  );
});
