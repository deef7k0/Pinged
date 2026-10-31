import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { View } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * What a floating top bar needs to know about the page underneath it.
 *
 * Published by `<Screen>` and read by `<FrostedTopBar>`, which is rendered
 * through the `topBar` slot and therefore sits inside this provider even though
 * the *screen* creates the element.
 *
 *  - **`blurTarget`** — the view whose pixels the bar blurs. iOS and the web
 *    sample whatever is behind a translucent layer for free; Android does not,
 *    and `expo-blur` on SDK 57 makes that explicit: a `<BlurView>` with no
 *    `blurTarget` silently downgrades to `blurMethod: 'none'` and renders a flat
 *    translucent slab. So `<Screen>` wraps its content in `<BlurTargetView>` and
 *    hands the ref down here.
 *  - **`modal`** — whether this page is a sheet, which changes where the bar's
 *    content sits. See `useTopBarInset`.
 *  - **`scrollY`** — how far the page is scrolled, on the UI thread. It is what
 *    turns the bar to frost, carries the glass discs away with the artwork and
 *    brings the pinned bar in.
 *  - **`background`** — the page's fill, which the frost is washed with.
 *  - **`insetHeader`** — whether the page keeps the bar's row clear. One that
 *    does not opens on artwork, and gets discs where a bar would be.
 *
 * ## Who writes `scrollY`
 *
 * The page's own scroller, through `usePageScroll()` — `<PageScrollView>`,
 * `<PageFlatList>` and `<PageSectionList>` in `ui/page-scroll`. The value is
 * made here and not by the screen because the screen is *above* `<Screen>` in
 * the tree: it creates the scroller's element, but the scroller renders under
 * this provider, where it can read the context. So a screen says nothing about
 * scrolling to its bar; it uses a page scroller and the two find each other.
 * (The value used to be the screen's — `useTopBarScroll()`, passed to the bar
 * as a prop — and eleven screens ended up carrying a handler nothing read.)
 *
 * ## Why the target is state and not a `useRef`
 *
 * `BlurView` resolves the target in `componentDidMount` and again in
 * `componentDidUpdate`, comparing `prevProps.blurTarget?.current` against the
 * current one. A plain `useRef` is filled *after* the first render and never
 * triggers a second, so the comparison never runs and the blur stays
 * unconfigured for the life of the screen. Holding the native view in state
 * forces the one extra render that lets `componentDidUpdate` see it.
 */
export type ScreenChrome = {
  /** The view `<FrostedTopBar>` blurs. Android only; inert elsewhere. */
  blurTarget: { current: View | null };
  /** This page is presented as a modal. */
  modal: boolean;
  /** The page's scroll offset in dp, live on the UI thread. */
  scrollY: SharedValue<number>;
  /**
   * Bumped whenever the page's content may have moved without a scroll: the
   * page scroller's content changing size, a block of text opening or closing
   * on the UI thread. A shelf waiting to arrive (`<Reveal>`) re-reads where it
   * is on it, so nothing waits off a screen it has already been moved onto.
   */
  layout: SharedValue<number>;
  /** The page's fill. */
  background: string;
  /** The page reserves the bar's row at its top. */
  insetHeader: boolean;
};

const ScreenChromeContext = createContext<ScreenChrome | null>(null);

export type ScreenChromeProviderProps = {
  modal?: boolean;
  background: string;
  insetHeader?: boolean;
  children: (chrome: ScreenChrome & { blurTargetRef: { current: View | null } }) => ReactNode;
};

/**
 * Owns the chrome state for one page.
 *
 * A render prop rather than the usual wrapper, because `<Screen>` needs the
 * setter for the blur target *and* has to render the provider above both the
 * target and the bar. Nothing else should mount this — it is `<Screen>`'s
 * internals, exposed only so that file stays readable.
 */
export function ScreenChromeProvider({
  modal = false,
  background,
  insetHeader = false,
  children,
}: ScreenChromeProviderProps) {
  const [target, setTarget] = useState<View | null>(null);
  const scrollY = useSharedValue(0);
  const layout = useSharedValue(0);

  /*
   * A ref object that is also a subscription.
   *
   * `BlurTargetView` types its `ref` as a `RefObject`, not a callback, so the
   * usual "callback ref that calls setState" is not available. This is the same
   * thing wearing the right shape: React assigns `.current` during commit, the
   * setter turns that into a state update, and the re-render is what lets
   * `BlurView.componentDidUpdate` notice the target exists.
   *
   * Built once. A new object each render would be re-attached every render,
   * which would call `setTarget` in a loop.
   */
  const blurTargetRef = useMemo(() => {
    let current: View | null = null;
    return {
      get current() {
        return current;
      },
      set current(view: View | null) {
        current = view;
        setTarget(view);
      },
    };
  }, []);

  /* A fresh object each time the native view changes, so `BlurView`'s
     `prevProps.blurTarget?.current !== this.props.blurTarget?.current` check
     actually fires. Handing it `blurTargetRef` itself would make that
     comparison a tautology and the blur would never configure. */
  const chrome = useMemo<ScreenChrome>(
    () => ({
      blurTarget: { current: target },
      modal,
      scrollY,
      layout,
      background,
      insetHeader,
    }),
    [target, modal, scrollY, layout, background, insetHeader]
  );

  return (
    <ScreenChromeContext.Provider value={chrome}>
      {children({ ...chrome, blurTargetRef })}
    </ScreenChromeContext.Provider>
  );
}

/**
 * The chrome for the enclosing `<Screen>`, or `null` outside one.
 *
 * Null is a supported answer: a bar rendered outside a `<Screen>` still draws,
 * it just falls back to a plain translucent tint on Android and never learns
 * that anything scrolled.
 */
export function useScreenChrome(): ScreenChrome | null {
  return useContext(ScreenChromeContext);
}
