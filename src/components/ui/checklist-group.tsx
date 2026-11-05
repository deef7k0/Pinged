import Ionicons from '@expo/vector-icons/Ionicons';

import { InsetGroup, Row } from '@/components/ui/inset-group';
import { useTheme } from '@/hooks/use-theme';

/**
 * Several choices from a fixed list, as iOS's checklist (the Apple pass,
 * 2026-11-05): one inset group of rows, a check at the far end of each one
 * on. With `max`, past the limit the rest dim — the heading says "2 of 4" and
 * the footer the rule, so the limit is read before a tap does nothing.
 *
 * Usually pushed over a form from a row that sums it up (`chosenLine`), its
 * ✓ in the bar returning to the form.
 */
export function ChecklistGroup<T extends string>({
  title,
  choices,
  value,
  onChange,
  max,
}: {
  title: string;
  choices: readonly { value: T; label: string }[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  max?: number;
}) {
  const theme = useTheme();
  const full = max !== undefined && value.length >= max;
  return (
    <InsetGroup
      header={max !== undefined ? `${title} · ${value.length} of ${max}` : title}
      footer={max !== undefined ? `Choose up to ${max}.` : undefined}>
      {choices.map((choice) => {
        const on = value.includes(choice.value);
        return (
          <Row
            key={choice.value}
            title={choice.label}
            disabled={full && !on}
            accessibilityLabel={`${choice.label}${on ? ', chosen' : ''}`}
            trailing={on ? <Ionicons name="checkmark" size={20} color={theme.text} /> : undefined}
            onPress={() =>
              onChange(
                on ? value.filter((entry) => entry !== choice.value) : [...value, choice.value]
              )
            }
          />
        );
      })}
    </InsetGroup>
  );
}

/** A checklist's value on the row that opens it: "Any", one name, or "RPG, Action". */
export function chosenLine(
  chosen: readonly string[],
  choices: readonly { value: string; label: string }[],
  none = 'Any'
): string {
  if (chosen.length === 0) return none;
  return chosen
    .map((value) => choices.find((choice) => choice.value === value)?.label ?? value)
    .join(', ');
}
