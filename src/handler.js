// src/handler.js

export default async function handler(req, res) {
  const { method, url } = req;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight request
  if (method === "OPTIONS") {
    return res.status(200).end();
  }

  if (method === "POST") {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const rawBody = Buffer.concat(buffers).toString();
      req.body = JSON.parse(rawBody);
    } catch (err) {
      return res.status(400).json({ message: "Invalid JSON body" });
    }
  }

  const pathname = url.split("?")[0]; // strip query params

    // REGISTER
  const regdata = []
  if (pathname === "/register" && method === "POST") {
    const { name, email, username, password, confirmpassword, phone } = req.body || {};
    if (!name || !email || !username || !password || !confirmpassword || !phone || !age) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (password !== confirmpassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    regdata.push({ name, email, username, phone });
    console.log("Registration data:", regdata);
    return res.status(201).json({ message: "User registered successfully", user: { name, email, username, phone, age } });
  }

  const data = []
  if (pathname === "/login" && method === "POST") {
    const { username, password, email, phone } = req.body || {};
    if (!username || !password || !email || !phone) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const find = regdata.find(user => user.username === username && user.password === password && user.email === email && user.phone === phone);
    if (!find) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    data.push({ username, email, phone });
    console.log(data)
    return res.status(200).json({ message: "Login successful", user: { username } });
  }



  // GETCRYPTO
  if (pathname === "/getcrypto" && method === "GET") {
    try {
      const response = await fetch("https://data-api.coindesk.com/index/cc/v1/markets/instruments?market=ccix&instrument_status=ACTIVE");
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch crypto data" });
    }
  }

  // TEST
  if (pathname === "/test" && method === "GET") {
    return res.status(200).json({ message: "Hello World GET works" });
  }

  // Not Found
  return res.status(404).json({ message: "Route not found" });
}
