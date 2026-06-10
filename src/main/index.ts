import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import { updateElectronApp } from 'update-electron-app';
import { initDatabase, dbRun, dbGet, dbAll, closeDatabase } from '../db/database';

// Check GitHub Releases for updates. Windows only for now: Squirrel.Mac
// refuses unsigned apps, and KickFlip has no Apple Developer certificate yet.
// Once the app is signed + notarized, drop the platform check.
if (process.platform === 'win32') {
  updateElectronApp({
    repo: 'xavierschwindtwrites-ai/kickflip',
    updateInterval: '1 hour',
  });
}

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

function registerIpcHandlers(): void {
  ipcMain.handle('campaign:save-data', (_, id: number, data: string) => {
    dbRun(
      `UPDATE campaigns SET data = ?, updated_at = datetime('now') WHERE id = ?`,
      [data, id],
    );
  });

  ipcMain.handle('campaign:load', (_, id: number) => {
    return dbGet('SELECT * FROM campaigns WHERE id = ?', [id]);
  });

  ipcMain.handle('campaign:ensure', () => {
    const existing = dbGet('SELECT * FROM campaigns ORDER BY id LIMIT 1');
    if (existing) return existing;
    const result = dbRun(
      `INSERT INTO campaigns (title) VALUES (?)`,
      ['My First Campaign'],
    );
    return dbGet('SELECT * FROM campaigns WHERE id = ?', [result.lastInsertRowid]);
  });

  ipcMain.handle('campaign:list', () => {
    return dbAll('SELECT id, title FROM campaigns ORDER BY updated_at DESC');
  });

  ipcMain.handle('campaign:create', (_, title: string, data: string) => {
    const result = dbRun(
      `INSERT INTO campaigns (title, data) VALUES (?, ?)`,
      [title, data],
    );
    return dbGet('SELECT * FROM campaigns WHERE id = ?', [result.lastInsertRowid]);
  });

  ipcMain.handle('campaign:delete', (_, id: number) => {
    dbRun('DELETE FROM campaigns WHERE id = ?', [id]);
  });

  ipcMain.handle('campaign:rename', (_, id: number, newTitle: string) => {
    dbRun(
      `UPDATE campaigns SET title = ?, updated_at = datetime('now') WHERE id = ?`,
      [newTitle, id],
    );
  });

  ipcMain.handle('campaign:duplicate', (_, id: number) => {
    const original = dbGet('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (!original) return null;
    const newTitle = `Copy of ${original.title as string}`;
    const result = dbRun(
      `INSERT INTO campaigns (title, data) VALUES (?, ?)`,
      [newTitle, original.data as string],
    );
    return dbGet('SELECT * FROM campaigns WHERE id = ?', [result.lastInsertRowid]);
  });

  ipcMain.handle('campaign:export', async (_, id: number) => {
    const campaign = dbGet('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (!campaign) return { ok: false, error: 'Campaign not found' };

    const safeName = (campaign.title as string).replace(/[^a-z0-9\- ]/gi, '').trim() || 'campaign';
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Campaign',
      defaultPath: `${safeName}.kickflip.json`,
      filters: [{ name: 'KickFlip Campaign', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, error: null };

    let data: unknown = {};
    try { data = JSON.parse(campaign.data as string); } catch { /* keep empty */ }
    const payload = {
      kickflipExport: 1,
      exportedAt: new Date().toISOString(),
      title: campaign.title,
      data,
    };
    try {
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
      return { ok: true, error: null };
    } catch (err) {
      return { ok: false, error: `Could not write file: ${(err as Error).message}` };
    }
  });

  ipcMain.handle('campaign:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Campaign',
      filters: [{ name: 'KickFlip Campaign', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return { ok: false, error: null, campaign: null };

    try {
      const raw = fs.readFileSync(filePaths[0], 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.kickflipExport !== 1 || typeof parsed.title !== 'string') {
        return { ok: false, error: 'Not a valid KickFlip campaign file.', campaign: null };
      }
      const dataStr = JSON.stringify(parsed.data ?? {});
      const result = dbRun(
        `INSERT INTO campaigns (title, data) VALUES (?, ?)`,
        [parsed.title, dataStr],
      );
      const campaign = dbGet('SELECT * FROM campaigns WHERE id = ?', [result.lastInsertRowid]);
      return { ok: true, error: null, campaign };
    } catch (err) {
      return { ok: false, error: `Could not read file: ${(err as Error).message}`, campaign: null };
    }
  });
}

app.on('ready', async () => {
  await initDatabase();
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  closeDatabase();
});
