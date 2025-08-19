// src/handler.js
import { PrismaClient } from "@prisma/client";
import microCors from "micro-cors";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

const cors = microCors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
});

const prisma = new PrismaClient();

const handler = async (req, res) => {
  const { method, url } = req;
  const pathname = url.split("?")[0];

  if (method === "OPTIONS") {
    return res.status(200).end(); // CORS preflight
  }

  // Parse JSON body
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

  // ---------------- REGISTER ----------------
  if (pathname === "/register" && method === "POST") {
    const { name, email, username, password, confirmpassword, phone, age } = req.body || {};

    if (!name || !email || !username || !password || !confirmpassword || !phone || !age) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (password !== confirmpassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    try {
      const existingUser = await prisma.register.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.register.create({
        data: { name, email, username, password: hashedPassword, phone, age: parseInt(age) },
      });

      return res.status(201).json({ message: "User registered successfully", user: { username, email } });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to register" });
    }
  }

  // ---------------- LOGIN ----------------
  if (pathname === "/login" && method === "POST") {
    const { username, password, email, phone } = req.body || {};

    if (!username || !password || !email || !phone) {
      return res.status(400).json({ message: "Missing login fields" });
    }

    try {
      const user = await prisma.register.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid || user.username !== username || user.phone !== phone) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Save login record
      await prisma.login.create({
        data: { email: user.email, password: user.password },
      });

      const token = uuidv4();
      return res.status(200).json({ message: "Login successful", user: { username }, token });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to login" });
    }
  }

  // ---------------- GET CRYPTO ----------------
  if (pathname === "/getcrypto" && method === "GET") {
    try {
      const response = await fetch("https://data-api.coindesk.com/index/cc/v1/markets/instruments?market=ccix&instrument_status=ACTIVE");
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch crypto data" });
    }
  }

  return res.status(404).json({ message: "Route not found" });
};

export default cors(handler);
