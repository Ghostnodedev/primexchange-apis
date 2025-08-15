export default function handler(req, res) {
  res.status(200).json({ message: 'Hello from Vercel Serverless API!' });
}

export default function getlogin(req,res) {
    const body = req.body;
    const { username, password } = body;
    console.log(`Username: ${username}, Password: ${password}`);

    if(!username || !password) {
        res.status(400).json({ message: 'Username and password are required' });
        return;
    }

    res.status(200).json({ message: 'Login successful', user: { username } });
}