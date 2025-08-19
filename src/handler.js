// src/handler.js
import microCors from "micro-cors";
import { v4 as uuidv4 } from "uuid";
import { db } from "./libdb";

// ✅ Setup tables if they don’t exist
async function setupTables() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS register (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      username TEXT,
      password TEXT,
      phone TEXT,
      age INTEGER
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS login (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      email TEXT,
      phone TEXT,
      password TEXT,
      token TEXT
    );
  `);

  console.log("Tables ready ✅");
}
setupTables();

const cors = microCors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
});

const handler = async (req, res) => {
  const { method, url } = req;
  const pathname = url.split("?")[0];

  if (method === "OPTIONS") {
    return res.status(200).end(); // Handle preflight
  }

  // Parse body for POST
  if (method === "POST") {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const rawBody = Buffer.concat(buffers).toString();
      req.body = JSON.parse(rawBody);
    } catch (err) {
      return res.status(400).json({ message: "Invalid JSON body" });
    }
  }

  // ✅ REGISTER route (store in DB)
  if (pathname === "/register" && method === "POST") {
    const { name, email, username, password, confirmpassword, phone, age } =
      req.body || {};

    if (
      !name ||
      !email ||
      !username ||
      !password ||
      !confirmpassword ||
      !phone ||
      !age
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (password !== confirmpassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    try {
      await db.execute({
        sql: `INSERT INTO register (name, email, username, password, phone, age) 
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [name, email, username, password, phone, age],
      });

      return res
        .status(201)
        .json({ message: "User registered successfully", user: { username, email } });
    } catch (err) {
      console.error("DB Insert Error:", err);
      return res.status(500).json({ message: "Error registering user" });
    }
  }

  // ✅ LOGIN route (check register table, then save to login table)
  if (pathname === "/login" && method === "POST") {
    const { username, password, email, phone } = req.body || {};

    if (!username || !password || !email || !phone) {
      return res.status(400).json({ message: "Missing login fields" });
    }

    try {
      const result = await db.execute({
        sql: `SELECT * FROM register 
              WHERE username = ? AND email = ? AND phone = ? AND password = ?`,
        args: [username, email, phone, password],
      });

      if (result.rows.length === 0) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = uuidv4();

      await db.execute({
        sql: `INSERT INTO login (username, email, phone, password, token) 
              VALUES (?, ?, ?, ?, ?)`,
        args: [username, email, phone, password, token],
      });

      return res
        .status(200)
        .json({ message: "Login successful", user: { username }, token });
    } catch (err) {
      console.error("DB Login Error:", err);
      return res.status(500).json({ message: "Error during login" });
    }
  }

  // ✅ GETCRYPTO route (unchanged)
  if (pathname === "/getcrypto" && method === "GET") {
    try {
      const response = await fetch(
        "https://data-api.coindesk.com/index/cc/v1/markets/instruments?market=ccix&instrument_status=ACTIVE"
      );
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch crypto data" });
    }
  }

  // Default
  return res.status(404).json({ message: "Route not found" });
};

export default cors(handler);
