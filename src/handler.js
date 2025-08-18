// src/handler.js

// Global storage for testing only (not persistent)
let regdata = [];

// Utility function to send JSON with CORS headers
function send(res, statusCode, body) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(statusCode).json(body);
}

export default async function handler(req, res) {
  const { method, url } = req;
  const pathname = url.split("?")[0]; // Remove query string

  // Handle preflight CORS request
  if (method === "OPTIONS") {
    return send(res, 200, {});
  }

  // Parse POST body
  if (method === "POST") {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const rawBody = Buffer.concat(buffers).toString();
      req.body = JSON.parse(rawBody);
    } catch (err) {
      return send(res, 400, { message: "Invalid JSON body" });
    }
  }

  // REGISTER route
  if (pathname === "/register" && method === "POST") {
    const { name, email, username, password, confirmpassword, phone, age } = req.body || {};

    if (!name || !email || !username || !password || !confirmpassword || !phone || !age) {
      return send(res, 400, { message: "Missing required fields" });
    }

    if (password !== confirmpassword) {
      return send(res, 400, { message: "Passwords do not match" });
    }

    const user = { name, email, username, password, phone, age };
    regdata.push(user);
    console.log("Registration:", user);

    return send(res, 201, { message: "User registered successfully", user });
  }

  // LOGIN route
  if (pathname === "/login" && method === "POST") {
    const { username, password, email, phone } = req.body || {};

    if (!username || !password || !email || !phone) {
      return send(res, 400, { message: "Missing fields" });
    }

    const user = regdata.find(
      (u) =>
        u.username === username &&
        u.password === password &&
        u.email === email &&
        u.phone === phone
    );

    if (!user) {
      return send(res, 401, { message: "Invalid credentials" });
    }

    console.log("Login:", user);
    return send(res, 200, { message: "Login successful", user: { username } });
  }

  // GETCRYPTO route
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

  // TEST route
  if (pathname === "/test" && method === "GET") {
    return send(res, 200, { message: "Hello World GET works" });
  }

  // Catch-all 404
  return send(res, 404, { message: "Route not found" });
}
