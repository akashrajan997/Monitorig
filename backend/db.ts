import Database from 'better-sqlite3';
import path from 'path';

// Initialize SQLite database
const dbPath = path.join(process.cwd(), 'workpulse.db');
const db = new Database(dbPath);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    displayName TEXT,
    role TEXT DEFAULT 'manager',
    provider TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    status TEXT DEFAULT 'active',
    lastSeen DATETIME,
    department TEXT,
    currentApp TEXT,
    agentSecret TEXT
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employeeId TEXT NOT NULL,
    type TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    details TEXT,
    agentSecret TEXT,
    FOREIGN KEY (employeeId) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Insert default policy if it doesn't exist
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
insertSetting.run('global_policy', JSON.stringify({
  mode: "baseline",
  modules: {
    activityTracking: true,
    urlTracking: true,
    fileTracking: false,
    screenshot: true
  },
  screenshotInterval: 300,
  heartbeatInterval: 60
}));

export default db;
