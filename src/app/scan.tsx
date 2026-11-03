import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { CARD_INSET, cardShape } from '@/components/ui/card-material';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Poster } from '@/components/ui/poster';
import { LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { releaseLine } from '@/constants/physical';
import { PLATFORMS, platformKeyFor } from '@/constants/platform-cases';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  confirmReleaseContribution,
  lookupBarcode,
  type BarcodeLookup,
  type CatalogueMatch,
  type ContributionWithRelations,
} from '@/lib/api';
import {
  PRODUCT_BARCODE_TYPES,
  displayBarcode,
  normalizeBarcode,
  scannerType,
} from '@/lib/barcode';
import { displayNameFor } from '@/lib/format';
import { getGameById } from '@/lib/games';
import { useAuth } from '@/store/auth';
import { Loader } from '@/components/ui/loader';

/** How long the "didn't read cleanly" hint stays up after a misread. */
const MISREAD_MS = 1800;

/**
 * Scan a game box's barcode and find that exact release.
 *
 * ## The flow
 *
 *   camera permission → scanner → a valid barcode → Gamelog's own database
 *     found       the release, and "Add to my copies"
 *     pending     someone described this box already: "That's my copy too"
 *   → then, only if Gamelog knows nothing, ScanDex's catalogue
 *     identified  ScanDex knows the game and platform; region and edition are
 *                 for the person holding the box to add
 *     unknown     "We don't recognize this release yet" → add it
 *
 * Gamelog's own catalogue comes first and is the only thing a copy can be
 * attached to as a *release*. ScanDex (behind the `scandex` Edge Function, which
 * holds the token) identifies boxes the community has not described yet, and
 * the scanner never depends on it: if it is down or not configured, a scan ends
 * at "unknown" exactly as it did before it was added.
 *
 * ## Noise is not a result
 *
 * Only the four symbologies a game box carries are read (`PRODUCT_BARCODE_TYPES`)
 * and a code must pass its check digit before it is looked up. A QR code on a
 * manual is ignored; a half-read barcode says so and keeps scanning, instead of
 * sending garbage to the database and telling someone their box is unknown.
 *
 * ## When the camera cannot be used
 *
 * Denied, unavailable (the web, an emulator), or failing to start — each says
 * which, and each offers typing the digits under the bars instead. The scanner
 * is a convenience; the lookup must never depend on it.
 */
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState<string | null>(null);
  const [manual, setManual] = useState(Platform.OS === 'web');
  const [cameraFailed, setCameraFailed] = useState(false);
  const [torch, setTorch] = useState(false);

  const cameraReady = !manual && !cameraFailed && permission?.granted === true;

  let content: React.ReactNode;
  if (manual || cameraFailed) {
    content = (
      <ManualEntry
        code={code}
        reason={
          cameraFailed
            ? 'The camera could not start on this device.'
            : Platform.OS === 'web'
              ? 'Scanning needs the app on a phone.'
              : null
        }
        onCode={setCode}
        onReset={() => setCode(null)}
        onUseCamera={Platform.OS === 'web' || cameraFailed ? null : () => setManual(false)}
      />
    );
  } else if (!permission) {
    content = <LoadingState />;
  } else if (!permission.granted) {
    content = (
      <PermissionState
        canAsk={permission.canAskAgain}
        onAsk={() => void requestPermission()}
        onManual={() => setManual(true)}
      />
    );
  } else {
    content = (
      <CameraScanner
        code={code}
        torch={torch}
        onCode={setCode}
        onReset={() => setCode(null)}
        onManual={() => setManual(true)}
        onMountError={() => setCameraFailed(true)}
      />
    );
  }

  return (
    <Screen
      miniPlayer={false}
      /* The camera runs edge to edge, under the status bar and the disc; every
         other state is a page of text and gets the inset. */
      edges={cameraReady ? [] : ['bottom']}
      insetHeader={!cameraReady}
      topBar={
        <FrostedTopBar
          dismiss
          right={
            cameraReady && !code ? (
              <TopBarDisc
                icon={torch ? 'flash' : 'flash-outline'}
                label={torch ? 'Turn the torch off' : 'Turn the torch on'}
                onPress={() => setTorch((on) => !on)}
              />
            ) : undefined
          }
        />
      }>
      {content}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// The camera
// ---------------------------------------------------------------------------

function CameraScanner({
  code,
  torch,
  onCode,
  onReset,
  onManual,
  onMountError,
}: {
  code: string | null;
  torch: boolean;
  onCode: (gtin: string) => void;
  onReset: () => void;
  onManual: () => void;
  onMountError: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [misread, setMisread] = useState(false);
  const misreadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* The callback fires many times a second while a barcode is in frame, and a
     state update does not land before the next frame arrives. The ref is what
     stops one box being looked up five times. */
  const held = useRef(false);

  function onScanned(result: BarcodeScanningResult) {
    if (held.current) return;
    const type = scannerType(result.type);
    if (!type) return;

    const gtin = normalizeBarcode(result.data, type);
    if (!gtin) {
      setMisread(true);
      if (misreadTimer.current) clearTimeout(misreadTimer.current);
      misreadTimer.current = setTimeout(() => setMisread(false), MISREAD_MS);
      return;
    }

    held.current = true;
    setMisread(false);
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    onCode(gtin);
  }

  function scanAgain() {
    held.current = false;
    onReset();
  }

  /* The window a barcode is lined up in: wide and short, the shape of the thing
     it is for. Fixed proportions of the display, capped for tablets. */
  const windowWidth = Math.min(width * 0.8, 380);
  const windowHeight = windowWidth * 0.46;
  const scrim = withAlpha(theme.shadowInk, 0.5);

  return (
    <View style={styles.camera}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: [...PRODUCT_BARCODE_TYPES] }}
        /* Unset while a code is held: the camera stays live behind the result
           as context, but reads nothing until "Scan another". */
        onBarcodeScanned={code ? undefined : onScanned}
        onMountError={onMountError}
      />

      {/* The dimmed frame around the window, as four blocks — a cut-out, not an
          image, so it stays sharp at any size. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.flex, { backgroundColor: scrim }]} />
        <View style={[styles.windowRow, { height: windowHeight }]}>
          <View style={[styles.flex, { backgroundColor: scrim }]} />
          <View style={{ width: windowWidth, height: windowHeight }}>
            <Corner position="topLeft" color={theme.text} />
            <Corner position="topRight" color={theme.text} />
            <Corner position="bottomLeft" color={theme.text} />
            <Corner position="bottomRight" color={theme.text} />
          </View>
          <View style={[styles.flex, { backgroundColor: scrim }]} />
        </View>
        <View style={[styles.flex, styles.hintArea, { backgroundColor: scrim }]}>
          {!code && (
            <Text
              variant="body"
              style={[styles.hint, { color: theme.text }]}
              accessibilityLiveRegion="polite">
              {misread
                ? 'That one did not read cleanly — hold the box steady.'
                : 'Line up the barcode on the back of the box.'}
            </Text>
          )}
        </View>
      </View>

      <View
        style={[
          styles.bottom,
          { paddingBottom: insets.bottom + Spacing.x16 },
          code ? { backgroundColor: theme.background } : null,
        ]}>
        {code ? (
          <LookupResult code={code} onScanAgain={scanAgain} />
        ) : (
          <Button
            title="Type the barcode instead"
            icon="keypad-outline"
            variant="secondary"
            onPress={onManual}
          />
        )}
      </View>
    </View>
  );
}

/** One L of the window's four corners. Drawn with borders, so no asset. */
function Corner({
  position,
  color,
}: {
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  color: string;
}) {
  const top = position.startsWith('top');
  const left = position.endsWith('Left');
  return (
    <View
      style={[
        styles.corner,
        {
          borderColor: color,
          [top ? 'top' : 'bottom']: 0,
          [left ? 'left' : 'right']: 0,
          [top ? 'borderTopWidth' : 'borderBottomWidth']: 3,
          [left ? 'borderLeftWidth' : 'borderRightWidth']: 3,
          [`border${top ? 'Top' : 'Bottom'}${left ? 'Left' : 'Right'}Radius`]: Radius.lg,
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Permission and manual entry
// ---------------------------------------------------------------------------

function PermissionState({
  canAsk,
  onAsk,
  onManual,
}: {
  canAsk: boolean;
  onAsk: () => void;
  onManual: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.centred}>
      <Ionicons name="barcode-outline" size={48} color={theme.textSecondary} />
      <Text variant="h2" style={styles.centredText}>
        {canAsk ? 'Scan a game’s barcode' : 'Camera access is required to scan a game barcode.'}
      </Text>
      <Text variant="body" color="textSecondary" style={styles.centredText}>
        {canAsk
          ? 'Pinged reads the barcode on the back of the box to find that exact release. The camera is only used while this screen is open.'
          : 'It was turned off for Pinged. You can switch it back on in Settings, or type the digits under the bars instead.'}
      </Text>
      <View style={styles.stack}>
        {canAsk ? (
          <Button title="Allow the camera" icon="camera-outline" fullWidth onPress={onAsk} />
        ) : (
          <Button
            title="Open Settings"
            icon="settings-outline"
            fullWidth
            onPress={() => void Linking.openSettings()}
          />
        )}
        <Button title="Type the barcode instead" variant="ghost" fullWidth onPress={onManual} />
      </View>
    </View>
  );
}

function ManualEntry({
  code,
  reason,
  onCode,
  onReset,
  onUseCamera,
}: {
  code: string | null;
  /** Why the camera is not being used, when that was not the reader's choice. */
  reason: string | null;
  onCode: (gtin: string) => void;
  onReset: () => void;
  onUseCamera: (() => void) | null;
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  function lookUp() {
    /* Typed input has no symbology, so an 8-digit code is read as EAN-8. A UPC-E
       typed by hand would need its type to be expanded, and there is no way to
       ask for it that a person would understand — the camera reads those. */
    const gtin = normalizeBarcode(input);
    if (!gtin) {
      setError(
        'That does not look like a game barcode. Check the digits under the bars — 12 or 13 of them, usually.'
      );
      return;
    }
    setError(null);
    onCode(gtin);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
      <PageScrollView
        contentContainerStyle={styles.manual}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text variant="h1">Look up a barcode</Text>
          {reason && (
            <Text variant="bodySmall" color="textMuted">
              {reason}
            </Text>
          )}
        </View>

        {code ? (
          <LookupResult
            code={code}
            onScanAgain={() => {
              setInput('');
              onReset();
            }}
          />
        ) : (
          <>
            <TextField
              label="Barcode"
              value={input}
              onChangeText={(value) => {
                setInput(value);
                setError(null);
              }}
              keyboardType="number-pad"
              placeholder="036000291452"
              maxLength={18}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={lookUp}
              error={error}
              hint="The digits printed under the bars on the back of the box."
            />
            <Button title="Look it up" fullWidth disabled={!input.trim()} onPress={lookUp} />
            {onUseCamera && (
              <Button
                title="Use the camera"
                icon="camera-outline"
                variant="ghost"
                fullWidth
                onPress={onUseCamera}
              />
            )}
          </>
        )}
      </PageScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// The answer
// ---------------------------------------------------------------------------

function LookupResult({ code, onScanAgain }: { code: string; onScanAgain: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const lookup = useQuery({
    queryKey: ['barcode', code],
    queryFn: () => lookupBarcode(code),
    staleTime: 60_000,
    retry: 1,
  });

  const shown = displayBarcode(code);

  if (lookup.isLoading) {
    return (
      <View style={styles.result} accessibilityLiveRegion="polite">
        <View style={styles.loadingRow}>
          <Loader color={theme.textSecondary} />
          <Text variant="body" color="textSecondary">
            Looking up {shown}…
          </Text>
        </View>
      </View>
    );
  }

  if (lookup.isLoadingError || !lookup.data) {
    return (
      <View style={styles.result} accessibilityLiveRegion="polite">
        <Text variant="h3">Could not look that up</Text>
        <Text variant="bodySmall" color="textSecondary">
          {lookup.error instanceof Error
            ? lookup.error.message
            : 'Check your connection and try again.'}
        </Text>
        <View style={styles.stack}>
          <Button title="Try again" fullWidth onPress={() => void lookup.refetch()} />
          <Button title="Scan another" variant="ghost" fullWidth onPress={onScanAgain} />
        </View>
      </View>
    );
  }

  return (
    <ResultBody
      result={lookup.data}
      shown={shown}
      onScanAgain={onScanAgain}
      onSearch={() => router.push('/add-copy')}
    />
  );
}

function ResultBody({
  result,
  shown,
  onScanAgain,
  onSearch,
}: {
  result: BarcodeLookup;
  shown: string;
  onScanAgain: () => void;
  onSearch: () => void;
}) {
  const router = useRouter();

  if (result.kind === 'found') {
    const { release } = result;
    return (
      <View style={styles.result} accessibilityLiveRegion="polite">
        <ReleaseCard
          title={release.game?.title ?? 'Unknown game'}
          coverUrl={release.game?.cover_url ?? null}
          heroUrl={release.game?.hero_url ?? null}
          line={releaseLine(release)}
          sub={release.publisher ?? `Barcode ${shown}`}
        />
        <View style={styles.stack}>
          <Button
            title="Add to my copies"
            icon="add"
            fullWidth
            onPress={() =>
              router.push({
                pathname: '/add-copy',
                params: { game: release.game_id, release: release.id },
              })
            }
          />
          <Button
            title="Open the game"
            variant="secondary"
            fullWidth
            onPress={() => router.push({ pathname: '/game/[id]', params: { id: release.game_id } })}
          />
          <Button title="Scan another" variant="ghost" fullWidth onPress={onScanAgain} />
        </View>
      </View>
    );
  }

  if (result.kind === 'pending') {
    return (
      <PendingResult
        barcode={result.barcode}
        claims={result.claims}
        shown={shown}
        onScanAgain={onScanAgain}
      />
    );
  }

  if (result.kind === 'identified') {
    return (
      <IdentifiedResult barcode={result.barcode} match={result.match} onScanAgain={onScanAgain} />
    );
  }

  return (
    <View style={styles.result} accessibilityLiveRegion="polite">
      <Text variant="h3">We don’t recognize this release yet.</Text>
      <Text variant="bodySmall" color="textSecondary">
        Nobody has added barcode {shown}. Tell us what’s in the box — once someone else with the
        same box agrees, it’s in the database for everyone.
      </Text>
      <View style={styles.stack}>
        <Button
          title="Add this release"
          icon="add-circle-outline"
          fullWidth
          onPress={() =>
            router.push({ pathname: '/add-release', params: { barcode: result.barcode } })
          }
        />
        <Button title="Scan again" variant="secondary" fullWidth onPress={onScanAgain} />
        <Button title="Search manually" variant="ghost" fullWidth onPress={onSearch} />
      </View>
    </View>
  );
}

/**
 * Somebody has described this box already, and it is waiting for agreement.
 *
 * The most useful thing the next person with the same box can do is say "yes,
 * that is what this is" — one tap, and two independent people agreeing is what
 * makes the release canonical (0024). If what they are holding is something
 * else, they describe their own; the two claims then wait for a third person or
 * a moderator, and neither is lost.
 */
function PendingResult({
  barcode,
  claims,
  shown,
  onScanAgain,
}: {
  barcode: string;
  claims: ContributionWithRelations[];
  shown: string;
  onScanAgain: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const mine = claims.find((claim) => claim.user_id === viewerId) ?? null;
  const others = claims.filter((claim) => claim.user_id !== viewerId).slice(0, 2);

  const confirm = useMutation({
    mutationFn: (claimId: string) => confirmReleaseContribution(claimId),
    onSuccess: (outcome, claimId) => {
      queryClient.invalidateQueries({ queryKey: ['barcode', barcode] });
      const claim = claims.find((entry) => entry.id === claimId);
      if (claim) queryClient.invalidateQueries({ queryKey: ['game-releases', claim.game_id] });
      if (outcome.status === 'duplicate') {
        queryClient.invalidateQueries({ queryKey: ['my-contributions', viewerId] });
      }
    },
  });

  return (
    <PageScrollView
      style={styles.resultScroll}
      contentContainerStyle={styles.result}
      showsVerticalScrollIndicator={false}>
      <Text variant="h3" accessibilityLiveRegion="polite">
        {mine ? 'You submitted this one' : 'Someone has described this box'}
      </Text>
      <Text variant="bodySmall" color="textSecondary">
        {mine
          ? `Barcode ${shown} is waiting for one more person with the same box to confirm it, or for a moderator.`
          : `Barcode ${shown} is waiting for confirmation. If it matches what you are holding, say so — that is what puts it in the database.`}
      </Text>

      {mine && (
        <>
          <ReleaseCard
            title={mine.game?.title ?? 'Unknown game'}
            coverUrl={mine.game?.cover_url ?? null}
            heroUrl={mine.game?.hero_url ?? null}
            line={releaseLine(mine)}
            sub="Your submission"
          />
          <Button
            title="Add to my copies"
            icon="add"
            fullWidth
            onPress={() =>
              router.push({
                pathname: '/add-copy',
                params: { game: mine.game_id, contribution: mine.id },
              })
            }
          />
        </>
      )}

      {others.map((claim) => (
        <View key={claim.id} style={styles.claim}>
          <ReleaseCard
            title={claim.game?.title ?? 'Unknown game'}
            coverUrl={claim.game?.cover_url ?? null}
            heroUrl={claim.game?.hero_url ?? null}
            line={releaseLine(claim)}
            sub={`Submitted by ${displayNameFor(claim.profile)}`}
          />
          {!mine && (
            <Button
              title="That’s my copy too"
              icon="checkmark"
              fullWidth
              loading={confirm.isPending && confirm.variables === claim.id}
              disabled={confirm.isPending}
              onPress={() => confirm.mutate(claim.id)}
            />
          )}
        </View>
      ))}

      {confirm.isError && (
        <Text variant="bodySmall" color="danger">
          {confirm.error instanceof Error ? confirm.error.message : 'Could not confirm that.'}
        </Text>
      )}

      <View style={styles.stack}>
        {!mine && (
          <Button
            title="Mine is different"
            variant="secondary"
            fullWidth
            onPress={() => router.push({ pathname: '/add-release', params: { barcode } })}
          />
        )}
        <Button title="Scan another" variant="ghost" fullWidth onPress={onScanAgain} />
      </View>
    </PageScrollView>
  );
}

/**
 * ScanDex knows this box: which game, on which platform.
 *
 * That is enough to add a copy and to open the game, so both are one tap. It is
 * not a release — ScanDex says nothing about region or edition — so the copy is
 * added with the platform filled in and the rest left to the form, and the third
 * button is how the box gets into Gamelog's own database, with the game and
 * platform already chosen. Once someone does that and a second person agrees,
 * this barcode answers "found" and ScanDex is not asked again.
 *
 * The source is named on the card. It is a third party's answer, and a reader
 * deciding whether to trust it should know whose.
 */
function IdentifiedResult({
  barcode,
  match,
  onScanAgain,
}: {
  barcode: string;
  match: CatalogueMatch;
  onScanAgain: () => void;
}) {
  const router = useRouter();

  /* The cover and IGDB's own title. The card is useful without them — ScanDex's
     title is shown until they arrive, and kept if they never do. */
  const game = useQuery({
    queryKey: ['game', match.gameId],
    queryFn: ({ signal }) => getGameById(match.gameId, signal),
    staleTime: 30 * 60_000,
  });

  /* ScanDex speaks IGDB's platform names ("Nintendo Switch"); the forms store
     the short form ("SWITCH"). An unrecognised name prefills nothing. */
  const key = match.platformName ? platformKeyFor(match.platformName) : null;
  const platform = key && key !== 'other' ? PLATFORMS[key] : null;
  const prefill = {
    game: match.gameId,
    ...(platform ? { platform: platform.short } : {}),
  };

  return (
    <View style={styles.result} accessibilityLiveRegion="polite">
      <ReleaseCard
        title={game.data?.title ?? match.title}
        coverUrl={game.data?.coverUrl ?? null}
        heroUrl={game.data?.heroUrl ?? null}
        line={platform?.label ?? match.platformName ?? ''}
        sub="Identified by ScanDex"
      />
      <Text variant="bodySmall" color="textSecondary">
        We know the game, not the region or edition of this box. Add those and it goes into Pinged’s
        database for the next person who scans it.
      </Text>
      <View style={styles.stack}>
        <Button
          title="Add to my copies"
          icon="add"
          fullWidth
          onPress={() => router.push({ pathname: '/add-copy', params: prefill })}
        />
        <Button
          title="Open the game"
          variant="secondary"
          fullWidth
          onPress={() => router.push({ pathname: '/game/[id]', params: { id: match.gameId } })}
        />
        <Button
          title="Add region and edition"
          variant="secondary"
          fullWidth
          onPress={() => router.push({ pathname: '/add-release', params: { ...prefill, barcode } })}
        />
        <Button title="Scan another" variant="ghost" fullWidth onPress={onScanAgain} />
      </View>
    </View>
  );
}

function ReleaseCard({
  title,
  coverUrl,
  heroUrl,
  line,
  sub,
}: {
  title: string;
  coverUrl: string | null;
  heroUrl: string | null;
  line: string;
  sub: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        cardShape,
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
      accessible
      accessibilityLabel={`${title}. ${line}. ${sub}`}>
      <Poster coverUrl={coverUrl} heroUrl={heroUrl} title={title} width={56} rounded="image" />
      <View style={styles.cardText}>
        <Text variant="h4" numberOfLines={2}>
          {title}
        </Text>
        {!!line && (
          <Text variant="bodySmall" color="textSecondary">
            {line}
          </Text>
        )}
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  camera: { flex: 1 },
  windowRow: { flexDirection: 'row' },
  hintArea: { alignItems: 'center', paddingTop: Spacing.x24, paddingHorizontal: Spacing.x24 },
  hint: { textAlign: 'center' },
  corner: { position: 'absolute', width: 28, height: 28 },
  /* The controls and the answer, over the bottom of the camera. Transparent
     while scanning so the frame stays visible; a surface once there is an
     answer to read. */
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x16,
    /* A sheet over the camera once it holds an answer: `Radius.sheet`. */
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
  },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x16,
    padding: Spacing.x24,
  },
  centredText: { textAlign: 'center' },
  stack: { gap: Spacing.x8, alignSelf: 'stretch' },
  manual: { padding: Spacing.x16, gap: Spacing.x16, paddingBottom: Spacing.x48 },
  head: { gap: Spacing.x4 },
  result: { gap: Spacing.x12 },
  resultScroll: { maxHeight: 520 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  claim: { gap: Spacing.x8 },
  /* Every card's material (`card-material`). */
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12, padding: CARD_INSET },
  cardText: { flex: 1, gap: 2 },
});
