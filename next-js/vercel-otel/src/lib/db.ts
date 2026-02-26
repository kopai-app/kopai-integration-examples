import { DatabaseSync } from "node:sqlite";

function getDb() {
  const g = globalThis as unknown as { __db?: DatabaseSync };
  if (!g.__db) {
    g.__db = new DatabaseSync(":memory:");
    g.__db.exec(`
      CREATE TABLE IF NOT EXISTS surveys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orgName TEXT NOT NULL,
        orgSize TEXT NOT NULL,
        industry TEXT NOT NULL,
        hasOtel TEXT NOT NULL,
        email TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  return g.__db;
}

const db = getDb();
export default db;
