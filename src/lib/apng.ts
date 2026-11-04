/**
 * An APNG split into its frames, each a plain PNG Skia can decode — so the
 * game page's one blur can play an animated PNG too (the owner's, 2026-11-04:
 * "the blur when scrolling seems to not work for the animated artwork and
 * blurs the still image"). Skia has no APNG decoder: an APNG is its first
 * frame there, and many SteamGridDB animated grids are APNGs, so the
 * animation was drawn over the art by expo-image while the blur under it was
 * made from the still.
 *
 * The method is the format's own (W3C PNG, 3rd ed., § 11.3, "APNG"): every
 * frame is a `fcTL` (where it goes, how long it stays, what happens to it
 * after) and its image data — `IDAT` for the default image, `fdAT` (a
 * sequence number, then the same bytes) for the rest. A frame is made a PNG
 * by writing the file's header with the frame's size, every chunk the file
 * put before its image data (a palette, transparency, gamma…), the frame's
 * data as `IDAT`, and `IEND`. Nothing is inflated: the bytes are moved, and
 * the CRCs of the two chunks that change are worked out again.
 *
 * The frames are composited — `dispose_op`, `blend_op` — where they are
 * drawn (`ui/progressive-blur`). Pure, nothing imported: `npm test` covers it.
 */

export type ApngFrame = {
  /** The frame as a standalone PNG. */
  png: Uint8Array;
  /** Where it goes on the canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** How long it stays, in ms. */
  delay: number;
  /** After it: 0 leave it, 1 clear its region, 2 put back what was there. */
  dispose: 0 | 1 | 2;
  /** Drawn: 0 replacing its region, 1 over it. */
  blend: 0 | 1;
};

export type Apng = { width: number; height: number; frames: ApngFrame[] };

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** Whether these bytes are a PNG that animates (it has an `acTL` before its image data). */
export function isApng(bytes: Uint8Array): boolean {
  if (!hasSignature(bytes)) return false;
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = readU32(bytes, at);
    const type = chunkType(bytes, at + 4);
    if (type === 'acTL') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    at += 12 + length;
  }
  return false;
}

/** The frames of an APNG, or null for anything else or anything malformed. */
export function splitApng(bytes: Uint8Array): Apng | null {
  if (!hasSignature(bytes)) return null;
  let at = 8;
  let header: Uint8Array | null = null;
  let width = 0;
  let height = 0;
  const shared: Uint8Array[] = [];
  const frames: ApngFrame[] = [];
  let control: Omit<ApngFrame, 'png'> | null = null;
  let data: Uint8Array[] = [];
  let seenImage = false;

  const finish = () => {
    if (!control || !header || data.length === 0) return;
    frames.push({ ...control, png: framePng(header, control.width, control.height, shared, data) });
    data = [];
  };

  while (at + 12 <= bytes.length) {
    const length = readU32(bytes, at);
    const type = chunkType(bytes, at + 4);
    const start = at + 8;
    if (start + length + 4 > bytes.length) return null;
    const body = bytes.subarray(start, start + length);

    if (type === 'IHDR') {
      if (length !== 13) return null;
      header = body;
      width = readU32(body, 0);
      height = readU32(body, 4);
    } else if (type === 'fcTL') {
      if (length !== 26) return null;
      finish();
      const delayNum = readU16(body, 20);
      const delayDen = readU16(body, 22) || 100;
      control = {
        width: readU32(body, 4),
        height: readU32(body, 8),
        x: readU32(body, 12),
        y: readU32(body, 16),
        delay: Math.round((delayNum / delayDen) * 1000),
        dispose: (body[24] <= 2 ? body[24] : 0) as 0 | 1 | 2,
        blend: (body[25] === 1 ? 1 : 0) as 0 | 1,
      };
    } else if (type === 'IDAT') {
      seenImage = true;
      /* The default image is a frame only when a `fcTL` came before it. */
      if (control) data.push(body);
    } else if (type === 'fdAT') {
      if (length < 4) return null;
      data.push(body.subarray(4));
    } else if (type === 'IEND') {
      break;
    } else if (type !== 'acTL' && !seenImage) {
      /* A palette, transparency, gamma… — every frame needs them. */
      shared.push(bytes.subarray(at, start + length + 4));
    }
    at = start + length + 4;
  }
  finish();
  if (!header || frames.length < 2) return null;
  return { width, height, frames };
}

function framePng(
  header: Uint8Array,
  width: number,
  height: number,
  shared: readonly Uint8Array[],
  data: readonly Uint8Array[]
): Uint8Array {
  const ihdr = new Uint8Array(header);
  writeU32(ihdr, 0, width);
  writeU32(ihdr, 4, height);
  const parts: Uint8Array[] = [Uint8Array.from(SIGNATURE), chunk('IHDR', ihdr), ...shared];
  for (const piece of data) parts.push(chunk('IDAT', piece));
  parts.push(chunk('IEND', new Uint8Array(0)));
  let size = 0;
  for (const part of parts) size += part.length;
  const out = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  writeU32(out, 0, body.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  writeU32(out, 8 + body.length, crc32(out, 4, 8 + body.length));
  return out;
}

let table: Uint32Array | null = null;

/** CRC-32 of `bytes[from, to)`, as PNG computes it over a chunk's type and data. */
export function crc32(bytes: Uint8Array, from = 0, to = bytes.length): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = from; i < to; i += 1) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function hasSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i += 1) if (bytes[i] !== SIGNATURE[i]) return false;
  return true;
}

function chunkType(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
}

function readU32(bytes: Uint8Array, at: number): number {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

function readU16(bytes: Uint8Array, at: number): number {
  return (bytes[at] << 8) | bytes[at + 1];
}

function writeU32(bytes: Uint8Array, at: number, value: number): void {
  bytes[at] = (value >>> 24) & 0xff;
  bytes[at + 1] = (value >>> 16) & 0xff;
  bytes[at + 2] = (value >>> 8) & 0xff;
  bytes[at + 3] = value & 0xff;
}
