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
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Tables are ready ✅');
}
setupTables();

// In-memory OTP store
const otpStore = new Map();

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

  // GET CRYPTO DATA
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

      const result = await db.execute(
        `SELECT * FROM register WHERE email = ?`,
        [normalizedEmail]
      );

      const users = result.rows || result;

      if (!users || users.length === 0) {
        return res.status(404).json({ message: 'Email not registered' });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore.set(normalizedEmail, otp);

      console.log(`[OTP SENT] For ${normalizedEmail}: ${otp}`);

      const mailOptions = {
        from: `mailtest122000@gmail.com`,
        to: normalizedEmail,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
      };

      await transporter.sendMail(mailOptions);

      return res.status(200).json({ message: 'OTP sent successfully' });
    } catch (err) {
      console.error('Error sending OTP email:', err);
      return res.status(500).json({ message: 'Failed to send OTP', error: err.message });
    }
  }

  // VERIFY OTP AND RESET PASSWORD
  if (pathname === '/verify-otp' && method === 'POST') {
    const { email, otp, newPassword } = req.body || {};

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const storedOtp = otpStore.get(normalizedEmail);

    if (!storedOtp || storedOtp !== otp.toString().trim()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
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

      otpStore.delete(normalizedEmail);

      return res.status(200).json({ message: 'OTP verified and password updated successfully' });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // DEFAULT 404
  return res.status(404).json({ message: 'Route not found' });
};

export default cors(handler);
