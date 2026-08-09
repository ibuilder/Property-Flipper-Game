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
import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
const html = `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body {
    background: linear-gradient(160deg, #151c26 0%, #0f1319 55%, #0b0e13 100%);
    font-family: "Segoe UI", -apple-system, system-ui, sans-serif;
    color: #e4e9f0;
    position: relative;
  }
  .frame { position: absolute; inset: 0; padding: 34px 38px; display: flex; flex-direction: column; }
  h1 {
    font-size: 54px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.02;
  }
  h1 .b { color: #4d9fff; }
  .tag {
    margin-top: 12px; font-size: 19px; line-height: 1.35; color: #97a3b4;
    max-width: 400px; font-weight: 500;
  }
  .house { position: absolute; right: -6px; bottom: 104px; }
  .numbers {
    position: absolute; left: 38px; right: 38px; bottom: 30px;
    display: flex; gap: 0; align-items: stretch;
    background: rgba(11,14,19,0.72);
    border: 1px solid #26303d; border-radius: 8px;
    overflow: hidden;
  }
  .cell { flex: 1; padding: 12px 14px; }
  .cell + .cell { border-left: 1px solid #26303d; }
  .k {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em;
    color: #64717f; font-weight: 700; white-space: nowrap;
  }
  .v {
    font-family: "Cascadia Mono", Consolas, monospace;
    font-size: 21px; font-weight: 600; margin-top: 3px; white-space: nowrap;
  }
  .good { color: #3ecf8e; }
  .bad { color: #f2555a; }
  .accent { color: #4d9fff; }
</style>
<div class="frame">
  <h1>Property<br><span class="b">Flipper</span></h1>
  <div class="tag">The flipping game where the spreadsheet is the game.</div>
</div>

<svg class="house" width="330" height="250" viewBox="0 0 200 150">
  <!-- Same visual language as the in-game facades: flat shapes, a hairline
       outline, one soft contact shadow. -->
  <ellipse cx="100" cy="126" rx="76" ry="6" fill="#000" opacity="0.35"/>
  <rect x="44" y="72" width="112" height="52" fill="#b9a894" stroke="#000" stroke-opacity="0.4"/>
  <rect x="44" y="72" width="20" height="52" fill="#9c8c7a" opacity="0.55"/>
  <polygon points="35,72 100,34 165,72" fill="#3d4654" stroke="#000" stroke-opacity="0.45"/>
  <rect x="128" y="44" width="9" height="24" fill="#9c8c7a"/>
  <rect x="58" y="82" width="16" height="19" fill="#e8e4dc"/>
  <rect x="59.5" y="83.5" width="13" height="16" fill="#7fb2e0"/>
  <rect x="112" y="82" width="16" height="19" fill="#e8e4dc"/>
  <rect x="113.5" y="83.5" width="13" height="16" fill="#f3d79a"/>
  <rect x="90" y="98" width="17" height="26" fill="#8a4b32"/>
  <circle cx="104" cy="111" r="1.4" fill="#e8e4dc"/>
  <circle cx="60" cy="120" r="7" fill="#2f6b3d"/>
  <circle cx="146" cy="121" r="6" fill="#2f6b3d"/>
  <!-- The board in the yard: this house is the transaction, not the home. -->
  <rect x="166" y="96" width="2" height="28" fill="#8a8479"/>
  <rect x="152" y="88" width="30" height="14" rx="2" fill="#e8e4dc"/>
  <rect x="155" y="91" width="24" height="2.5" fill="#4d9fff"/>
  <rect x="155" y="95" width="15" height="2" fill="#9aa3ad"/>
</svg>

<!-- Four cells, not five: at 315px wide — the size itch actually displays this
     — a fifth column clips, and the one that clipped was the profit, which is
     the only number the image exists to show. The arithmetic is checkable on
     purpose: 118,000 in, 86,300 of rehab and carry, sold at 232,000. -->
<div class="numbers">
  <div class="cell"><div class="k">Bought</div><div class="v">$118,000</div></div>
  <div class="cell"><div class="k">All-in</div><div class="v bad">$204,300</div></div>
  <div class="cell"><div class="k">Sold</div><div class="v">$232,000</div></div>
  <div class="cell"><div class="k">Profit</div><div class="v good">$27,700</div></div>
</div>
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
