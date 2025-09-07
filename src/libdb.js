import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await db.execute(`
  CREATE TABLE IF NOT EXISTS profile (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    totalamount REAL NOT NULL,
    depositamount REAL NOT NULL,
    sellamount REAL DEFAULT 0,
    status TEXT DEFAULT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

createTable().catch(console.error);