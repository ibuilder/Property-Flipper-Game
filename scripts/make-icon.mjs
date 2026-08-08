/**
 * Generate build/icon.ico from scratch.
 *
 * Written by hand rather than pulled from a dependency so the repo has no
 * binary asset of unknown provenance and the icon can be regenerated on any
 * machine with `npm run icon`. Draws a simple house-with-upward-arrow mark
 * (buy low, sell high) as raw BGRA pixels, then wraps the sizes in an ICO
 * container holding embedded PNGs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZES = [16, 24, 32, 48, 64, 128, 256];

const BG = [0x19, 0x13, 0x0f]; // matches the app background
const ROOF = [0xff, 0x9f, 0x4d]; // accent blue in BGR
const WALL = [0xf0, 0xe9, 0xe4];
const ARROW = [0x8e, 0xcf, 0x3e]; // green

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const s = (v) => Math.round((v / 32) * size);

  const set = (x, y, [b, g, r], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    // Simple source-over onto whatever is there.
    const ia = a / 255;
    px[i] = Math.round(px[i] * (1 - ia) + b * ia);
    px[i + 1] = Math.round(px[i + 1] * (1 - ia) + g * ia);
    px[i + 2] = Math.round(px[i + 2] * (1 - ia) + r * ia);
    px[i + 3] = Math.max(px[i + 3], a);
  };

  // Rounded-ish background.
  const radius = s(6);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.min(x, size - 1 - x);
      const dy = Math.min(y, size - 1 - y);
      if (dx < radius && dy < radius) {
        const d = Math.hypot(radius - dx, radius - dy);
        if (d > radius) continue;
      }
      set(x, y, BG);
    }
  }

  // Roof: a filled triangle.
  const apexX = size / 2;
  const apexY = s(7);
  const eaveY = s(16);
  const halfW = s(11);
  for (let y = apexY; y <= eaveY; y++) {
    const t = (y - apexY) / (eaveY - apexY);
    const w = halfW * t;
    for (let x = Math.round(apexX - w); x <= Math.round(apexX + w); x++) {
      set(x, y, ROOF);
    }
  }

  // Walls.
  const wallTop = eaveY;
  const wallBottom = s(25);
  const wallHalf = s(8);
  for (let y = wallTop; y <= wallBottom; y++) {
    for (let x = Math.round(apexX - wallHalf); x <= Math.round(apexX + wallHalf); x++) {
      set(x, y, WALL);
    }
  }

  // Upward arrow across the wall: rising value.
  const aw = Math.max(0.7, s(1.4));
  const x0 = apexX - s(5.5);
  const y0 = wallBottom - s(2.5);
  const x1 = apexX + s(3.5);
  const y1 = wallTop + s(2.5);

  // Shaft, drawn as a thick antialiased segment.
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  for (let py = 0; py < size; py++) {
    for (let px2 = 0; px2 < size; px2++) {
      const t = Math.max(0, Math.min(1, ((px2 - x0) * dx + (py - y0) * dy) / (len * len)));
      const d = Math.hypot(px2 - (x0 + dx * t), py - (y0 + dy * t));
      if (d <= aw) set(px2, py, ARROW);
      else if (d <= aw + 1) set(px2, py, ARROW, Math.round(255 * (aw + 1 - d)));
    }
  }

  // Arrowhead: an equilateral triangle pointing along the shaft.
  const ux = dx / len;
  const uy = dy / len;
  const head = s(4.5);
  const halfBase = s(3);
  const tipX = x1 + ux * s(1.5);
  const tipY = y1 + uy * s(1.5);
  const baseX = tipX - ux * head;
  const baseY = tipY - uy * head;
  for (let py = 0; py < size; py++) {
    for (let px2 = 0; px2 < size; px2++) {
      // Project into the triangle's local frame.
      const rx = px2 - baseX;
      const ry = py - baseY;
      const along = rx * ux + ry * uy;
      const across = Math.abs(-rx * uy + ry * ux);
      if (along < 0 || along > head) continue;
      if (across <= halfBase * (1 - along / head)) set(px2, py, ARROW);
    }
  }

  return px;
}

// --- minimal PNG encoder ------------------------------------------------

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function toPng(size, bgra) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      raw[o++] = bgra[i + 2];
      raw[o++] = bgra[i + 1];
      raw[o++] = bgra[i];
      raw[o++] = bgra[i + 3];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- DIB (BMP) encoder --------------------------------------------------

/**
 * Classic BITMAPINFOHEADER icon image.
 *
 * GDI+ and several Windows shell paths do not accept PNG-compressed entries
 * below 256px, so the small sizes ship as DIBs. Note the doubled height in the
 * header: it accounts for the XOR colour data plus the AND mask that follows,
 * even for 32-bit icons where the mask is redundant.
 */
function toDib(size, bgra) {
  const head = Buffer.alloc(40);
  head.writeUInt32LE(40, 0);
  head.writeInt32LE(size, 4);
  head.writeInt32LE(size * 2, 8);
  head.writeUInt16LE(1, 12); // planes
  head.writeUInt16LE(32, 14); // bpp
  head.writeUInt32LE(0, 16); // BI_RGB

  // XOR data, bottom-up.
  const xor = Buffer.alloc(size * size * 4);
  let o = 0;
  for (let y = size - 1; y >= 0; y--) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      xor[o++] = bgra[i];
      xor[o++] = bgra[i + 1];
      xor[o++] = bgra[i + 2];
      xor[o++] = bgra[i + 3];
    }
  }

  // AND mask: 1bpp, rows padded to 4 bytes. Fully opaque, so all zeroes.
  const maskRow = Math.ceil(size / 32) * 4;
  const and = Buffer.alloc(maskRow * size);

  return Buffer.concat([head, xor, and]);
}

// --- ICO container ------------------------------------------------------

const images = SIZES.map((size) => {
  const pixels = render(size);
  return { size, data: size >= 256 ? toPng(size, pixels) : toDib(size, pixels) };
});

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(images.length, 4);

const entries = [];
let offset = 6 + images.length * 16;
for (const { size, data } of images) {
  const e = Buffer.alloc(16);
  e[0] = size >= 256 ? 0 : size;
  e[1] = size >= 256 ? 0 : size;
  e[2] = 0; // palette
  e[4] = 1; // planes
  e.writeUInt16LE(32, 6); // bpp
  e.writeUInt32LE(data.length, 8);
  e.writeUInt32LE(offset, 12);
  entries.push(e);
  offset += data.length;
}

mkdirSync('build', { recursive: true });
writeFileSync('build/icon.ico', Buffer.concat([header, ...entries, ...images.map((p) => p.data)]));
console.log(`build/icon.ico written (${SIZES.join(', ')}px)`);
