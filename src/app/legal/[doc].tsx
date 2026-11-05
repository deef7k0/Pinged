import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  LEGAL_DOCS,
  LEGAL_UPDATED,
  fillContact,
  isLegalSlug,
  type LegalBlock,
} from '@/constants/legal';
import { Spacing } from '@/constants/theme';

/**
 * The privacy policy, the terms of use and how to delete an account, in the
 * app — the same text as the web pages Google Play links to
 * (`constants/legal.ts`). Open signed in or out: the sign-up page links here,
 * so the route sits outside every guard in the root layout.
 */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();

  if (!isLegalSlug(doc)) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <EmptyState icon="search" title="Page not found" />
      </Screen>
    );
  }

  const page = LEGAL_DOCS[doc];
  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title={page.title} />}>
      <PageScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="caption" color="textMuted">
          Last updated {LEGAL_UPDATED}
        </Text>
        <Text variant="prose" color="textSecondary">
          {fillContact(page.intro)}
        </Text>
        {page.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text variant="h4" accessibilityRole="header">
              {section.heading}
            </Text>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </View>
        ))}
      </PageScrollView>
    </Screen>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === 'string') {
    return (
      <Text variant="prose" color="textSecondary">
        {fillContact(block)}
      </Text>
    );
  }
  return (
    <View style={styles.list}>
      {block.list.map((line) => (
        <View key={line} style={styles.item}>
          <Text variant="prose" color="textMuted">
            •
          </Text>
          <Text variant="prose" color="textSecondary" style={styles.itemText}>
            {fillContact(line)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x8,
    paddingBottom: Spacing.x48,
    gap: Spacing.x16,
  },
  section: { gap: Spacing.x8, marginTop: Spacing.x16 },
  list: { gap: Spacing.x8 },
  item: { flexDirection: 'row', gap: Spacing.x8 },
  itemText: { flex: 1 },
});
