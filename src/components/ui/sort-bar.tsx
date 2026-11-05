import { useMemo } from 'react';

import { DropdownButton } from '@/components/ui/dropdown-button';
import { Segmented } from '@/components/ui/segmented';

export type SortOption<T extends string> = { key: T; label: string };

export type SortBarProps<T extends string> = {
  options: readonly SortOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** What is being ordered, for a screen reader. */
  accessibilityLabel?: string;
  /**
   * `choice` for a filter or a mode rather than an order: up to four options
   * are iOS's segmented control, more a pull-down showing the choice itself
   * (no "Sort by").
   */
  kind?: 'sort' | 'choice';
};

/**
 * How a list is ordered: one pull-down reading "Sort by Newest ⌄" (the Apple
 * pass, 2026-11-05) — a grey capsule that drops the orders as a menu, the one
 * in force ticked (`<DropdownButton>`).
 *
 * It was a wrapping row of outlined pills, one per order — five of them over
 * a grid of covers. Same props, so every caller changed with it.
 */
export function SortBar<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel = 'Sort',
  kind = 'sort',
}: SortBarProps<T>) {
  const choices = useMemo(
    () =>
      options.map((option) => ({
        value: option.key,
        label: option.label,
        short: kind === 'sort' ? `Sort by ${option.label}` : option.label,
      })),
    [options, kind]
  );

  if (kind === 'choice' && options.length >= 2 && options.length <= 4) {
    return (
      <Segmented
        label={accessibilityLabel}
        value={value}
        onChange={onChange}
        options={options.map((option) => ({ value: option.key, label: option.label }))}
      />
    );
  }

  return (
    <DropdownButton
      label={accessibilityLabel}
      value={value}
      options={choices}
      onChange={onChange}
      size="small"
    />
  );
}
