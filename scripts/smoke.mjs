#!/usr/bin/env node
/**
 * Launch the built app and prove it starts.
 *
 * The roadmap item this replaces was "verify the macOS and Linux builds on
 * real hardware", which is not something the author can do from one Windows
 * machine and is not something a human should have to remember to do on every
 * release. What is actually being bought by that verification is confidence
 * that the packaged artifact runs at all -- and that is testable.
 *
 * So: run Electron against the production build on each platform in CI, wait
 * for the renderer to mount, and fail loudly if it does not. On Linux there is
 * no display, so this runs under xvfb when one is available.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('smoke: dist/index.html is missing — run `npm run build` first.');
  process.exit(1);
}
if (!existsSync(path.join(root, 'dist-electron', 'main.js'))) {
  console.error('smoke: dist-electron/main.js is missing — run `npm run build` first.');
  process.exit(1);
}

// The electron package exports the path to the real binary. Using that rather
// than the .bin shim avoids needing a shell on Windows, which Node now warns
// about because arguments through a shell are concatenated rather than escaped.
const electron = createRequire(import.meta.url)('electron');

// Headless Linux needs a display server. If xvfb-run is unavailable we still
// try directly rather than skipping, so a missing xvfb is a visible failure
// rather than a silently green build.
const useXvfb =
  process.platform === 'linux' &&
  spawnSync('which', ['xvfb-run'], { encoding: 'utf8' }).status === 0;

const command = useXvfb ? 'xvfb-run' : electron;
const args = useXvfb ? ['-a', electron, '.'] : ['.'];

console.log(`smoke: launching ${command} ${args.join(' ')} on ${process.platform}`);

const child = spawn(command, args, {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    PROPERTY_FLIPPER_SMOKE: '1',
    // Electron needs this on some CI images; harmless elsewhere.
    ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
  },
});

// A hard outer bound, in case the process hangs before the renderer even
// starts and the in-app timeout never gets a chance to fire.
const kill = setTimeout(() => {
  console.error('smoke: timed out after 90s — killing');
  child.kill('SIGKILL');
  process.exit(1);
}, 90_000);

child.on('exit', (code) => {
  clearTimeout(kill);
  if (code === 0) {
    console.log('smoke: the packaged app starts and mounts.');
  } else {
    console.error(`smoke: FAILED with exit code ${code}`);
  }
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  clearTimeout(kill);
  console.error(`smoke: could not launch Electron: ${err.message}`);
  process.exit(1);
});
