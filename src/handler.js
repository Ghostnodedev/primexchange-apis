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


export const getcrypto = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // const apiUrl = 'https://data-api.coindesk.com/index/cc/v1/markets/instruments?market=ccix&instrument_status=ACTIVE';

  const apiUrl = "https://dummyjson.com/products"
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching crypto data' });
  }
};

