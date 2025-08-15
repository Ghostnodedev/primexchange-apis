export default async function handler(req, res) {
  const { url, method } = req;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GET /getempdata
  if (url === '/getempdata' && method === 'GET') {
    return res.status(200).json({ message: 'Employee data response' });
  }

  // Handle POST /getlogin
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
    } catch (err) {
      return res.status(500).json({ message: 'Error parsing request body', error: err.message });
    }
  }

  // Default case
  return res.status(404).json({ message: 'Route not found' });
}
