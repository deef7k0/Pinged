import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageFlatList } from '@/components/ui/page-scroll';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { PosterAspectRatio, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getPingablePeople,
  isPingsNotReady,
  sendPings,
  type PingTarget,
  type SendResult,
} from '@/lib/api';
import type { DirectPingKind, Profile } from '@/lib/database.types';
import { displayNameFor } from '@/lib/format';
import {
  DIRECT_PING_KINDS,
  DIRECT_PING_MESSAGE_MAX,
  DIRECT_PING_NOUN,
  sendLabel,
} from '@/lib/pings';
import { useAuth } from '@/store/auth';

type Params = {
  kind?: string;
  target?: string;
  title?: string;
  subtitle?: string;
  image?: string;
};

/** Pictures that are box art draw portrait; the rest draw as a landscape tile. */
const PORTRAIT: readonly DirectPingKind[] = [
  'game',
  'soundtrack',
  'review',
  'collection',
  'request',
];

/**
 * Ping something to people — the sheet every Ping button in the app opens.
 *
 * Params name what is being sent (`kind`, `target`) and how it looked to the
 * sender (`title`, `subtitle`, `image`), which is what the recipient's inbox
 * draws. The list is everybody the sender can reach right now
 * (`pingable_people`: people they follow or are friends with, whose own
 * setting lets them in), the ones pinged most recently first; a field filters
 * it. Tick people, add a line if you like, send.
 *
 * The send is one insert per person, so somebody who tightened their setting
 * a moment ago is reported by name and costs nobody else their ping. Done, the
 * sheet says so for a beat and closes.
 */
export default function SendPingScreen() {
  const params = useLocalSearchParams<Params>();
  const kind = (DIRECT_PING_KINDS as readonly string[]).includes(params.kind ?? '')
    ? (params.kind as DirectPingKind)
    : null;
  const target: PingTarget | null =
    kind && params.target && params.title
      ? {
          kind,
          targetId: params.target,
          title: params.title,
          subtitle: params.subtitle || null,
          imageUrl: params.image || null,
        }
      : null;

  const bar = <FrostedTopBar dismiss title="Ping" />;

  if (!target) {
    return (
      <Screen edges={['bottom']} insetHeader modal topBar={bar}>
        <EmptyState title="Nothing to ping" message="This link doesn’t point at anything." />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} insetHeader modal topBar={bar}>
      <SendFlow target={target} />
    </Screen>
  );
}

function SendFlow({ target }: { target: PingTarget }) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set());
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<SendResult | null>(null);

  const people = useQuery({
    queryKey: ['pingable-people', userId],
    queryFn: getPingablePeople,
    enabled: !!userId,
    staleTime: 60_000,
  });

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = people.data ?? [];
    if (!term) return all;
    return all.filter(
      (person) =>
        person.username.toLowerCase().includes(term) ||
        (person.display_name ?? '').toLowerCase().includes(term)
    );
  }, [people.data, search]);

  const toggle = useCallback((id: string) => {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const send = useMutation({
    mutationFn: () => sendPings(userId!, [...chosen], target, message),
    onSuccess: (outcome) => {
      setResult(outcome);
      void queryClient.invalidateQueries({ queryKey: ['pingable-people'] });
      if (outcome.failed.length === 0) setTimeout(() => router.back(), 1100);
    },
  });

  if (result)
    return <Sent result={result} people={people.data ?? []} onDone={() => router.back()} />;

  const renderPerson = ({ item }: { item: Profile }) => (
    <PersonRow person={item} selected={chosen.has(item.id)} onToggle={toggle} />
  );
  const tooLong = message.length > DIRECT_PING_MESSAGE_MAX;

  let list: React.ReactNode;
  if (people.isPending) list = <LoadingState />;
  else if (people.isLoadingError) {
    list = isPingsNotReady(people.error) ? (
      <EmptyState
        title="Pings are on their way"
        message="They arrive with the database’s next update."
      />
    ) : (
      <ErrorState error={people.error} onRetry={() => void people.refetch()} />
    );
  } else {
    list = (
      <PageFlatList
        data={shown}
        keyExtractor={keyOf}
        renderItem={renderPerson}
        extraData={chosen}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={shown.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={
          search.trim() ? (
            <EmptyState
              title="Nobody by that name"
              message="Only people you can ping are listed."
            />
          ) : (
            <EmptyState
              title="No one to ping yet"
              message="People choose who can ping them — anyone who follows them, people they follow back, or friends. Follow someone and they’ll show up here."
            />
          )
        }
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
      <View style={styles.head}>
        <What target={target} />
        {(people.data?.length ?? 0) > 6 && (
          <TextField
            value={search}
            onChangeText={setSearch}
            icon="search"
            variant="search"
            placeholder="Search people…"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        )}
      </View>

      <View style={styles.flex}>{list}</View>

      <View
        style={[styles.foot, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
        <TextField
          value={message}
          onChangeText={setMessage}
          placeholder="Add a line (optional)"
          maxLength={DIRECT_PING_MESSAGE_MAX + 20}
          accessibilityLabel="A line to go with it"
          error={tooLong ? `${DIRECT_PING_MESSAGE_MAX} characters at most.` : null}
          returnKeyType="done"
        />
        {send.isError && (
          <Text variant="bodySmall" color="danger">
            {send.error instanceof Error ? send.error.message : 'Could not send that.'}
          </Text>
        )}
        <Button
          title={sendLabel(chosen.size)}
          icon="paper-plane"
          fullWidth
          loading={send.isPending}
          disabled={chosen.size === 0 || tooLong}
          onPress={() => send.mutate()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const keyOf = (person: Profile) => person.id;

/** What is being pinged: its picture, its name, its line. */
function What({ target }: { target: PingTarget }) {
  const theme = useTheme();
  const portrait = PORTRAIT.includes(target.kind);
  const width = portrait ? 44 : 72;
  const height = portrait ? Math.round(44 / PosterAspectRatio) : Math.round(72 * (9 / 16));

  return (
    <View style={[styles.what, { backgroundColor: theme.controlFill }]}>
      {target.imageUrl ? (
        <Image
          source={{ uri: target.imageUrl }}
          style={[styles.art, { width, height, backgroundColor: theme.surfaceElevated }]}
          contentFit="cover"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            styles.art,
            styles.artEmpty,
            { width, height, backgroundColor: theme.surfaceElevated },
          ]}>
          <Ionicons name="radio-outline" size={20} color={theme.textMuted} />
        </View>
      )}
      <View style={styles.whatText}>
        <Text variant="caption" color="textMuted">
          {`Pinging a ${DIRECT_PING_NOUN[target.kind]}`}
        </Text>
        <Text variant="h5" numberOfLines={2}>
          {target.title}
        </Text>
        {target.subtitle ? (
          <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
            {target.subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const PersonRow = memo(function PersonRow({
  person,
  selected,
  onToggle,
}: {
  person: Profile;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const theme = useTheme();
  const name = displayNameFor(person);
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${name}, @${person.username}`}
      onPress={() => onToggle(person.id)}
      scaleTo={0.985}
      pressedColor={theme.controlPressed}
      style={StyleSheet.flatten([
        styles.person,
        { backgroundColor: selected ? theme.primaryMuted : withAlpha(theme.text, 0) },
      ])}>
      <Avatar uri={person.avatar_url} name={name} size={44} />
      <View style={styles.personText}>
        <Text variant="itemTitle" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
          @{person.username}
        </Text>
      </View>
      <View
        style={[
          styles.check,
          selected
            ? { backgroundColor: theme.primary, borderColor: theme.primary }
            : { borderColor: theme.outline },
        ]}>
        {selected && (
          <PressGlyph pop={selected}>
            <Ionicons name="checkmark" size={16} color={theme.onPrimary} />
          </PressGlyph>
        )}
      </View>
    </PressableScale>
  );
});

/** Sent: a tick, who it reached, and — if anybody — who it did not, and why. */
function Sent({
  result,
  people,
  onDone,
}: {
  result: SendResult;
  people: Profile[];
  onDone: () => void;
}) {
  const theme = useTheme();
  const nameOf = (id: string) => displayNameFor(people.find((person) => person.id === id) ?? null);
  return (
    <View style={styles.sent}>
      {result.sent > 0 && (
        <View style={[styles.sentMark, { backgroundColor: theme.primary }]}>
          <Ionicons name="paper-plane" size={30} color={theme.onPrimary} />
        </View>
      )}
      <Text variant="h2" style={styles.center}>
        {result.sent > 0 ? 'Pinged' : 'Not sent'}
      </Text>
      {result.sent > 0 && (
        <Text variant="body" color="textSecondary" style={styles.center}>
          {result.sent === 1 ? 'It’s in their inbox.' : `It’s in ${result.sent} inboxes.`}
        </Text>
      )}
      {result.failed.map((failure) => (
        <Text key={failure.recipientId} variant="bodySmall" color="textMuted" style={styles.center}>
          {`${nameOf(failure.recipientId)}: ${failure.reason}`}
        </Text>
      ))}
      {result.failed.length > 0 && <Button title="Done" variant="secondary" onPress={onDone} />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: {
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x12,
    paddingBottom: Spacing.x8,
    gap: Spacing.x12,
  },
  what: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x12,
    borderRadius: Radius.card,
  },
  art: { borderRadius: Radius.image },
  artEmpty: { alignItems: 'center', justifyContent: 'center' },
  whatText: { flex: 1, minWidth: 0, gap: 2 },
  list: { paddingHorizontal: Spacing.x8, paddingBottom: Spacing.x16 },
  emptyList: { flexGrow: 1 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x8,
    paddingVertical: Spacing.x8,
    borderRadius: Radius.card,
  },
  personText: { flex: 1, minWidth: 0, gap: 1 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foot: {
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x12,
    paddingBottom: Spacing.x12,
    gap: Spacing.x8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x12,
    padding: Spacing.x32,
  },
  sentMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.x8,
  },
  center: { textAlign: 'center' },
});
