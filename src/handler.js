// src/handler.js
import microCors from 'micro-cors';
import { v4 as uuidv4 } from 'uuid';
import { db } from './libdb.js';

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
      phone TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Tables are ready ✅');
}

// Run setup once
setupTables();

// Simple in-memory store for OTPs (for demo only)
const otpStore = new Map();

const handler = async (req, res) => {
  const { method, url } = req;
  const pathname = url.split('?')[0];

  if (method === 'OPTIONS') return res.status(200).end();

  // Parse JSON body for POST requests
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

  // Register user
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

  // Login user
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

  // GET CRYPTO
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

  // -------------------
  // Forgot Password Flow
  // -------------------

  // Step 1: Request OTP for phone number (check both tables)
  if (pathname === '/request-otp' && method === 'POST') {
    const { phone } = req.body || {};
    console.log(phone)
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    try {
      // Check register table
      const registerResult = await db.execute(
        `SELECT * FROM register WHERE phone = ?`,
        [phone.trim()]
      );

      // If not found in register, check login table
      let userFound = false;
      if (registerResult.rows.length > 0) {
        userFound = true;
      } else {
        const loginResult = await db.execute(
          `SELECT * FROM login WHERE phone = ?`,
          [phone.trim()]
        );
        if (loginResult.rows.length > 0) userFound = true;
      }

      if (!userFound) {
        return res.status(404).json({ message: 'Phone number not registered' });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore.set(phone.trim(), otp);

      console.log(`OTP for ${phone}: ${otp}`); // For testing; replace with real SMS

      return res.status(200).json({ message: 'OTP sent successfully' });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // Step 2: Verify OTP
  if (pathname === '/verify-otp' && method === 'POST') {
    const { phone, otp } = req.body || {};

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone and OTP are required' });
    }

    const validOtp = otpStore.get(phone.trim());
    if (validOtp && validOtp === otp) {
      otpStore.delete(phone.trim()); // remove OTP after success
      return res.status(200).json({ message: 'OTP verified successfully' });
    } else {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
  }

  // Step 3: Reset password (update in either register or login table)
  if (pathname === '/reset-password' && method === 'POST') {
    const { phone, newPassword } = req.body || {};
    if (!phone || !newPassword) {
      return res.status(400).json({ message: 'Phone and new password are required' });
    }

    try {
      // Try update in register table
      const updateRegister = await db.execute(
        `UPDATE register SET password = ? WHERE phone = ?`,
        [newPassword, phone.trim()]
      );

      if (updateRegister.rowsAffected && updateRegister.rowsAffected > 0) {
        return res.status(200).json({ message: 'Password updated successfully' });
      }

      // If no rows affected in register, try login table
      const updateLogin = await db.execute(
        `UPDATE login SET password = ? WHERE phone = ?`,
        [newPassword, phone.trim()]
      );

      if (updateLogin.rowsAffected && updateLogin.rowsAffected > 0) {
        return res.status(200).json({ message: 'Password updated successfully' });
      }

      // If no rows affected in either table
      return res.status(404).json({ message: 'User not found' });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // Not found route
  return res.status(404).json({ message: 'Route not found' });
};

export default cors(handler);
