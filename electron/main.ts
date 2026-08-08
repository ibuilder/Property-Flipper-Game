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

const isDev = !app.isPackaged;
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
