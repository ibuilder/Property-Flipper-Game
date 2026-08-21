import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Electron main process.
 *
 * Two things here matter for a *packaged* build specifically, and both were
 * fatal flaws in the original project:
 *
 *   1. Saves go to app.getPath('userData'), not the working directory. An
 *      installed app launched from a Start Menu shortcut has an arbitrary cwd,
 *      and writing next to the executable under Program Files fails outright
 *      without elevation.
 *
 *   2. The renderer runs with nodeIntegration off and contextIsolation on. All
 *      file access goes through the narrow IPC surface below.
 */

/**
 * Dev mode loads from the Vite server; production loads the built files.
 *
 * The smoke test has to be excluded explicitly. It runs `electron .` against an
 * unpackaged tree, so `app.isPackaged` is false and the app would go looking
 * for a dev server — which on a developer's machine is very often running, so
 * the check passes while testing something other than the build. That is
 * exactly what happened: it went green locally against Vite and red in CI,
 * where no dev server exists. CI was right.
 */
const isSmokeTest = process.env.PROPERTY_FLIPPER_SMOKE === '1';
const isDev = !app.isPackaged && !isSmokeTest;
const SAVE_DIR = () => path.join(app.getPath('userData'), 'saves');
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0f1319',
    show: false,
    autoHideMenuBar: true,
    title: 'Property Flipper',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  /**
   * Smoke mode: launch, prove the renderer actually loaded, and quit.
   *
   * This is what stands in for "verify the macOS and Linux builds on real
   * hardware". It will not catch anything about how the app feels, but it does
   * catch the class of failure that has actually bitten this project: an icon
   * that will not convert, a file missing from the package, a path that only
   * resolves on the machine that built it. Those are silent until somebody
   * double-clicks the artifact, and now CI double-clicks it on all three
   * platforms.
   */
  if (process.env.PROPERTY_FLIPPER_SMOKE === '1') {
    const fail = (why: string) => {
      console.error(`smoke: ${why}`);
      app.exit(1);
    };
    const timer = setTimeout(() => fail('renderer did not finish loading in 30s'), 30_000);

    mainWindow.webContents.once('did-finish-load', async () => {
      clearTimeout(timer);
      try {
        // Not merely "did a window open" -- assert the app actually mounted.
        const mounted = await mainWindow!.webContents.executeJavaScript(
          "!!document.querySelector('#root') && document.querySelector('#root').childElementCount > 0",
        );
        if (!mounted) return fail('#root is empty: the renderer loaded but did not mount');
        console.log('smoke: renderer mounted');

        /*
         * The contrast audit rides on the smoke harness.
         *
         * It needs a real cascade and real compositing, which no unit test
         * gives -- every contrast bug found so far lived in the gap between
         * what a token measures against and what it is actually painted on.
         * Electron is already a dependency and CI already launches it on
         * three platforms, so this costs no new tooling.
         */
        const readScript = (name: string) =>
          fs.readFile(path.join(app.getAppPath(), 'scripts', name), 'utf8');

        if (process.env.PROPERTY_FLIPPER_AUDIT === '1') {
          /*
           * Audited at the size people play at, not the size it was designed
           * at.
           *
           * This ran at the default 1440x940, which is the window the shell was
           * built for and the one place its layout has the most room. The itch
           * embed is 1280x800 and that is what the store page tells players to
           * use, so a defect that only appears below 1440 shipped unexamined --
           * the top bar's controls wrapped there and the wrapped line was
           * painted through the tab strip. Measuring the generous case and
           * shipping the tight one is backwards.
           */
          mainWindow!.setContentSize(1280, 800);
          await new Promise((r) => setTimeout(r, 400));

          // Navigation first: both harnesses share one copy of how to reach
          // each screen, because reaching them is the fiddly part.
          await mainWindow!.webContents.executeJavaScript(await readScript('scenes.js'));
          const report = await mainWindow!.webContents.executeJavaScript(
            await readScript('contrast-audit.js'),
          );
          console.log(`audit: ${JSON.stringify(report)}`);
          return app.exit(report.unique.length > 0 ? 2 : 0);
        }

        /*
         * Store screenshots, captured from the running app.
         *
         * The same seven screens the audit walks, photographed rather than
         * measured. Capturing has to happen out here in the main process --
         * a page cannot photograph itself -- so the scenes are reached one at
         * a time and the window is captured between each.
         *
         * A screenshot taken by hand is out of date the moment anything moves
         * and nobody notices, which is the same argument as the README images.
         * These are the pictures an itch page needs, so they are made the same
         * way as everything else here: by the machine, from the real app.
         */
        if (process.env.PROPERTY_FLIPPER_SHOTS === '1') {
          const outDir = path.join(app.getAppPath(), 'docs', 'shots');
          await fs.mkdir(outDir, { recursive: true });
          /*
           * Emptied first. The files are numbered by position in the walk, so
           * inserting a scene renumbers everything after it and the old names
           * survive as orphans -- two runs left `05-finance.png` sitting beside
           * `05-renovation.png` and `07-finance.png`, and nothing said which
           * was current.
           */
          for (const f of await fs.readdir(outDir)) {
            if (f.endsWith('.png')) await fs.unlink(path.join(outDir, f));
          }

          // The size the itch page copy specifies for the embed, so the shots
          // match what a player will actually see in the frame.
          mainWindow!.setContentSize(1280, 800);
          await new Promise((r) => setTimeout(r, 400));

          await mainWindow!.webContents.executeJavaScript(await readScript('scenes.js'));
          const names: string[] = await mainWindow!.webContents.executeJavaScript(
            'window.__PF_SCENES.scenes.map((s) => s.name)',
          );

          const taken: string[] = [];
          const missed: string[] = [];
          for (let i = 0; i < names.length; i++) {
            const ok = await mainWindow!.webContents.executeJavaScript(
              `window.__PF_SCENES.scenes[${i}].reach()`,
            );
            if (!ok) {
              missed.push(names[i]);
              continue;
            }

            /*
             * Tidy the screen before photographing it.
             *
             * Two things spoil a shot and neither is a bug in the app. The
             * first-run explainers are doing their job for a new player and
             * covering the product for a storefront, so they are dismissed.
             * And a scene reached by clicking through leaves the page and any
             * open dialog wherever the last click left them -- the menu shot
             * came out starting mid-sentence -- so everything is returned to
             * the top first.
             */
            await mainWindow!.webContents.executeJavaScript(`(async () => {
              for (const b of document.querySelectorAll('button')) {
                if (/^(Got it|Dismiss|Skip)$/i.test((b.textContent || '').trim())) {
                  b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                }
              }
              await new Promise((r) => setTimeout(r, 250));
              window.scrollTo(0, 0);
              for (const el of document.querySelectorAll('*')) {
                // Except the board, which is a map: it centres itself on the
                // zoom it is at, and "return it to the top" means pointing the
                // camera at the empty street in the corner.
                if (el.closest('.board-frame')) continue;
                if (el.scrollTop > 0) el.scrollTop = 0;
              }
            })()`);
            await new Promise((r) => setTimeout(r, 350));
            const image = await mainWindow!.webContents.capturePage();
            const file = path.join(outDir, `${String(i + 1).padStart(2, '0')}-${names[i]}.png`);
            await fs.writeFile(file, image.toPNG());
            taken.push(path.basename(file));
          }
          console.log(`shots: ${JSON.stringify({ taken, missed })}`);
          return app.exit(missed.length > 0 ? 2 : 0);
        }

        /*
         * Short animations for social.
         *
         * Same walk, same window, but capturing repeatedly while something
         * moves rather than once when it has settled. `capturePage` is the
         * slow part at roughly a tenth of a second a frame, so the clips are
         * declared in steps and the capture rate *is* the frame rate -- there
         * is no point asking for 30fps from a pipe that cannot deliver it.
         */
        if (process.env.PROPERTY_FLIPPER_CLIPS === '1') {
          /*
           * Forward the renderer's console to ours.
           *
           * Driving a clip is fiddly -- finding a listing with a particular
           * shape, checking a control is even enabled -- and without this the
           * only signal when it goes wrong is `missed`, which says nothing
           * about why. Clips only; the audit and the screenshots have their
           * own structured reports and would just be noisier for it.
           */
          mainWindow!.webContents.on('console-message', (_e, _level, message) => {
            if (message.startsWith('CLIP ')) console.log(message);
          });

          const outDir = path.join(app.getAppPath(), 'docs', 'clips');
          await fs.mkdir(outDir, { recursive: true });
          for (const f of await fs.readdir(outDir)) {
            if (f.endsWith('.png')) await fs.unlink(path.join(outDir, f));
          }

          mainWindow!.setContentSize(1280, 800);
          await new Promise((r) => setTimeout(r, 400));
          await mainWindow!.webContents.executeJavaScript(await readScript('scenes.js'));

          const names: string[] = await mainWindow!.webContents.executeJavaScript(
            'window.__PF_SCENES.clips.map((c) => c.name)',
          );

          const made: string[] = [];
          const missed: string[] = [];
          for (let i = 0; i < names.length; i++) {
            const ok = await mainWindow!.webContents.executeJavaScript(
              `window.__PF_SCENES.clips[${i}].reach()`,
            );
            if (!ok) {
              missed.push(names[i]);
              continue;
            }
            // Dismiss the first-run explainers, same as the screenshots do.
            await mainWindow!.webContents.executeJavaScript(`(async () => {
              for (const b of document.querySelectorAll('button')) {
                if (/^(Got it|Dismiss|Skip)$/i.test((b.textContent || '').trim())) {
                  b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                }
              }
              await new Promise((r) => setTimeout(r, 250));
            })()`);

            const steps: number = await mainWindow!.webContents.executeJavaScript(
              `window.__PF_SCENES.clips[${i}].steps.length`,
            );
            for (let s = 0; s < steps; s++) {
              await mainWindow!.webContents.executeJavaScript(
                `window.__PF_SCENES.clips[${i}].steps[${s}]()`,
              );
              const image = await mainWindow!.webContents.capturePage();
              const file = path.join(outDir, `${names[i]}-${String(s).padStart(3, '0')}.png`);
              await fs.writeFile(file, image.toPNG());
            }
            made.push(`${names[i]}:${steps}`);
          }
          console.log(`clips: ${JSON.stringify({ made, missed })}`);
          return app.exit(missed.length > 0 ? 2 : 0);
        }

        app.exit(0);
      } catch (err) {
        fail(`could not query the renderer: ${String(err)}`);
      }
    });

    mainWindow.webContents.once('did-fail-load', (_e, code, desc) =>
      fail(`renderer failed to load (${code}): ${desc}`),
    );
  }

  // Never let the renderer navigate away or spawn windows to arbitrary URLs.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_URL ?? 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await fs.mkdir(SAVE_DIR(), { recursive: true }).catch(() => {});
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------------------------------------------------------------------------
// IPC: save slots
// ---------------------------------------------------------------------------

function slotPath(slot: string): string {
  // Defend against traversal: slots are a fixed, simple namespace.
  const safe = slot.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'default';
  return path.join(SAVE_DIR(), `${safe}.json`);
}

ipcMain.handle('save:write', async (_e, slot: string, data: unknown) => {
  await fs.mkdir(SAVE_DIR(), { recursive: true });
  await fs.writeFile(slotPath(slot), JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true };
});

ipcMain.handle('save:read', async (_e, slot: string) => {
  try {
    const raw = await fs.readFile(slotPath(slot), 'utf-8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (err: any) {
    if (err?.code === 'ENOENT') return { ok: false, error: 'No save in that slot.' };
    return { ok: false, error: String(err?.message ?? err) };
  }
});

ipcMain.handle('save:list', async () => {
  try {
    const files = await fs.readdir(SAVE_DIR());
    const out = [];
    for (const f of files.filter((f) => f.endsWith('.json'))) {
      const stat = await fs.stat(path.join(SAVE_DIR(), f));
      out.push({ slot: f.replace(/\.json$/, ''), modified: stat.mtime.toISOString() });
    }
    return { ok: true, saves: out.sort((a, b) => b.modified.localeCompare(a.modified)) };
  } catch {
    return { ok: true, saves: [] };
  }
});

ipcMain.handle('save:delete', async (_e, slot: string) => {
  try {
    await fs.unlink(slotPath(slot));
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle('save:export', async (_e, data: unknown) => {
  if (!mainWindow) return { ok: false };
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Export save',
    defaultPath: 'property-flipper-save.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false };
  await fs.writeFile(res.filePath, JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true, path: res.filePath };
});

ipcMain.handle('save:import', async () => {
  if (!mainWindow) return { ok: false };
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Import save',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (res.canceled || res.filePaths.length === 0) return { ok: false };
  try {
    const raw = await fs.readFile(res.filePaths[0], 'utf-8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
});

// ---------------------------------------------------------------------------
// IPC: settings
// ---------------------------------------------------------------------------

ipcMain.handle('settings:read', async () => {
  try {
    return { ok: true, data: JSON.parse(await fs.readFile(SETTINGS_FILE(), 'utf-8')) };
  } catch {
    return { ok: true, data: {} };
  }
});

ipcMain.handle('settings:write', async (_e, data: unknown) => {
  await fs.writeFile(SETTINGS_FILE(), JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true };
});

ipcMain.handle('app:version', () => app.getVersion());
