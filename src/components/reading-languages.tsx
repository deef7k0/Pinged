import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { SelectionCard } from '@/components/ui/selection-card';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  type AccordionSlot,
} from '@/components/ui/accordion';
import { Text } from '@/components/ui/text';
import {
  ControlHeight,
  Radius,
  SmallControlRowGap,
  SmallControlSlop,
  Spacing,
} from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useReadingLanguages } from '@/hooks/use-reading-languages';
import { LANGUAGES, languageList, languageSummary, type ReadingChoice } from '@/lib/language';
import { saveReadingChoice } from '@/lib/reading-languages';

export type ReadingLanguagesProps = AccordionSlot & {
  userId: string;
  /** Its key in the `<Accordion>` it is a row of. */
  value: string;
};

/**
 * Which languages somebody is shown reviews in, and the way to change them.
 *
 * ## What it governs, said where it is set
 *
 * The lists that *choose* for the reader: the popular reviews, the people
 * suggested, the one review a game's page leads with. Not a game's own
 * reviews, and not anything searched for — those show everything, always. The
 * panel says so, because a control that hides things has to say what from.
 *
 * ## Why it is a disclosure
 *
 * For the reason the hidden-games list above it is one: the answer is right
 * for nearly everybody without being touched ("English and Spanish"), so
 * collapsed it is one row stating that answer, and the thirty-nine languages
 * are only drawn for somebody who came to change them.
 *
 * ## Three ways, because there are three things a person means
 *
 * - **Automatic** — the app's language, this phone's, and any they have
 *   written a review in. Named in the row, so "automatic" is never a mystery.
 * - **Every language** — nothing is left out. The off switch.
 * - **Chosen** — exactly the ones ticked. Picking it starts from what
 *   automatic came to, so the first tap adds a language instead of emptying
 *   the list; unticking the last one goes back to automatic, since reading
 *   nothing is not a choice anybody makes.
 *
 * Kept on the device (`lib/reading-languages`), and written straight into the
 * query cache as it is saved: every chart is keyed on these languages, so it
 * re-asks by itself.
 */
export function ReadingLanguages({ userId, value, ...slot }: ReadingLanguagesProps) {
  const accent = useAccent();
  const selectable = useSelectable();
  const queryClient = useQueryClient();

  const { choice, reading, automatic, ready } = useReadingLanguages();

  /* Set, not invalidated: the store is one value and this just wrote it. */
  const choose = useMutation({
    mutationFn: (next: ReadingChoice) => saveReadingChoice(userId, next),
    onMutate: (next) => {
      queryClient.setQueryData(['reading-languages', userId], next);
    },
    onSuccess: (kept) => {
      queryClient.setQueryData(['reading-languages', userId], kept);
    },
  });

  const chosen = choice.mode === 'chosen' ? choice.languages : [];

  function toggle(code: string) {
    const next = chosen.includes(code)
      ? chosen.filter((entry) => entry !== code)
      : [...chosen, code];
    /* The last one unticked is automatic again — `coerceReadingChoice` would
       make it so on the next read; doing it here lights the right card now. */
    choose.mutate(next.length > 0 ? { mode: 'chosen', languages: next } : { mode: 'auto' });
  }

  const summary = !ready
    ? 'Checking…'
    : reading === null
      ? 'Every language'
      : choice.mode === 'auto'
        ? `${languageSummary(reading)} · automatic`
        : languageSummary(reading);

  return (
    <AccordionItem value={value} {...slot}>
      <AccordionTrigger
        icon="language-outline"
        title="Review languages"
        summary={summary}
        accessibilityLabel={`Review languages, ${reading === null ? 'every language' : languageList(reading)}`}
      />
      <AccordionContent>
        <View style={styles.panel}>
          <Text variant="caption" color="textMuted" style={styles.hint}>
            Popular reviews, suggested people and the review a game’s page leads with are picked
            from these. A game’s own reviews, and anything you search for, are never left out. A
            review nobody could put a language to is shown to everybody.
          </Text>

          <View style={styles.modes} accessibilityRole="radiogroup">
            <SelectionCard
              title="Automatic"
              hint={`${languageList(automatic)} — this app’s language, this phone’s, and any you write reviews in.`}
              selected={choice.mode === 'auto'}
              onPress={() => choose.mutate({ mode: 'auto' })}
            />
            <SelectionCard
              title="Every language"
              hint="Nothing is left out for the language it is written in."
              selected={choice.mode === 'all'}
              onPress={() => choose.mutate({ mode: 'all' })}
            />
            <SelectionCard
              title="Chosen"
              hint="Only the ones you tick."
              selected={choice.mode === 'chosen'}
              /* From what automatic came to, so the list opens with the
                 reader's own languages ticked rather than with none. */
              onPress={() => {
                if (choice.mode !== 'chosen') {
                  choose.mutate({ mode: 'chosen', languages: automatic });
                }
              }}
            />
          </View>

          {choice.mode === 'chosen' && (
            <View style={styles.chips}>
              {LANGUAGES.map(({ code, name }) => {
                const on = chosen.includes(code);
                const look = selectable(on);
                return (
                  <PressableScale
                    key={code}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={name}
                    onPress={() => toggle(code)}
                    scaleTo={0.96}
                    hitSlop={SmallControlSlop}
                    pressedColor={look.pressedColor}
                    focusRing={look.focusRing}
                    style={StyleSheet.flatten([styles.chip, look.style])}>
                    {/* A glyph as well as a tint: ticked is not only a colour. */}
                    {on && <Ionicons name="checkmark" size={14} color={accent.onSurface} />}
                    <Text variant="body" color={look.label}>
                      {name}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          )}
        </View>
      </AccordionContent>
    </AccordionItem>
  );
}

const styles = StyleSheet.create({
  /* The hidden-games row's own shape: the two are one group of rows. */
  panel: { paddingHorizontal: Spacing.x4, gap: Spacing.x16 },
  hint: { paddingTop: Spacing.x4 },
  /* The reference's 14 between options (`x16`, 15), as `<ChoiceChips>` keeps. */
  modes: { gap: Spacing.x16 },
  /* The chip row every multi-choice in the app is: 8 between, and rows exactly
     the two slops that meet, so wrapped rows' touch boxes tile. */
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.x8,
    rowGap: SmallControlRowGap,
    paddingBottom: Spacing.x8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    minHeight: ControlHeight.small,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
