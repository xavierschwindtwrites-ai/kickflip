import { app, BrowserWindow, ipcMain } from 'electron';
import { getDatabase, closeDatabase } from '../db/database';

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
    const db = getDatabase();
    db.prepare(
      `UPDATE campaigns SET data = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(data, id);
  });

  ipcMain.handle('campaign:load', (_, id: number) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) || null;
  });

  ipcMain.handle('campaign:ensure', () => {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM campaigns ORDER BY id LIMIT 1').get();
    if (existing) return existing;
    const result = db.prepare(
      `INSERT INTO campaigns (title) VALUES (?)`
    ).run('My First Campaign');
    return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
  });

  ipcMain.handle('campaign:list', () => {
    const db = getDatabase();
    return db.prepare('SELECT id, title FROM campaigns ORDER BY updated_at DESC').all();
  });

  ipcMain.handle('campaign:create', (_, title: string, data: string) => {
    const db = getDatabase();
    const result = db.prepare(
      `INSERT INTO campaigns (title, data) VALUES (?, ?)`
    ).run(title, data);
    return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
  });
}

app.on('ready', () => {
  getDatabase();
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
