import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crc32 as zlibCrc32, deflateSync } from 'node:zlib';

import { crc32, isApng, splitApng } from './apng.ts';
import { decodePng } from './png.ts';

/* A chunk as PNG writes one, its CRC from Node's own zlib. */
function chunk(type: string, body: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlibCrc32(Buffer.concat([head.subarray(4), Buffer.from(body)])) >>> 0, 0);
  return Buffer.concat([head, Buffer.from(body), crc]);
}

/* RGBA rows, each behind filter byte 0, deflated. */
function pixels(width: number, height: number, rgba: [number, number, number, number]) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x += 1) raw.set(rgba, y * (width * 4 + 1) + 1 + x * 4);
  }
  return deflateSync(raw);
}

function u32(...values: number[]) {
  const out = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => out.writeUInt32BE(value, index * 4));
  return out;
}

function fctl(
  seq: number,
  w: number,
  h: number,
  x: number,
  y: number,
  delay: number,
  dispose: number,
  blend: number
) {
  const body = Buffer.alloc(26);
  body.writeUInt32BE(seq, 0);
  body.writeUInt32BE(w, 4);
  body.writeUInt32BE(h, 8);
  body.writeUInt32BE(x, 12);
  body.writeUInt32BE(y, 16);
  body.writeUInt16BE(delay, 20);
  body.writeUInt16BE(1000, 22);
  body[24] = dispose;
  body[25] = blend;
  return chunk('fcTL', body);
}

/* A 4×4 APNG: a red default image that is frame one, then a blue 2×2 at (1, 1). */
function apng(): Uint8Array {
  const ihdr = Buffer.concat([u32(4, 4), Buffer.from([8, 6, 0, 0, 0])]);
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('acTL', u32(2, 0)),
      fctl(0, 4, 4, 0, 0, 80, 0, 0),
      chunk('IDAT', pixels(4, 4, [255, 0, 0, 255])),
      fctl(1, 2, 2, 1, 1, 120, 1, 1),
      chunk('fdAT', Buffer.concat([u32(2), pixels(2, 2, [0, 0, 255, 255])])),
      chunk('IEND', new Uint8Array(0)),
    ])
  );
}

describe('an APNG, split into frames Skia can decode', () => {
  it('computes PNG’s CRC as zlib does', () => {
    const bytes = new Uint8Array(Buffer.from('IHDRsome bytes', 'latin1'));
    assert.equal(crc32(bytes), zlibCrc32(Buffer.from(bytes)) >>> 0);
  });

  it('tells an APNG from a plain PNG', () => {
    assert.equal(isApng(apng()), true);
    const plain = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', Buffer.concat([u32(1, 1), Buffer.from([8, 6, 0, 0, 0])])),
      chunk('IDAT', pixels(1, 1, [1, 2, 3, 255])),
      chunk('IEND', new Uint8Array(0)),
    ]);
    assert.equal(isApng(new Uint8Array(plain)), false);
    assert.equal(splitApng(new Uint8Array(plain)), null);
  });

  it('makes every frame a PNG of its own, with its place, its time and its ops', () => {
    const split = splitApng(apng());
    assert.ok(split);
    assert.equal(split.width, 4);
    assert.equal(split.frames.length, 2);
    const [first, second] = split.frames;
    assert.deepEqual(
      { x: first.x, y: first.y, w: first.width, h: first.height, delay: first.delay },
      { x: 0, y: 0, w: 4, h: 4, delay: 80 }
    );
    assert.deepEqual(
      {
        x: second.x,
        y: second.y,
        w: second.width,
        h: second.height,
        delay: second.delay,
        dispose: second.dispose,
        blend: second.blend,
      },
      { x: 1, y: 1, w: 2, h: 2, delay: 120, dispose: 1, blend: 1 }
    );
    const red = decodePng(first.png);
    const blue = decodePng(second.png);
    assert.ok(red && blue);
    assert.equal(red.width, 4);
    assert.deepEqual([...red.data.subarray(0, 4)], [255, 0, 0, 255]);
    assert.equal(blue.width, 2);
    assert.deepEqual([...blue.data.subarray(0, 4)], [0, 0, 255, 255]);
  });
});
