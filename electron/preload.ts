import { contextBridge, ipcRenderer } from 'electron';

/**
 * The entire surface the renderer is allowed to touch. Nothing else from Node
 * or Electron is exposed -- no fs, no path, no ipcRenderer itself.
 */
const api = {
  saves: {
    write: (slot: string, data: unknown) => ipcRenderer.invoke('save:write', slot, data),
    read: (slot: string) => ipcRenderer.invoke('save:read', slot),
    list: () => ipcRenderer.invoke('save:list'),
    remove: (slot: string) => ipcRenderer.invoke('save:delete', slot),
    exportToFile: (data: unknown) => ipcRenderer.invoke('save:export', data),
    importFromFile: () => ipcRenderer.invoke('save:import'),
  },
  settings: {
    read: () => ipcRenderer.invoke('settings:read'),
    write: (data: unknown) => ipcRenderer.invoke('settings:write', data),
  },
  version: () => ipcRenderer.invoke('app:version'),
};

contextBridge.exposeInMainWorld('flipper', api);

export type FlipperApi = typeof api;
