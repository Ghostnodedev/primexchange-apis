export default function handler(req, res) {
  if (req.method === "POST") {
    const { username, password, email, phone } = req.body || {};

    if (!username || !password || !email || !phone) {
      return res
        .status(400)
        .json({ message: "Missing username, password, email, or phone" });
    }
    return res
      .status(200)
      .json({ message: "Login successful", user: { username } });
  }

  res.status(405).json({ message: "Method Not Allowed" });
}

export const register = async (req, res) => {
  const { name, email, username, password, confirmpassword, phone, age } =
    req.body || {};

  if (
    !name ||
    !email ||
    !username ||
    !password ||
    !confirmpassword ||
    !phone ||
    !age
  ) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (password !== confirmpassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  // Simulate user registration logic
  return res
    .status(201)
    .json({
      message: "User registered successfully",
      user: { name, email, username, phone, age },
    });
};

// src/handler.js


export async function getcrypto(req, res) {
  const { method, url } = req;
  console.log('Incoming:', method, url);

  if (method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const apiUrl = 'https://data-api.coindesk.com/index/cc/v1/markets/instruments?market=ccix&instrument_status=ACTIVE';

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Crypto Data:', data);

    return res.status(200).json(data);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ message: 'Failed to fetch crypto data' });
  }
}
