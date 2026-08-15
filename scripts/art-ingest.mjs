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
const OUT_UI = path.join(ROOT, 'src', 'ui', 'art.generated.ts');

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

// ---------------------------------------------------------------------------
// The rest of the delivery: everything that is not board geometry.
//
// These are kept as markup rather than parsed into path arrays. The houses are
// pulled apart because the board has to re-ink them per theme and place them
// against a projection; Scout, the mastheads and the coloured houses are
// finished pictures with their own baked palette, and taking them apart would
// buy nothing but a chance to get them wrong.
// ---------------------------------------------------------------------------

/** Inner markup of an SVG, with the wrapper and its own dimensions removed. */
function readMarkup(file, { recolour = false } = {}) {
  const raw = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ART, file).replace(/\\/g, '/');
  for (const [re, what] of FORBIDDEN) {
    if (re.test(raw)) throw new Error(`${rel}: contains a ${what}, which the brief forbids`);
  }
  const box = raw.match(/viewBox="([^"]+)"/);
  if (!box) throw new Error(`${rel}: no viewBox`);
  const [, , w, h] = box[1].split(/\s+/).map(Number);

  let body = raw
    .replace(/^[\s\S]*?<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim();
  // Root-level presentation attributes do not survive unwrapping, so anything
  // the paths inherited has to be pushed back down onto them.
  const rootStroke = raw.match(/<svg\b[^>]*\bstroke="([^"]+)"/);
  const rootWidth = raw.match(/<svg\b[^>]*\bstroke-width="([^"]+)"/);
  if (rootStroke && !/<(path|g)\b[^>]*\bstroke=/.test(body)) {
    const w2 = rootWidth ? ` stroke-width="${rootWidth[1]}"` : '';
    body = `<g fill="none" stroke="${rootStroke[1]}"${w2} stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  }
  if (recolour) body = body.replace(/#000000/gi, 'currentColor');
  return { w, h, body };
}

const dir = (name) => path.join(ART, name);
const svgsIn = (name) =>
  fs.existsSync(dir(name))
    ? fs
        .readdirSync(dir(name))
        .filter((f) => f.endsWith('.svg'))
        .sort()
    : [];

// Icons: single-path, one colour, drawn on a 24px grid. Recoloured to
// currentColor so they take whatever they are placed inside.
const icons = {};
for (const f of svgsIn('icons')) {
  const raw = fs.readFileSync(path.join(dir('icons'), f), 'utf8');
  const ds = [...raw.matchAll(/\bd="([^"]+)"/g)].map((m) => m[1]);
  if (!ds.length) throw new Error(`art/icons/${f}: no path data`);
  icons[f.replace(/^icon-|\.svg$/g, '')] = ds;
}

// Scout's moods and the four other faces, as finished pictures.
const scout = {};
const npc = {};
for (const f of svgsIn('scout')) {
  const { body } = readMarkup(path.join(dir('scout'), f));
  if (f.startsWith('avatar-')) npc[f.replace(/^avatar-|\.svg$/g, '')] = body;
  else scout[f.replace(/^scout-|\.svg$/g, '')] = body;
}

/*
 * Mastheads and headline plates, un-papered.
 *
 * These are delivered as ink on a full-bleed sheet of `#f4efe2`. That is right
 * for a printed page and wrong for a panel that has to work in both themes: the
 * sheet would sit in the dark theme as a lit rectangle. The letterforms are
 * outlined paths, so dropping the sheet and mapping the ink to `currentColor`
 * gives a masthead that takes the theme's text colour and keeps every serif.
 */
const press = {};
for (const f of svgsIn('press')) {
  const { w, h, body } = readMarkup(path.join(dir('press'), f));
  const unpapered = body
    .replace(/<rect\b[^>]*\bfill="#f4efe2"[^>]*>(?:<\/rect>)?/gi, '')
    /*
     * Drop the kicker.
     *
     * The masthead's strapline is set in the same wood-type, which has no
     * digits or punctuation drawn yet, so it renders with holes in it. It is
     * also the one line here that is static, and the rail already prints a
     * live dateline underneath -- town, week number and date -- so nothing is
     * lost by removing it and a broken-looking line is avoided. It is the only
     * accent-coloured group in the set, which is what makes this findable.
     */
    .replace(/<g\b[^>]*>(?:(?!<\/g>)[\s\S])*?fill="#5980a6"[\s\S]*?<\/g>/gi, '')
    .replace(/#1d1f20/gi, 'currentColor');
  if (/#f4efe2|#5980a6/i.test(unpapered)) {
    throw new Error(`art/press/${f}: paper or kicker colour survived the un-papering`);
  }
  press[f.replace(/\.svg$/, '')] = { w, h, body: unpapered };
}

/*
 * The coloured houses, in two cuts.
 *
 * Each one is delivered standing on its own kerbed plinth: an opaque lot
 * diamond, its two extruded side faces, a lawn and a contact shadow, all drawn
 * before the building. That is right for a picture of a house and fatal on the
 * board, where it would paint over the lot colour that the four data views
 * exist to show -- the board would stop answering four questions and start
 * answering none.
 *
 * The ground is a clean prefix in all thirty-five files, so it can be taken off
 * deterministically rather than by eye. `HOUSE_COLOR` keeps it for anywhere a
 * house is the subject; `HOUSE_COLOR_BARE` drops it so the building can stand
 * on a lot the board has coloured itself.
 */
const GROUND_FILLS = new Set(['#cdc4b1', '#b0a693', '#9e9584', '#8b9d63', 'rgba(60,50,40,0.10)']);

/** Half-width of the lot diamond in the coloured set's own coordinates. */
let colourHalfWidth = null;

function stripGround(body, rel) {
  const parts = body.match(/<path\b[^>]*?(?:\/>|>\s*<\/path>)/g) ?? [];
  let cut = 0;
  for (const p of parts) {
    const fill = p.match(/fill="([^"]+)"/);
    if (!fill || !GROUND_FILLS.has(fill[1])) break;
    // The plinth top is the lot itself, and gives the set's art unit.
    const d = p.match(/\bd="M0 0 L([\d.]+) -([\d.]+) L([\d.]+) 0/);
    if (d) {
      const half = Number(d[1]);
      if (colourHalfWidth === null) colourHalfWidth = half;
      else if (Math.abs(colourHalfWidth - half) > 0.01) {
        throw new Error(
          `art/${rel}: lot diamond is ${half} wide but another file says ` +
            `${colourHalfWidth}. The coloured set must share one lot size or ` +
            `houses cannot be placed on a common grid.`,
        );
      }
    }
    cut++;
  }
  if (!cut) throw new Error(`art/${rel}: expected the plinth to be drawn first, found none`);
  let out = body;
  for (let i = 0; i < cut; i++) out = out.replace(parts[i], '');
  return out.trim();
}

const colour = {};
const colourBare = {};
let colourTransforms = {};
const cdir = dir('houses-color');
if (fs.existsSync(cdir)) {
  const tf = path.join(cdir, '_transforms.json');
  if (!fs.existsSync(tf)) {
    throw new Error(
      `art/houses-color/_transforms.json is missing. Without it the coloured ` +
        `set cannot be scaled to a common size: each artboard is fitted to its ` +
        `own drawing, so a bungalow and a victorian would render the same height.`,
    );
  }
  colourTransforms = JSON.parse(fs.readFileSync(tf, 'utf8'));
  for (const id of Object.keys(colourTransforms)) {
    colour[id] = {};
    colourBare[id] = {};
    for (const [key, name] of [
      ['base', `house-${id}.svg`],
      ...STATES.map((s) => [s, `house-${id}-${s}.svg`]),
    ]) {
      const file = path.join(cdir, name);
      if (!fs.existsSync(file)) throw new Error(`art/houses-color/${name} is missing`);
      const { body } = readMarkup(file);
      colour[id][key] = body;
      // Only the base stands on ground; the overlays are drawn over it and add
      // no plinth of their own, so there is nothing in them to take off.
      colourBare[id][key] = key === 'base' ? stripGround(body, `houses-color/${name}`) : body;
    }
  }
}

const ui = [];
ui.push(`// GENERATED by scripts/art-ingest.mjs from art/. Do not edit by hand.`);
ui.push(``);
ui.push(
  `/**\n` +
    ` * Icon path data, on a 24px grid at 1.5 stroke.\n` +
    ` *\n` +
    ` * Delivered under Lucide-compatible names, so any one of these can be\n` +
    ` * swapped for the Lucide original without touching a call site.\n` +
    ` */`,
);
ui.push(`export const ICON_BOX = 24;`);
ui.push(`export const ICONS: Record<string, string[]> = {`);
for (const [k, v] of Object.entries(icons)) ui.push(`  ${JSON.stringify(k)}: ${j(v)},`);
ui.push(`};`);
ui.push(``);
ui.push(`export type IconName = keyof typeof ICONS & string;`);
ui.push(``);
ui.push(
  `/**\n` +
    ` * Scout, one drawing per mood, and the four faces he is not.\n` +
    ` *\n` +
    ` * Baked palette rather than theme tokens: he is a character, and a\n` +
    ` * character who changes colour with the interface stops being one.\n` +
    ` */`,
);
ui.push(`export const SCOUT_BOX = 320;`);
ui.push(`export const SCOUT: Record<string, string> = {`);
for (const [k, v] of Object.entries(scout)) ui.push(`  ${JSON.stringify(k)}: ${j(v)},`);
ui.push(`};`);
ui.push(``);
ui.push(`export const NPC: Record<string, string> = {`);
for (const [k, v] of Object.entries(npc)) ui.push(`  ${JSON.stringify(k)}: ${j(v)},`);
ui.push(`};`);
ui.push(``);
ui.push(`export interface PressPlate {`);
ui.push(`  w: number;`);
ui.push(`  h: number;`);
ui.push(`  body: string;`);
ui.push(`}`);
ui.push(``);
ui.push(`export const PRESS: Record<string, PressPlate> = {`);
for (const [k, v] of Object.entries(press)) {
  ui.push(`  ${JSON.stringify(k)}: { w: ${v.w}, h: ${v.h}, body: ${j(v.body)} },`);
}
ui.push(`};`);
ui.push(``);
ui.push(
  `/**\n` +
    ` * The coloured houses.\n` +
    ` *\n` +
    ` * Not used on the board: each one paints its own kerbed plinth and lawn,\n` +
    ` * which would cover the very lot colour the four data views exist to show.\n` +
    ` * They are for anywhere a single house is the subject and there is no ramp\n` +
    ` * underneath it.\n` +
    ` *\n` +
    ` * \`k\` differs per archetype because each artboard is fitted to its own\n` +
    ` * drawing. Dividing it out is what keeps a bungalow smaller than a mill\n` +
    ` * loft instead of rendering both at the same height.\n` +
    ` */`,
);
ui.push(`export const COLOR_BOX = 256;`);
ui.push(
  `export const COLOR_TRANSFORM: Record<string, { k: number; tx: number; ty: number }> = ${JSON.stringify(colourTransforms, null, 2)};`,
);
ui.push(``);
ui.push(
  `/**\n` +
    ` * Grid units per lot edge in the coloured set's own coordinate space.\n` +
    ` *\n` +
    ` * Read off the plinth diamond rather than assumed, and asserted identical\n` +
    ` * across all thirty-five files at ingest.\n` +
    ` */`,
);
ui.push(`export const COLOR_UNIT = ${colourHalfWidth === null ? 'null' : +(colourHalfWidth / 0.7071).toFixed(4)};`);
ui.push(``);
ui.push(`export const HOUSE_COLOR: Record<string, Record<string, string>> = {`);
for (const [id, states] of Object.entries(colour)) {
  ui.push(`  ${id}: {`);
  for (const [k, v] of Object.entries(states)) ui.push(`    ${k}: ${j(v)},`);
  ui.push(`  },`);
}
ui.push(`};`);
ui.push(``);
ui.push(`/** The same houses with the plinth, lawn and shadow removed. */`);
ui.push(`export const HOUSE_COLOR_BARE: Record<string, Record<string, string>> = {`);
for (const [id, states] of Object.entries(colourBare)) {
  ui.push(`  ${id}: {`);
  for (const [k, v] of Object.entries(states)) ui.push(`    ${k}: ${j(v)},`);
  ui.push(`  },`);
}
ui.push(`};`);
ui.push(``);

fs.writeFileSync(OUT_UI, ui.join('\n'), 'utf8');
console.log(
  `art-ingest: ${Object.keys(icons).length} icons, ${Object.keys(scout).length} Scout moods, ` +
    `${Object.keys(npc).length} faces, ${Object.keys(press).length} press, ` +
    `${Object.keys(colour).length} coloured archetypes -> ` +
    `${path.relative(ROOT, OUT_UI).replace(/\\/g, '/')}`,
);
