import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function run(from: string, env: Record<string, string> = {}) {
  const out = mkdtempSync(path.join(tmpdir(), 'steam-out-'));
  execFileSync('node', ['scripts/steam-package.mjs'], {
    stdio: 'pipe',
    env: {
      ...process.env,
      STEAM_PACKAGE_FROM: from,
      STEAM_PACKAGE_OUT: out,
      ...env,
    },
  });
  return out;
}

describe('steam-package', () => {
  it('prefers the unpacked / portable game over an installer', () => {
    const from = mkdtempSync(path.join(tmpdir(), 'steam-in-'));
    mkdirSync(path.join(from, 'win-unpacked'));
    writeFileSync(path.join(from, 'win-unpacked', 'Property Flipper.exe'), 'exe');
    writeFileSync(path.join(from, 'Property Flipper-0.0.0-Setup.exe'), 'installer');
    writeFileSync(path.join(from, 'Property Flipper-0.0.0-Portable.exe'), 'portable');
    mkdirSync(path.join(from, 'linux-unpacked'));
    writeFileSync(path.join(from, 'linux-unpacked', 'property-flipper'), 'bin');
    writeFileSync(path.join(from, 'Property Flipper-0.0.0.AppImage'), 'image');
    mkdirSync(path.join(from, 'Property Flipper.app'));
    writeFileSync(path.join(from, 'Property Flipper.app', 'dummy'), 'app');
    writeFileSync(path.join(from, 'Property Flipper-0.0.0.dmg'), 'dmg');

    const out = run(from, { STEAM_APP_ID: '480' });

    expect(existsSync(path.join(out, 'windows', 'Property Flipper.exe'))).toBe(true);
    expect(existsSync(path.join(out, 'windows', 'Property Flipper-0.0.0-Setup.exe'))).toBe(false);
    expect(existsSync(path.join(out, 'linux', 'property-flipper'))).toBe(true);
    expect(existsSync(path.join(out, 'macos', 'Property Flipper.app', 'dummy'))).toBe(true);

    const vdf = readFileSync(path.join(out, 'app_build.vdf'), 'utf8');
    expect(vdf).toContain('"AppID" "480"');
    expect(vdf).toContain('"481"');
    expect(vdf).toContain('"482"');
    expect(vdf).toContain('"483"');
    expect(vdf).not.toContain('"windows" {');
    expect(readFileSync(path.join(out, 'LAUNCH.md'), 'utf8')).toContain('Property Flipper.exe');

    rmSync(from, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });

  it('falls back to the GitHub-release files when nothing is unpacked', () => {
    const from = mkdtempSync(path.join(tmpdir(), 'steam-in-'));
    writeFileSync(path.join(from, 'Property Flipper-0.0.0-Portable.exe'), 'win');
    writeFileSync(path.join(from, 'Property Flipper-0.0.0.zip'), 'mac');
    writeFileSync(path.join(from, 'Property Flipper-0.0.0.AppImage'), 'linux');

    const out = run(from, { STEAM_APP_ID: 'not-a-number', STEAM_DEPOT_WINDOWS: '1001' });
    expect(existsSync(path.join(out, 'windows', 'Property Flipper-0.0.0-Portable.exe'))).toBe(true);
    expect(existsSync(path.join(out, 'macos', 'Property Flipper-0.0.0.zip'))).toBe(true);
    const vdf = readFileSync(path.join(out, 'app_build.vdf'), 'utf8');
    expect(vdf).toContain('"AppID" "YOUR_APP_ID"');
    expect(vdf).toContain('"1001"');
    expect(vdf).toContain('YOUR_MACOS_DEPOT_ID');

    rmSync(from, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });
});
