#!/usr/bin/env node
/**
 * Run the contrast audit against the built app and report it legibly.
 *
 * Shares the smoke harness because it needs exactly the same thing: the real
 * renderer, running the real stylesheet, in a real browser engine. The audit
 * itself lives in scripts/contrast-audit.js and is executed inside the
 * renderer; this process only launches, parses and formats.
 *
 * Default sizes are the ones a storefront actually uses: 1280×800 (itch embed
 * and current shots), 960×540 (itch's other common embed), and 375×812 (a
 * phone). Override with PROPERTY_FLIPPER_AUDIT_SIZES=1280x800.
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

const DEFAULT_SIZES = '1280x800,960x540,375x812';

function sizesFromEnv() {
  const raw = process.env.PROPERTY_FLIPPER_AUDIT_SIZES || DEFAULT_SIZES;
  const sizes = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+x\d+$/.test(s));
  return sizes.length > 0 ? sizes : ['1280x800'];
}

function runOnce(size) {
  return new Promise((resolve, reject) => {
    let out = '';
    const child = spawn(command, args, {
      cwd: root,
      env: {
        ...process.env,
        PROPERTY_FLIPPER_SMOKE: '1',
        PROPERTY_FLIPPER_AUDIT: '1',
        PROPERTY_FLIPPER_AUDIT_SIZE: size,
        ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
      },
    });

    child.stdout.on('data', (b) => (out += b));
    child.stderr.on('data', (b) => (out += b));

    const kill = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`audit ${size}: timed out after 90s`));
    }, 90_000);

    child.on('error', (err) => {
      clearTimeout(kill);
      reject(err);
    });

    child.on('exit', (code) => {
      clearTimeout(kill);
      const line = out.split('\n').find((l) => l.startsWith('audit: '));
      if (!line) {
        reject(new Error(`audit ${size}: the renderer never reported.\n${out.trim()}`));
        return;
      }
      let report;
      try {
        report = JSON.parse(line.slice('audit: '.length));
      } catch {
        reject(new Error(`audit ${size}: could not parse the report:\n${line}`));
        return;
      }
      resolve({ report, code: code ?? 1, size });
    });
  });
}

function reportFailed(report) {
  const targets = report.targets ?? [];
  const slivers = report.slivers ?? [];
  const collisions = report.collisions ?? [];
  const spills = report.spills ?? [];
  const stranded = report.unreachable ?? [];
  return Boolean(
    (report.missed && report.missed.length) ||
      report.unique.length ||
      targets.length ||
      slivers.length ||
      collisions.length ||
      spills.length ||
      stranded.length,
  );
}

function printReport(report, size) {
  const targets = report.targets ?? [];
  const slivers = report.slivers ?? [];
  const collisions = report.collisions ?? [];
  const spills = report.spills ?? [];
  const stranded = report.unreachable ?? [];
  const label = size ? `${size} ` : '';
  console.log(
    `audit: ${label}${report.scenes.length} scenes (${report.scenes.join(', ')}), ` +
      `${report.darkFailures} dark and ${report.lightFailures} light below AA ` +
      `(${report.unique.length} distinct), ` +
      `${report.targetFailures ?? 0} targets under 24px (${targets.length} distinct), ` +
      `${report.sliverCount ?? 0} scrollbars for a sliver (${slivers.length} distinct), ` +
      `${collisions.length} controls drawn over each other, ` +
      `${spills.length} boxes overflowing a fixed height, ` +
      `${stranded.length} ${stranded.length === 1 ? 'box' : 'boxes'} nobody can scroll to the top of`,
  );

  if (report.missed.length > 0) {
    console.error(
      `audit: FAILED to reach ${report.missed.join(', ')} at ${size} — coverage is incomplete.`,
    );
  }

  if (!reportFailed(report)) {
    console.log(
      `audit: ${size} every piece of text meets AA in both themes, every control ` +
        `meets WCAG 2.5.8, no scrollbar is doing less work than the room it ` +
        `takes, no two controls share a pixel, nothing is drawn outside a ` +
        `height it was given, and every scroll container can reach its own ` +
        `first line, across ${report.scenes.length} scenes.`,
    );
    return;
  }

  if (stranded.length > 0) {
    console.log('');
    for (const v of stranded) {
      console.log(
        `  ${String(`${v.above}px`).padStart(7)}  above the top of  ` +
          `${String(v.scene).padEnd(12)} ${v.selector} > ${v.child}`,
      );
    }
  }

  if (spills.length > 0) {
    console.log('');
    for (const v of spills) {
      console.log(
        `  ${String(`+${v.over}px`).padStart(7)}  outside a ${v.height}px height   ` +
          `${String(v.scene).padEnd(12)} ${v.selector}`,
      );
    }
  }

  if (collisions.length > 0) {
    console.log('');
    for (const c of collisions) {
      console.log(
        `  ${String(`${c.w}x${c.h}`).padStart(7)}  overlap   ${String(c.scene).padEnd(12)} ` +
          `${c.a}
           over ${c.b}`,
      );
    }
  }

  if (slivers.length > 0) {
    console.log('');
    for (const v of slivers) {
      const times = v.count > 1 ? ` ×${v.count}` : '';
      console.log(
        `  ${String(`${v.over}px`).padStart(7)}  (scrolls ${v.axis} inside ${v.client}px; ` +
          `the bar costs ~15)  ${String(v.scene).padEnd(12)} ${v.selector}${times}`,
      );
    }
  }

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

  if (report.unique.length > 0) {
    console.log('');
    for (const f of report.unique) {
      const times = f.count > 1 ? ` ×${f.count}` : '';
      console.log(
        `  ${String(f.ratio).padStart(5)}:1  (needs ${f.bar})  ${f.theme.padEnd(5)} ` +
          `${String(f.scene).padEnd(12)} ${f.size}px  ${f.selector}${times}\n         "${f.text}"`,
      );
    }
  }
  console.log('');
}

const sizes = sizesFromEnv();

let failed = false;
for (const size of sizes) {
  let result;
  try {
    result = await runOnce(size);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  printReport(result.report, size);
  if (reportFailed(result.report) || (result.code !== 0 && result.code !== 2)) failed = true;
}

if (failed) process.exit(2);
console.log(`audit: ${sizes.join(', ')} all clear.`);
process.exit(0);
