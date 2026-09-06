#!/usr/bin/env node
/**
 * Stage GitHub-release artifacts into a Steam depot layout.
 *
 * Steamworks still needs an app ID and a human to run SteamCMD — this only
 * puts the same Windows / macOS / Linux builds the release workflow already
 * smoke-tested into `dist-steam/`, next to a VDF template. Uploading a
 * different binary than GitHub Releases is how a store page and a download
 * silently disagree.
 *
 *     node scripts/steam-package.mjs
 *
 * Looks in `release/` first, then `desktop/` (the itch job's download dir).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-steam');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

const SEARCH = [path.join(root, 'release'), path.join(root, 'desktop')];

function find(pattern) {
  const re = new RegExp(pattern, 'i');
  for (const dir of SEARCH) {
    if (!existsSync(dir)) continue;
    const hit = readdirSync(dir).find((f) => re.test(f));
    if (hit) return path.join(dir, hit);
  }
  return null;
}

const files = {
  windows: find('Setup\\.exe$') ?? find('Portable\\.exe$'),
  macos: find('\\.dmg$'),
  linux: find('\\.AppImage$'),
};

mkdirSync(out, { recursive: true });

let staged = 0;
for (const [os, file] of Object.entries(files)) {
  const destDir = path.join(out, os);
  mkdirSync(destDir, { recursive: true });
  if (!file) {
    console.warn(`  ${os}: no artifact yet — run npm run dist, or download a GitHub release`);
    continue;
  }
  const dest = path.join(destDir, path.basename(file));
  copyFileSync(file, dest);
  console.log(`  ${os}: ${path.basename(file)}`);
  staged += 1;
}

const appId = process.env.STEAM_APP_ID || 'YOUR_APP_ID';
const vdf = `"AppBuild"
{
  "AppID" "${appId}"
  "Desc" "Property Flipper ${pkg.version}"
  "ContentRoot" "${out.replaceAll('\\', '/')}"
  "SetLive" ""
  "Depots"
  {
    "windows" { "FileMapping" { "LocalPath" "windows/*" "DepotPath" "." "Recursive" "1" } }
    "macos"   { "FileMapping" { "LocalPath" "macos/*"   "DepotPath" "." "Recursive" "1" } }
    "linux"   { "FileMapping" { "LocalPath" "linux/*"   "DepotPath" "." "Recursive" "1" } }
  }
}
`;
writeFileSync(path.join(out, 'app_build.vdf'), vdf);

if (staged === 0) {
  console.error('\nsteam-package: no desktop artifacts found.');
  process.exit(1);
}
console.log(`\nsteam-package: staged ${staged} OS folder(s) under dist-steam/`);
console.log('Replace YOUR_APP_ID (or set STEAM_APP_ID) and upload with SteamCMD. See docs/steam.md.');
