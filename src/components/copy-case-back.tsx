import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text as RNText, View } from 'react-native';

import { CONDITION_LABEL, REGION_LABEL, completenessLabel, mediumFor } from '@/constants/physical';
import {
  CASE_TEMPLATES,
  CASE_TEMPLATE_SIZE,
  PLATFORMS,
  hasCase,
  type PlatformKey,
} from '@/constants/platform-cases';
import { formatPartialDate } from '@/constants/progress';
import { Typeface, readableInk } from '@/constants/theme';
import type { CopyWithRelations } from '@/lib/api';
import type { CopyArtImage } from '@/lib/api/copy-art';
import { maskBarcode } from '@/lib/barcode';

/**
 * The plastic of the case's back, and its sheen — **the same values as
 * `<GameCaseBack>`**, restated because that component keeps them private and is
 * protected from edits. The two backs must match exactly: they are the same
 * object with different things printed on it, and a second shade of plastic would
 * make the showcase's case look like a different product from the game page's.
 *
 * Exported for the rest of the showcase's case — its edges, its tray, the
 * inside of its cover — which are the same plastic seen from other sides.
 */
export const PLASTIC = {
  top: '#17181A',
  bottom: '#0E0F11',
  rule: 'rgba(255,255,255,0.07)',
  ink: '#E9EAEC',
  quiet: '#9A9DA3',
  highlight: 'rgba(255,255,255,0.10)',
} as const;

/** Every size is a fraction of the case's width, with a readable floor. */
const SIZES = {
  pad: (w: number) => Math.round(w * 0.072),
  band: (w: number) => Math.round(w * 0.125),
  bandLabel: (w: number) => Math.max(7, w * 0.05),
  title: (w: number) => Math.max(9, w * 0.068),
  label: (w: number) => Math.max(6.5, w * 0.04),
  value: (w: number) => Math.max(8, w * 0.054),
  notes: (w: number) => Math.max(7.5, w * 0.05),
  radius: (w: number) => Math.max(3, Math.round(w * 0.025)),
};

/** The corner of the case's back, which the 3D stage's back, tray and cover share. */
export const backCornerRadius = SIZES.radius;

export type CopyCaseBackProps = {
  copy: CopyWithRelations;
  platform: PlatformKey;
  width: number;
  /**
   * The face's height, when it is not a case's. A platform with a case is
   * drawn at its template's proportions and needs nothing here; a copy shown
   * as bare box art has no template, and its back has to be the same rectangle
   * as the art in front of it.
   */
  height?: number;
  /**
   * A scan of the real back cover (`useCopyArt`, GameTDB or ScreenScraper),
   * drawn in place of the printed record when there is one.
   */
  scan?: CopyArtImage | null;
  /**
   * Without the painted sheen: the 3D stage takes a picture of this face
   * (`<CopyStageSheet>`) and lights its plastic for real, so a drawn
   * reflection would be a second, fixed one.
   */
  unlit?: boolean;
};

/**
 * The back of a physical copy's case: what *this* box is.
 *
 * The game page's back prints your record of playing the game; this one prints
 * the record of owning it — which release, what came in the box, how it has
 * worn, when you got it. Same plastic, same branding band in the platform's own
 * colour, so turning either case over feels like the same object.
 *
 * Only what the owner filled in is printed. An unrecorded condition is left off
 * rather than printed as "Not recorded", which is a fact about the form and not
 * about the box.
 *
 * **This face is the only place the edition is printed.** There was a readable
 * list of the same facts under the case; the owner removed it — "the
 * information for the physical edition should only be displayed at the back of
 * the case" — so the case is drawn larger than it was, to be read here.
 *
 * **Unless the real back has been found** (`scan`, 2026-10-22: "fetch… a back
 * cover and CD disc to display. The front stays app-default"). Then the face
 * is the scan — the publisher's own back, under the same plastic sheen — and
 * the record is said under the stage while the back faces the reader
 * (`copyRecordLine`), so it is still shown, and still only once. A scan of a
 * whole sleeve (GameTDB's Wii and GameCube) is cropped to its back: the image
 * is drawn as tall as the face and slid so only `crop` shows.
 */
export function CopyCaseBack({
  copy,
  platform,
  width,
  height: given,
  scan,
  unlit = false,
}: CopyCaseBackProps) {
  /* The front's own height: each platform's case is drawn at its template's
     proportions, and the two faces must be one rectangle. */
  const size = hasCase(platform) ? CASE_TEMPLATES[platform].templateSize : CASE_TEMPLATE_SIZE;
  const height = given ?? (width / size.width) * size.height;
  const pad = SIZES.pad(width);
  /*
   * A face shorter than a keep case — a near-square 3DS box, a SNES box on its
   * side — has no room for the whole list this layout was drawn for, and a row
   * cut in half by the shell's edge reads as a fault. So a short face prints a
   * one-line title, as many whole rows as fit, and no note. The estimate is of
   * the type's own line boxes, a little generous so it errs toward one row
   * fewer. What does not fit is still in the showcase's spoken label.
   */
  const short = height < width * 1.1;
  const rowHeight = SIZES.label(width) * 1.3 + 1 + SIZES.value(width) * 1.35 + 5;
  const rowsRoom =
    height - SIZES.band(width) - pad * 2 - SIZES.title(width) * 1.35 - pad * 0.6 - pad * 0.5;
  const maxRows = short ? Math.max(0, Math.floor((rowsRoom + 5) / rowHeight)) : Infinity;

  const meta = PLATFORMS[platform];
  const band = hasCase(platform) ? CASE_TEMPLATES[platform].spineColor : meta.accent;
  const bandInk = readableInk(band);

  const barcode = copy.release?.barcodes[0]?.barcode ?? copy.contribution?.barcode ?? null;
  const release = [
    copy.region ? REGION_LABEL[copy.region] : null,
    copy.edition?.trim() || 'Standard',
  ]
    .filter(Boolean)
    .join(' · ');

  const rows: [string, string][] = [
    ['Release', release],
    ...(copy.completeness
      ? ([['In the box', completenessLabel(copy.completeness, mediumFor(platform))]] as [
          string,
          string,
        ][])
      : []),
    ...(copy.condition
      ? ([['Condition', CONDITION_LABEL[copy.condition]]] as [string, string][])
      : []),
    ...(copy.acquired_on
      ? ([['Got it', formatPartialDate(copy.acquired_on) ?? copy.acquired_on]] as [
          string,
          string,
        ][])
      : []),
    ...(barcode ? ([['Barcode', maskBarcode(barcode)]] as [string, string][]) : []),
  ];

  if (scan) {
    /* The shown part of the scan fills the face's height; its width follows
       the scan's own shape, and the face clips the rest. */
    const part = scan.crop ? scan.crop.right - scan.crop.left : 1;
    const drawnHeight = height;
    const drawnWidth = (drawnHeight * scan.width) / Math.max(1, scan.height);
    const shownWidth = drawnWidth * part;
    /* Centred when the shown part is not the face's own shape. */
    const left = -(scan.crop?.left ?? 0) * drawnWidth + (width - shownWidth) / 2;
    return (
      <View style={[styles.shell, { width, height, borderRadius: SIZES.radius(width) }]}>
        <LinearGradient
          colors={[PLASTIC.top, PLASTIC.bottom]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Image
          source={{ uri: scan.url }}
          recyclingKey={scan.url}
          cachePolicy="memory-disk"
          contentFit="fill"
          transition={200}
          style={{ position: 'absolute', top: 0, left, width: drawnWidth, height: drawnHeight }}
          accessibilityIgnoresInvertColors
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 0.55 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>
    );
  }

  return (
    <View style={[styles.shell, { width, height, borderRadius: SIZES.radius(width) }]}>
      <LinearGradient
        colors={[PLASTIC.top, PLASTIC.bottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.band, { height: SIZES.band(width), backgroundColor: band }]}>
        <View style={[styles.bandHighlight, { backgroundColor: PLASTIC.highlight }]} />
        <Ionicons name={meta.icon} size={SIZES.bandLabel(width) + 2} color={bandInk} />
        <RNText
          style={[styles.bandLabel, { fontSize: SIZES.bandLabel(width), color: bandInk }]}
          numberOfLines={1}>
          {meta.short}
        </RNText>
      </View>

      <View style={[styles.body, { padding: pad, gap: pad * 0.6 }]}>
        <RNText
          style={[styles.title, { fontSize: SIZES.title(width), color: PLASTIC.ink }]}
          numberOfLines={short ? 1 : 2}>
          {copy.game?.title ?? 'A copy'}
        </RNText>

        <View style={[styles.rows, { borderTopColor: PLASTIC.rule, paddingTop: pad * 0.5 }]}>
          {rows.slice(0, maxRows).map(([label, value]) => (
            <View key={label} style={styles.row}>
              <RNText
                style={[styles.label, { fontSize: SIZES.label(width), color: PLASTIC.quiet }]}
                numberOfLines={1}>
                {label.toUpperCase()}
              </RNText>
              <RNText
                style={[styles.value, { fontSize: SIZES.value(width), color: PLASTIC.ink }]}
                numberOfLines={1}>
                {value}
              </RNText>
            </View>
          ))}
        </View>

        {!short && !!copy.notes?.trim() && (
          <RNText
            style={[styles.notes, { fontSize: SIZES.notes(width), color: PLASTIC.quiet }]}
            numberOfLines={2}>
            “{copy.notes.trim()}”
          </RNText>
        )}
      </View>

      {/* The same diagonal sheen as both other faces. */}
      {!unlit && (
        <LinearGradient
          colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 0.55 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

/**
 * The copy's record in one line — release, region and edition, what is in
 * the box, its condition — said under the stage while a scanned back is
 * toward the reader, since the scan covers the printed one.
 */
export function copyRecordLine(copy: CopyWithRelations, platform: PlatformKey): string {
  return [
    copy.region ? REGION_LABEL[copy.region] : null,
    copy.edition?.trim() || 'Standard',
    copy.completeness ? completenessLabel(copy.completeness, mediumFor(platform)) : null,
    copy.condition ? CONDITION_LABEL[copy.condition] : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

const styles = StyleSheet.create({
  shell: { overflow: 'hidden' },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bandHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  bandLabel: { fontFamily: Typeface.bold, letterSpacing: 1 },
  body: { flex: 1 },
  title: { fontFamily: Typeface.bold, letterSpacing: 0.1 },
  rows: { gap: 5, borderTopWidth: StyleSheet.hairlineWidth },
  row: { gap: 1 },
  label: { fontFamily: Typeface.semibold, letterSpacing: 0.8 },
  value: { fontFamily: Typeface.medium },
  notes: { fontFamily: Typeface.italic, marginTop: 'auto' },
});
