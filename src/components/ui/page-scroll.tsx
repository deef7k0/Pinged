import { useCallback, useEffect, useRef, type Component, type Ref } from 'react';
import {
  FlatList,
  ScrollView,
  SectionList,
  type DefaultSectionT,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type SectionListProps,
} from 'react-native';
import { useAnimatedRef, useScrollOffset } from 'react-native-reanimated';

import { HANDOFF, settleOffset } from '@/constants/top-bar';
import { useScreenChrome } from '@/hooks/use-screen-chrome';

/**
 * A page's main scroller, which tells the page's top bar how far it has gone.
 *
 * `<FrostedTopBar>` is clear at the top of a page and frost once the page has
 * moved; over artwork its discs leave with the art and a bar comes in after
 * it. All of that hangs on one number — the scroll offset — and these are how
 * it gets from the list to the bar: drop-in `ScrollView`, `FlatList` and
 * `SectionList`, each of which writes its offset to the `scrollY` that
 * `<Screen>` publishes (`hooks/use-screen-chrome`).
 *
 * ```tsx
 * <Screen insetHeader topBar={<FrostedTopBar back title="Settings" />}>
 *   <PageScrollView>…</PageScrollView>
 * </Screen>
 * ```
 *
 * **A screen whose page scrolls must use one**, or its bar never learns the
 * page moved: it stays clear, and rows slide under a title with nothing
 * behind it. A screen that does not scroll needs none.
 *
 * ## They are still plain lists
 *
 * Not `Animated.FlatList`. That wraps every cell so cells can animate, which
 * no list here does, and eleven screens were once `Animated` lists only to
 * carry a scroll handler. `useScrollOffset` needs a ref it can read on the UI
 * thread and nothing else: it registers for the native scroll event by the
 * scroller's tag, so the offset is written by a worklet, never crosses to the
 * JS thread, and a scrolling page still causes no renders.
 *
 * ## One per page, and it is the page's
 *
 * Every page scroller under a `<Screen>` writes the same value, so only the
 * scroller that *is* the page takes one of these — never a rail, a sheet's
 * list or a menu. A screen that swaps lists (tabs with a list each) is fine:
 * a list that mounts starts at its top and says so, so the bar is not left
 * frosted over a list that has not moved.
 */

type Scroller = Component | null;

function forward<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === 'function') ref(node);
  else if (ref) ref.current = node;
}

/**
 * The ref that makes a scroller the page's. For a scroller these components do
 * not cover; must be called under a `<Screen>`, which is why a route cannot
 * call it for the list it renders itself.
 *
 * @param forwarded the caller's own ref to the scroller, kept working.
 */
export function usePageScroll<T extends Scroller>(forwarded?: Ref<T>) {
  const offset = useScreenChrome()?.scrollY;
  const scroller = useAnimatedRef<Component>();
  useScrollOffset(scroller, offset);

  /* A list that has just mounted is at its top, and a native scroller says
     nothing until it moves — without this, the bar would keep the offset of
     whichever list was here before. */
  useEffect(() => {
    offset?.set(0);
  }, [offset]);

  return useCallback(
    (node: T | null) => {
      scroller(node);
      forward(forwarded, node);
    },
    [scroller, forwarded]
  );
}

/**
 * The page scroller's `onContentSizeChange`, which also tells the page its
 * content has moved (`ScreenChrome.layout`) — keeping the caller's own handler.
 */
function usePageContentSize(own?: (width: number, height: number) => void) {
  const layout = useScreenChrome()?.layout;
  return useCallback(
    (width: number, height: number) => {
      layout?.set(layout.get() + 1);
      own?.(width, height);
    },
    [layout, own]
  );
}

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;
type ScrollHandler = ((event: ScrollEvent) => void) | undefined;

/** A band of offsets the page must not come to rest inside — the glass bar's handoff. */
export type SettleBand = { from: number; to: number } | null | undefined;

/** Anything that can be scrolled to an offset: a `ScrollView`, or a `FlatList`'s own method. */
type Scrollable = {
  scrollTo?: (options: { y: number; animated: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated: boolean }) => void;
};

/**
 * DrawerView's `.ended` (eleev), for a page: when the scroll comes to rest
 * inside `band`, it is carried on to the end the finger was going toward, or
 * back to the nearer one (`settleOffset`). So a page with the glass bar never
 * rests with the bar half in and two names half shown.
 *
 * Not `snapToOffsets`: with `snapToEnd={false}`, React Native's own snapping
 * (`ReactScrollView.flingAndSnap`, `RCTEnhancedScrollView`) catches any fling
 * *passing through* the last offset and stops it there — every fling from the
 * top of a game's page would end at the bar. This acts only once the page has
 * stopped: at the end of a drag that does not coast, or the end of the coast.
 *
 * The caller's own handlers still run.
 */
function usePageSettle(
  band: SettleBand,
  node: { current: Scrollable | null },
  ownBegin: ScrollHandler,
  ownEnd: ScrollHandler,
  ownMomentum: ScrollHandler
) {
  const dragFrom = useRef(0);

  const settle = useCallback(
    (offset: number) => {
      if (!band) return;
      const target = settleOffset(
        offset,
        band.from,
        band.to,
        offset - dragFrom.current,
        HANDOFF.intent
      );
      if (target === null) return;
      const scroller = node.current;
      if (scroller?.scrollToOffset) scroller.scrollToOffset({ offset: target, animated: true });
      else scroller?.scrollTo?.({ y: target, animated: true });
    },
    [band, node]
  );

  const onScrollBeginDrag = useCallback(
    (event: ScrollEvent) => {
      dragFrom.current = event.nativeEvent.contentOffset.y;
      ownBegin?.(event);
    },
    [ownBegin]
  );
  const onScrollEndDrag = useCallback(
    (event: ScrollEvent) => {
      /* A release that will coast is settled when the coast ends. Both
         platforms report this in dp (or px) a millisecond, sign aside. */
      const coasting = Math.abs(event.nativeEvent.velocity?.y ?? 0) > 0.05;
      if (!coasting) settle(event.nativeEvent.contentOffset.y);
      ownEnd?.(event);
    },
    [settle, ownEnd]
  );
  const onMomentumScrollEnd = useCallback(
    (event: ScrollEvent) => {
      settle(event.nativeEvent.contentOffset.y);
      ownMomentum?.(event);
    },
    [settle, ownMomentum]
  );

  return band
    ? { onScrollBeginDrag, onScrollEndDrag, onMomentumScrollEnd }
    : { onScrollBeginDrag: ownBegin, onScrollEndDrag: ownEnd, onMomentumScrollEnd: ownMomentum };
}

/*
 * `scrollEventThrottle` is 16 unless the caller says otherwise: one event a
 * frame. iOS sends a scroll event only when the gesture ends without it; it is
 * harmless on Android.
 */

export function PageScrollView({
  ref,
  scrollEventThrottle = 16,
  onContentSizeChange,
  settle,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  ...props
}: ScrollViewProps & { ref?: Ref<ScrollView>; settle?: SettleBand }) {
  const node = useRef<Scrollable | null>(null);
  const keep = useCallback(
    (scroller: ScrollView | null) => {
      node.current = scroller;
      forward(ref, scroller);
    },
    [ref]
  );
  const setRef = usePageScroll(keep);
  const sized = usePageContentSize(onContentSizeChange);
  const settling = usePageSettle(
    settle,
    node,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd
  );
  return (
    <ScrollView
      ref={setRef}
      scrollEventThrottle={scrollEventThrottle}
      onContentSizeChange={sized}
      {...settling}
      {...props}
    />
  );
}

export function PageFlatList<ItemT>({
  ref,
  scrollEventThrottle = 16,
  onContentSizeChange,
  settle,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  ...props
}: FlatListProps<ItemT> & { ref?: Ref<FlatList<ItemT>>; settle?: SettleBand }) {
  const node = useRef<Scrollable | null>(null);
  const keep = useCallback(
    (list: FlatList<ItemT> | null) => {
      node.current = list;
      forward(ref, list);
    },
    [ref]
  );
  const setRef = usePageScroll(keep);
  const sized = usePageContentSize(onContentSizeChange);
  const settling = usePageSettle(
    settle,
    node,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd
  );
  return (
    <FlatList
      ref={setRef}
      scrollEventThrottle={scrollEventThrottle}
      onContentSizeChange={sized}
      {...settling}
      {...props}
    />
  );
}

export function PageSectionList<ItemT, SectionT = DefaultSectionT>({
  ref,
  scrollEventThrottle = 16,
  onContentSizeChange,
  ...props
}: SectionListProps<ItemT, SectionT> & { ref?: Ref<SectionList<ItemT, SectionT>> }) {
  const setRef = usePageScroll(ref);
  const sized = usePageContentSize(onContentSizeChange);
  return (
    <SectionList
      ref={setRef}
      scrollEventThrottle={scrollEventThrottle}
      onContentSizeChange={sized}
      {...props}
    />
  );
}
