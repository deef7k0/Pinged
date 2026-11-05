import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { GlassSurface, useLiquidGlass } from '@/components/ui/liquid-glass';
import { Loader } from '@/components/ui/loader';
import { PageFlatList } from '@/components/ui/page-scroll';
import { PressGlyph } from '@/components/ui/press-glyph';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { PosterAspectRatio, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
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
import { toast } from '@/lib/toast';

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
        <EmptyState
          icon="paper-plane-outline"
          title="Nothing to ping"
          message="This link doesn’t point at anything."
        />
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
  const accent = useAccent();
  const liquid = useLiquidGlass();
  const filled = { fill: theme.text, ink: theme.onPrimary };
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
      if (outcome.failed.length === 0)
        toast.success(outcome.sent === 1 ? 'Ping sent' : 'Pings sent');
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
  /* The people pinged most recently come first (`pingable_people`), so the
     rail is the people you send to. Hidden while searching. */
  const recent = search.trim() ? [] : (people.data ?? []).slice(0, RAIL_COUNT);

  let list: React.ReactNode;
  if (people.isPending) list = <LoadingState />;
  else if (people.isLoadingError) {
    list = isPingsNotReady(people.error) ? (
      <EmptyState
        icon="paper-plane-outline"
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
        ItemSeparatorComponent={PersonRule}
        contentContainerStyle={shown.length === 0 ? styles.emptyList : styles.list}
        ListHeaderComponent={
          recent.length > 1 ? (
            <RecentRail people={recent} chosen={chosen} onToggle={toggle} />
          ) : null
        }
        ListEmptyComponent={
          search.trim() ? (
            <EmptyState
              title="Nobody by that name"
              message="Only people you can ping are listed."
            />
          ) : (
            <EmptyState
              icon="paper-plane-outline"
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

      {/*
        The line and the send, docked over the keyboard as one capsule —
        Messages' (the Apple pass, 2026-11-05). It was a field and a
        full-width "Ping 3 people" button in a band at the foot.
      */}
      <View style={styles.foot}>
        {(send.isError || tooLong) && (
          <Text variant="bodySmall" color="danger" style={styles.footNote}>
            {tooLong
              ? `${DIRECT_PING_MESSAGE_MAX} characters at most.`
              : send.error instanceof Error
                ? send.error.message
                : 'Could not send that.'}
          </Text>
        )}
        <View
          style={[
            styles.capsule,
            liquid ? styles.capsuleGlass : { backgroundColor: theme.surfaceElevated },
            { borderColor: theme.border },
          ]}>
          {liquid && <GlassSurface radius={CAPSULE / 2} />}
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={chosen.size > 0 ? 'Add a line (optional)' : 'Choose who to ping'}
            placeholderTextColor={theme.textMuted}
            selectionColor={accent.onSurface}
            maxLength={DIRECT_PING_MESSAGE_MAX + 20}
            multiline
            accessibilityLabel="A line to go with it"
            style={[styles.input, { color: theme.text }]}
          />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={sendLabel(chosen.size)}
            accessibilityState={{ disabled: chosen.size === 0 || tooLong || send.isPending }}
            disabled={chosen.size === 0 || tooLong || send.isPending}
            onPress={() => send.mutate()}
            scaleTo={0.9}
            style={StyleSheet.flatten([
              styles.send,
              { backgroundColor: send.isPending ? theme.controlFill : filled.fill },
              (chosen.size === 0 || tooLong) && styles.sendOff,
            ])}>
            {send.isPending ? (
              <Loader size="small" color={theme.text} />
            ) : (
              <PressGlyph>
                <Ionicons name="paper-plane" size={17} color={filled.ink} />
              </PressGlyph>
            )}
          </PressableScale>
        </View>
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
      style={StyleSheet.flatten([styles.person, { backgroundColor: withAlpha(theme.text, 0) }])}>
      <Avatar uri={person.avatar_url} name={name} size={40} />
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
            ? { backgroundColor: theme.text, borderColor: theme.text }
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

/** The hairline between people, from where the names start. */
function PersonRule() {
  const theme = useTheme();
  return <View style={[styles.personRule, { backgroundColor: theme.border }]} />;
}

/** How many faces the rail holds. */
const RAIL_COUNT = 8;
const RAIL_FACE = 56;

/**
 * The people you ping most, as a rail of round faces that tick — the share
 * sheet's row of people. A tap is the same as ticking their row below.
 */
function RecentRail({
  people,
  chosen,
  onToggle,
}: {
  people: Profile[];
  chosen: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.rail}
      contentContainerStyle={styles.railContent}>
      {people.map((person) => {
        const name = displayNameFor(person);
        const selected = chosen.has(person.id);
        return (
          <PressableScale
            key={person.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={name}
            onPress={() => onToggle(person.id)}
            scaleTo={0.92}
            style={styles.railItem}>
            <View>
              <Avatar uri={person.avatar_url} name={name} size={RAIL_FACE} />
              {selected && (
                <View
                  style={[
                    styles.railTick,
                    { backgroundColor: theme.text, borderColor: theme.background },
                  ]}>
                  <PressGlyph pop={selected}>
                    <Ionicons name="checkmark" size={13} color={theme.onPrimary} />
                  </PressGlyph>
                </View>
              )}
            </View>
            <Text variant="caption" numberOfLines={1} style={styles.railName}>
              {name}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

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

/** The message capsule's height at one line. */
const CAPSULE = 48;

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
  list: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x16 },
  emptyList: { flexGrow: 1 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x8,
  },
  personRule: { height: StyleSheet.hairlineWidth, marginLeft: 40 + Spacing.x12 },
  rail: { flexGrow: 0, marginHorizontal: -Spacing.x16, marginBottom: Spacing.x12 },
  railContent: { paddingHorizontal: Spacing.x16, gap: Spacing.x12 },
  railItem: { width: RAIL_FACE + Spacing.x8, alignItems: 'center', gap: Spacing.x4 },
  railName: { textAlign: 'center' },
  railTick: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
  foot: { paddingHorizontal: Spacing.x12, paddingTop: Spacing.x8, paddingBottom: Spacing.x8 },
  footNote: { paddingHorizontal: Spacing.x8, paddingBottom: Spacing.x4 },
  capsule: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: CAPSULE,
    paddingLeft: Spacing.x16,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: CAPSULE / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  capsuleGlass: { borderWidth: 0 },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    maxHeight: 110,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 0,
  },
  send: {
    width: CAPSULE - 8,
    height: CAPSULE - 8,
    borderRadius: (CAPSULE - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.x8,
  },
  sendOff: { opacity: 0.35 },
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
