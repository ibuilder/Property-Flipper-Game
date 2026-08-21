import { readFileSync, unlinkSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { indexFrame, lzw, quantise, writeGif } from '../scripts/gif.mjs';
import { readPng, resize } from '../scripts/image.mjs';

/**
 * The GIF encoder behind the social clips.
 *
 * The whole risk is in the LZW: it is a variable-width code stream, and the
 * moment the width grows has to agree with the decoder's idea of the same
 * moment to the single code. Off by one in either direction produces a file
 * that is the right length, has a valid header, opens without complaint, and
 * decodes to noise a few rows into the first frame. Chrome renders it. So does
 * every preview pane. Nothing says anything is wrong.
 *
 * That is why the round trip below compares *indices*, exactly, rather than
 * colours: quantisation makes colour comparison fuzzy, and fuzzy is precisely
 * what hides this failure. It was caught by measuring a real screenshot's
 * decoded pixels against the source in a browser -- mean channel error 40.95,
 * where a correct stream measures 0.33 -- and the test exists so nobody has to
 * do that again.
 */

const SCRATCH = 'docs/marketing/.gif.test.gif';

/**
 * The decoder, written as the deliberate mirror of the encoder.
 *
 * `next === 1 << width` here against the encoder's `next === (1 << width) + 1`
 * is not a typo: a decoder learns each dictionary entry one code later than the
 * encoder wrote it, so its counter runs exactly one behind and its threshold
 * has to sit exactly one lower.
 */
function unlzw(buf: Buffer, minCodeSize: number): number[] {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;

  let dict: number[][] = [];
  let width = minCodeSize + 1;
  let next = eoi + 1;
  const reset = () => {
    dict = [];
    for (let i = 0; i < clear; i++) dict[i] = [i];
    dict[clear] = [];
    dict[eoi] = [];
    next = eoi + 1;
    width = minCodeSize + 1;
  };
  reset();

  let bit = 0;
  const read = () => {
    let v = 0;
    for (let i = 0; i < width; i++) {
      const byte = buf[bit >> 3];
      if (byte === undefined) return eoi;
      v |= ((byte >> (bit & 7)) & 1) << i;
      bit++;
    }
    return v;
  };

  const out: number[] = [];
  let prev: number[] | null = null;
  for (;;) {
    const code = read();
    if (code === eoi) break;
    if (code === clear) {
      reset();
      prev = null;
      continue;
    }
    // `code < next`, not `dict[code]` — a stale entry from before a reset is
    // still truthy and would be silently accepted.
    const entry: number[] | null = code < next ? dict[code] : prev ? [...prev, prev[0]] : null;
    if (!entry) throw new Error(`unlzw: code ${code} with no entry and no prefix`);
    out.push(...entry);
    if (prev) {
      dict[next] = [...prev, entry[0]];
      if (++next === 1 << width && width < 12) width++;
    }
    prev = entry;
  }
  return out;
}

function frame(w: number, h: number, fn: (x: number, y: number) => [number, number, number]) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const [r, g, b] = fn(x, y);
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  return { w, h, data };
}

describe('the LZW stream', () => {
  it('round-trips a short run exactly', () => {
    const indices = [1, 1, 1, 1, 2, 2, 2, 2, 1, 1];
    expect(unlzw(lzw(Uint8Array.from(indices), 8), 8)).toEqual(indices);
  });

  it('round-trips across the 9-, 10- and 11-bit width changes', () => {
    /*
     * The case that matters, and the one a small fixture never reaches. The
     * dictionary has to fill past 512, 1024 and 2048 codes for the width to
     * step three times, which needs a few thousand *distinct* sequences —
     * hence pseudo-random data rather than a pattern that compresses away.
     */
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };
    const indices = Uint8Array.from({ length: 40_000 }, () => rnd() % 256);
    expect(unlzw(lzw(indices, 8), 8)).toEqual([...indices]);
  });

  it('round-trips a run long enough to force a dictionary reset', () => {
    // Past 4096 codes the encoder has to emit a clear and start again, and the
    // decoder has to notice. 200k distinct-ish symbols gets there comfortably.
    let seed = 999;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };
    const indices = Uint8Array.from({ length: 200_000 }, () => rnd() % 256);
    expect(unlzw(lzw(indices, 8), 8)).toEqual([...indices]);
  });

  it('round-trips a flat run, which compresses to almost nothing', () => {
    const indices = new Uint8Array(50_000).fill(7);
    const encoded = lzw(indices, 8);
    expect(unlzw(encoded, 8)).toEqual([...indices]);
    // A degenerate input should also be tiny; if this ever balloons, the
    // dictionary is not being reused.
    expect(encoded.length).toBeLessThan(2_000);
  });

  it('round-trips at small palette depths too', () => {
    for (const min of [2, 4, 8]) {
      const n = 1 << min;
      const indices = Uint8Array.from({ length: 5_000 }, (_, i) => (i * 7) % n);
      expect(unlzw(lzw(indices, min), min), `minCodeSize ${min}`).toEqual([...indices]);
    }
  });
});

describe('the palette', () => {
  it('separates colours a uniform cube would collapse', () => {
    // Six near-identical dark blues: the material this project is actually
    // made of, and what median cut is here for.
    const blues = frame(24, 1, (x) => [10 + (x % 6), 20 + (x % 6), 40 + (x % 6) * 2]);
    const palette = quantise([blues], 256, 1);
    expect(palette.length).toBeGreaterThanOrEqual(6);
  });

  it('maps every pixel to a real entry', () => {
    const f = frame(32, 32, (x, y) => [x * 8, y * 8, 128]);
    const palette = quantise([f], 64, 1);
    const idx = indexFrame(f, palette);
    expect(idx).toHaveLength(32 * 32);
    for (const i of idx) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(palette.length);
    }
  });

  it('reproduces a flat colour exactly', () => {
    const f = frame(16, 16, () => [91, 140, 203]);
    const palette = quantise([f], 256, 1);
    const idx = indexFrame(f, palette);
    for (const i of idx) expect(palette[i]).toEqual([91, 140, 203]);
  });
});

describe('the file', () => {
  it('writes a header, a loop extension and a trailer', () => {
    const f = frame(8, 8, (x) => [x * 30, 0, 0]);
    writeGif(SCRATCH, [f, f], { delay: 8 });
    const b = readFileSync(SCRATCH);
    expect(b.toString('ascii', 0, 6)).toBe('GIF89a');
    expect(b.readUInt16LE(6)).toBe(8);
    expect(b.readUInt16LE(8)).toBe(8);
    expect(b.includes(Buffer.from('NETSCAPE2.0', 'ascii'))).toBe(true);
    expect(b[b.length - 1]).toBe(0x3b);
    unlinkSync(SCRATCH);
  });

  it('refuses frames that are not all the same size', () => {
    const a = frame(8, 8, () => [0, 0, 0]);
    const b = frame(9, 8, () => [0, 0, 0]);
    expect(() => writeGif(SCRATCH, [a, b])).toThrow(/differ in size/);
  });

  it('refuses to write nothing', () => {
    expect(() => writeGif(SCRATCH, [])).toThrow(/no frames/);
  });

  it('survives a real screenshot at a size worth posting', () => {
    // End to end on the actual material, which is where quantisation and LZW
    // meet. 256 colours on this palette should be close to lossless.
    const shot = resize(readPng('docs/shots/03-deal.png'), 320, 200);
    const info = writeGif(SCRATCH, [shot], { delay: 10 });
    expect(info.colours).toBeGreaterThan(200);
    expect(info.bytes).toBeGreaterThan(1_000);
    // Well inside the 3MB most places accept for a single image.
    expect(info.bytes).toBeLessThan(3_000_000);
    unlinkSync(SCRATCH);
  });
});
