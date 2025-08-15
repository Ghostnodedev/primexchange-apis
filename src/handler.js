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


// export const getcrypto = async (req, res) => {
//   if (req.method === 'GET') {
//     try {
//       const response = await fetch('https://api.coindesk.com/v1/bpi/currentprice.json');
//       const data = await response.json();
//       return res.status(200).json(data);
//     } catch (err) {
//       return res.status(500).json({ error: err.message });
//     }
//   } else {
//     res.setHeader('Allow', ['GET']);
//     return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
//   }
// }

export function test(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ message: "Hello World GET works" });
  } else {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
}


