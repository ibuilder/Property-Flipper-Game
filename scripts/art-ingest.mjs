/**
 * Compile the delivered SVG art into typed modules the bundle can carry.
 *
 *     npm run art
 *
 * The art in `art/` is the source of truth and is never edited here. This reads
 * it, checks it against the constraints in the brief, and writes
 * `src/ui/board/art.generated.ts` (the line board's geometry) and
 * `src/ui/art.generated.ts` (everything else).
 *
 * It is a compile step rather than a set of `?raw` imports because the bundle
 * ships one self-contained CSP-safe file: anything not inlined is silently
 * absent at runtime.
 *
 * ## The placement model
 *
 * Every piece that stands on the board declares two things, and both come from
 * the delivery rather than from measurement here:
 *
 *   anchor   where the lot origin -- grid (0,0) -- lands inside that file's own
 *            artboard, in artboard pixels. For Scout's sprites there is no lot
 *            origin, so it is the point where his feet meet the ground.
 *   scale    the fit the file applies to its own drawing, as a wrapping
 *            `<g transform>`. 1 where there is no wrapper.
 *
 * Given a set's art unit -- grid units per lot edge in the coordinates the
 * drawing was made in -- placement is then the same three lines everywhere:
 *
 *     s = (TILE / unit) / scale
 *     translate(origin.x - s * anchor.x, origin.y - s * anchor.y) scale(s)
 *
 * Dividing `scale` back out is what keeps a bungalow smaller than a mill loft.
 * Each artboard is fitted to its own drawing, so using them as delivered would
 * render every house at the same height.
 *
 * This replaced an earlier version that recovered anchors by re-running the
 * generators, which was only ever a workaround for their absence.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART = path.join(ROOT, 'art');
const OUT_BOARD = path.join(ROOT, 'src', 'ui', 'board', 'art.generated.ts');
const OUT_UI = path.join(ROOT, 'src', 'ui', 'art.generated.ts');

const STATES = ['distressed', 'occupied', 'working', 'finished'];
const SEASONS = ['autumn', 'dusk', 'winter'];
const SPRITES = [
  'scout-idle-1',
  'scout-idle-2',
  'scout-walking-1',
  'scout-walking-2',
  'scout-digging-1',
  'scout-digging-2',
];

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

const j = (v) => JSON.stringify(v);
const dir = (name) => path.join(ART, name);
const exists = (p) => fs.existsSync(p);

function readJson(rel) {
  const p = path.join(ART, rel);
  if (!exists(p)) throw new Error(`art/${rel} is missing; it carries the anchors`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function svgsIn(name) {
  const d = dir(name);
  if (!exists(d)) return [];
  return fs
    .readdirSync(d)
    .filter((f) => f.endsWith('.svg'))
    .sort();
}

/** Inner markup of an SVG, with the wrapper removed and root attributes pushed down. */
function readMarkup(file, { recolour = false } = {}) {
  const raw = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ART, file).replace(/\\/g, '/');
  for (const [re, what] of FORBIDDEN) {
    if (re.test(raw)) throw new Error(`art/${rel}: contains a ${what}, which the brief forbids`);
  }
  const box = raw.match(/viewBox="([^"]+)"/);
  if (!box) throw new Error(`art/${rel}: no viewBox`);
  const [, , w, h] = box[1].split(/\s+/).map(Number);

  let body = raw
    .replace(/^[\s\S]*?<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim();

  // Presentation attributes on <svg> do not survive unwrapping.
  const rootStroke = raw.match(/<svg\b[^>]*\bstroke="([^"]+)"/);
  const rootWidth = raw.match(/<svg\b[^>]*\bstroke-width="([^"]+)"/);
  if (rootStroke && !/<(path|g)\b[^>]*\bstroke=/.test(body)) {
    const sw = rootWidth ? ` stroke-width="${rootWidth[1]}"` : '';
    body = `<g fill="none" stroke="${rootStroke[1]}"${sw} stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  }
  if (recolour) body = body.replace(/#000000/gi, 'currentColor');
  return { w, h, body };
}

/** `<path>` elements of a body, in document order. */
const pathsOf = (body) => body.match(/<path\b[^>]*?(?:\/>|>\s*<\/path>)/g) ?? [];

// ---------------------------------------------------------------------------
// The line house set: parsed into weighted paths so the board can re-ink it.
// ---------------------------------------------------------------------------

/**
 * Pull the stroke groups out of one line drawing.
 *
 * Deliberately strict rather than a general SVG parser: the delivery format is
 * two `<g>` groups of `<path>`, and anything else is a change worth failing on
 * rather than silently dropping.
 */
function parseLine(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ART, file).replace(/\\/g, '/');
  for (const [re, what] of FORBIDDEN) {
    if (re.test(raw)) throw new Error(`art/${rel}: contains a ${what}, which the brief forbids`);
  }
  const box = raw.match(/viewBox="0 0 (\d+) \1"/);
  if (!box) throw new Error(`art/${rel}: expected a square viewBox at the origin`);

  const paths = [];
  for (const [, attrs, body] of raw.matchAll(/<g\b([^>]*)>([\s\S]*?)<\/g>/g)) {
    const w = attrs.match(/stroke-width="([\d.]+)"/);
    if (!w) throw new Error(`art/${rel}: a stroke group has no stroke-width`);
    for (const [, d] of body.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)) {
      paths.push({ w: Number(w[1]), d: d.trim() });
    }
  }
  if (!paths.length) throw new Error(`art/${rel}: no paths found`);
  return { size: Number(box[1]), paths };
}

/**
 * The line set's art unit, cross-checked against its generator.
 *
 * The delivered anchors are the authority. `_gen.js` is still shipped and still
 * computes the same numbers, so it is used as an independent second opinion:
 * if the two ever disagree, one of them has been regenerated without the other
 * and the board would put houses somewhere subtly wrong.
 */
async function lineUnitAndCheck(anchors) {
  const genPath = path.join(ART, '_gen.js');
  if (!exists(genPath)) {
    throw new Error('art/_gen.js is missing; it is the only statement of the line set art unit');
  }
  const driver = `
    const out = { unit: S, anchors: {} };
    for (const id of Object.keys(A)) {
      const t = transformFor(id);
      out.anchors[id] = [t[0], t[1]];
    }
    globalThis.__LINE = out;
  `;
  const src = fs.readFileSync(genPath, 'utf8') + driver;
  await import('data:text/javascript;base64,' + Buffer.from(src, 'utf8').toString('base64'));
  const got = globalThis.__LINE;

  for (const [id, a] of Object.entries(anchors)) {
    const mine = got.anchors[id];
    if (!mine) continue;
    const dx = Math.abs(mine[0] - a.anchor[0]);
    const dy = Math.abs(mine[1] - a.anchor[1]);
    if (dx > 0.15 || dy > 0.15) {
      throw new Error(
        `art/houses/_anchors.json disagrees with _gen.js for ${id}: ` +
          `[${a.anchor}] against [${mine.map((n) => n.toFixed(2))}]. One was regenerated ` +
          `without the other.`,
      );
    }
  }
  return got.unit;
}

// ---------------------------------------------------------------------------
// Read the delivery
// ---------------------------------------------------------------------------

const lineAnchors = readJson('houses/_anchors.json');
const ids = Object.keys(lineAnchors);
const ART_UNIT = await lineUnitAndCheck(lineAnchors);

const houses = {};
let pathCount = 0;
for (const id of ids) {
  houses[id] = {};
  for (const [key, name] of [
    ['base', `house-${id}.svg`],
    ...STATES.map((s) => [s, `house-${id}-${s}.svg`]),
  ]) {
    const file = path.join(dir('houses'), name);
    if (!exists(file)) throw new Error(`art/houses/${name} is missing`);
    const { paths } = parseLine(file);
    houses[id][key] = paths;
    pathCount += paths.length;
  }
}

/*
 * The coloured houses, in two cuts.
 *
 * Each is delivered standing on its own kerbed plinth: an opaque lot diamond,
 * two extruded side faces, a lawn and a contact shadow, all drawn before the
 * building. That is right for a picture of a house and fatal on the board,
 * where it would paint over the lot colour the four data views exist to show --
 * the board would stop answering four questions and start answering none.
 *
 * The ground is a clean prefix of every base file, so it comes off by counting
 * rather than by eye. `HOUSE_COLOR` keeps it for anywhere a house is the
 * subject; `HOUSE_COLOR_BARE` drops it so the building can stand on a lot the
 * board has coloured itself.
 */
const GROUND_FILLS = new Set(['#cdc4b1', '#b0a693', '#9e9584', '#8b9d63', 'rgba(60,50,40,0.10)']);
let colourHalfWidth = null;
const groundCut = {};
const plinth = {};

function stripGround(body, rel, id) {
  const parts = pathsOf(body);
  let cut = 0;
  for (const p of parts) {
    const fill = p.match(/fill="([^"]+)"/);
    if (!fill || !GROUND_FILLS.has(fill[1])) break;
    // The plinth top is the lot itself, and gives the set's art unit.
    const d = p.match(/\bd="M0 0 L([\d.]+) -([\d.]+) L([\d.]+) 0/);
    if (d) {
      const half = Number(d[1]);
      if (colourHalfWidth === null) colourHalfWidth = half;
      else if (Math.abs(colourHalfWidth - half) > 0.05) {
        throw new Error(`art/${rel}: lot diamond ${half} wide, elsewhere ${colourHalfWidth}`);
      }
    }
    cut++;
  }
  if (!cut) throw new Error(`art/${rel}: expected the plinth to be drawn first, found none`);
  groundCut[id] = { cut, total: parts.length };
  plinth[id] = parts.slice(0, cut).join('');
  let out = body;
  for (let i = 0; i < cut; i++) out = out.replace(parts[i], '');
  return out.trim();
}

/**
 * Remove a known number of leading paths.
 *
 * For the seasonal remaps, where the ground cannot be found by colour -- dusk
 * and winter repaint the plinth, so `#cdc4b1` is not there to look for. Path
 * order is shared with the coloured base, so the count found there is the right
 * count here, checked against a matching total.
 */
function stripLeading(body, id, rel) {
  const { cut, total } = groundCut[id];
  const parts = pathsOf(body);
  if (parts.length !== total) {
    throw new Error(
      `art/${rel}: ${parts.length} paths against ${total} in the coloured base. The ` +
        `seasonal sets are remaps of it and must keep its path order.`,
    );
  }
  let out = body;
  for (let i = 0; i < cut; i++) out = out.replace(parts[i], '');
  return out.trim();
}

const colourTransforms = readJson('houses-color/_transforms.json');
const colourBare = {};
for (const id of ids) {
  if (!colourTransforms[id]) throw new Error(`art/houses-color/_transforms.json has no ${id}`);
  colourBare[id] = {};
  for (const [key, name] of [
    ['base', `house-${id}.svg`],
    ...STATES.map((s) => [s, `house-${id}-${s}.svg`]),
  ]) {
    const file = path.join(dir('houses-color'), name);
    if (!exists(file)) throw new Error(`art/houses-color/${name} is missing`);
    const { body } = readMarkup(file);
    // Only the base stands on ground; overlays add no plinth of their own.
    colourBare[id][key] = key === 'base' ? stripGround(body, `houses-color/${name}`, id) : body;
  }
}

/*
 * The seasonal remaps.
 *
 * Delivered complete this time -- ten bases and forty overlays each -- so
 * nothing has to be derived. Each set carries its own transforms file; they are
 * checked against the coloured set's rather than assumed equal, because an
 * earlier delivery disagreed on one archetype by 1.6 units, which would have
 * put that house off its lot in every season.
 */
const seasonal = {};
for (const season of SEASONS) {
  const sdir = dir(`houses-${season}`);
  if (!exists(sdir)) continue;
  const tf = readJson(`houses-${season}/_transforms.json`);
  seasonal[season] = {};
  for (const id of ids) {
    const t = tf[id];
    if (!t) throw new Error(`art/houses-${season}/_transforms.json has no ${id}`);
    const c = colourTransforms[id];
    for (const k of ['k', 'tx', 'ty']) {
      if (Math.abs(t[k] - c[k]) > 0.05) {
        throw new Error(
          `art/houses-${season}: ${id} ${k} is ${t[k]} but the coloured set says ${c[k]}. ` +
            `The remaps must share the base's fit or the house moves with the season.`,
        );
      }
    }
    const states = {};
    for (const [key, name] of [
      ['base', `house-${id}.svg`],
      ...STATES.map((s) => [s, `house-${id}-${s}.svg`]),
    ]) {
      const file = path.join(sdir, name);
      if (!exists(file)) throw new Error(`art/houses-${season}/${name} is missing`);
      const { body } = readMarkup(file);
      states[key] = key === 'base' ? stripLeading(body, id, `houses-${season}/${name}`) : body;
    }
    seasonal[season][id] = states;
  }
}

/*
 * Lot furniture, both finishes, now anchored.
 *
 * The line set used to be centred on its own bounding box, which discarded
 * where each piece stood -- a fence belongs on a boundary and a driveway at the
 * kerb, and centred they are the same drawing. Both sets are now generated from
 * one description and share an art space, verified below rather than trusted.
 */
function readFurniture(folder, recolour) {
  const anchors = readJson(`${folder}/_anchors.json`);
  const out = {};
  for (const f of svgsIn(folder)) {
    const name = f.replace(/^lot-|\.svg$/g, '');
    const a = anchors[name];
    if (!a) throw new Error(`art/${folder}/_anchors.json has no ${name}`);
    const { body } = readMarkup(path.join(dir(folder), f), { recolour });
    out[name] = { anchor: a.anchor, scale: a.scale ?? 1, body };
  }
  return out;
}
const furnitureLine = readFurniture('furniture', true);
const furnitureColour = readFurniture('furniture-color', false);

/*
 * Scout's board sprites, coloured and line.
 *
 * Anchored at the ground contact point rather than a lot origin, identical
 * across all six frames so alternating them does not make him hop.
 */
function readSprites(folder, recolour) {
  const meta = readJson(`${folder}/_anchors.json`);
  const table = meta.sprites ?? meta;
  const out = {};
  for (const name of SPRITES) {
    const file = path.join(dir(folder), `${name}.svg`);
    if (!exists(file)) continue;
    const a = table[name];
    if (!a) throw new Error(`art/${folder}/_anchors.json has no ${name}`);
    const { body } = readMarkup(file, { recolour });
    out[name] = { anchor: a.anchor, scale: a.scale ?? 1, body };
  }
  return out;
}
const spriteColour = readSprites('scout', false);
const spriteLine = readSprites('scout-line', true);

// Scout's busts and the four faces he is not.
const scout = {};
const npc = {};
for (const f of svgsIn('scout')) {
  if (SPRITES.some((s) => f === `${s}.svg`)) continue;
  const { body } = readMarkup(path.join(dir('scout'), f));
  if (f.startsWith('avatar-')) npc[f.replace(/^avatar-|\.svg$/g, '')] = body;
  else scout[f.replace(/^scout-|\.svg$/g, '')] = body;
}

// Icons: single-path, one colour, on a 24px grid.
const icons = {};
for (const f of svgsIn('icons')) {
  const raw = fs.readFileSync(path.join(dir('icons'), f), 'utf8');
  const ds = [...raw.matchAll(/\bd="([^"]+)"/g)].map((m) => m[1]);
  if (!ds.length) throw new Error(`art/icons/${f}: no path data`);
  icons[f.replace(/^icon-|\.svg$/g, '')] = ds;
}

/*
 * Press, un-papered.
 *
 * Delivered on transparent this time, as asked. The ink is still mapped to
 * `currentColor` so a masthead takes the theme's text colour, and the accent
 * used by the masthead kicker -- switched on now that the face has digits --
 * is mapped to the accent token.
 *
 * The cover is the one file that deliberately carries a ground, so it is left
 * exactly as delivered.
 */
const press = {};
for (const f of svgsIn('press')) {
  const name = f.replace(/\.svg$/, '');
  /*
   * The cover is not interface art and never appears inside the app: it is a
   * poster for the itch page, rasterised by `scripts/make-cover.mjs`, which
   * reads it straight from `art/`. Inlining it here would ship a 630x500
   * illustration -- the one file that deliberately carries its own ground --
   * into every player's bundle to be drawn nowhere.
   */
  if (name === 'cover-630x500') continue;
  const { w, h, body } = readMarkup(path.join(dir('press'), f));
  const themed = body
    .replace(/#1d1f20/gi, 'currentColor')
    .replace(/#5980a6/gi, 'var(--color-accent)');
  if (/#f4efe2/i.test(themed)) {
    throw new Error(`art/press/${f}: still carries a paper ground; deliver these on transparent`);
  }
  press[name] = { w, h, body: themed };
}

// ---------------------------------------------------------------------------
// Checks that span sets
// ---------------------------------------------------------------------------

const COLOR_UNIT = colourHalfWidth === null ? null : +(colourHalfWidth / 0.7071).toFixed(4);

/*
 * The furniture shares the coloured houses' art space.
 *
 * Asserted rather than assumed: a flat lot-sized piece must span the lot, so
 * the driveway's own width is a direct read of the unit it was drawn in. If a
 * future delivery moves the furniture back onto its own grid, this fails here
 * rather than by putting a hedge through a wall.
 */
function checkFurnitureUnit(set, label) {
  const drive = set.driveway;
  if (!drive || COLOR_UNIT === null) return;
  const xs = [];
  for (const d of drive.body.match(/\bd="([^"]+)"/g) ?? []) {
    const nums = [...d.matchAll(/-?\d*\.?\d+/g)].map((m) => Number(m[0]));
    for (let i = 0; i < nums.length; i += 2) xs.push(nums[i]);
  }
  if (!xs.length) return;
  const centre = (Math.min(...xs) + Math.max(...xs)) / 2;
  const want = 0.7071 * COLOR_UNIT;
  if (Math.abs(centre - want) > 1.5) {
    throw new Error(
      `art/${label}: the driveway centres on ${centre.toFixed(2)} but the lot centre is ` +
        `${want.toFixed(2)}. This set is not drawn in the coloured art space.`,
    );
  }
}
checkFurnitureUnit(furnitureLine, 'furniture');
checkFurnitureUnit(furnitureColour, 'furniture-color');

// ---------------------------------------------------------------------------
// Emit: the line board
// ---------------------------------------------------------------------------

const b = [];
b.push(`// GENERATED by scripts/art-ingest.mjs from art/. Do not edit by hand.`);
b.push(`// ${ids.length} archetypes x 5 states.`);
b.push(``);
b.push(`/** One stroked path. \`w\` is the delivered pen weight: 1 detail, 2 contour. */`);
b.push(`export interface ArtPath {`);
b.push(`  w: number;`);
b.push(`  d: string;`);
b.push(`}`);
b.push(``);
b.push(`/** The condition overlays, drawn on top of the base. */`);
b.push(`export type HouseState = ${STATES.map(j).join(' | ')};`);
b.push(``);
b.push(`export const HOUSE_STATES: HouseState[] = [${STATES.map(j).join(', ')}];`);
b.push(``);
b.push(
  `/**\n` +
    ` * Grid units per lot edge in the line set's own coordinates.\n` +
    ` *\n` +
    ` * The board's TILE divided by this lands a delivered footprint exactly on\n` +
    ` * a board lot.\n` +
    ` */`,
);
b.push(`export const ART_UNIT = ${ART_UNIT};`);
b.push(``);
b.push(
  `/**\n` +
    ` * Where the lot origin -- grid (0,0) -- sits inside each artboard.\n` +
    ` *\n` +
    ` * Not a constant: each artboard is fitted to its own drawing, so this\n` +
    ` * varies with roof height. Houses are placed by this point, never by the\n` +
    ` * artboard centre, or a ranch hovers while a victorian sinks.\n` +
    ` */`,
);
b.push(`export const HOUSE_ANCHOR: Record<string, { x: number; y: number }> = {`);
for (const id of ids) {
  const [x, y] = lineAnchors[id].anchor;
  b.push(`  ${id}: { x: ${x}, y: ${y} },`);
}
b.push(`};`);
b.push(``);
b.push(`export const HOUSE_ART: Record<string, Record<string, ArtPath[]>> = {`);
for (const id of ids) {
  b.push(`  ${id}: {`);
  for (const key of ['base', ...STATES]) {
    b.push(`    ${key}: [`);
    for (const p of houses[id][key]) b.push(`      { w: ${p.w}, d: ${j(p.d)} },`);
    b.push(`    ],`);
  }
  b.push(`  },`);
}
b.push(`};`);
b.push(``);
fs.writeFileSync(OUT_BOARD, b.join('\n'), 'utf8');

// ---------------------------------------------------------------------------
// Emit: everything else
// ---------------------------------------------------------------------------

const emitPlaceables = (out, name, table, doc) => {
  out.push(doc);
  out.push(`export const ${name}: Record<string, Placeable> = {`);
  for (const [k, v] of Object.entries(table)) {
    out.push(
      `  ${j(k)}: { anchor: [${v.anchor[0]}, ${v.anchor[1]}], scale: ${v.scale}, body: ${j(v.body)} },`,
    );
  }
  out.push(`};`);
  out.push(``);
};

const u = [];
u.push(`// GENERATED by scripts/art-ingest.mjs from art/. Do not edit by hand.`);
u.push(``);
u.push(
  `/**\n` +
    ` * A drawing that stands somewhere on the board.\n` +
    ` *\n` +
    ` * \`anchor\` is where the lot origin lands inside the artboard -- or, for\n` +
    ` * Scout, where his feet meet the ground. \`scale\` is the fit the file\n` +
    ` * applies to itself, which has to be divided back out at placement.\n` +
    ` */`,
);
u.push(`export interface Placeable {`);
u.push(`  anchor: [number, number];`);
u.push(`  scale: number;`);
u.push(`  body: string;`);
u.push(`}`);
u.push(``);
u.push(`export const ICON_BOX = 24;`);
u.push(`export const ICONS: Record<string, string[]> = {`);
for (const [k, v] of Object.entries(icons)) u.push(`  ${j(k)}: ${j(v)},`);
u.push(`};`);
u.push(``);
u.push(`export type IconName = keyof typeof ICONS & string;`);
u.push(``);
u.push(
  `/**\n` +
    ` * Scout, one drawing per mood, and the four faces he is not.\n` +
    ` *\n` +
    ` * Baked palette rather than theme tokens: he is a character, and a\n` +
    ` * character who changes colour with the interface stops being one.\n` +
    ` */`,
);
u.push(`export const SCOUT_BOX = 320;`);
u.push(`export const SCOUT: Record<string, string> = {`);
for (const [k, v] of Object.entries(scout)) u.push(`  ${j(k)}: ${j(v)},`);
u.push(`};`);
u.push(``);
u.push(`export const NPC: Record<string, string> = {`);
for (const [k, v] of Object.entries(npc)) u.push(`  ${j(k)}: ${j(v)},`);
u.push(`};`);
u.push(``);
u.push(`export const SPRITE_NAMES = ${j(SPRITES)};`);
u.push(``);
emitPlaceables(
  u,
  'SPRITE_COLOR',
  spriteColour,
  `/** Scout on the board, coloured. Anchored where his feet meet the ground. */`,
);
emitPlaceables(u, 'SPRITE_LINE', spriteLine, `/** The same six frames, inked for the line board. */`);
u.push(`export interface PressPlate {`);
u.push(`  w: number;`);
u.push(`  h: number;`);
u.push(`  body: string;`);
u.push(`}`);
u.push(``);
u.push(`export const PRESS: Record<string, PressPlate> = {`);
for (const [k, v] of Object.entries(press)) {
  u.push(`  ${j(k)}: { w: ${v.w}, h: ${v.h}, body: ${j(v.body)} },`);
}
u.push(`};`);
u.push(``);
u.push(
  `/**\n` +
    ` * Grid units per lot edge in the coloured set's coordinates.\n` +
    ` *\n` +
    ` * Read off the plinth diamond rather than assumed, and asserted identical\n` +
    ` * across every base file at ingest. The furniture shares it.\n` +
    ` */`,
);
u.push(`export const COLOR_UNIT = ${COLOR_UNIT};`);
u.push(``);
u.push(`export const COLOR_TRANSFORM: Record<string, { k: number; tx: number; ty: number }> = {`);
for (const id of ids) {
  const t = colourTransforms[id];
  u.push(`  ${id}: { k: ${t.k}, tx: ${t.tx}, ty: ${t.ty} },`);
}
u.push(`};`);
u.push(``);
u.push(
  `/**\n` +
    ` * The kerbed plinth, lawn and contact shadow, on its own.\n` +
    ` *\n` +
    ` * Kept apart from the buildings rather than as a second copy of every\n` +
    ` * house. The board never wants it -- it would paint over the lot colour\n` +
    ` * the four data views exist to show -- and anywhere a house is the\n` +
    ` * subject it is this plus the bare drawing. Carrying both cuts in full\n` +
    ` * cost 438KB of bundle to say what these few paths say.\n` +
    ` */`,
);
u.push(`export const HOUSE_PLINTH: Record<string, string> = {`);
for (const id of ids) u.push(`  ${id}: ${j(plinth[id] ?? '')},`);
u.push(`};`);
u.push(``);
u.push(`/** The houses themselves, with no ground under them. */`);
u.push(`export const HOUSE_COLOR_BARE: Record<string, Record<string, string>> = {`);
for (const id of ids) {
  u.push(`  ${id}: {`);
  for (const [k, v] of Object.entries(colourBare[id])) u.push(`    ${k}: ${j(v)},`);
  u.push(`  },`);
}
u.push(`};`);
u.push(``);
u.push(`export const SEASON_NAMES = ${j(Object.keys(seasonal))};`);
u.push(``);
u.push(
  `/**\n` +
    ` * Seasonal remaps, plinth removed, complete with condition states.\n` +
    ` *\n` +
    ` * They share the coloured set's fit exactly, checked at ingest, so a house\n` +
    ` * does not move when the season turns.\n` +
    ` */`,
);
u.push(
  `export const HOUSE_SEASON: Record<string, Record<string, Record<string, string>>> = {`,
);
for (const [season, byId] of Object.entries(seasonal)) {
  u.push(`  ${season}: {`);
  for (const [id, states] of Object.entries(byId)) {
    u.push(`    ${id}: {`);
    for (const [k, v] of Object.entries(states)) u.push(`      ${k}: ${j(v)},`);
    u.push(`    },`);
  }
  u.push(`  },`);
}
u.push(`};`);
u.push(``);
emitPlaceables(
  u,
  'FURNITURE_LINE',
  furnitureLine,
  `/** Lot furniture, inked for the line board. */`,
);
emitPlaceables(
  u,
  'FURNITURE_COLOR',
  furnitureColour,
  `/** The same fourteen pieces, coloured. */`,
);
fs.writeFileSync(OUT_UI, u.join('\n'), 'utf8');

console.log(
  `art-ingest: ${ids.length} archetypes x 5 states (${pathCount} paths), ` +
    `${Object.keys(seasonal).length} seasons, ` +
    `${Object.keys(furnitureLine).length}+${Object.keys(furnitureColour).length} furniture, ` +
    `${Object.keys(spriteColour).length}+${Object.keys(spriteLine).length} sprites, ` +
    `${Object.keys(icons).length} icons, ${Object.keys(scout).length} moods, ` +
    `${Object.keys(npc).length} faces, ${Object.keys(press).length} press`,
);
