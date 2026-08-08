import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Package the app, working around locations that cannot host the build.
 *
 * electron-builder extracts Electron into `<output>/win-unpacked.tmp` and then
 * renames it. Directories created straight at a drive root inherit an ACL that
 * grants BUILTIN\Users only ReadAndExecute, and the rename fails there with
 * EPERM even though ordinary writes succeed.
 *
 * So: try the normal `release/` output first. If packaging fails, retry under
 * the OS temp directory and copy the finished artifacts back — copying into
 * the restricted directory works fine, it is only the rename that does not.
 */

const projectRoot = path.resolve(import.meta.dirname, '..');
const releaseDir = path.join(projectRoot, 'release');
const platformArgs = process.argv.slice(2);
const targetArgs = platformArgs.length > 0 ? platformArgs : [`--${platformFlag()}`];

function platformFlag() {
  if (process.platform === 'darwin') return 'mac';
  if (process.platform === 'linux') return 'linux';
  return 'win';
}

function runBuilder(outDir) {
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    // The config is passed explicitly: electron-builder's auto-discovery did
    // not pick up electron-builder.config.js and silently fell back to its
    // defaults, which package with the wrong options straight into dist/.
    ['electron-builder', ...targetArgs, '--config', 'electron-builder.config.js', '--publish', 'never'],
    {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, PROPERTY_FLIPPER_OUT: outDir },
      shell: process.platform === 'win32',
    },
  );
  return result.status === 0;
}

function copyArtifacts(from, to) {
  mkdirSync(to, { recursive: true });
  let copied = 0;
  for (const name of readdirSync(from)) {
    const src = path.join(from, name);
    if (statSync(src).isDirectory()) continue; // skip win-unpacked etc.
    cpSync(src, path.join(to, name), { force: true });
    copied += 1;
  }
  return copied;
}

console.log(`\n> packaging into ${releaseDir}\n`);
if (runBuilder(releaseDir)) {
  console.log(`\n✔ artifacts in ${releaseDir}\n`);
  process.exit(0);
}

console.warn(
  '\n! packaging failed in release/. This is usually an ACL on the project\n' +
    '  location rather than a config problem. Retrying via the temp directory.\n',
);

const fallback = path.join(os.tmpdir(), 'property-flipper-build');
rmSync(fallback, { recursive: true, force: true });

if (!runBuilder(fallback)) {
  console.error('\n✖ packaging failed in the fallback location too.\n');
  process.exit(1);
}

const n = copyArtifacts(fallback, releaseDir);
console.log(`\n✔ built in ${fallback}, copied ${n} artifact(s) to ${releaseDir}\n`);
