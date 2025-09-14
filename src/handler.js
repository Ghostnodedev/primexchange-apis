// src/handler.js
import microCors from "micro-cors";
import { v4 as uuidv4 } from "uuid";
import { db } from "./libdb.js"; // your DB connection here
import nodemailer from "nodemailer";

const cors = microCors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
});

// Setup your database tables (run once)
async function setupTables() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS register (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT,
      age INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS login (
      CREATE TABLE IF NOT EXISTS login (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      otp TEXT,
      otp_expires_at INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

// await db.execute(`DROP TABLE IF EXISTS account`);
// await db.execute(`
//   CREATE TABLE IF NOT EXISTS account (
//     id TEXT PRIMARY KEY,
//     holdername TEXT NOT NULL,
//     accountno TEXT NOT NULL,
//     ifsc TEXT NOT NULL,
//     bankname TEXT NOT NULL,
//     accounttype TEXT NOT NULL,
//     sellamount INTEGER DEFAULT 0,
//     email TEXT NOT NULL,
//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//   );
// `);



  // Add otp column if it doesn't exist
  try {
    await db.execute(`ALTER TABLE login ADD COLUMN otp TEXT`);
    console.log("Added otp column to login table");
  } catch (err) {
    if (err.message.includes("duplicate column name")) {
      console.log("otp column already exists, skipping");
    } else {
      console.error("Error adding otp column:", err);
    }
  }

  // Add otp_expires_at column if it doesn't exist
  try {
    await db.execute(`ALTER TABLE login ADD COLUMN otp_expires_at INTEGER`);
    console.log("Added otp_expires_at column to login table");
  } catch (err) {
    if (err.message.includes("duplicate column name")) {
      console.log("otp_expires_at column already exists, skipping");
    } else {
      console.error("Error adding otp_expires_at column:", err);
    }
  }

  console.log("Database tables are ready!");
}
setupTables();

// Setup nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "vaibhavpandey331@gmail.com", // YOUR email here
    pass: "qpii npbr bcfs iodu", // Your generated Gmail App Password here
  },
});

const handler = async (req, res) => {
  const { method, url } = req;
  const pathname = url.split("?")[0];

  if (method === "OPTIONS") return res.status(200).end();

  // Parse JSON body if POST
  if (method === "POST") {
    try {
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      const rawBody = Buffer.concat(buffers).toString();
      req.body = JSON.parse(rawBody);
    } catch (err) {
      return res.status(400).json({ message: "Invalid JSON body" });
    }
  }

  // Register new user
  if (pathname === "/register" && method === "POST") {
    const { name, email, username, password, confirmpassword, phone, age } =
      req.body || {};
    if (!name || !email || !username || !password || !confirmpassword) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (password !== confirmpassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    try {
      const normalizedEmail = email.toLowerCase().trim();

      await db.execute(
        `INSERT INTO register (name, email, username, password, phone, age) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, normalizedEmail, username, password, phone || "", age || null]
      );

      // Also create a login entry (for OTP etc)
      await db.execute(`INSERT INTO login (email, password) VALUES (?, ?)`, [
        normalizedEmail,
        password,
      ]);

      return res
        .status(201)
        .json({
          message: "User registered successfully",
          user: { username, email: normalizedEmail },
        });
    } catch (err) {
      return res
        .status(400)
        .json({
          message: "User already exists or DB error",
          error: err.message,
        });
    }
  }

  // Login user
  if (pathname === "/login" && method === "POST") {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Missing login fields" });
    }

    try {
      const normalizedEmail = email.toLowerCase().trim();

      const result = await db.execute(
        `SELECT * FROM register WHERE email = ? AND password = ?`,
        [normalizedEmail, password]
      );

      const users = result.rows || result;

      if (!users || users.length === 0)
        return res.status(401).json({ message: "Invalid credentials" });

      const token = uuidv4();
      return res
        .status(200)
        .json({
          message: "Login successful",
          user: { email: normalizedEmail },
          token,
        });
    } catch (err) {
      return res.status(500).json({ message: "DB error", error: err.message });
    }
  }

  // Request OTP
  if (pathname === "/request-otp" && method === "POST") {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    try {
      const normalizedEmail = email.toLowerCase().trim();

      // Check user exists
      const result = await db.execute(
        `SELECT * FROM register WHERE email = ?`,
        [normalizedEmail]
      );

      const users = result.rows || result;

      if (!users || users.length === 0) {
        return res.status(404).json({ message: "Email not registered" });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Set OTP expiration (5 minutes from now)
      const expiresAt = Date.now() + 5 * 60 * 1000;

      // Update OTP & expiration in login table
      await db.execute(
        `UPDATE login SET otp = ?, otp_expires_at = ? WHERE email = ?`,
        [otp, expiresAt, normalizedEmail]
      );

      console.log(`[OTP SENT] For ${normalizedEmail}, OTP: ${otp}`);

      // Send OTP email
      const mailOptions = {
        from: `mailtest@gmail.com`,
        to: normalizedEmail,
        subject: "Your OTP Code",
        text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
      };

      await transporter.sendMail(mailOptions);

      return res.status(200).json({ message: "OTP sent successfully" });
    } catch (err) {
      console.error("Error sending OTP email:", err);
      return res
        .status(500)
        .json({ message: "Failed to send OTP", error: err.message });
    }
  }

  // Verify OTP
  if (pathname === "/verify-otp" && method === "POST") {
    let { email, otp } = req.body || {};

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    email = email.toLowerCase().trim();
    otp = otp.toString().trim();

    try {
      // Get stored OTP and expiration from DB
      const result = await db.execute(
        `SELECT otp, otp_expires_at FROM login WHERE email = ?`,
        [email]
      );

      const rows = result.rows || result;
      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "Email not found" });
      }

      const { otp: storedOtp, otp_expires_at } = rows[0];

      if (!storedOtp) {
        return res
          .status(400)
          .json({
            message: "No OTP found for this email. Please request a new OTP.",
          });
      }

      if (storedOtp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      if (Date.now() > otp_expires_at) {
        return res
          .status(400)
          .json({ message: "OTP expired. Please request a new OTP." });
      }

      // OTP valid - clear it from DB after successful verification
      await db.execute(
        `UPDATE login SET otp = NULL, otp_expires_at = NULL WHERE email = ?`,
        [email]
      );

      return res.status(200).json({ message: "OTP verified successfully" });
    } catch (err) {
      return res.status(500).json({ message: "DB error", error: err.message });
    }
  }

  // Reset password
  if (pathname === "/reset-password" && method === "POST") {
    const { email, newPassword } = req.body || {};

    if (!email || !newPassword) {
      return res
        .status(400)
        .json({ message: "Email and new password are required" });
    }

    try {
      const normalizedEmail = email.toLowerCase().trim();

      const result = await db.execute(
        `UPDATE register SET password = ? WHERE email = ?`,
        [newPassword, normalizedEmail]
      );

      const affected = result.rowsAffected || result.changes || 0;

      if (affected === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Also update login password to keep consistent
      await db.execute(`UPDATE login SET password = ? WHERE email = ?`, [
        newPassword,
        normalizedEmail,
      ]);

      return res.status(200).json({ message: "Password updated successfully" });
    } catch (err) {
      return res.status(500).json({ message: "DB error", error: err.message });
    }
  }

if (pathname === "/account" && method === "POST") {
  try {
    const { accountno, ifsc, holdername, bankname, accounttype, sellamount, email } = req.body;
    const id = uuidv4();

    if (!accountno || !ifsc || !holdername || !bankname || !accounttype || !email) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const normEmail = email.toLowerCase();

    // Validate ifsc and accountno if needed
    const IFSC_REGEX = /^[A-Z]{4}0[0-9]{6}$/;
    const ACCOUNT_REGEX = /^[0-9]{9,18}$/;

    if (!ACCOUNT_REGEX.test(accountno)) {
      res.status(400).json({ message: "Invalid Account Number (must be 9–18 digits)" });
      return;
    }
    if (!IFSC_REGEX.test(ifsc)) {
      res.status(400).json({ message: "Invalid IFSC Code" });
      return;
    }

    // 1. Check if the account already exists using accountno + email
    const selectQuery = `
      SELECT id, sellamount
      FROM account
      WHERE accountno = ? AND email = ?
      LIMIT 1
    `;
    const selectParams = [accountno, normEmail];

    let existingRows;
    try {
      existingRows = await sqlLiteClient.query(selectQuery, selectParams);
      // Depending on the library, `query` might return an array of rows directly
      // or an object. Ensure it's iterable.
    } catch (err) {
      console.error("DB SELECT error:", err);
      res.status(500).json({ error: "Database SELECT error" });
      return;
    }

    // If existingRows is not iterable or not an array, handle error
    if (!existingRows || !Array.isArray(existingRows)) {
      res.status(500).json({ error: "Database returned unexpected format" });
      return;
    }

    if (existingRows.length > 0) {
      // Account exists → update
      const existing = existingRows[0];
      const newSellAmount = (existing.sellamount || 0) + sellamount;

      const updateQuery = `
        UPDATE account
        SET
          holdername = ?,
          ifsc = ?,
          bankname = ?,
          accounttype = ?,
          sellamount = ?
        WHERE accountno = ? AND email = ?
      `;
      const updateParams = [
        holdername,
        ifsc,
        bankname,
        accounttype,
        newSellAmount,
        accountno,
        normEmail
      ];

      try {
        await sqlLiteClient.query(updateQuery, updateParams);
      } catch (err) {
        console.error("DB UPDATE error:", err);
        res.status(500).json({ error: "Database UPDATE error" });
        return;
      }

      res.status(200).json({ message: "Account updated", id: existing.id, sellamount: newSellAmount });
      return;
    } else {
      // Account does not exist → insert
      const newId = uuidv4();

      const insertQuery = `
        INSERT INTO account (id, holdername, accountno, ifsc, bankname, accounttype, sellamount, email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const insertParams = [
        newId,
        holdername,
        accountno,
        ifsc,
        bankname,
        accounttype,
        sellamount,
        normEmail
      ];

      try {
        await sqlLiteClient.query(insertQuery, insertParams);
      } catch (err) {
        console.error("DB INSERT error:", err);
        res.status(500).json({ error: "Database INSERT error" });
        return;
      }

      res.status(201).json({ message: "Account inserted", id: newId, sellamount: sellamount });
      return;
    }

  } catch (err) {
    console.error("General POST /account error:", err);
    res.status(500).json({ error: err.message });
  }
}

// ---------------- GET /gacc ----------------
// Only fetch accounts for the given email
if (pathname === "/gacc" && method === "GET") {
  try {
    const email = req.query.email; // frontend must send ?email=user@example.com
    if (!email) return res.status(400).json({ message: "Missing email" });

    const result = await db.execute(
      `SELECT * FROM account WHERE email = ?`,
      [email.toLowerCase()]
    );

    res.status(200).json({ data: result.rows || result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
  return;
}

if (pathname === "/profile" && method === "POST") {
  try {
    const { email, username, totalamount, depositamount, sellamount } = req.body;
    console.log("Incoming payload:", req.body);

    // Validate required fields
    if (!email || !username || !totalamount || !depositamount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const id = uuidv4();

    try {
      await db.execute({
        sql: `INSERT INTO profile (id, email, username, totalamount, depositamount, sellamount)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          email.toLowerCase(),
          username,
          totalamount,
          depositamount,
          sellamount || 0, // default to 0 if missing
        ],
      });

      return res.status(201).json({ message: "Profile created", id });
    } catch (dbError) {
      console.error("DB insert error:", dbError);
      return res.status(500).json({ message: "Database error" });
    }
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Get profile by email
if (pathname === "/gprofile" && method === "GET") {
  try {
    const email = req.query?.email;
    console.log("Email query param:", email);

    if (!email) {
      return res.status(400).json({ message: "Missing email" });
    }

    const result = await db.execute(
      `SELECT * FROM profile WHERE email = ?`,
      [email.toLowerCase()]
    );

    return res.status(200).json({ data: result.rows || result });
  } catch (error) {
    console.error("DB fetch error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// Default 404 response for unknown routes
return res.status(404).json({ message: "Route not found" });
}
export default cors(handler);
