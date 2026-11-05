import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Platform, Text as RNText, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { Typeface, withAlpha } from '@/constants/theme';
import {
  dragEnd,
  layoutWords,
  wordAt,
  type PlacedWord,
  type ReviewText,
  type WordLayout,
  type WordRange,
} from '@/lib/review-highlight';

export type ReviewHighlighterProps = {
  review: ReviewText;
  range: WordRange;
  onChange: (range: WordRange) => void;
  /** Whether a pick fits on the card. Dragging stops at the last one that does. */
  fits: (range: WordRange) => boolean;
  /** A drag went further than the card would let it. */
  onLimit: () => void;
  /** The sheet's ink: the words, the highlight and its ends. */
  ink: string;
  /** What prints on the ink — the arrows on the ends. */
  onInk: string;
};

/** The words at the size the picker shows them, SimpMusic's line size. */
const FONT = 17;
const LINE = 32;
/** Room either side of the text for the ends to stand in, and above and below. */
const PAD_X = 22;
const PAD_Y = 12;
/**
 * An end of the highlight, as a phone's own selection handles are drawn: a
 * slim rule at the highlight's edge and a round knob with an arrow in it on
 * its corner — the start's above the line, the end's below — so it stands in
 * the gap between lines, not on the words beside it. The lines are a little
 * looser than SimpMusic's (32 on 17) to make that gap.
 */
const KNOB = { size: 18, glyph: 12, rule: 2 };
/** A press on an end has to be held this long before it drags — never a scroll. */
const HOLD_MS = 220;
/** Lines kept mounted above and below what is on screen, for a long review. */
const OVERSCAN = 12;

/**
 * The whole review, with a highlight over the part that goes on the image —
 * the owner's design (2026-10-16), after Instagram's slider for a song in a
 * story: a window over the text that can be moved, stretched and shrunk,
 * stopping where the card is full.
 *
 * ```text
 *   Hollow Knight is ‹gorgeous and lonely,
 *   and far too long›for what it has to say
 * ```
 *
 * - **A tap** moves the highlight to the word under it, one whole word.
 * - **Holding an end and dragging** stretches or shrinks the highlight from
 *   that end, a word at a time, across line breaks. It stops at the last word
 *   the card holds (`dragEnd`) and says so.
 * - **A swipe scrolls.** The two never meet: an end only drags after it has
 *   been held still for a moment (`activateAfterLongPress`), so a finger that
 *   moves at once is the scroll's; once an end is dragging, the scroll is
 *   switched off until it is let go. A tap fails as soon as the finger moves.
 *
 * Every word is placed by `layoutWords` from Inter's advance widths and drawn
 * where it was placed, so the finger's position is a word without asking the
 * platform, and the highlight is exactly round the words it covers. Line
 * breaks are the review's own.
 */
export function ReviewHighlighter({
  review,
  range,
  onChange,
  fits,
  onLimit,
  ink,
  onInk,
}: ReviewHighlighterProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scrollY, setScrollY] = useState(0);
  /* A drag in progress: which end, the pick when it began, where that end
     was in the text, and whether it has already met the card's limit. */
  const [drag, setDrag] = useState<{
    edge: 'start' | 'end';
    from: WordRange;
    x: number;
    y: number;
    limited: boolean;
  } | null>(null);

  const layout = useMemo(
    () => (size.width > 0 ? layoutWords(review.words, size.width - 2 * PAD_X, FONT, LINE) : null),
    [review.words, size.width]
  );

  /* Where the finger was when a drag began, on the UI thread. */
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);

  function tapAt(x: number, y: number) {
    if (!layout) return;
    /* A quick touch on an end is not a tap on the word beside it: the end only
       answers being held. */
    if (onAnEnd(layout, range, x, y)) return;
    const index = wordAt(layout, x - PAD_X, y - PAD_Y);
    if (index >= 0) onChange({ first: index, last: index });
  }

  function beginDrag(edge: 'start' | 'end') {
    if (!layout) return;
    const word = layout.words[edge === 'start' ? range.first : range.last];
    if (!word) return;
    setDrag({
      edge,
      from: range,
      x: edge === 'start' ? word.x : word.x + word.width,
      y: word.line * LINE + LINE / 2,
      limited: false,
    });
    if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
  }

  function moveDrag(edge: 'start' | 'end', dx: number, dy: number) {
    /* Moves that arrive before the drag's first render are let go. */
    if (!layout || !drag || drag.edge !== edge) return;
    const target = wordAt(layout, drag.x + dx, drag.y + dy);
    if (target < 0) return;
    const moved = dragEnd(drag.from, edge, target, fits);
    if (moved.limited !== drag.limited) {
      if (moved.limited) {
        onLimit();
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }
      }
      setDrag({ ...drag, limited: moved.limited });
    }
    if (moved.range.first !== range.first || moved.range.last !== range.last) {
      onChange(moved.range);
    }
  }

  function endDrag() {
    setDrag(null);
  }

  /* Rebuilt every render, as the app's other gestures are: a gesture keeps
     going across the renders it causes, with the newest handlers. */
  const tap = Gesture.Tap()
    .maxDuration(300)
    .onEnd((event, success) => {
      if (success) runOnJS(tapAt)(event.x, event.y);
    });

  const end = (edge: 'start' | 'end') =>
    Gesture.Pan()
      .activateAfterLongPress(HOLD_MS)
      .onStart((event) => {
        fingerX.set(event.absoluteX);
        fingerY.set(event.absoluteY);
        runOnJS(beginDrag)(edge);
      })
      .onUpdate((event) => {
        runOnJS(moveDrag)(edge, event.absoluteX - fingerX.get(), event.absoluteY - fingerY.get());
      })
      .onFinalize(() => {
        runOnJS(endDrag)();
      });

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current.width === width && current.height === height ? current : { width, height }
    );
  }

  const first = layout?.words[range.first];
  const last = layout?.words[range.last];

  /* Only the lines in view, and a margin: a review can be forty thousand
     characters, and every word is a view of its own. */
  const fromLine = Math.max(0, Math.floor((scrollY - PAD_Y) / LINE) - OVERSCAN);
  const toLine = Math.ceil((scrollY + size.height) / LINE) + OVERSCAN;

  return (
    <View style={styles.frame} onLayout={onLayout}>
      {layout && first && last && (
        <ScrollView
          scrollEnabled={drag === null}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(event) => setScrollY(event.nativeEvent.contentOffset.y)}>
          <GestureDetector gesture={tap}>
            <View
              collapsable={false}
              style={{ height: layout.lines * LINE + 2 * PAD_Y + PICKER_FOOT, width: size.width }}>
              {highlightBands(layout, range).map((band) => (
                <View
                  key={band.line}
                  style={[
                    styles.band,
                    {
                      left: PAD_X + band.left - 4,
                      top: PAD_Y + band.line * LINE + BAND_INSET,
                      width: band.right - band.left + 8,
                      height: LINE - 2 * BAND_INSET,
                      backgroundColor: withAlpha(ink, 0.2),
                    },
                  ]}
                />
              ))}

              {layout.words.map((word, index) =>
                word.line < fromLine || word.line > toLine ? null : (
                  <RNText
                    key={index}
                    allowFontScaling={false}
                    style={[
                      styles.word,
                      {
                        left: PAD_X + word.x,
                        top: PAD_Y + word.line * LINE,
                        color:
                          index >= range.first && index <= range.last ? ink : withAlpha(ink, 0.5),
                      },
                    ]}>
                    {word.text}
                  </RNText>
                )
              )}

              <End
                gesture={end('start')}
                edge="start"
                box={endBox(first, 'start')}
                ink={ink}
                onInk={onInk}
              />
              <End
                gesture={end('end')}
                edge="end"
                box={endBox(last, 'end')}
                ink={ink}
                onInk={onInk}
              />
            </View>
          </GestureDetector>
        </ScrollView>
      )}
    </View>
  );
}

/** The band the highlight draws on a word's line: its top and foot. */
const BAND_INSET = 2;

/**
 * Where an end stands, in the text's own frame: the box that holds its rule
 * and its knob — the start's knob on the highlight's top-left corner, the
 * end's on its bottom-right — and where the knob is inside it.
 */
function endBox(word: PlacedWord, edge: 'start' | 'end') {
  const x = PAD_X + (edge === 'start' ? word.x - 4 : word.x + word.width + 4);
  const bandTop = PAD_Y + word.line * LINE + BAND_INSET;
  const bandHeight = LINE - 2 * BAND_INSET;
  const half = KNOB.size / 2;
  return {
    left: x - half,
    top: edge === 'start' ? bandTop - half : bandTop,
    width: KNOB.size,
    height: bandHeight + half,
    knobTop: edge === 'start' ? 0 : bandHeight - half,
    ruleTop: edge === 'start' ? half : 0,
    ruleHeight: bandHeight,
  };
}

type EndBox = ReturnType<typeof endBox>;

/** Whether a point (in the text's own frame) is on either end, slop included. */
function onAnEnd(layout: WordLayout, range: WordRange, x: number, y: number): boolean {
  const first = layout.words[range.first];
  const last = layout.words[range.last];
  if (!first || !last) return false;
  return [endBox(first, 'start'), endBox(last, 'end')].some(
    (box) =>
      x >= box.left - END_SLOP.left &&
      x <= box.left + box.width + END_SLOP.right &&
      y >= box.top - END_SLOP.top &&
      y <= box.top + box.height + END_SLOP.bottom
  );
}

/** Room under the last line for the floating Continue pill. */
const PICKER_FOOT = 96;

/** The highlight, one band a line, from its first word on that line to its last. */
function highlightBands(layout: WordLayout, range: WordRange) {
  const bands = new Map<number, { line: number; left: number; right: number }>();
  for (let index = range.first; index <= range.last; index++) {
    const word = layout.words[index];
    if (!word) continue;
    const band = bands.get(word.line);
    if (band) {
      band.left = Math.min(band.left, word.x);
      band.right = Math.max(band.right, word.x + word.width);
    } else {
      bands.set(word.line, { line: word.line, left: word.x, right: word.x + word.width });
    }
  }
  return [...bands.values()];
}

/** An end of the highlight: a rule at its edge, and a knob with an arrow. */
function End({
  gesture,
  edge,
  box,
  ink,
  onInk,
}: {
  gesture: ReturnType<typeof Gesture.Pan>;
  edge: 'start' | 'end';
  box: EndBox;
  ink: string;
  onInk: string;
}) {
  return (
    <GestureDetector gesture={gesture}>
      <View
        hitSlop={END_SLOP}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={
          edge === 'start'
            ? 'Start of the highlight. Hold and drag to move it.'
            : 'End of the highlight. Hold and drag to move it.'
        }
        style={[
          styles.end,
          { left: box.left, top: box.top, width: box.width, height: box.height },
        ]}>
        <View
          style={[styles.rule, { top: box.ruleTop, height: box.ruleHeight, backgroundColor: ink }]}
        />
        <View style={[styles.knob, { top: box.knobTop, backgroundColor: ink }]}>
          <Ionicons
            name={edge === 'start' ? 'chevron-back' : 'chevron-forward'}
            size={KNOB.glyph}
            color={onInk}
          />
        </View>
      </View>
    </GestureDetector>
  );
}

/** A knob is 18 across; slop takes it to a thumb without moving it. */
const END_SLOP = { top: 14, bottom: 14, left: 14, right: 14 };

const styles = StyleSheet.create({
  frame: { flex: 1 },
  band: { position: 'absolute', borderRadius: 6 },
  word: {
    position: 'absolute',
    fontSize: FONT,
    lineHeight: LINE,
    /* The weight the words were measured in (`layoutWords`), so each is
       drawn exactly as wide as its place. */
    fontFamily: Typeface.regular,
  },
  end: { position: 'absolute' },
  rule: {
    position: 'absolute',
    left: (KNOB.size - KNOB.rule) / 2,
    width: KNOB.rule,
    borderRadius: KNOB.rule / 2,
  },
  knob: {
    position: 'absolute',
    left: 0,
    width: KNOB.size,
    height: KNOB.size,
    borderRadius: KNOB.size / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
