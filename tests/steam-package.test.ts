import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('steam-package', () => {
  it('stages the same-shaped artifacts the release workflow already builds', () => {
    mkdirSync('release', { recursive: true });
    writeFileSync('release/Property Flipper-0.0.0-Setup.exe', 'win');
    writeFileSync('release/Property Flipper-0.0.0.dmg', 'mac');
    writeFileSync('release/Property Flipper-0.0.0.AppImage', 'linux');

    execFileSync('node', ['scripts/steam-package.mjs'], {
      stdio: 'pipe',
      env: { ...process.env, STEAM_APP_ID: '480' },
    });

    expect(existsSync('dist-steam/windows/Property Flipper-0.0.0-Setup.exe')).toBe(true);
    expect(existsSync('dist-steam/macos/Property Flipper-0.0.0.dmg')).toBe(true);
    expect(existsSync('dist-steam/linux/Property Flipper-0.0.0.AppImage')).toBe(true);
    const vdf = readFileSync('dist-steam/app_build.vdf', 'utf8');
    expect(vdf).toContain('"AppID" "480"');
    expect(vdf).toContain('windows/*');
  });
});
