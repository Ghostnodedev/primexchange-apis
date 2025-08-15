export default async function handler(req, res) {
  const { url, method } = req;

  // Handle GET /getempdata
  if (url === '/getempdata' && method === 'GET') {
    return res.status(200).json({ message: 'Employee data response' });
  }

  // Handle POST /getlogin
  if (url === '/getlogin' && method === 'POST') {
    try {
      // Parse JSON body
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
      return res.status(400).json({ message: 'Invalid JSON body', error: err.message });
    }
  }

  // If no match
  return res.status(404).json({ message: 'Not Found' });
}
