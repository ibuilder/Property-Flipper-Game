/**
 * Just enough PNG to crop and resize the marketing art.
 *
 * There is no image library in this project and there is not going to be one:
 * `sharp` is a native module with a platform-specific binary, and adding it to
 * a repo that CI builds on three platforms in order to resize two pictures is a
 * bad trade. Node ships zlib, PNG is a container around a zlib stream, and the
 * whole job is a hundred lines.
 *
 * 8-bit non-interlaced only, which is what every generator emits. Anything else
 * throws rather than producing a quietly wrong image.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

/**
 * The most pixels this will decode: 64 megapixels, or a 8000x8000 image.
 *
 * The header states the dimensions and nothing checks them against the data
 * that follows, which is a decompression bomb waiting to be handed one. A
 * two-byte edit to the height field of a valid 630x500 cover made this allocate
 * 165MB and run for nearly three seconds; the same edit to a different byte
 * asks for gigabytes and takes the process down with an allocation failure
 * rather than an error anybody can act on.
 *
 * Nothing here reads a file it did not write, so this is not a live exposure --
 * it is a bound on an exported, tested function that will get reused, and the
 * standard everywhere else in this codebase is that a failure says what it is.
 */
const MAX_PIXELS = 64 * 1024 * 1024;

/** @returns {{ w: number, h: number, data: Buffer }} RGBA, 4 bytes per pixel. */
export function readPng(path) {
  const buf = readFileSync(path);
  // Checked before the read, because an 8-byte file throws a RangeError out of
  // `readUInt32BE` that names a buffer offset rather than the file.
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`${path} is not a PNG`);
  }

  let off = 8;
  let head = null;
  const idat = [];
  let palette = null;
  let alpha = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    // A chunk that runs past the end of the file is a truncated or lying file,
    // not a chunk. `subarray` would silently hand back a short one.
    if (off + 12 + len > buf.length) {
      throw new Error(`${path}: ${type} chunk claims ${len} bytes and the file ends first`);
    }
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      head = {
        w: data.readUInt32BE(0),
        h: data.readUInt32BE(4),
        depth: data[8],
        colour: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') alpha = data;
    off += 12 + len;
  }
  if (!head) throw new Error(`${path} has no IHDR`);
  if (head.depth !== 8 || head.interlace !== 0) {
    throw new Error(`${path}: only 8-bit non-interlaced PNG is supported (${JSON.stringify(head)})`);
  }
  // Zero in either axis used to come back as an image with no pixels in it,
  // which is not an error until something divides by it two functions later.
  if (head.w < 1 || head.h < 1) {
    throw new Error(`${path}: header says ${head.w}x${head.h}, which is not an image`);
  }
  if (head.w * head.h > MAX_PIXELS) {
    throw new Error(
      `${path}: header claims ${head.w}x${head.h} (${Math.round((head.w * head.h) / 1e6)}Mpx), ` +
        `over the ${MAX_PIXELS / 1e6}Mpx limit`,
    );
  }
  if (idat.length === 0) throw new Error(`${path} has no image data`);

  const ch = head.colour === 3 ? 1 : CHANNELS[head.colour];
  if (!ch) throw new Error(`${path}: unsupported colour type ${head.colour}`);
  if (head.colour === 3 && !palette) {
    throw new Error(`${path}: says it is paletted and carries no PLTE chunk`);
  }

  const { w, h } = head;
  const stride = w * ch;
  const raw = inflateSync(Buffer.concat(idat));
  // The decompressed stream has to hold exactly one filter byte plus one
  // scanline per row. Short means truncated; the unfilter loop would otherwise
  // read zeroes off the end and produce a picture that is half real.
  const want = h * (stride + 1);
  if (raw.length < want) {
    throw new Error(
      `${path}: ${raw.length} bytes of pixel data for a ${w}x${h} image that needs ${want}`,
    );
  }
  const flat = Buffer.alloc(h * stride);

  // Undo the per-scanline filters. This is the whole of PNG decoding.
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = flat.subarray(y * stride, (y + 1) * stride);
    const prev = y ? flat.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const guess = a + b - c;
        const da = Math.abs(guess - a);
        const db = Math.abs(guess - b);
        const dc = Math.abs(guess - c);
        v += da <= db && da <= dc ? a : db <= dc ? b : c;
      }
      cur[i] = v & 255;
    }
  }

  // Widen everything to RGBA so the rest of the file has one case to handle.
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0, o = 0; i < w * h; i++, o += 4) {
    if (head.colour === 3) {
      const idx = flat[i] * 3;
      data[o] = palette[idx];
      data[o + 1] = palette[idx + 1];
      data[o + 2] = palette[idx + 2];
      data[o + 3] = alpha ? (alpha[flat[i]] ?? 255) : 255;
    } else if (ch === 1) {
      data[o] = data[o + 1] = data[o + 2] = flat[i];
      data[o + 3] = 255;
    } else if (ch === 2) {
      data[o] = data[o + 1] = data[o + 2] = flat[i * 2];
      data[o + 3] = flat[i * 2 + 1];
    } else {
      data[o] = flat[i * ch];
      data[o + 1] = flat[i * ch + 1];
      data[o + 2] = flat[i * ch + 2];
      data[o + 3] = ch === 4 ? flat[i * ch + 3] : 255;
    }
  }
  return { w, h, data };
}

/** A rectangle out of an image. No resampling; the pixels are the same pixels. */
export function crop(img, x, y, w, h) {
  const sx = Math.max(0, Math.min(img.w - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(img.h - 1, Math.round(y)));
  const cw = Math.max(1, Math.min(img.w - sx, Math.round(w)));
  const chh = Math.max(1, Math.min(img.h - sy, Math.round(h)));
  const out = Buffer.alloc(cw * chh * 4);
  for (let row = 0; row < chh; row++) {
    img.data.copy(out, row * cw * 4, ((sy + row) * img.w + sx) * 4, ((sy + row) * img.w + sx + cw) * 4);
  }
  return { w: cw, h: chh, data: out };
}

/**
 * Resample to an exact size, area-averaged.
 *
 * Every destination pixel is the mean of the source rectangle it covers, with
 * partial coverage at the edges weighted by how much of the source pixel falls
 * inside. That is the right filter for making something smaller -- it looks at
 * every source pixel exactly once and in proportion, where nearest-neighbour
 * throws most of them away and aliases hard edges into stair-steps. Enlarging
 * degenerates to bilinear, which is as much as can honestly be recovered.
 */
export function resize(img, w, h) {
  const out = Buffer.alloc(w * h * 4);
  const fx = img.w / w;
  const fy = img.h / h;

  for (let y = 0; y < h; y++) {
    const y0 = y * fy;
    const y1 = (y + 1) * fy;
    const ry0 = Math.floor(y0);
    const ry1 = Math.min(img.h, Math.ceil(y1));

    for (let x = 0; x < w; x++) {
      const x0 = x * fx;
      const x1 = (x + 1) * fx;
      const rx0 = Math.floor(x0);
      const rx1 = Math.min(img.w, Math.ceil(x1));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let total = 0;
      for (let sy = ry0; sy < ry1; sy++) {
        const wy = Math.min(sy + 1, y1) - Math.max(sy, y0);
        if (wy <= 0) continue;
        for (let sx = rx0; sx < rx1; sx++) {
          const wx = Math.min(sx + 1, x1) - Math.max(sx, x0);
          if (wx <= 0) continue;
          const weight = wx * wy;
          const o = (sy * img.w + sx) * 4;
          r += img.data[o] * weight;
          g += img.data[o + 1] * weight;
          b += img.data[o + 2] * weight;
          a += img.data[o + 3] * weight;
          total += weight;
        }
      }
      const o = (y * w + x) * 4;
      if (total === 0) {
        // Only reachable when a destination pixel maps outside the source,
        // which the clamping above prevents. Copy the nearest rather than
        // writing a transparent hole.
        const so = (Math.min(img.h - 1, ry0) * img.w + Math.min(img.w - 1, rx0)) * 4;
        out[o] = img.data[so];
        out[o + 1] = img.data[so + 1];
        out[o + 2] = img.data[so + 2];
        out[o + 3] = img.data[so + 3];
      } else {
        out[o] = Math.round(r / total);
        out[o + 1] = Math.round(g / total);
        out[o + 2] = Math.round(b / total);
        out[o + 3] = Math.round(a / total);
      }
    }
  }
  return { w, h, data: out };
}

/**
 * Crop to an aspect ratio, then resize to it. The usual operation.
 *
 * `anchorY` says which band to keep when height has to go: 0 the top, 1 the
 * bottom, 0.5 the middle. Titles live near the top of a poster, so a banner cut
 * from one wants a low number and a centre crop throws the name away.
 */
export function fit(img, w, h, anchorY = 0.5, anchorX = 0.5) {
  const want = w / h;
  const have = img.w / img.h;
  let cw = img.w;
  let ch = img.h;
  if (have > want) cw = Math.round(img.h * want);
  else ch = Math.round(img.w / want);
  const x = Math.round((img.w - cw) * anchorX);
  const y = Math.round((img.h - ch) * anchorY);
  return resize(crop(img, x, y, cw, ch), w, h);
}

const CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, body) {
  const out = Buffer.alloc(body.length + 12);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'ascii');
  body.copy(out, 8);
  out.writeUInt32BE(CRC(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

/**
 * Write an image out.
 *
 * Filter 1 (Sub) on every row rather than picking the best filter per row: the
 * marketing art is photographic, Sub is a good fit for it, and the difference
 * between this and a full adaptive search is a few percent of file size against
 * a lot of code that would need its own tests.
 */
export function writePng(path, img, { opaque = true } = {}) {
  const ch = opaque ? 3 : 4;
  const stride = img.w * ch;
  const raw = Buffer.alloc(img.h * (stride + 1));
  for (let y = 0; y < img.h; y++) {
    const at = y * (stride + 1);
    raw[at] = 1;
    for (let x = 0; x < img.w; x++) {
      const s = (y * img.w + x) * 4;
      const d = at + 1 + x * ch;
      for (let c = 0; c < ch; c++) {
        const v = img.data[s + c];
        const left = x > 0 ? img.data[s - 4 + c] : 0;
        raw[d + c] = (v - left) & 255;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = opaque ? 2 : 6;

  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
  return path;
}
