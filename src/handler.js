// src/handler.js
import microCors from 'micro-cors';
import { v4 as uuidv4 } from 'uuid';
import { db } from './libdb.js';
import nodemailer from 'nodemailer';

const cors = microCors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
});

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

// Run setup once
setupTables();

// Store OTPs in-memory (For production use persistent store with expiration)
const otpStore = new Map();

// Setup nodemailer transporter (hardcoded email & password)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'mailtest122000@gmail.com',     // YOUR email here
    pass: 'Testing@142000',                // YOUR app password here
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

  // /register
  if (pathname === '/register' && method === 'POST') {
    const { name, email, username, password, confirmpassword, phone, age } = req.body || {};

    if (!name || !email || !username || !password || !confirmpassword) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (password !== confirmpassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    try {
      const normalizedEmail = email.toLowerCase();

      await db.execute(
        `INSERT INTO register (name, email, username, password, phone, age) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, normalizedEmail, username, password, phone || '', age || null]
      );
      return res.status(201).json({ message: 'User registered successfully', user: { username, email: normalizedEmail } });
    } catch (err) {
      return res.status(400).json({ message: 'User already exists or DB error', error: err.message });
    }
  }

  // /login
  if (pathname === '/login' && method === 'POST') {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Missing login fields' });
    }

    try {
      const normalizedEmail = email.toLowerCase();

      const result = await db.execute(
        `SELECT * FROM register WHERE email = ? AND password = ?`,
        [normalizedEmail, password]
      );

      // Adjust depending on your DB driver result shape
      const users = result.rows || result;

      if (!users || users.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

      const token = uuidv4();
      return res.status(200).json({ message: 'Login successful', user: { email: normalizedEmail }, token });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // /getcrypto
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

  // /request-otp
  if (pathname === '/request-otp' && method === 'POST') {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    try {
      const normalizedEmail = email.toLowerCase();

      const result = await db.execute(
        `SELECT * FROM register WHERE email = ?`,
        [normalizedEmail]
      );

      const users = result.rows || result;

      console.log('DB query result:', users); // Debug

      if (!users || users.length === 0) {
        return res.status(404).json({ message: 'Email not registered' });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore.set(normalizedEmail, otp);

      const mailOptions = {
        from: `"YourAppName" <mailtest122000@gmail.com>`,  // Use your actual email here
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

  // /verify-otp
  if (pathname === '/verify-otp' && method === 'POST') {
    const { email, otp } = req.body || {};

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const normalizedEmail = email.toLowerCase();
    const validOtp = otpStore.get(normalizedEmail);

    if (validOtp && validOtp === otp) {
      otpStore.delete(normalizedEmail); // Remove OTP after success
      return res.status(200).json({ message: 'OTP verified successfully' });
    } else {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
  }

  // /reset-password
  if (pathname === '/reset-password' && method === 'POST') {
    const { email, newPassword } = req.body || {};

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required' });
    }

    try {
      const normalizedEmail = email.toLowerCase();

      const result = await db.execute(
        `UPDATE register SET password = ? WHERE email = ?`,
        [newPassword, normalizedEmail]
      );

      const affected = result.rowsAffected || result.changes || 0;

      if (affected === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      return res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // Default 404
  return res.status(404).json({ message: 'Route not found' });
};

export default cors(handler);
