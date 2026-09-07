#!/usr/bin/env node
/**
 * Confirm itch.io channels are on one version, or print the owner checklist.
 *
 * Mixed channels are how 2.2.0's portable build sat next to 2.1.0's installer.
 * butler status is the check; this script is what CI can fail on.
 *
 *     node scripts/itch-status.mjs
 *     node scripts/itch-status.mjs --expect v2.2.0 --require
 *
 * Without butler / ITCH_* this prints the checklist and exits 0, unless
 * `--require` is set (CI after a push).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const ITCH_CHANNELS = ['html5', 'windows', 'windows-portable', 'mac', 'linux'];

/** Strip a leading v so `v2.2.0` and `2.2.0` compare. */
export function normaliseVersion(value) {
  return String(value || '')
    .trim()
    .replace(/^v/i, '');
}

/**
 * Pull a version off a butler status snippet for one channel.
 *
 * butler's layout has moved before; we look for a semver on the same line as
 * the channel name, which is what `--userversion` prints back.
 */
export function versionForChannel(statusText, channel) {
  const lines = String(statusText).split(/\r?\n/);
  const re = new RegExp(`(?:^|[:\\s/])${channel}(?=$|[^\\w-])`, 'i');
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    // butler prints the channel on one line and `current: vX.Y.Z` on the next.
    const block = lines.slice(i, i + 4).join('\n');
    const m = block.match(/\bv?(\d+\.\d+\.\d+)\b/i);
    if (m) return normaliseVersion(m[1]);
  }
  return null;
}

/** @param {string} statusText @returns {Record<string, string>} */
export function versionsByChannel(statusText) {
  const out = {};
  for (const ch of ITCH_CHANNELS) {
    const v = versionForChannel(statusText, ch);
    if (v) out[ch] = v;
  }
  return out;
}

export function channelsOffVersion(statusText, expected, channels = ITCH_CHANNELS) {
  const want = normaliseVersion(expected);
  const found = versionsByChannel(statusText);
  return channels.filter((ch) => found[ch] !== want);
}

function printChecklist() {
  console.log(`itch-status: butler is not available here. Owner checklist:

1. Create the itch.io project as HTML, embed 1280 × 800. Paste docs/itch-page.md.
2. Repository secret ITCH_API_KEY; variables ITCH_USER and ITCH_GAME.
3. Tag a release (or dispatch Publish to itch.io). Five channels: html5,
   windows, windows-portable, mac, linux — same userversion as the git tag.
4. npm run itch:status -- --expect vX.Y.Z --require
`);
}

function findButler() {
  if (process.env.BUTLER && existsSync(process.env.BUTLER)) return process.env.BUTLER;
  const local = path.resolve('butler');
  if (existsSync(local)) return local;
  const which = spawnSync('which', ['butler'], { encoding: 'utf8' });
  if (which.status === 0) return which.stdout.trim();
  return null;
}

function main() {
  const argv = process.argv.slice(2);
  const requireFlag = argv.includes('--require');
  const expectIdx = argv.indexOf('--expect');
  const expected = expectIdx >= 0 ? argv[expectIdx + 1] : null;
  const chIdx = argv.indexOf('--channels');
  const channelList =
    chIdx >= 0
      ? argv[chIdx + 1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : ITCH_CHANNELS;

  const user = process.env.ITCH_USER;
  const game = process.env.ITCH_GAME;
  const butler = findButler();
  const key = process.env.BUTLER_API_KEY || process.env.ITCH_API_KEY;

  if (!butler || !user || !game || !key) {
    printChecklist();
    if (requireFlag) {
      console.error('itch-status: --require set, but butler or ITCH_* credentials are missing.');
      process.exit(1);
    }
    process.exit(0);
  }

  const target = `${user}/${game}`;
  const result = spawnSync(butler, ['status', target], {
    encoding: 'utf8',
    env: { ...process.env, BUTLER_API_KEY: key },
  });
  const text = `${result.stdout || ''}\n${result.stderr || ''}`;
  process.stdout.write(result.stdout || '');
  if (result.status !== 0) {
    console.error(result.stderr || 'itch-status: butler status failed.');
    process.exit(requireFlag ? 1 : result.status ?? 1);
  }

  if (!expected) process.exit(0);

  const missing = channelsOffVersion(text, expected, channelList);
  if (missing.length === 0) {
    console.log(`itch-status: every known channel reports ${normaliseVersion(expected)}.`);
    process.exit(0);
  }
  console.error(
    `itch-status: expected ${normaliseVersion(expected)} on all channels; off or missing: ${missing.join(', ')}`,
  );
  process.exit(1);
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  main();
}
