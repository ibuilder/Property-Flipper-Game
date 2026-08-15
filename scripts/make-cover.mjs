#!/usr/bin/env node
/**
 * Generate build/cover.png — the itch.io cover image.
 *
 * itch will not surface a project in browse or search without one, so this is
 * not decoration; it is the difference between the page existing and the page
 * being found.
 *
 * Rendered through Electron rather than a drawing library, because Electron is
 * already a dependency and a browser is the only thing in this repo that can
 * lay out text properly. Hand-plotting pixels is how build/icon.ico is made,
 * and that works for a 32px glyph — it does not work for a 630x500 image with
 * a headline on it.
 *
 * 630x500 is itch's recommended size. It is displayed as small as 315x250, so
 * everything here is sized to survive being halved.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'build');
const tmpDir = path.join(root, '.cover-tmp');

const W = 630;
const H = 500;

/**
 * The cover art itself.
 *
 * One idea, stated once: a house, and the arithmetic that decides whether it
 * was worth buying. The numbers are real ones from the game's own model, which
 * is the whole positioning — this is the flipping game where the spreadsheet is
 * the game.
 */
const __dirnameOuter = path.dirname(fileURLToPath(import.meta.url));

/*
 * The cover is now the commissioned poster rather than a layout built here.
 *
 * `art/press/cover-630x500.svg` is the one delivered file that deliberately
 * carries its own ground -- it is a poster, not a panel, and never sits inside
 * the interface. Electron is still what rasterises it, because it is already a
 * dependency and is the only thing here that can render an SVG properly.
 */
const coverSvg = readFileSync(
  path.join(__dirnameOuter, '..', 'art', 'press', 'cover-630x500.svg'),
  'utf8',
);

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #0b0e13; }
  svg { display: block; width: ${W}px; height: ${H}px; }
</style>
${coverSvg}
`;

const main = `
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.disableHardwareAcceleration();
// Without this the capture comes out at the host's display scaling — 787x625
// on a 125% Windows desktop — rather than the 630x500 itch asks for.
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('high-dpi-support', '1');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: ${W},
    height: ${H},
    show: false,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });

  await win.loadFile(path.join(__dirname, 'cover.html'));
  // Let fonts settle before capturing, or the headline renders in a fallback.
  await new Promise((r) => setTimeout(r, 700));

  const image = await win.webContents.capturePage();
  const size = image.getSize();
  // Resize rather than trusting the capture: if anything about the host's
  // scaling still leaks through, itch would get an asset of the wrong size and
  // the only sign would be a slightly soft cover.
  const exact =
    size.width === ${W} && size.height === ${H}
      ? image
      : image.resize({ width: ${W}, height: ${H}, quality: 'best' });
  fs.writeFileSync(path.join(__dirname, 'cover.png'), exact.toPNG());
  console.log('captured ' + size.width + 'x' + size.height + ' -> ' + ${W} + 'x' + ${H});
  app.exit(0);
});
`;

mkdirSync(tmpDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(tmpDir, 'cover.html'), html);
writeFileSync(path.join(tmpDir, 'main.js'), main);
writeFileSync(
  path.join(tmpDir, 'package.json'),
  JSON.stringify({ name: 'cover', main: 'main.js' }),
);

const electron = createRequire(import.meta.url)('electron');
const child = spawn(electron, ['.'], { cwd: tmpDir, stdio: 'inherit' });

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`make-cover: Electron exited ${code}`);
    process.exit(code ?? 1);
  }
  const src = path.join(tmpDir, 'cover.png');
  const dest = path.join(outDir, 'cover.png');
  copyFileSync(src, dest);
  rmSync(tmpDir, { recursive: true, force: true });
  console.log(`make-cover: wrote ${dest} (${Math.round(statSync(dest).size / 1024)} kB, ${W}x${H})`);
});
