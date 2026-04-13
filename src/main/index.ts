import { app, BrowserWindow, ipcMain } from 'electron';
import { initDatabase, dbRun, dbGet, dbAll, closeDatabase } from '../db/database';

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
