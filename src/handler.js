// src/handler.js
import microCors from 'micro-cors';
import { v4 as uuidv4 } from 'uuid';

const cors = microCors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
});

let regdata = []; 

const handler = async (req, res) => {
  const { method, url } = req;

  const pathname = url.split('?')[0];

  if (method === 'OPTIONS') {
    return res.status(200).end(); // Handle preflight
  }

  // Parse body for POST
  if (method === 'POST') {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const rawBody = Buffer.concat(buffers).toString();
      req.body = JSON.parse(rawBody);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid JSON body' });
    }
  }

  // REGISTER route
  if (pathname === '/register' && method === 'POST') {
    const { name, email, username, password, confirmpassword, phone, age } = req.body || {};

    if (!name || !email || !username || !password || !confirmpassword || !phone || !age) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (password !== confirmpassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    const token = uuidv4();
    regdata.push({ name, email, username, password, phone, age });
    console.log('Registered users:', regdata);

    return res.status(201).json({ message: 'User registered successfully', user: { username, email }, token });
  }

  // LOGIN route
  let logindata = []
  if (pathname === '/login' && method === 'POST') {
    const { username, password, email, phone } = req.body || {};

    if (!username || !password || !email || !phone) {
      return res.status(400).json({ message: 'Missing login fields' });
    }

    const found = regdata.find(user =>
      user.username === username &&
      user.password === password &&
      user.email === email &&
      user.phone === phone
    );

    if (!found) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    logindata.push({ username, password, email, phone });

    // // const token = jwt.sign({ username }, process.env.JWT_SECRET);
    // console.log('Login successful for user:', token);

    return res.status(200).json({ message: 'Login successful', user: { username } });
  }


  // GETCRYPTO route
  if (pathname === '/getcrypto' && method === 'GET') {
    try {
      const response = await fetch('https://data-api.coindesk.com/index/cc/v1/markets/instruments?market=ccix&instrument_status=ACTIVE');
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ message: 'Failed to fetch crypto data' });
    }
  }
}

export default cors(handler)
