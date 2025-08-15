export default function handler(req, res) {
  if (req.method === 'POST') {
    const { username, password, email, phone } = req.body || {};

    if (!username || !password || !email || !phone) {
      return res.status(400).json({ message: 'Missing username, password, email, or phone' });
    }
    return res.status(200).json({ message: 'Login successful', user: { username } });
  }

  res.status(405).json({ message: 'Method Not Allowed' });
}

export const register = async(req,res)=>{
  const {name, email,username,password, confirmpassword ,phone,age} = req.body || {};

  if (!name || !email || !username || !password || !confirmpassword || !phone || !age) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (password !== confirmpassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  // Simulate user registration logic
  return res.status(201).json({ message: 'User registered successfully', user: { name, email, username, phone, age } });
}

