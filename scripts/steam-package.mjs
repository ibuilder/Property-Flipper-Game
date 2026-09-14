#!/usr/bin/env node
/**
 * Stage GitHub-release (or local `release/`) artifacts into a Steam depot layout.
 *
 * Steamworks still needs an app ID and a human to run SteamCMD — this only
 * puts the same Windows / macOS / Linux builds the release workflow already
 * smoke-tested into `dist-steam/`, next to a VDF template. Uploading a
 * different binary than GitHub Releases is how a store page and a download
 * silently disagree.
 *
 * Steam launches whatever is in the depot. An NSIS installer or a DMG is a
 * download the player already has Steam for; prefer the unpacked app, then the
 * Windows portable / Linux AppImage / macOS zip, and only fall back to an
 * installer with a warning.
 *
 *     node scripts/steam-package.mjs
 *
 * Looks in `release/` first, then `desktop/` (the itch job's download dir).
 * Override with STEAM_PACKAGE_FROM (path-delimited) and STEAM_PACKAGE_OUT.
 */
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.STEAM_PACKAGE_OUT || path.join(root, 'dist-steam');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

const SEARCH = (process.env.STEAM_PACKAGE_FROM || '')
  .split(path.delimiter)
  .map((p) => p.trim())
  .filter(Boolean);
const search = SEARCH.length > 0 ? SEARCH : [path.join(root, 'release'), path.join(root, 'desktop')];

function walkDirs(dir, depth, visit) {
  if (depth < 0 || !existsSync(dir)) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    visit(path.join(dir, e.name), e.name);
  }
  if (depth === 0) return;
  for (const e of entries) {
    if (e.isDirectory()) walkDirs(path.join(dir, e.name), depth - 1, visit);
  }
}

function findDir(predicate) {
  for (const dir of search) {
    let hit = null;
    if (existsSync(dir) && statSync(dir).isDirectory() && predicate(dir, path.basename(dir))) {
      return dir;
    }
    walkDirs(dir, 2, (full, name) => {
      if (!hit && predicate(full, name)) hit = full;
    });
    if (hit) return hit;
  }
  return null;
}

function findFile(pattern) {
  const re = new RegExp(pattern, 'i');
  for (const dir of search) {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    const hit = readdirSync(dir).find((f) => re.test(f) && statSync(path.join(dir, f)).isFile());
    if (hit) return path.join(dir, hit);
  }
  return null;
}

function empty(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function stageDir(src, dest) {
  empty(dest);
  cpSync(src, dest, { recursive: true });
}

function stageFile(src, destDir) {
  empty(destDir);
  copyFileSync(src, path.join(destDir, path.basename(src)));
}

function guessLaunch(dir) {
  const names = existsSync(dir) ? readdirSync(dir) : [];
  const exe = names.find((n) => /\.exe$/i.test(n) && !/uninstall/i.test(n) && !/setup/i.test(n));
  const setup = names.find((n) => /setup\.exe$/i.test(n));
  const app = names.find((n) => /\.app$/i.test(n));
  const image = names.find((n) => /\.AppImage$/i.test(n));
  const zip = names.find((n) => /\.zip$/i.test(n));
  const dmg = names.find((n) => /\.dmg$/i.test(n));
  // electron-builder's linux unpack is usually the product name, no extension.
  const linuxBin = names.find((n) => n === 'property-flipper' || n === pkg.productName);
  return exe || app || image || linuxBin || zip || dmg || setup || names[0] || '(nothing staged)';
}

const warnings = [];
const launch = {};

function pickWindows() {
  const unpacked = findDir((_full, name) => name === 'win-unpacked');
  if (unpacked) return { kind: 'dir', src: unpacked, launchHint: 'unpacked' };
  const portable = findFile('Portable\\.exe$');
  if (portable) return { kind: 'file', src: portable, launchHint: 'portable' };
  const setup = findFile('Setup\\.exe$');
  if (setup) {
    warnings.push(
      'windows: staged the NSIS installer. Steam will run an installer, not the game. Prefer win-unpacked or the Portable.exe from the same release.',
    );
    return { kind: 'file', src: setup, launchHint: 'installer' };
  }
  return null;
}

function pickMacos() {
  const app = findDir((_full, name) => name.endsWith('.app'));
  if (app) return { kind: 'dir', src: app, launchHint: 'app', destName: path.basename(app) };
  const zip = findFile('\\.zip$');
  if (zip) return { kind: 'file', src: zip, launchHint: 'zip' };
  const dmg = findFile('\\.dmg$');
  if (dmg) {
    warnings.push(
      'macos: staged a DMG. Steam cannot mount a disk image as the game. Add the mac zip from the same release (electron-builder zip target) or copy the .app.',
    );
    return { kind: 'file', src: dmg, launchHint: 'dmg' };
  }
  return null;
}

function pickLinux() {
  const unpacked = findDir((_full, name) => name === 'linux-unpacked');
  if (unpacked) return { kind: 'dir', src: unpacked, launchHint: 'unpacked' };
  const image = findFile('\\.AppImage$');
  if (image) return { kind: 'file', src: image, launchHint: 'appimage' };
  return null;
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const picks = {
  windows: pickWindows(),
  macos: pickMacos(),
  linux: pickLinux(),
};

let staged = 0;
for (const [os, pick] of Object.entries(picks)) {
  const destDir = path.join(out, os);
  if (!pick) {
    console.warn(`  ${os}: no artifact yet — run npm run dist, or download a GitHub release`);
    mkdirSync(destDir, { recursive: true });
    continue;
  }
  if (pick.kind === 'dir' && pick.destName) {
    empty(destDir);
    cpSync(pick.src, path.join(destDir, pick.destName), { recursive: true });
  } else if (pick.kind === 'dir') {
    stageDir(pick.src, destDir);
  } else {
    stageFile(pick.src, destDir);
  }
  launch[os] = guessLaunch(destDir);
  console.log(`  ${os}: ${path.basename(pick.src)} (${pick.launchHint}) → ${launch[os]}`);
  staged += 1;
}

const rawId = process.env.STEAM_APP_ID || 'YOUR_APP_ID';
const appId = /^\d+$/.test(rawId) ? rawId : 'YOUR_APP_ID';

function depotId(envName, offset) {
  const raw = process.env[envName];
  if (raw && /^\d+$/.test(raw)) return raw;
  if (/^\d+$/.test(appId)) return String(Number(appId) + offset);
  return `YOUR_${envName.replace(/^STEAM_DEPOT_/, '')}_DEPOT_ID`;
}

const depots = {
  windows: depotId('STEAM_DEPOT_WINDOWS', 1),
  macos: depotId('STEAM_DEPOT_MACOS', 2),
  linux: depotId('STEAM_DEPOT_LINUX', 3),
};

const vdf = `"AppBuild"
{
  "AppID" "${appId}"
  "Desc" "Property Flipper ${pkg.version}"
  "ContentRoot" "${out.replaceAll('\\', '/')}"
  "SetLive" ""
  "Depots"
  {
    "${depots.windows}"
    {
      "FileMapping"
      {
        "LocalPath" "windows/*"
        "DepotPath" "."
        "Recursive" "1"
      }
    }
    "${depots.macos}"
    {
      "FileMapping"
      {
        "LocalPath" "macos/*"
        "DepotPath" "."
        "Recursive" "1"
      }
    }
    "${depots.linux}"
    {
      "FileMapping"
      {
        "LocalPath" "linux/*"
        "DepotPath" "."
        "Recursive" "1"
      }
    }
  }
}
`;
writeFileSync(path.join(out, 'app_build.vdf'), vdf);

const launchDoc = `# Steamworks launch options

Staged by \`npm run steam:package\` for Property Flipper ${pkg.version}.
Paste these into the app's Installation → Launch Options. Executable names are
whatever this run actually copied.

| OS | Executable |
| --- | --- |
| Windows | \`${launch.windows ?? ''}\` |
| macOS | \`${launch.macos ?? ''}\` |
| Linux | \`${launch.linux ?? ''}\` |

Linux AppImages need the executable bit; Steam usually preserves it from the depot.
If a DMG or Setup.exe landed here, do not upload — restage from win-unpacked, the
Portable.exe, linux-unpacked / AppImage, or the macOS zip.

Depot IDs default to app ID + 1 / + 2 / + 3. Override with STEAM_DEPOT_WINDOWS,
STEAM_DEPOT_MACOS, STEAM_DEPOT_LINUX when Steamworks assigned different numbers.
`;
writeFileSync(path.join(out, 'LAUNCH.md'), launchDoc);

for (const w of warnings) console.warn(`  warning: ${w}`);

if (staged === 0) {
  console.error('\nsteam-package: no desktop artifacts found.');
  process.exit(1);
}
console.log(`\nsteam-package: staged ${staged} OS folder(s) under ${out}`);
if (appId === 'YOUR_APP_ID') {
  console.log('Set STEAM_APP_ID to the numeric Steamworks app ID before uploading.');
}
console.log('Upload with SteamCMD. See docs/steam.md.');
