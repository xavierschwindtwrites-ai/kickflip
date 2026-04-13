/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

// Use __non_webpack_require__ to bypass webpack's module wrapping entirely.
// sql.js's asm.js build assigns to module.exports which breaks inside
// webpack's scope. This does a real Node.js require at runtime.
// In dev: resolves from project node_modules.
// In packaged app: resolves from extraResource copied into Resources/.
declare const __non_webpack_require__: typeof require;

function loadSqlJs(): (config?: Record<string, unknown>) => Promise<{ Database: new (data?: ArrayLike<number> | Buffer | null) => SqlJsDatabase }> {
  // In packaged app, the file is in Resources/sql-asm.js (via extraResource)
  const resourcePath = path.join(
    path.dirname(app.getAppPath()),
    'sql-asm.js',
  );
  if (fs.existsSync(resourcePath)) {
    return __non_webpack_require__(resourcePath);
  }
  // Dev mode: resolve from node_modules
  return __non_webpack_require__('sql.js/dist/sql-asm.js');
}

interface SqlJsDatabase {
  run(sql: string, params?: unknown[]): void;
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
  prepare(sql: string): SqlJsStatement;
  export(): Uint8Array;
  close(): void;
}

interface SqlJsStatement {
  bind(params?: unknown[]): boolean;
  step(): boolean;
  getColumnNames(): string[];
  get(): unknown[];
  free(): boolean;
}

let db: SqlJsDatabase | null = null;
let dbPath = '';

function getDbPath(): string {
  if (!dbPath) {
    dbPath = path.join(app.getPath('userData'), 'kickflip.db');
  }
  return dbPath;
}

function persist(): void {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(getDbPath(), Buffer.from(data));
}

export async function initDatabase(): Promise<void> {
  const initFn = loadSqlJs();
  const SQL = await initFn();
  const p = getDbPath();

  if (fs.existsSync(p)) {
    const fileBuffer = fs.readFileSync(p);
    db = new SQL.Database(fileBuffer) as SqlJsDatabase;
  } else {
    db = new SQL.Database() as SqlJsDatabase;
  }

  db.run('PRAGMA foreign_keys = ON');
  db.run(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      data TEXT NOT NULL DEFAULT '{}'
    )
  `);
  persist();
}

function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized — call initDatabase() first');
  return db;
}

/** Run a statement and persist. Returns lastInsertRowid for INSERTs. */
export function dbRun(sql: string, params?: unknown[]): { lastInsertRowid: number } {
  const d = getDb();
  d.run(sql, params);
  persist();
  const row = d.exec('SELECT last_insert_rowid() AS id');
  const lastId = row.length > 0 ? (row[0].values[0][0] as number) : 0;
  return { lastInsertRowid: lastId };
}

/** Get a single row. */
export function dbGet(sql: string, params?: unknown[]): Record<string, unknown> | null {
  const d = getDb();
  const stmt = d.prepare(sql);
  if (params) stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row: Record<string, unknown> = {};
    cols.forEach((c: string, i: number) => { row[c] = vals[i]; });
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

/** Get all rows. */
export function dbAll(sql: string, params?: unknown[]): Record<string, unknown>[] {
  const d = getDb();
  const stmt = d.prepare(sql);
  if (params) stmt.bind(params);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row: Record<string, unknown> = {};
    cols.forEach((c: string, i: number) => { row[c] = vals[i]; });
    rows.push(row);
  }
  stmt.free();
  return rows;
}

export function closeDatabase(): void {
  if (db) {
    persist();
    db.close();
    db = null;
  }
}
