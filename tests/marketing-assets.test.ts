import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { crop, fit, readPng, resize, writePng } from '../scripts/image.mjs';

/**
 * The store art, and the hundred lines of PNG that cut it to size.
 *
 * Two separate risks. The first is the image code: it is hand-written because
 * adding a native image library to a repo CI builds on three platforms in order
 * to resize two pictures is a bad trade, and hand-written means the failure
 * mode is a file that opens fine and is subtly wrong -- a colour channel
 * swapped, an edge row of garbage, an off-by-one in the resampler that tints
 * everything. Round-tripping a known image catches all of those; eyeballing the
 * output catches none of them.
 *
 * The second is drift: the committed assets have to still be the size each
 * storefront asks for. A cover that stopped being 630x500 is not a crash, it is
 * a page that looks slightly wrong forever.
 */

const SCRATCH = 'docs/marketing/.roundtrip.test.png';

/** A small image with structure in it: gradients, hard edges, and full alpha. */
function fixture(w: number, h: number) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      data[o] = Math.round((x / (w - 1)) * 255);
      data[o + 1] = Math.round((y / (h - 1)) * 255);
      data[o + 2] = x < w / 2 ? 0 : 255;
      data[o + 3] = 255;
    }
  }
  return { w, h, data };
}

describe('the PNG round trip', () => {
  it('reads back exactly what it wrote', () => {
    const src = fixture(40, 24);
    writePng(SCRATCH, src);
    const back = readPng(SCRATCH);

    expect(back.w).toBe(40);
    expect(back.h).toBe(24);
    // Channel-for-channel. A red/blue swap survives every eyeball test and no
    // byte comparison at all, which is exactly why this is a byte comparison.
    for (let i = 0; i < src.data.length; i += 4) {
      expect([back.data[i], back.data[i + 1], back.data[i + 2]], `pixel ${i / 4}`).toEqual([
        src.data[i],
        src.data[i + 1],
        src.data[i + 2],
      ]);
    }
  });

  it('writes a file a decoder will accept', () => {
    writePng(SCRATCH, fixture(8, 8));
    const buf = readFileSync(SCRATCH);
    expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(buf.toString('ascii', 12, 16)).toBe('IHDR');
    expect(buf.toString('ascii', buf.length - 8, buf.length - 4)).toBe('IEND');
  });
});

/**
 * What a malformed file does.
 *
 * `readPng` is a parser, and this project's whole standard is that a failure
 * says what it is. Handed damaged input it did four things that are not that:
 * a two-byte edit to the height field of a valid cover made it allocate 165MB
 * and run for nearly three seconds; a zero in either axis came back as an
 * image with no pixels rather than an error, which stays silent until `resize`
 * divides by it; a paletted header with no palette threw a TypeError about
 * reading a property of null; and an empty file threw a RangeError naming a
 * buffer offset.
 *
 * Nothing here reads a file it did not write, so none of that was a live
 * exposure. It is an exported and tested function that will get reused, and
 * these are the shapes a reuse would hit first.
 */
describe('a damaged PNG', () => {
  const good = () => readFileSync('docs/marketing/cover-630x500.png');
  const write = (buf: Buffer) => {
    writeFileSync(SCRATCH, buf);
    return SCRATCH;
  };
  const edit = (fn: (b: Buffer) => void) => {
    const b = Buffer.from(good());
    fn(b);
    return write(b);
  };

  it('refuses a header asking for more pixels than exist anywhere', () => {
    // The bomb. 630 x 65535 is two bytes away from the real cover.
    const started = Date.now();
    expect(() => readPng(edit((b) => b.writeUInt32BE(0x0000ffff, 20)))).toThrow(/Mpx|needs/);
    // And refuses it without doing the work first.
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('refuses a header whose dimensions overflow allocation', () => {
    expect(() => readPng(edit((b) => b.writeUInt32BE(0x7fffffff, 16)))).toThrow(/Mpx/);
  });

  it('refuses zero in either axis instead of returning an empty image', () => {
    expect(() => readPng(edit((b) => b.writeUInt32BE(0, 16)))).toThrow(/not an image/);
    expect(() => readPng(edit((b) => b.writeUInt32BE(0, 20)))).toThrow(/not an image/);
  });

  it('names the file when it is not a PNG at all', () => {
    expect(() => readPng(write(Buffer.alloc(0)))).toThrow(/is not a PNG/);
    expect(() => readPng(write(Buffer.from('hello')))).toThrow(/is not a PNG/);
    expect(() => readPng(edit((b) => (b[1] = 0)))).toThrow(/is not a PNG/);
  });

  it('says a paletted file is missing its palette, rather than dying on null', () => {
    expect(() => readPng(edit((b) => (b[25] = 3)))).toThrow(/PLTE/);
  });

  it('rejects a truncated file at every point it can be cut', () => {
    for (const frac of [0.02, 0.25, 0.5, 0.9, 0.999]) {
      const b = good();
      const cut = b.subarray(0, Math.floor(b.length * frac));
      expect(() => readPng(write(Buffer.from(cut))), `cut at ${frac}`).toThrow(Error);
    }
  });

  it('rejects a chunk that claims more bytes than the file holds', () => {
    expect(() => readPng(edit((b) => b.writeUInt32BE(0xfffffff0, 8)))).toThrow(/chunk claims/);
  });

  it('rejects the formats it does not implement, by name', () => {
    expect(() => readPng(edit((b) => (b[24] = 16)))).toThrow(/8-bit non-interlaced/);
    expect(() => readPng(edit((b) => (b[28] = 1)))).toThrow(/8-bit non-interlaced/);
    expect(() => readPng(edit((b) => (b[25] = 99)))).toThrow(/colour type 99/);
  });
});

describe('cropping and resizing', () => {
  it('takes the rectangle asked for and moves no pixels', () => {
    const src = fixture(20, 20);
    const out = crop(src, 5, 6, 8, 4);
    expect([out.w, out.h]).toEqual([8, 4]);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 8; x++) {
        const a = (y * 8 + x) * 4;
        const b = ((y + 6) * 20 + (x + 5)) * 4;
        expect(out.data[a]).toBe(src.data[b]);
        expect(out.data[a + 1]).toBe(src.data[b + 1]);
      }
    }
  });

  it('clamps a crop that runs off the edge instead of reading past it', () => {
    const src = fixture(10, 10);
    const out = crop(src, 8, 8, 50, 50);
    expect([out.w, out.h]).toEqual([2, 2]);
    expect(crop(src, -20, -20, 4, 4).w).toBe(4);
  });

  it('resizes to the exact size asked for', () => {
    const out = resize(fixture(100, 60), 33, 17);
    expect([out.w, out.h]).toEqual([33, 17]);
    expect(out.data).toHaveLength(33 * 17 * 4);
  });

  it('leaves a flat colour flat, at any scale', () => {
    // The tell-tale for a weighting bug: if the area weights do not sum to the
    // area, a uniform image comes back darker or lighter than it went in.
    const w = 37;
    const h = 21;
    const flat = { w, h, data: Buffer.alloc(w * h * 4) };
    flat.data.fill(0);
    for (let i = 0; i < w * h; i++) {
      flat.data[i * 4] = 91;
      flat.data[i * 4 + 1] = 140;
      flat.data[i * 4 + 2] = 203;
      flat.data[i * 4 + 3] = 255;
    }
    for (const [tw, th] of [
      [9, 5],
      [37, 21],
      [80, 44],
    ] as const) {
      const out = resize(flat, tw, th);
      for (let i = 0; i < tw * th; i++) {
        expect([out.data[i * 4], out.data[i * 4 + 1], out.data[i * 4 + 2]], `${tw}x${th}`).toEqual([
          91, 140, 203,
        ]);
      }
    }
  });

  it('keeps a horizontal gradient increasing left to right', () => {
    // Catches a transposed index, which otherwise produces a plausible-looking
    // image rotated or mirrored.
    const out = resize(fixture(64, 64), 16, 16);
    for (let x = 1; x < 16; x++) {
      expect(out.data[x * 4]).toBeGreaterThan(out.data[(x - 1) * 4]);
    }
  });

  it('never invents a pixel outside the source range', () => {
    const out = resize(fixture(50, 50), 7, 91);
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i + 3]).toBe(255);
      expect(out.data[i]).toBeLessThanOrEqual(255);
      expect(out.data[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it('fits to an aspect ratio by cropping the long axis, not by squashing', () => {
    // A 2:1 source into a 1:1 target must lose width. If `fit` ever stretches
    // instead, the key art's lettering goes with it and nobody notices until
    // the store page is live.
    const out = fit(fixture(200, 100), 50, 50);
    expect([out.w, out.h]).toEqual([50, 50]);

    // The anchor decides which band survives. Top and bottom must differ on an
    // image with a vertical gradient in it.
    const top = fit(fixture(100, 200), 40, 10, 0);
    const bottom = fit(fixture(100, 200), 40, 10, 1);
    expect(top.data[1]).toBeLessThan(bottom.data[1]);
  });
});

describe('the committed store assets', () => {
  const expected = [
    ['docs/marketing/cover-630x500.png', 630, 500],
    ['docs/marketing/banner-1920x620.png', 1920, 620],
    ['docs/marketing/social-1200x630.png', 1200, 630],
  ] as const;

  it.each(expected)('%s is present at %ix%i', (file, w, h) => {
    expect(existsSync(file), `${file} missing — run \`npm run marketing\``).toBe(true);
    const img = readPng(file);
    expect([img.w, img.h]).toEqual([w, h]);
  });

  it('keeps the masters the derived assets are cut from', () => {
    // Without these the assets cannot be regenerated, and an aspect ratio that
    // needs adjusting a year from now becomes a re-commission.
    for (const master of [
      'docs/marketing/source/key-art-cutaway.png',
      'docs/marketing/source/key-art-before-after.png',
    ]) {
      expect(existsSync(master), `${master} missing`).toBe(true);
    }
  });

  it('publishes the link-preview card where the markup says it is', () => {
    /*
     * Open Graph is a promise made to a crawler that nothing on the page keeps.
     * Nothing fetches these tags at runtime, so a card that moved, was renamed,
     * or was never generated fails silently and forever -- every link anybody
     * posts just shows a bare URL, and there is no error anywhere to notice.
     *
     * `public/` is copied verbatim into the build by Vite, so a file there is a
     * file at the site root. This checks the two ends agree.
     */
    const html = readFileSync('index.html', 'utf8');
    const image = html.match(/property="og:image"\s+content="([^"]+)"/)?.[1];
    expect(image, 'index.html declares no og:image').toBeTruthy();

    // Absolute, because a crawler has no base to resolve against.
    expect(image).toMatch(/^https:\/\//);

    const file = `public/${image!.split('/').pop()}`;
    expect(existsSync(file), `${image} resolves to ${file}, which does not exist`).toBe(true);

    // The dimensions declared in the markup have to be the real ones: several
    // platforms lay the card out from the tags before the image arrives.
    const img = readPng(file);
    expect(html).toContain(`content="${img.w}"`);
    expect(html).toContain(`content="${img.h}"`);
    expect([img.w, img.h]).toEqual([1200, 630]);
  });

  it('is under the 3MB itch accepts, with room to spare', () => {
    for (const [file] of expected) {
      const bytes = readFileSync(file).length;
      expect(bytes, `${file} is ${Math.round(bytes / 1024)}kB`).toBeLessThan(3_000_000);
    }
  });
});
