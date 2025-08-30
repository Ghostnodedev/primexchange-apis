// src/handler.js
import microCors from 'micro-cors';
import { v4 as uuidv4 } from 'uuid';
import { db } from './libdb.js';  // your DB connection here
import nodemailer from 'nodemailer';

const cors = microCors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      otp TEXT,
      otp_expires_at INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Tables are ready ✅');
}
setupTables();

// Setup nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'vaibhavpandey331@gmail.com',     // YOUR email here
    pass: 'qpii npbr bcfs iodu',       // Your generated Gmail App Password here
  },
});

const handler = async (req, res) => {
  const { method, url } = req;
  const pathname = url.split('?')[0];

  if (method === 'OPTIONS') return res.status(200).end();

  // Parse JSON body if POST
  if (method === 'POST') {
    try {
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      const rawBody = Buffer.concat(buffers).toString();
      req.body = JSON.parse(rawBody);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid JSON body' });
    }
  }

  // Register new user
  if (pathname === '/register' && method === 'POST') {
    const { name, email, username, password, confirmpassword, phone, age } = req.body || {};

    if (!name || !email || !username || !password || !confirmpassword) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (password !== confirmpassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    try {
      const normalizedEmail = email.toLowerCase().trim();

      await db.execute(
        `INSERT INTO register (name, email, username, password, phone, age) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, normalizedEmail, username, password, phone || '', age || null]
      );

      // Also insert into login table for login purposes (password here)
      await db.execute(
        `INSERT INTO login (email, password) VALUES (?, ?)`,
        [normalizedEmail, password]
      );

      return res.status(201).json({ message: 'User registered successfully', user: { username, email: normalizedEmail } });
    } catch (err) {
      return res.status(400).json({ message: 'User already exists or DB error', error: err.message });
    }
  }

  // Login user
  if (pathname === '/login' && method === 'POST') {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Missing login fields' });
    }

    try {
      const normalizedEmail = email.toLowerCase().trim();

      const result = await db.execute(
        `SELECT * FROM login WHERE email = ? AND password = ?`,
        [normalizedEmail, password]
      );

      const users = result.rows || result;

      if (!users || users.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

      const token = uuidv4();
      return res.status(200).json({ message: 'Login successful', user: { email: normalizedEmail }, token });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // Get Crypto data (unchanged)
  if (pathname === '/getcrypto' && method === 'GET') {
    try {
      const response = await fetch(
        'https://data-api.coindesk.com/index/cc/v1/markets/instruments?market=ccix&instrument_status=ACTIVE'
      );
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ message: 'Failed to fetch crypto data' });
    }
  }

  // REQUEST OTP
  if (pathname === '/request-otp' && method === 'POST') {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    try {
      const normalizedEmail = email.toLowerCase().trim();

      // Check if user exists in register table
      const userResult = await db.execute(
        `SELECT * FROM register WHERE email = ?`,
        [normalizedEmail]
      );
      const users = userResult.rows || userResult;

      if (!users || users.length === 0) {
        return res.status(404).json({ message: 'Email not registered' });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now

      // Insert or update OTP and expiry in login table
      await db.execute(`
        INSERT INTO login (email, otp, otp_expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET otp = excluded.otp, otp_expires_at = excluded.otp_expires_at
      `, [normalizedEmail, otp, otpExpiresAt]);

      // Send OTP email
      await transporter.sendMail({
        from: 'mailtest@gmail.com',
        to: normalizedEmail,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
      });

      console.log(`[OTP SENT] ${normalizedEmail}: ${otp}`);

      return res.status(200).json({ message: 'OTP sent successfully' });
    } catch (err) {
      console.error('Error sending OTP email:', err);
      return res.status(500).json({ message: 'Failed to send OTP', error: err.message });
    }
  }

  // VERIFY OTP
  if (pathname === '/verify-otp' && method === 'POST') {
    const { email, otp } = req.body || {};

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const enteredOtp = otp.toString().trim();

      const otpRowResult = await db.execute(
        `SELECT otp, otp_expires_at FROM login WHERE email = ?`,
        [normalizedEmail]
      );
      const rows = otpRowResult.rows || otpRowResult;

      if (!rows || rows.length === 0) {
        return res.status(400).json({ message: 'No OTP found for this email. Please request a new OTP.' });
      }

      const { otp: storedOtp, otp_expires_at } = rows[0];

      if (storedOtp !== enteredOtp) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }

      if (Date.now() > otp_expires_at) {
        return res.status(400).json({ message: 'OTP expired. Please request a new OTP.' });
      }

      // OTP valid - clear OTP and expiry in DB to prevent reuse
      await db.execute(
        `UPDATE login SET otp = NULL, otp_expires_at = NULL WHERE email = ?`,
        [normalizedEmail]
      );

      return res.status(200).json({ message: 'OTP verified successfully' });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // Reset password - only allow if OTP is verified (no otp stored for email)
  if (pathname === '/reset-password' && method === 'POST') {
    const { email, newPassword } = req.body || {};

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required' });
    }

    try {
      const normalizedEmail = email.toLowerCase().trim();

      // Check if OTP still exists (means not verified)
      const otpCheckResult = await db.execute(
        `SELECT otp FROM login WHERE email = ?`,
        [normalizedEmail]
      );
      const otpRows = otpCheckResult.rows || otpCheckResult;
      if (otpRows && otpRows.length > 0 && otpRows[0].otp) {
        return res.status(403).json({ message: 'OTP not verified. Please verify OTP first.' });
      }

      const result = await db.execute(
        `UPDATE register SET password = ? WHERE email = ?`,
        [newPassword, normalizedEmail]
      );

      const affected = result.rowsAffected || result.changes || 0;

      if (affected === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Also update password in login table for consistency
      await db.execute(
        `UPDATE login SET password = ? WHERE email = ?`,
        [newPassword, normalizedEmail]
      );

      return res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // Default 404 response for unknown routes
  return res.status(404).json({ message: 'Route not found' });
};

export default cors(handler);
