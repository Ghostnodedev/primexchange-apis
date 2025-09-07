import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function createTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS account (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      holder_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      ifsc_code TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      account_type TEXT NOT NULL
    )
  `);
  console.log("✅ bank_accounts table created successfully");

  await db.execute(`DROP TABLE IF EXISTS account`);
await db.execute(`
  CREATE TABLE IF NOT EXISTS profile (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    totalamount REAL NOT NULL,
    depositamount REAL NOT NULL,
    sellamount REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    Txid: TEXT DEFAULT ,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
}


createTable().catch(console.error);