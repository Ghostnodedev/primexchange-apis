import microCors from 'micro-cors';
import { v4 as uuidv4 } from 'uuid';
import { db } from './libdb.js';  // your DB connection
import nodemailer from 'nodemailer';

const cors = microCors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
});

// Setup your database tables
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
    CREATE TABLE IF NOT EXISTS otp_verification (
      email TEXT PRIMARY KEY,
      otp TEXT NOT NULL,
      expires_at INTEGER NOT NULL  -- store expiry as UNIX timestamp (ms)
    );
  `);

  console.log('Tables are ready ✅');
}
setupTables();

// Email transporter
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

  // Parse JSON body
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

  // REGISTER
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

      return res.status(201).json({ message: 'User registered successfully', user: { username, email: normalizedEmail } });
    } catch (err) {
      return res.status(400).json({ message: 'User already exists or DB error', error: err.message });
    }
  }

  // LOGIN
  if (pathname === '/login' && method === 'POST') {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Missing login fields' });
    }

    try {
      const normalizedEmail = email.toLowerCase().trim();

      const result = await db.execute(
        `SELECT * FROM register WHERE email = ? AND password = ?`,
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

  // REQUEST OTP
  if (pathname === '/request-otp' && method === 'POST') {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    try {
      const normalizedEmail = email.toLowerCase().trim();

      // Check user exists
      const userResult = await db.execute(
        `SELECT * FROM register WHERE email = ?`,
        [normalizedEmail]
      );
      const users = userResult.rows || userResult;
      if (!users || users.length === 0) {
        return res.status(404).json({ message: 'Email not registered' });
      }

      // Generate OTP & expiry timestamp (5 minutes)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000;

      // Insert or replace OTP in otp_verification table
      await db.execute(
        `INSERT INTO otp_verification (email, otp, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET otp=excluded.otp, expires_at=excluded.expires_at`,
        [normalizedEmail, otp, expiresAt]
      );

      console.log(`[OTP SENT] ${normalizedEmail}: ${otp}`);

      // Send email
      const mailOptions = {
        from: `mailtest@gmail.com`,
        to: normalizedEmail,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
      };
      await transporter.sendMail(mailOptions);

      return res.status(200).json({ message: 'OTP sent successfully' });
    } catch (err) {
      return res.status(500).json({ message: 'Failed to send OTP', error: err.message });
    }
  }

  // VERIFY OTP
  if (pathname === '/verify-otp' && method === 'POST') {
    const { email, otp } = req.body || {};

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    try {
      const result = await db.execute(
        `SELECT otp, expires_at FROM otp_verification WHERE email = ?`,
        [normalizedEmail]
      );

      const rows = result.rows || result;

      if (!rows || rows.length === 0) {
        return res.status(400).json({ message: 'No OTP found for this email. Please request a new OTP.' });
      }

      const { otp: storedOtp, expires_at } = rows[0];
      const now = Date.now();

      if (storedOtp !== otp.toString().trim()) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }

      if (now > expires_at) {
        return res.status(400).json({ message: 'OTP expired. Please request a new OTP.' });
      }

      // OTP is valid and not expired - delete it now
      await db.execute(`DELETE FROM otp_verification WHERE email = ?`, [normalizedEmail]);

      // Store somewhere that OTP was verified (in memory for now)
      otpVerifiedStore.add(normalizedEmail);

      return res.status(200).json({ message: 'OTP verified successfully' });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // CREATE NEW PASSWORD
  if (pathname === '/create-password' && method === 'POST') {
    const { email, newPassword } = req.body || {};

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if OTP verified (you can replace with your own persistent check)
    if (!otpVerifiedStore.has(normalizedEmail)) {
      return res.status(403).json({ message: 'OTP not verified. Please verify OTP first.' });
    }

    try {
      const result = await db.execute(
        `UPDATE register SET password = ? WHERE email = ?`,
        [newPassword, normalizedEmail]
      );

      const affected = result.rowsAffected || result.changes || 0;

      if (affected === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Remove verified mark after password reset
      otpVerifiedStore.delete(normalizedEmail);

      return res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // Default 404
  return res.status(404).json({ message: 'Route not found' });
};

const otpVerifiedStore = new Set();

export default cors(handler);
