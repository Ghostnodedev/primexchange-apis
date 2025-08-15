export default function handler(req, res) {
  if (req.method === 'POST') {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ message: 'Missing username or password' });
    }

    return res.status(200).json({ message: 'Login successful', user: { username } });
  }

  res.status(405).json({ message: 'Method Not Allowed' });
}
