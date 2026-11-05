import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { AnchoredMenu, AnchoredMenuItem, useAnchoredMenu } from '@/components/ui/anchored-menu';
import { Row } from '@/components/ui/inset-group';
import { useTheme } from '@/hooks/use-theme';

export type PullDownChoice<T extends string> = { value: T; label: string; hint?: string };

/**
 * A row of an `<InsetGroup>` whose value is a choice — iOS's pull-down row
 * (the Apple pass, 2026-11-05): the name, the choice in the quiet ink at the
 * far end, the up-and-down chevron; a tap drops the choices as a menu, the
 * one in force ticked. With `anyLabel`, the menu leads with that ("Any") and
 * choosing it clears the value.
 */
export function PullDownRow<T extends string>({
  title,
  choices,
  value,
  onChange,
  anyLabel,
  placeholder = 'Choose',
}: {
  title: string;
  choices: readonly PullDownChoice<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** The clearing option's words — "Any", "Not sure". Absent: no clearing. */
  anyLabel?: string;
  /** Shown while nothing is chosen and there is no `anyLabel`. */
  placeholder?: string;
}) {
  const theme = useTheme();
  const [trigger, menu] = useAnchoredMenu();
  const current = choices.find((choice) => choice.value === value) ?? null;
  const tick = <Ionicons name="checkmark" size={20} color={theme.text} />;

  return (
    <View ref={trigger} collapsable={false}>
      <Row
        title={title}
        value={current?.label ?? anyLabel ?? placeholder}
        menu
        onPress={menu.open}
      />
      <AnchoredMenu menu={menu} label={title} align="end">
        {anyLabel !== undefined && (
          <AnchoredMenuItem
            title={anyLabel}
            checked={value === null}
            trailing={value === null ? tick : undefined}
            onPress={() => {
              menu.close();
              onChange(null);
            }}
          />
        )}
        {choices.map((choice) => (
          <AnchoredMenuItem
            key={choice.value}
            title={choice.label}
            hint={choice.hint}
            checked={choice.value === value}
            trailing={choice.value === value ? tick : undefined}
            onPress={() => {
              menu.close();
              onChange(choice.value);
            }}
          />
        ))}
      </AnchoredMenu>
    </View>
  );
}
