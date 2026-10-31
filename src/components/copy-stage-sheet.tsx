import { memo, useEffect, useRef, type RefObject } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { CopyCaseBack } from '@/components/copy-case-back';
import { CopyCaseLip, CopyCaseSpine } from '@/components/copy-case-edge';
import { CopyCaseEditionBand } from '@/components/copy-case-front';
import type { PlatformKey } from '@/constants/platform-cases';
import type { CopyWithRelations } from '@/lib/api';

/** Pictures of the case's printed faces, as local files, for the 3D stage to print with. */
export type StageSnapshots = {
  /** What they were taken of: a new key means the copy's record changed and they are retaken. */
  key: string;
  /** The printed back; null when the back is a scan of the real one, which is drawn instead. */
  back: string | null;
  spine: string;
  lip: string;
  edition: string | null;
  /** The edition band's height, as a share of the case's. */
  editionHeight: number;
};

export type CopyStageSheetProps = {
  copy: CopyWithRelations;
  platform: PlatformKey;
  caseWidth: number;
  caseHeight: number;
  depth: number;
  title: string;
  edition: string | null;
  /** Whether the back is printed (no scan of the real one). */
  printedBack: boolean;
  /** Where the case stands on the stage, so the sheet is laid out under it. */
  left: number;
  top: number;
  pageColor: string;
  snapshotKey: string;
  onCaptured: (snapshots: StageSnapshots) => void;
  onFail: (reason: string) => void;
};

/**
 * The case's printed faces, laid out once for the 3D stage to photograph.
 *
 * The 3D stage's case is the flat stage's case, printed the same way: the
 * back's record of the copy, the spine, the opening edge and the edition band
 * are text and gradients that only React Native lays out, and a GPU cannot
 * set type. So they are drawn here by the very components the flat stage
 * draws them with, captured as pictures (`react-native-view-shot`), and handed
 * on. The box art, the case template and the disc are not here: those are
 * pictures already, and the 3D stage reads them directly.
 *
 * It sits at the very back of the stage, under the case, behind a cover in
 * the page's own colour — so it is laid out and drawn as any visible view is
 * (a capture of a hidden or off-screen view can come back empty), and nobody
 * sees it. It is unmounted as soon as the pictures are taken.
 *
 * Nothing in it is an image component: expo-image's Android bitmaps live on
 * the GPU, and view-shot draws on a software canvas that cannot read them.
 */
export const CopyStageSheet = memo(function CopyStageSheet({
  copy,
  platform,
  caseWidth,
  caseHeight,
  depth,
  title,
  edition,
  printedBack,
  left,
  top,
  pageColor,
  snapshotKey,
  onCaptured,
  onFail,
}: CopyStageSheetProps) {
  const back = useRef<View>(null);
  const spine = useRef<View>(null);
  const lip = useRef<View>(null);
  const band = useRef<View>(null);
  const laid = useRef(new Set<string>());
  const bandHeight = useRef(0);
  const alive = useRef(true);
  const started = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const needed = ['spine', 'lip', ...(printedBack ? ['back'] : []), ...(edition ? ['band'] : [])];

  const capture = async () => {
    try {
      /* Imported here, as the share sheet does: the stage is only offered
         this path once the module is known to be in the build. */
      const { captureRef } = await import('react-native-view-shot');
      /* A frame for the native views to be drawn once before they are read. */
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const shoot = (ref: RefObject<View | null>) =>
        captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
      const [backUri, spineUri, lipUri, bandUri] = await Promise.all([
        printedBack ? shoot(back) : Promise.resolve(null),
        shoot(spine),
        shoot(lip),
        edition ? shoot(band) : Promise.resolve(null),
      ]);
      if (!alive.current) return;
      onCaptured({
        key: snapshotKey,
        back: backUri,
        spine: spineUri,
        lip: lipUri,
        edition: bandUri,
        editionHeight: edition ? bandHeight.current / caseHeight : 0,
      });
    } catch (error) {
      if (alive.current) onFail(`the case's faces could not be captured: ${String(error)}`);
    }
  };

  const laidOut = (name: string) => (event: LayoutChangeEvent) => {
    if (name === 'band') bandHeight.current = event.nativeEvent.layout.height;
    laid.current.add(name);
    if (started.current || !needed.every((part) => laid.current.has(part))) return;
    started.current = true;
    void capture();
  };

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.sheet, { left, top, width: caseWidth, height: caseHeight }]}>
      {printedBack && (
        <View ref={back} collapsable={false} style={styles.part} onLayout={laidOut('back')}>
          <CopyCaseBack
            copy={copy}
            platform={platform}
            width={caseWidth}
            height={caseHeight}
            unlit
          />
        </View>
      )}
      <View ref={spine} collapsable={false} style={styles.part} onLayout={laidOut('spine')}>
        <CopyCaseSpine
          platform={platform}
          depth={depth}
          height={caseHeight}
          caseWidth={caseWidth}
          title={title}
        />
      </View>
      <View ref={lip} collapsable={false} style={styles.part} onLayout={laidOut('lip')}>
        <CopyCaseLip platform={platform} depth={depth} height={caseHeight} caseWidth={caseWidth} />
      </View>
      {!!edition && (
        <View
          ref={band}
          collapsable={false}
          style={[styles.part, { width: caseWidth }]}
          onLayout={laidOut('band')}>
          <CopyCaseEditionBand edition={edition} floating={false} />
        </View>
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: pageColor }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  sheet: { position: 'absolute' },
  part: { position: 'absolute', left: 0, top: 0 },
});
