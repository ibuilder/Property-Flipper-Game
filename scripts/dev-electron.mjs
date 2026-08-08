import { spawn } from 'node:child_process';
import { context } from 'esbuild';
import electron from 'electron';

/**
 * Development launcher for the Electron shell.
 *
 * Builds main/preload, waits for the Vite dev server to answer, then starts
 * Electron and restarts it whenever the main-process code changes. The
 * renderer hot-reloads on its own through Vite, so only main/preload edits
 * need a relaunch.
 */

const DEV_URL = process.env.VITE_DEV_URL ?? 'http://localhost:5173';
const READY_TIMEOUT_MS = 60_000;

let child = null;
let restarting = false;

function log(msg) {
  console.log(`[electron] ${msg}`);
}

async function waitForServer(url) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function startElectron() {
  if (child) {
    // Avoid the exit handler treating a deliberate restart as a quit.
    restarting = true;
    child.kill();
    child = null;
  }

  child = spawn(electron, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development', VITE_DEV_URL: DEV_URL },
  });

  child.on('close', (code) => {
    if (restarting) {
      restarting = false;
      return;
    }
    // The user closed the window: tear the whole dev session down so
    // `concurrently -k` stops Vite too.
    log(`exited (${code}), shutting down`);
    process.exit(code ?? 0);
  });
}

const ctx = await context({
  entryPoints: { main: 'electron/main.ts', preload: 'electron/preload.ts' },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outdir: 'dist-electron',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'warning',
  plugins: [
    {
      name: 'relaunch',
      setup(build) {
        let first = true;
        build.onEnd((result) => {
          if (result.errors.length > 0) {
            log('build failed, keeping the previous window');
            return;
          }
          if (first) {
            first = false;
            return;
          }
          log('main process changed, restarting');
          startElectron();
        });
      },
    },
  ],
});

await ctx.watch();
log(`waiting for ${DEV_URL}`);

if (!(await waitForServer(DEV_URL))) {
  console.error(`[electron] dev server did not come up at ${DEV_URL} within 60s`);
  process.exit(1);
}

log('dev server is up, launching');
startElectron();

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    restarting = true;
    child?.kill();
    ctx.dispose();
    process.exit(0);
  });
}
