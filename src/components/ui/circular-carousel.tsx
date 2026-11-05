import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

/*
 * reacticx's circular carousel (`molecules/circular-carousel`, MIT — the
 * owner's, 2026-11-03, for a person's Top 10): cards on a wheel. The one in
 * front stands upright; its neighbours drop by an eighth and then a quarter
 * of a card, shrink to 0.85 and 0.75, fade to 80% and 50%, and turn 20° and
 * 40° away — and on Android blur a little (`filter`, as the reference does
 * there). Paging a card at a time.
 */

export const CIRCULAR = {
  translate: [1 / 4, 1 / 8, 0, 1 / 8, 1 / 4],
  opacity: [0.5, 0.8, 1, 0.8, 0.5],
  scale: [0.75, 0.85, 1, 0.85, 0.75],
  rotate: [40, 20, 0, -20, -40],
  blur: [4, 8, 0, 8, 4],
  radius: 24,
} as const;

export type CircularCarouselProps<T> = {
  data: readonly T[];
  keyOf: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** Drawn behind the card, unclipped, turning with it — the Top 10's numeral. */
  renderBehind?: (item: T, index: number) => ReactNode;
  /** The card's width; the carousel is the display's. */
  itemWidth: number;
  itemHeight: number;
  /** The width it is laid out in. */
  width: number;
  spacing?: number;
  onIndexChange?: (index: number) => void;
};

export function CircularCarousel<T>({
  data,
  keyOf,
  renderItem,
  renderBehind,
  itemWidth,
  itemHeight,
  width,
  spacing = 1,
  onIndexChange,
}: CircularCarouselProps<T>) {
  const scrollX = useSharedValue(0);
  const step = itemWidth + spacing;
  const side = (width - itemWidth) / 2;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.set(event.contentOffset.x);
    },
  });

  useAnimatedReaction(
    () => Math.round(scrollX.get() / step),
    (index, was) => {
      if (was !== null && index !== was && onIndexChange) runOnJS(onIndexChange)(index);
    },
    [step, onIndexChange]
  );

  return (
    <Animated.FlatList
      data={data}
      horizontal
      keyExtractor={keyOf}
      showsHorizontalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      snapToInterval={step}
      decelerationRate="fast"
      disableIntervalMomentum
      style={styles.list}
      contentContainerStyle={{
        paddingHorizontal: side - spacing / 2,
        paddingVertical: itemHeight * 0.3,
      }}
      renderItem={({ item, index }) => (
        <Card
          index={index}
          scrollX={scrollX}
          step={step}
          itemWidth={itemWidth}
          itemHeight={itemHeight}
          spacing={spacing}
          behind={renderBehind?.(item, index)}>
          {renderItem(item, index)}
        </Card>
      )}
    />
  );
}

function Card({
  index,
  scrollX,
  step,
  itemWidth,
  itemHeight,
  spacing,
  behind,
  children,
}: {
  behind?: ReactNode;
  index: number;
  scrollX: SharedValue<number>;
  step: number;
  itemWidth: number;
  itemHeight: number;
  spacing: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const range = [-2, -1, 0, 1, 2].map((offset) => (index + offset) * step);
    const at = (output: readonly number[]) =>
      interpolate(scrollX.get(), range, output as number[], Extrapolation.CLAMP);
    const base: ViewStyle = {
      opacity: at(CIRCULAR.opacity),
      transform: [
        { translateY: at(CIRCULAR.translate.map((share) => share * itemWidth)) },
        { scale: at(CIRCULAR.scale) },
        { rotateZ: `${at(CIRCULAR.rotate)}deg` },
      ],
    };
    if (Platform.OS === 'android') base.filter = [{ blur: at(CIRCULAR.blur) }];
    return base;
  });

  return (
    <Animated.View
      style={[{ width: itemWidth, height: itemHeight, marginHorizontal: spacing / 2 }, style]}>
      {behind}
      <View style={styles.card}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0 },
  card: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: CIRCULAR.radius,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
});
