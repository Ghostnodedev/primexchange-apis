// src/handler.js
import microCors from 'micro-cors';
import { v4 as uuidv4 } from 'uuid';
import { db } from './libdb.js';

const cors = microCors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
});

// In-memory OTP store
const otpStore = new Map();

// Setup database tables
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

  // 📍 /register
  if (pathname === '/register' && method === 'POST') {
    const { name, email, username, password, confirmpassword, phone, age } = req.body || {};

    if (!name || !email || !username || !password || !confirmpassword) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (password !== confirmpassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    try {
      await db.execute(
        `INSERT INTO register (name, email, username, password, phone, age) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, email, username, password, phone || '', age || null]
      );
      return res.status(201).json({ message: 'User registered successfully', user: { username, email } });
    } catch (err) {
      return res.status(400).json({ message: 'User already exists or DB error', error: err.message });
    }
  }

  // 📍 /login
  if (pathname === '/login' && method === 'POST') {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Missing login fields' });
    }

    try {
      const result = await db.execute(
        `SELECT * FROM register WHERE email = ? AND password = ?`,
        [email, password]
      );

      if (result.rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

      const token = uuidv4();
      return res.status(200).json({ message: 'Login successful', user: { email }, token });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // 📍 /getcrypto
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

  // 📍 /request-otp — Step 1
  if (pathname === '/request-otp' && method === 'POST') {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    try {
      const result = await db.execute(
        `SELECT * FROM register WHERE phone = ?`,
        [phone]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Phone number not registered' });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore.set(phone, otp);

      console.log(`OTP for ${phone}: ${otp}`); // Simulate sending OTP
      return res.status(200).json({ message: 'OTP sent successfully' });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // 📍 /verify-otp — Step 2
  if (pathname === '/verify-otp' && method === 'POST') {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone and OTP are required' });
    }

    const validOtp = otpStore.get(phone);
    if (validOtp && validOtp === otp) {
      otpStore.delete(phone);
      return res.status(200).json({ message: 'OTP verified successfully' });
    } else {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
  }

  // 📍 /reset-password — Step 3
  if (pathname === '/reset-password' && method === 'POST') {
    const { phone, newPassword } = req.body;

    if (!phone || !newPassword) {
      return res.status(400).json({ message: 'Phone and new password are required' });
    }

    try {
      const result = await db.execute(
        `UPDATE register SET password = ? WHERE phone = ?`,
        [newPassword, phone]
      );

      if (result.rowsAffected === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      return res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // 📍 If no route matches
  return res.status(404).json({ message: 'Route not found' });
};

export default cors(handler);
