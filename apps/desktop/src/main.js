/**
 * apps/desktop/src/main.js
 * FSTail Platform — Electron Main Process (Production)
 *
 * In development: loads http://localhost:3000 (Next.js dev server)
 * In production:  spawns the bundled Next.js standalone server,
 *                 then loads http://localhost:3456
 *
 * Phase 1 security fixes applied:
 *   R-01 safeStorage for Groq API key
 *   R-02 URL allowlist on all outbound IPC
 *   R-14 Background colour set before window creation
 */

const {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  nativeTheme,
  Menu,
  Tray,
  shell,
  dialog,
} = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const Store = require('electron-store');
const http = require('http');

// ── Constants ─────────────────────────────────────────────────────────

const isDev = !app.isPackaged;
const WEB_PORT = 3456; // Bundled Next.js server port (prod only)
const WEB_URL = isDev
  ? 'http://localhost:3000'
  : `http://localhost:${WEB_PORT}`;


const store = new Store();

// ── Single instance lock ──────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// ── State ─────────────────────────────────────────────────────────────

let mainWindow = null;
let tray = null;
let nextServerProcess = null;
let webServerReady = false;

// ── R-14: Read theme BEFORE creating any window ───────────────────────

const storedTheme = store.get('theme', 'dark');
nativeTheme.themeSource = storedTheme;
const backgroundColor = storedTheme === 'dark' ? '#0f172a' : '#f8fafc';

// ── Next.js standalone server (production only) ───────────────────────

function startNextServer() {
  return new Promise((resolve, reject) => {
    if (isDev) { resolve(); return; }

    const serverPath = path.join(
      process.resourcesPath,
      'web',
      'server.js',
    );

    nextServerProcess = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        PORT: String(WEB_PORT),
        NODE_ENV: 'production',
        HOSTNAME: '127.0.0.1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    nextServerProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log('[next]', msg.trim());
      if (msg.includes('started server') || msg.includes('Ready')) {
        webServerReady = true;
        resolve();
      }
    });

    nextServerProcess.stderr.on('data', (data) => {
      console.error('[next:err]', data.toString().trim());
    });

    nextServerProcess.on('error', reject);

    // Timeout if server doesn't start in 30s
    setTimeout(() => {
      if (!webServerReady) reject(new Error('Next.js server timed out'));
    }, 30_000);
  });
}

// Poll until the Next.js server responds (production only)
async function waitForServer(url, retries = 40, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    const ready = await new Promise((resolve) => {
      http.get(url, (res) => resolve(res.statusCode < 500))
          .on('error', () => resolve(false));
    });
    if (ready) return;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error('Next.js server did not become ready in time');
}

// ── Window creation ───────────────────────────────────────────────────
// Al final del archivo, reemplaza la función createWindow o la carga
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: backgroundColor,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  const loadApp = () => {
    mainWindow.loadURL('http://localhost:3000');
  };

  // Esperar un poco más en desarrollo
  if (isDev) {
    setTimeout(loadApp, 2000); // da tiempo a Next.js
  } else {
    loadApp();
  }

  mainWindow.webContents.openDevTools(); // útil para debug
}

// ── System tray ───────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');

  try {
    tray = new Tray(iconPath);
  } catch {
    return; // Icon not found — skip tray
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open FSTail Platform',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setToolTip('FSTail Platform');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) mainWindow.show();
  });
}

// ── Auto-updater ──────────────────────────────────────────────────────

function setupAutoUpdater() {
  if (isDev) return; // Don't check for updates in dev

  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log(`Update available: ${info.version}`);
    // Notify the renderer
    mainWindow?.webContents.send('update:available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`Update downloaded: ${info.version}`);
    mainWindow?.webContents.send('update:downloaded', info);

    // Show native dialog — let user decide when to restart
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `FSTail Platform ${info.version} is ready to install.`,
      detail: 'Restart now to apply the update, or it will be applied on next launch.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
    mainWindow?.webContents.send('update:error', err.message);
  });

  // Check on launch, then every 4 hours
  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
}

// ── IPC handlers ──────────────────────────────────────────────────────

function registerIpcHandlers() {

  // ── API Key (R-01: safeStorage) ──────────────────────────────────
  ipcMain.handle('api-key:save', (_e, plainKey) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS keychain unavailable. Cannot store API key securely.');
    }
    const encrypted = safeStorage.encryptString(plainKey);
    store.set('groqApiKeyEncrypted', encrypted.toString('base64'));
    store.delete('groqApiKey'); // Remove legacy plaintext key
    return { ok: true };
  });

  ipcMain.handle('api-key:get', () => {
    const encoded = store.get('groqApiKeyEncrypted');
    if (!encoded) return null;
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
  });

  ipcMain.handle('api-key:delete', () => {
    store.delete('groqApiKeyEncrypted');
    store.delete('groqApiKey');
    return { ok: true };
  });

  // ── Theme ─────────────────────────────────────────────────────────
  ipcMain.handle('theme:get', () => store.get('theme', 'dark'));

  ipcMain.handle('theme:set', (_e, theme) => {
    store.set('theme', theme);
    nativeTheme.themeSource = theme;
    return { ok: true };
  });

  // ── OS Notifications ──────────────────────────────────────────────
  ipcMain.handle('notification:show', (_e, { title, body }) => {
    const { Notification } = require('electron');
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
    return { ok: true };
  });

  // ── Auto-updater controls ─────────────────────────────────────────
  ipcMain.handle('update:check', () => {
    if (!isDev) autoUpdater.checkForUpdatesAndNotify();
  });

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // ── App info ──────────────────────────────────────────────────────
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:platform', () => process.platform);
  ipcMain.handle('app:isDev', () => isDev);

  // ── Shell ─────────────────────────────────────────────────────────
  ipcMain.handle('shell:openExternal', (_e, url) => {
    // R-02: only allow http/https URLs
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      throw new Error(`Rejected non-http URL: ${url}`);
    }
    return shell.openExternal(url);
  });
}

// ── Deep link handling ────────────────────────────────────────────────

function handleDeepLink(url) {
  // fstail://portal/<token> — open a client portal report
  const match = url.match(/^fstail:\/\/portal\/(.+)$/);
  if (match && mainWindow) {
    const token = match[1];
    mainWindow.loadURL(`${WEB_URL}/portal/${token}`);
    mainWindow.show();
    mainWindow.focus();
  }
}

// Register custom protocol
if (!isDev) {
  app.setAsDefaultProtocolClient('fstail');
}

// macOS — handle deep link from 'open-url' event
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    handleDeepLink(url);
  }
});

// Windows/Linux — handle from second-instance argv
app.on('second-instance', (_event, argv) => {
  const url = argv.find((arg) => arg.startsWith('fstail://'));
  if (url) handleDeepLink(url);

  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ── App lifecycle ─────────────────────────────────────────────────────

app.whenReady().then(async () => {
  registerIpcHandlers();

  // Start bundled Next.js server (production only)
  try {
    await startNextServer();
    if (!isDev) await waitForServer(WEB_URL);
  } catch (err) {
    console.error('Failed to start web server:', err);
    dialog.showErrorBox(
      'Startup Error',
      `FSTail Platform failed to start its web server.\n\n${err.message}`,
    );
    app.quit();
    return;
  }

  createWindow();
  createTray();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS: keep app running in tray when all windows closed
  if (process.platform !== 'darwin') {
    if (!app.isQuitting) {
      // Keep alive in tray on Windows/Linux too
      return;
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (nextServerProcess) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }
});
