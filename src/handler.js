import microCors from 'micro-cors';
import { v4 as uuidv4 } from 'uuid';
import { db } from './libdb.js';
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

// In-memory stores
const otpStore = new Map();           // email -> otp string
const otpVerifiedStore = new Set();   // emails that passed OTP check

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'vaibhavpandey331@gmail.com',     // YOUR email here
    pass: 'qpii npbr bcfs iodu',    // Your Gmail App Password here
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

  // REGISTER
  if (pathname === '/register' && method === 'POST') {
    const { name, email, username, password, confirmpassword, phone, age } = req.body || {};

    if (!name || !email || !username || !password || !confirmpassword || !phone || !age) {
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
    const { email, password , username , phone } = req.body || {};
    if (!email || !password || !username || !phone) {
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

      const result = await db.execute(
        `SELECT * FROM register WHERE email = ?`,
        [normalizedEmail]
      );

      const users = result.rows || result;

      if (!users || users.length === 0) {
        return res.status(404).json({ message: 'Email not registered' });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Store OTP keyed by normalized email
      otpStore.set(normalizedEmail, otp);
      otpVerifiedStore.delete(normalizedEmail); // reset verification on new OTP

      console.log(`[OTP SENT] ${normalizedEmail}: ${otp}`);

      const mailOptions = {
        from: `mailtest@gmail.com`,
        to: normalizedEmail,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
      };

      await transporter.sendMail(mailOptions);

      return res.status(200).json({ message: 'OTP sent successfully' });
    } catch (err) {
      console.error('Error sending OTP:', err);
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
    const enteredOtp = String(otp).trim();

    // Debug: log all OTPs currently stored
    console.log('[OTP VERIFY DEBUG] Current otpStore:', Array.from(otpStore.entries()));

    const storedOtp = otpStore.get(normalizedEmail);

    console.log(`[OTP VERIFY] Email: ${normalizedEmail}, Stored OTP: '${storedOtp}', Entered OTP: '${enteredOtp}'`);

    if (!storedOtp) {
      return res.status(400).json({ message: 'No OTP found for this email. Please request a new OTP.' });
    }

    if (storedOtp !== enteredOtp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // OTP matches
    otpStore.delete(normalizedEmail);
    otpVerifiedStore.add(normalizedEmail);

    console.log(`[OTP VERIFIED ✅] ${normalizedEmail}`);

    return res.status(200).json({ message: 'OTP verified successfully' });
  }

  // CREATE NEW PASSWORD
  if (pathname === '/create-password' && method === 'POST') {
    const { email, newPassword } = req.body || {};

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

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

      otpVerifiedStore.delete(normalizedEmail); // cleanup after password reset

      return res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
      return res.status(500).json({ message: 'DB error', error: err.message });
    }
  }

  // Default 404 for unknown routes
  return res.status(404).json({ message: 'Route not found' });
};

export default cors(handler);
