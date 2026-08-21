#!/usr/bin/env node
/**
 * Short animated clips of the running game, for social.
 *
 * Two halves. Electron walks to a starting state and photographs a frame after
 * every step of a declared animation, into `docs/clips/*.png`; then this
 * downscales them and encodes each set into a GIF.
 *
 * The reason it is GIF and not video: GIF is the only motion format that plays
 * inline, autoplaying and silent, on every forum, chat and timeline without
 * anyone clicking anything. That is the entire job. It also means no ffmpeg,
 * because `scripts/gif.mjs` is a hundred and fifty lines and a dependency that
 * ships per-platform binaries is not worth it for three animations.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { writeGif } from './gif.mjs';
import { readPng, resize } from './image.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frameDir = path.join(root, 'docs', 'clips');

/*
 * 640 wide, from a 1280 capture.
 *
 * Half size is the sweet spot: every frame is encoded in full because this
 * encoder does not do interframe differencing, so width costs linearly, and
 * text in this interface is still legible at half. Anything under about 560
 * starts losing the figures, which are the point of most of these clips.
 */
const WIDTH = 640;
/** Hundredths of a second, which is GIF's unit. 8 is 12.5fps. */
const DELAY = 8;
const MAX_BYTES = 3_000_000;

for (const f of ['dist/index.html', 'dist-electron/main.js']) {
  if (!existsSync(path.join(root, f))) {
    console.error(`clips: ${f} is missing — run \`npm run build\` first.`);
    process.exit(1);
  }
}

const electron = createRequire(import.meta.url)('electron');
const useXvfb =
  process.platform === 'linux' &&
  spawnSync('which', ['xvfb-run'], { encoding: 'utf8' }).status === 0;
const sandboxArgs = process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : [];

const child = spawn(
  useXvfb ? 'xvfb-run' : electron,
  useXvfb ? ['-a', electron, '.', ...sandboxArgs] : ['.', ...sandboxArgs],
  {
    cwd: root,
    env: {
      ...process.env,
      PROPERTY_FLIPPER_SMOKE: '1',
      PROPERTY_FLIPPER_CLIPS: '1',
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    },
  },
);

let out = '';
child.stdout.on('data', (b) => (out += b));
child.stderr.on('data', (b) => (out += b));

const kill = setTimeout(() => {
  console.error('clips: timed out after 180s — killing');
  child.kill('SIGKILL');
  process.exit(1);
}, 180_000);

child.on('exit', (code) => {
  clearTimeout(kill);
  const line = out.split('\n').find((l) => l.startsWith('clips: '));
  if (!line) {
    console.error('clips: the renderer never reported. Output follows:\n');
    console.error(out.trim());
    process.exit(1);
  }

  const report = JSON.parse(line.slice('clips: '.length));
  if (report.missed.length > 0) {
    console.error(`clips: could not reach ${report.missed.join(', ')}.`);
    process.exit(2);
  }

  // Group the captured frames by clip name and encode each set.
  const files = readdirSync(frameDir).filter((f) => f.endsWith('.png')).sort();
  const groups = new Map();
  for (const f of files) {
    const name = f.replace(/-\d+\.png$/, '');
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(path.join(frameDir, f));
  }

  if (groups.size === 0) {
    console.error('clips: no frames were captured.');
    process.exit(1);
  }

  let oversize = false;
  for (const [name, paths] of groups) {
    const frames = paths.map((p) => {
      const img = readPng(p);
      return resize(img, WIDTH, Math.round((img.h / img.w) * WIDTH));
    });
    const dest = path.join(frameDir, `${name}.gif`);
    const info = writeGif(dest, frames, { delay: DELAY });
    const mb = (info.bytes / 1e6).toFixed(2);
    console.log(
      `  ${`${name}.gif`.padEnd(20)} ${info.w}x${info.h}  ${String(info.frames).padStart(2)} frames  ${mb}MB`,
    );
    if (info.bytes > MAX_BYTES) {
      console.error(`    over the 3MB most places accept — shorten it or drop the width`);
      oversize = true;
    }
    // The frames were scaffolding; the GIF is the artefact. `KEEP_FRAMES=1`
    // leaves them, which is how you check what was actually captured when a
    // clip comes out wrong.
    if (process.env.KEEP_FRAMES !== '1') for (const p of paths) unlinkSync(p);
  }

  console.log(`\nclips: ${groups.size} in docs/clips/`);
  process.exit(oversize ? 2 : 0);
});

child.on('error', (err) => {
  clearTimeout(kill);
  console.error(`clips: could not launch Electron — ${err.message}`);
  process.exit(1);
});
