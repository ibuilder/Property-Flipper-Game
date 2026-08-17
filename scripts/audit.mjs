#!/usr/bin/env node
/**
 * Run the contrast audit against the built app and report it legibly.
 *
 * Shares the smoke harness because it needs exactly the same thing: the real
 * renderer, running the real stylesheet, in a real browser engine. The audit
 * itself lives in scripts/contrast-audit.js and is executed inside the
 * renderer; this process only launches, parses and formats.
 *
 * Exits 2 when anything is below its WCAG AA bar, so it can gate CI. Exits 1
 * on a harness failure, which is a different problem and should read
 * differently.
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
    console.error(`audit: ${f} is missing — run \`npm run build\` first.`);
    process.exit(1);
  }
}

const electron = createRequire(import.meta.url)('electron');
const useXvfb =
  process.platform === 'linux' &&
  spawnSync('which', ['xvfb-run'], { encoding: 'utf8' }).status === 0;
const sandboxArgs = process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu'] : [];

const command = useXvfb ? 'xvfb-run' : electron;
const args = useXvfb ? ['-a', electron, '.', ...sandboxArgs] : ['.', ...sandboxArgs];

const child = spawn(command, args, {
  cwd: root,
  env: {
    ...process.env,
    PROPERTY_FLIPPER_SMOKE: '1',
    PROPERTY_FLIPPER_AUDIT: '1',
    ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
  },
});

let out = '';
child.stdout.on('data', (b) => (out += b));
child.stderr.on('data', (b) => (out += b));

const kill = setTimeout(() => {
  console.error('audit: timed out after 90s — killing');
  child.kill('SIGKILL');
  process.exit(1);
}, 90_000);

child.on('exit', (code) => {
  clearTimeout(kill);

  const line = out.split('\n').find((l) => l.startsWith('audit: '));
  if (!line) {
    console.error(out.trim());
    console.error('audit: the renderer never reported. See the output above.');
    process.exit(1);
  }

  let report;
  try {
    report = JSON.parse(line.slice('audit: '.length));
  } catch {
    console.error(`audit: could not parse the report:\n${line}`);
    process.exit(1);
  }

  const targets = report.targets ?? [];
  console.log(
    `audit: ${report.scenes.length} scenes (${report.scenes.join(', ')}), ` +
      `${report.darkFailures} dark and ${report.lightFailures} light below AA ` +
      `(${report.unique.length} distinct), ` +
      `${report.targetFailures ?? 0} targets under 24px (${targets.length} distinct)`,
  );

  // A scene the audit could not reach is a scene it is not defending. Silently
  // auditing a smaller sample is how it passed while a real bug shipped.
  if (report.missed.length > 0) {
    console.error(`audit: FAILED to reach ${report.missed.join(', ')} — coverage is incomplete.`);
    process.exit(2);
  }

  if (report.unique.length === 0 && targets.length === 0) {
    console.log(
      `audit: every piece of text meets AA in both themes and every control ` +
        `meets WCAG 2.5.8, across ${report.scenes.length} scenes.`,
    );
    process.exit(0);
  }

  /*
   * WCAG 2.2 SC 2.5.8, Target Size (Minimum), AA.
   *
   * Reported separately from contrast because it is a different failure with a
   * different fix: a control too small to hit reliably, with no 24px of clear
   * space around it to excuse the size.
   */
  if (targets.length > 0) {
    console.log('');
    for (const t of targets) {
      const times = t.count > 1 ? ` ×${t.count}` : '';
      console.log(
        `  ${String(`${t.w}x${t.h}`).padStart(7)}  (needs 24x24 or 24px clear)  ` +
          `${String(t.scene).padEnd(12)} ${t.selector}${times}
           "${t.text}"`,
      );
    }
  }

  console.log('');
  for (const f of report.unique) {
    const times = f.count > 1 ? ` ×${f.count}` : '';
    console.log(
      `  ${String(f.ratio).padStart(5)}:1  (needs ${f.bar})  ${f.theme.padEnd(5)} ` +
        `${String(f.scene).padEnd(12)} ${f.size}px  ${f.selector}${times}\n         "${f.text}"`,
    );
  }
  console.log('');
  process.exit(report.unique.length || targets.length ? 2 : code === 0 ? 0 : 2);
});

child.on('error', (err) => {
  clearTimeout(kill);
  console.error(`audit: could not launch Electron: ${err.message}`);
  process.exit(1);
});
