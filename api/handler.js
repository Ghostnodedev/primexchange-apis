export default async function handler(req, res) {
  console.log(`[HANDLER] ${req.method} ${req.url}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, method } = req;

  if (url === '/getempdata' && method === 'GET') {
    return res.status(200).json({ message: 'Employee data response' });
  }

  if (url === '/getlogin' && method === 'POST') {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(buffers).toString());

      const { username, password } = data;

      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      return res.status(200).json({
        message: 'Login successful',
        user: { username }
      });
    } catch (error) {
      return res.status(500).json({ message: 'Server error', error: error.message });
    }
  }

  return res.status(404).json({ message: 'Route not found' });
}
