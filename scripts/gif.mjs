/**
 * Just enough GIF to turn captured frames into a clip.
 *
 * Same trade as `image.mjs`: the alternative is ffmpeg or a native encoder, and
 * neither belongs in a repo CI builds on three platforms in order to make three
 * short animations. GIF is a palette, an LZW stream and a handful of blocks.
 *
 * Two pieces do the work. Median-cut picks 256 colours for the whole clip
 * rather than per frame -- one global table is smaller, and it stops the
 * palette shifting under a static background, which is the artefact that makes
 * a hand-rolled GIF look hand-rolled. Then LZW, which is the format's whole
 * compression story.
 *
 * No dithering, deliberately. This game is flat colour and thin ink; dithering
 * would scatter noise through both and cost size to do it.
 */
import { writeFileSync } from 'node:fs';

/* ------------------------------------------------------------------ palette */

/**
 * Median cut.
 *
 * Repeatedly split the box of colours along its longest axis at the median,
 * until there are as many boxes as colours wanted, then average each box. It
 * beats a fixed palette on exactly the images this project makes -- a few
 * dozen closely-related dark blues that a uniform RGB cube would collapse into
 * three.
 *
 * Sampling every pixel of every frame is unnecessary and slow; every fourth
 * gives the same boxes on this material.
 */
export function quantise(frames, max = 256, stride = 4) {
  const pixels = [];
  for (const f of frames) {
    for (let i = 0; i < f.data.length; i += 4 * stride) {
      pixels.push([f.data[i], f.data[i + 1], f.data[i + 2]]);
    }
  }
  if (pixels.length === 0) return [[0, 0, 0]];

  let boxes = [pixels];
  while (boxes.length < max) {
    // Split the box with the widest spread; splitting anything else first
    // spends palette entries where the eye will not notice them.
    let pick = -1;
    let widest = -1;
    let axis = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255;
        let hi = 0;
        for (const p of box) {
          if (p[c] < lo) lo = p[c];
          if (p[c] > hi) hi = p[c];
        }
        if (hi - lo > widest) {
          widest = hi - lo;
          pick = i;
          axis = c;
        }
      }
    });
    if (pick < 0 || widest <= 0) break;

    const box = boxes[pick];
    box.sort((a, b) => a[axis] - b[axis]);
    const mid = box.length >> 1;
    boxes.splice(pick, 1, box.slice(0, mid), box.slice(mid));
  }

  return boxes.filter((b) => b.length).map((box) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const p of box) {
      r += p[0];
      g += p[1];
      b += p[2];
    }
    const n = box.length;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

/**
 * Nearest palette entry for every pixel.
 *
 * The cache is what makes this finish: a 640x400 frame is 256,000 lookups and
 * a clip has dozens of frames, but a flat-coloured interface only contains a
 * few thousand distinct colours. Keyed on the packed RGB so the map stays
 * integer-keyed.
 */
export function indexFrame(frame, palette, cache = new Map()) {
  const out = new Uint8Array(frame.w * frame.h);
  for (let i = 0, p = 0; p < out.length; i += 4, p++) {
    const key = (frame.data[i] << 16) | (frame.data[i + 1] << 8) | frame.data[i + 2];
    let idx = cache.get(key);
    if (idx === undefined) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < palette.length; c++) {
        const dr = frame.data[i] - palette[c][0];
        const dg = frame.data[i + 1] - palette[c][1];
        const db = frame.data[i + 2] - palette[c][2];
        // Squared distance, weighted the way the eye weights the channels.
        const d = 3 * dr * dr + 6 * dg * dg + db * db;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      idx = best;
      cache.set(key, idx);
    }
    out[p] = idx;
  }
  return out;
}

/* ---------------------------------------------------------------------- LZW */

/**
 * GIF's variable-width LZW.
 *
 * Codes start one bit wider than the palette needs and grow as the dictionary
 * fills, up to 12 bits, at which point a clear code resets it. Getting the
 * *timing* of that width increase wrong produces a file that decodes to noise
 * a few rows into the first frame, which is why `tests/gif.test.ts` round-trips
 * the indices exactly rather than eyeballing the output.
 */
export function lzw(indices, minCodeSize) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;

  const out = [];
  let bits = 0;
  let bitCount = 0;
  const emit = (code, width) => {
    bits |= code << bitCount;
    bitCount += width;
    while (bitCount >= 8) {
      out.push(bits & 0xff);
      bits >>= 8;
      bitCount -= 8;
    }
  };

  let dict = new Map();
  let next = eoi + 1;
  let width = minCodeSize + 1;
  const reset = () => {
    dict = new Map();
    next = eoi + 1;
    width = minCodeSize + 1;
  };

  emit(clear, width);
  reset();

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 4096 + k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix, width);
    if (next < 4096) {
      dict.set(key, next);
      /*
       * Grow one code before the next one to be assigned would not fit.
       *
       * The code just handed out is `next - 1`, and it can be emitted on the
       * very next pass, so the width has to cover it *now* rather than when it
       * is first used. Off by one in either direction and the stream stays a
       * valid-looking file of the right length that decodes to noise from
       * about the five-hundredth new sequence -- in practice, a few rows into
       * the first frame.
       *
       * The decoder's mirror of this is `next === 1 << width`, one lower,
       * because a decoder builds its dictionary one code behind the encoder.
       * The two have to be written as a pair or they drift apart exactly here.
       */
      if (++next === (1 << width) + 1 && width < 12) width++;
    } else {
      emit(clear, width);
      reset();
    }
    prefix = k;
  }
  emit(prefix, width);
  emit(eoi, width);
  if (bitCount > 0) out.push(bits & 0xff);

  return Buffer.from(out);
}

/* --------------------------------------------------------------------- file */

function subBlocks(buf) {
  const parts = [];
  for (let i = 0; i < buf.length; i += 255) {
    const chunk = buf.subarray(i, i + 255);
    parts.push(Buffer.from([chunk.length]), chunk);
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

/**
 * Write an animated GIF.
 *
 * `delay` is in hundredths of a second, which is the format's unit and the
 * reason GIF frame rates are the odd numbers they are: 100/12 is not an
 * integer, so 12fps is really 8.33 and browsers round it their own way.
 */
export function writeGif(path, frames, { delay = 8, loop = 0, colours = 256 } = {}) {
  if (!frames.length) throw new Error('writeGif: no frames');
  const { w, h } = frames[0];
  for (const f of frames) {
    if (f.w !== w || f.h !== h) {
      throw new Error(`writeGif: frames differ in size (${w}x${h} then ${f.w}x${f.h})`);
    }
  }

  const palette = quantise(frames, colours);
  // The table has to be a power of two, and at least two entries.
  let bits = 1;
  while (1 << bits < palette.length) bits++;
  const tableSize = 1 << bits;

  const table = Buffer.alloc(tableSize * 3);
  palette.forEach(([r, g, b], i) => {
    table[i * 3] = r;
    table[i * 3 + 1] = g;
    table[i * 3 + 2] = b;
  });

  const parts = [Buffer.from('GIF89a', 'ascii')];

  const screen = Buffer.alloc(7);
  screen.writeUInt16LE(w, 0);
  screen.writeUInt16LE(h, 2);
  screen[4] = 0x80 | ((bits - 1) & 7); // global table present, its size
  screen[5] = 0; // background index
  screen[6] = 0; // pixel aspect ratio
  parts.push(screen, table);

  // Netscape 2.0 application extension: the only way to say "loop".
  const loopExt = Buffer.alloc(19);
  loopExt.write('\x21\xFF\x0BNETSCAPE2.0\x03\x01', 0, 'binary');
  loopExt.writeUInt16LE(loop, 16);
  loopExt[18] = 0;
  parts.push(loopExt);

  const cache = new Map();
  for (const frame of frames) {
    const gce = Buffer.alloc(8);
    gce[0] = 0x21;
    gce[1] = 0xf9;
    gce[2] = 4;
    gce[3] = 0; // no transparency, no disposal: every frame is complete
    gce.writeUInt16LE(delay, 4);
    gce[6] = 0;
    gce[7] = 0;
    parts.push(gce);

    const desc = Buffer.alloc(10);
    desc[0] = 0x2c;
    desc.writeUInt16LE(0, 1);
    desc.writeUInt16LE(0, 3);
    desc.writeUInt16LE(w, 5);
    desc.writeUInt16LE(h, 7);
    desc[9] = 0; // no local colour table
    parts.push(desc);

    const minCodeSize = Math.max(2, bits);
    parts.push(Buffer.from([minCodeSize]));
    parts.push(subBlocks(lzw(indexFrame(frame, palette, cache), minCodeSize)));
  }

  parts.push(Buffer.from([0x3b]));
  const gif = Buffer.concat(parts);
  writeFileSync(path, gif);
  return { path, bytes: gif.length, w, h, frames: frames.length, colours: palette.length };
}
