#!/usr/bin/env node
/**
 * Capture store screenshots from the running app.
 *
 * itch wants three to five images and they are the first thing anyone looks at,
 * so they should be of the real thing rather than a mock. This walks the same
 * seven screens the accessibility audit walks -- one shared scene list, in
 * scripts/scenes.js -- and photographs each one at the 1280x800 the page copy
 * specifies for the embed.
 *
 * Shares the smoke harness for the same reason the audit does: it needs the
 * real renderer running the real stylesheet, and Electron is already here.
 *
 * Exits 2 when a screen could not be reached, because a missing shot should be
 * noisy rather than a gap in the folder nobody counts.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const f of ['dist/index.html', 'dist-electron/main.js']) {
  if (!existsSync(path.join(root, f))) {
    console.error(`shots: ${f} is missing — run \`npm run build\` first.`);
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
      PROPERTY_FLIPPER_SHOTS: '1',
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    },
  },
);

let out = '';
child.stdout.on('data', (b) => (out += b));
child.stderr.on('data', (b) => (out += b));

const kill = setTimeout(() => {
  console.error('shots: timed out after 90s — killing');
  child.kill('SIGKILL');
  process.exit(1);
}, 90_000);

child.on('exit', (code) => {
  clearTimeout(kill);
  const line = out.split('\n').find((l) => l.startsWith('shots: '));
  if (!line) {
    console.error('shots: the renderer never reported. Output follows:\n');
    console.error(out.trim());
    process.exit(1);
  }

  const report = JSON.parse(line.slice('shots: '.length));
  console.log(`shots: wrote ${report.taken.length} to docs/shots/`);
  for (const f of report.taken) console.log(`  ${f}`);
  if (report.missed.length > 0) {
    console.error(`\nshots: could not reach ${report.missed.join(', ')} — those screens have no image.`);
    process.exit(2);
  }
  process.exit(code === 0 ? 0 : 2);
});

child.on('error', (err) => {
  clearTimeout(kill);
  console.error(`shots: could not launch Electron — ${err.message}`);
  process.exit(1);
});
