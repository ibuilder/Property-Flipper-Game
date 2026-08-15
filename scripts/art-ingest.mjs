/**
 * Compile the delivered SVG art into a typed module the bundle can carry.
 *
 * The art in `art/` is the source of truth and is never edited here: this reads
 * it, checks it against the constraints in the brief, and writes
 * `src/ui/board/art.generated.ts`. Run it after adding or replacing art.
 *
 *     node scripts/art-ingest.mjs
 *
 * Two things make this a compile step rather than a set of `?raw` imports.
 *
 * The bundle ships one self-contained CSP-safe file, so the geometry has to be
 * inlined rather than fetched, and inlining 35 files by hand is how a set goes
 * stale. And more importantly the art needs an **anchor** that is not in the
 * SVGs. Each artboard is centred on its own drawing's bounding box, so the lot
 * origin lands somewhere different in every file -- measured, a 15.5px spread
 * across the seven archetypes on a lot diamond only 19px tall. Placing the
 * artboards by their centres would leave the ranch hovering and the victorian
 * sunk into the ground. The anchor is recovered by running the generator that
 * produced the art, which is shipped alongside it, and baked into the output.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART = path.join(ROOT, 'art');
const OUT = path.join(ROOT, 'src', 'ui', 'board', 'art.generated.ts');

/** Constraints from the brief that a delivery must not violate. */
const FORBIDDEN = [
  [/<image\b/i, '<image> element'],
  [/\bxlink:/i, 'xlink reference'],
  [/\burl\(/i, 'url() reference'],
  [/<text\b/i, '<text> element'],
  [/\bid="/i, 'id attribute'],
  [/<style\b/i, '<style> block'],
  [/\bfont-/i, 'font property'],
];

/**
 * Recover each archetype's lot origin by re-running the generator.
 *
 * `_gen.js` is a plain script with no exports, so it is evaluated with a driver
 * appended. Deriving this rather than hand-copying seven pairs of numbers means
 * a regenerated art set cannot silently disagree with the board.
 */
async function readAnchors() {
  const genPath = path.join(ART, '_gen.js');
  if (!fs.existsSync(genPath)) {
    throw new Error(
      `art/_gen.js is missing. It is the only source of the per-archetype lot ` +
        `anchor, which is not recoverable from the SVGs alone.`,
    );
  }
  const driver = `
    const out = { unit: S, anchors: {} };
    for (const id of Object.keys(A)) {
      const t = transformFor(id);
      const c = P(0.5, 0.5, 0);
      out.anchors[id] = { x: c[0] + t[0], y: c[1] + t[1] };
    }
    globalThis.__ART = out;
  `;
  const src = fs.readFileSync(genPath, 'utf8') + driver;
  await import('data:text/javascript;base64,' + Buffer.from(src, 'utf8').toString('base64'));
  return globalThis.__ART;
}

/**
 * Pull the stroke groups out of one SVG.
 *
 * Deliberately strict rather than a general SVG parser: the delivery format is
 * two `<g>` groups of `<path>`, and anything else is a change worth failing on
 * rather than silently dropping.
 */
function parse(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ART, file).replace(/\\/g, '/');

  for (const [re, what] of FORBIDDEN) {
    if (re.test(raw)) throw new Error(`${rel}: contains a ${what}, which the brief forbids`);
  }

  const box = raw.match(/viewBox="0 0 (\d+) \1"/);
  if (!box) throw new Error(`${rel}: expected a square viewBox starting at the origin`);

  const paths = [];
  const groups = [...raw.matchAll(/<g\b([^>]*)>([\s\S]*?)<\/g>/g)];
  if (!groups.length) throw new Error(`${rel}: no stroke groups found`);

  for (const [, attrs, body] of groups) {
    const w = attrs.match(/stroke-width="([\d.]+)"/);
    if (!w) throw new Error(`${rel}: a group has no stroke-width`);
    const weight = Number(w[1]);
    for (const [, d] of body.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)) {
      paths.push({ w: weight, d: d.trim() });
    }
  }
  if (!paths.length) throw new Error(`${rel}: no paths found`);
  return { size: Number(box[1]), paths };
}

const { unit: ART_UNIT, anchors } = await readAnchors();
const ids = Object.keys(anchors);
const STATES = ['distressed', 'occupied', 'working', 'finished'];

const houses = {};
let pathCount = 0;
for (const id of ids) {
  houses[id] = {};
  const want = [['base', `house-${id}.svg`], ...STATES.map((s) => [s, `house-${id}-${s}.svg`])];
  for (const [key, name] of want) {
    const file = path.join(ART, 'houses', name);
    if (!fs.existsSync(file)) {
      throw new Error(`art/houses/${name} is missing: every archetype needs a base and 4 states`);
    }
    const { paths } = parse(file);
    houses[id][key] = paths;
    pathCount += paths.length;
  }
}

const furniture = {};
const furnDir = path.join(ART, 'furniture');
if (fs.existsSync(furnDir)) {
  for (const name of fs.readdirSync(furnDir).sort()) {
    if (!name.endsWith('.svg')) continue;
    const { paths, size } = parse(path.join(furnDir, name));
    furniture[name.replace(/^lot-|\.svg$/g, '')] = { size, paths };
    pathCount += paths.length;
  }
}

const j = (v) => JSON.stringify(v);
const lines = [];
lines.push(`// GENERATED by scripts/art-ingest.mjs from art/. Do not edit by hand.`);
lines.push(`// Source: ${ids.length} archetypes x 5 states, ${Object.keys(furniture).length} furniture pieces.`);
lines.push(``);
lines.push(`/** One stroked path. \`w\` is the delivered pen weight: 1 detail, 2 contour. */`);
lines.push(`export interface ArtPath {`);
lines.push(`  w: number;`);
lines.push(`  d: string;`);
lines.push(`}`);
lines.push(``);
lines.push(`/** The condition overlays, drawn on top of the base. */`);
lines.push(`export type HouseState = ${STATES.map(j).join(' | ')};`);
lines.push(``);
lines.push(`export const HOUSE_STATES: HouseState[] = [${STATES.map(j).join(', ')}];`);
lines.push(``);
lines.push(
  `/**\n` +
    ` * Grid units per lot edge in the art's own coordinate space.\n` +
    ` *\n` +
    ` * The board's TILE divided by this is the scale factor that lands a\n` +
    ` * delivered footprint exactly on a board lot.\n` +
    ` */`,
);
lines.push(`export const ART_UNIT = ${ART_UNIT};`);
lines.push(``);
lines.push(
  `/**\n` +
    ` * Where the lot origin sits inside each 128x128 artboard.\n` +
    ` *\n` +
    ` * Not a constant: each artboard is centred on its own drawing, so this\n` +
    ` * varies by roof height. Houses are placed by this point, never by the\n` +
    ` * artboard centre.\n` +
    ` */`,
);
lines.push(`export const HOUSE_ANCHOR: Record<string, { x: number; y: number }> = {`);
for (const id of ids) {
  const a = anchors[id];
  lines.push(`  ${id}: { x: ${+a.x.toFixed(3)}, y: ${+a.y.toFixed(3)} },`);
}
lines.push(`};`);
lines.push(``);
lines.push(`export const HOUSE_ART: Record<string, Record<string, ArtPath[]>> = {`);
for (const id of ids) {
  lines.push(`  ${id}: {`);
  for (const key of ['base', ...STATES]) {
    lines.push(`    ${key}: [`);
    for (const p of houses[id][key]) lines.push(`      { w: ${p.w}, d: ${j(p.d)} },`);
    lines.push(`    ],`);
  }
  lines.push(`  },`);
}
lines.push(`};`);
lines.push(``);
lines.push(
  `/**\n` +
    ` * Lot furniture, delivered but not yet placed.\n` +
    ` *\n` +
    ` * These arrived without the generator that produced them, so unlike the\n` +
    ` * houses their lot anchor cannot be recovered -- placing them would be\n` +
    ` * guesswork. Carried here so they are ready the moment an anchor is agreed.\n` +
    ` */`,
);
lines.push(`export const FURNITURE: Record<string, { size: number; paths: ArtPath[] }> = {`);
for (const [name, f] of Object.entries(furniture)) {
  lines.push(`  ${JSON.stringify(name)}: {`);
  lines.push(`    size: ${f.size},`);
  lines.push(`    paths: [`);
  for (const p of f.paths) lines.push(`      { w: ${p.w}, d: ${j(p.d)} },`);
  lines.push(`    ],`);
  lines.push(`  },`);
}
lines.push(`};`);
lines.push(``);

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(
  `art-ingest: ${ids.length} archetypes x 5 states, ` +
    `${Object.keys(furniture).length} furniture, ${pathCount} paths -> ` +
    `${path.relative(ROOT, OUT).replace(/\\/g, '/')}`,
);
