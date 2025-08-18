// src/handler.js

const users = []; // In-memory storage (use DB in real apps)

function send(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).json(body);
}

export default async function handler(req, res) {
  const { method, url } = req;
  const pathname = url.split("?")[0];

  // Preflight CORS request
  if (method === "OPTIONS") {
    return send(res, 200, {});
  }

  // Parse body for POST
  if (method === "POST") {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      req.body = JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      return send(res, 400, { message: "Invalid JSON" });
    }
  }

  // REGISTER
  if (pathname === "/register" && method === "POST") {
    const { name, email, username, password, confirmpassword, phone, age } = req.body || {};
    if (!name || !email || !username || !password || !confirmpassword || !phone || !age) {
      return send(res, 400, { message: "Missing required fields" });
    }
    if (password !== confirmpassword) {
      return send(res, 400, { message: "Passwords do not match" });
    }

    const existing = users.find(u => u.username === username);
    if (existing) {
      return send(res, 409, { message: "User already exists" });
    }

    users.push({ name, email, username, password, phone, age });
    return send(res, 201, { message: "User registered successfully", user: { name, email, username } });
  }

  // LOGIN
  if (pathname === "/login" && method === "POST") {
    const { username, password, email, phone } = req.body || {};
    if (!username || !password || !email || !phone) {
      return send(res, 400, { message: "Missing fields" });
    }

    const user = users.find(
      u => u.username === username && u.password === password && u.email === email && u.phone === phone
    );

    if (!user) return send(res, 401, { message: "Invalid credentials" });
    return send(res, 200, { message: "Login successful", user: { username } });
  }

  // GETCRYPTO
  if (pathname === "/getcrypto" && method === "GET") {
    try {
      const response = await fetch(
        "https://data-api.coindesk.com/index/cc/v1/markets/instruments?market=ccix&instrument_status=ACTIVE"
      );
      const data = await response.json();
      return send(res, 200, data);
    } catch (err) {
      return send(res, 500, { error: "Failed to fetch crypto data" });
    }
  }

  // TEST
  if (pathname === "/test" && method === "GET") {
    return send(res, 200, { message: "Hello World GET works" });
  }

  return send(res, 404, { message: "Route not found" });
}
