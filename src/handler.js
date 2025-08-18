export default async function handler(req, res) {
  const { url, method } = req;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (method === "OPTIONS") {
    return res.status(200).end();
  }

  // Parse body for POST requests
  if (method === "POST") {
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    try {
      req.body = JSON.parse(Buffer.concat(buffers).toString());
    } catch (e) {
      return res.status(400).json({ message: "Invalid JSON" });
    }
  }

  // LOGIN
  if (url.includes("/login") && method === "POST") {
    const { username, password, email, phone } = req.body || {};
    if (!username || !password || !email || !phone) {
      return res.status(400).json({ message: "Missing fields" });
    }
    return res.status(200).json({ message: "Login successful", user: { username } });
  }

  // REGISTER
  if (url.includes("/register") && method === "POST") {
    const { name, email, username, password, confirmpassword, phone, age } = req.body || {};
    if (!name || !email || !username || !password || !confirmpassword || !phone || !age) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (password !== confirmpassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    return res.status(201).json({ message: "User registered successfully", user: { name, email, username, phone, age } });
  }

  // GETCRYPTO
  if (url.includes("/getcrypto") && method === "GET") {
    try {
      const response = await fetch("https://data-api.coindesk.com/index/cc/v1/markets/instruments?market=ccix&instrument_status=ACTIVE");
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // TEST
  if (url.includes("/test") && method === "GET") {
    return res.status(200).json({ message: "Hello World GET works" });
  }

  // 404
  return res.status(404).json({ message: "Not Found" });
}
