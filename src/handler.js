export default async function handler(req, res) {
  const { url, method } = req;

  // LOGIN endpoint
  if (url === "/login" && method === "POST") {
    const { username, password, email, phone } = req.body || {};
    if (!username || !password || !email || !phone) {
      return res.status(400).json({ message: "Missing username, password, email, or phone" });
    }
    return res.status(200).json({ message: "Login successful", user: { username } });
  }

  // REGISTER endpoint
  if (url === "/register" && method === "POST") {
    const { name, email, username, password, confirmpassword, phone, age } = req.body || {};
    if (!name || !email || !username || !password || !confirmpassword || !phone || !age) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (password !== confirmpassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    return res.status(201).json({
      message: "User registered successfully",
      user: { name, email, username, phone, age },
    });
  }

  // GETCRYPTO endpoint
  if (url === "/getcrypto" && method === "GET") {
    try {
      const response = await fetch("https://data-api.coindesk.com/index/cc/v1/markets/instruments?market=ccix&instrument_status=ACTIVE");
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // TEST endpoint
  if (url === "/test" && method === "GET") {
    return res.status(200).json({ message: "Hello World GET works" });
  }

  // If no route matched
  res.status(404).json({ message: "Not Found" });
}
