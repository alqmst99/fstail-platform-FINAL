/**
 * apps/desktop/src/preload.js
 * Context bridge — exposes safe typed IPC API to the renderer (Next.js).
 * The renderer has ZERO access to Node.js or Electron internals.
 * Every capability must be explicitly listed here.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {

  // ── API Key (Groq — OS keychain via safeStorage R-01) ────────────
  apiKey: {
    save:   (key)  => ipcRenderer.invoke('api-key:save', key),
    get:    ()     => ipcRenderer.invoke('api-key:get'),
    delete: ()     => ipcRenderer.invoke('api-key:delete'),
  },

  // ── Theme ─────────────────────────────────────────────────────────
  theme: {
    get: ()      => ipcRenderer.invoke('theme:get'),
    set: (theme) => ipcRenderer.invoke('theme:set', theme),
  },

  // ── Notifications ─────────────────────────────────────────────────
  notification: {
    show: (title, body) =>
      ipcRenderer.invoke('notification:show', { title, body }),
  },

  // ── Auto-updater ──────────────────────────────────────────────────
  updater: {
    check:   () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),

    // Subscribe to update events from main process
    onAvailable:  (cb) => {
      ipcRenderer.on('update:available',  (_e, info) => cb(info));
      return () => ipcRenderer.removeAllListeners('update:available');
    },
    onDownloaded: (cb) => {
      ipcRenderer.on('update:downloaded', (_e, info) => cb(info));
      return () => ipcRenderer.removeAllListeners('update:downloaded');
    },
    onError: (cb) => {
      ipcRenderer.on('update:error', (_e, msg) => cb(msg));
      return () => ipcRenderer.removeAllListeners('update:error');
    },
  },

  // ── Shell ─────────────────────────────────────────────────────────
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },

  // ── App info ──────────────────────────────────────────────────────
  app: {
    version:  () => ipcRenderer.invoke('app:version'),
    platform: () => ipcRenderer.invoke('app:platform'),
    isDev:    () => ipcRenderer.invoke('app:isDev'),
  },

  // ── Convenience flags ─────────────────────────────────────────────
  isElectron: true,
  platform: process.platform,
});
