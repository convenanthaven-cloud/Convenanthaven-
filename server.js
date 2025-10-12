    import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "sk_test_yourkey";
const users = {};

// ✅ Route 1 — Home
app.get("/", (req, res) => {
  res.send("✅ Paystack Thunkable Demo Server is running successfully!");
});

// ✅ Route 2 — Initialize Checkout
app.get("/pay/checkout", async (req, res) => {
  const { email, plan, userId } = req.query;
  console.log("checkout:init", { email, plan, userId });

  if (!email || !plan || !userId) {
    return res.status(400).send("Missing email, plan, or userId");
  }

  const PLAN_AMOUNTS = {
    monthly: 8000 * 100,   // ₦8,000
    "6month": 45000 * 100, // ₦45,000
  };

  const amount = PLAN_AMOUNTS[plan];
  if (!amount) {
    return res.status(400).send(`Unknown plan: ${plan}`);
  }

  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount,
        metadata: { plan, userId },
        callback_url: `https://convenanthaven-alw5.onrender.com/pay/verify?userId=${userId}`,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = response.data;
    console.log("Paystack init response:", data);

    if (data.status && data.data.authorization_url) {
      res.redirect(data.data.authorization_url);
    } else {
      res.status(500).send("Failed to initialize checkout.");
    }
  } catch (error) {
    console.error("Paystack error:", error.response?.data || error.message);
    res.status(500).send("Checkout initialization failed.");
  }
});

// ✅ Route 3 — Verify Payment
app.get("/pay/verify", async (req, res) => {
  const { reference, userId } = req.query;
  console.log("verify:init", { reference, userId });

  if (!reference || !userId) {
    return res.status(400).send("Missing reference or userId");
  }

  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = response.data;
    console.log("verify:response", data);

    if (data.status && data.data.status === "success") {
      users[userId] = {
        subscription_status: "active",
        subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      // ✅ Return HTML success page
      return res.send(`
        <html>
          <body style="font-family:sans-serif;text-align:center;padding:40px;">
            <h2>✅ Payment Successful!</h2>
            <p>Your subscription is now <strong>active</strong>.</p>
            <script>
              window.parent.postMessage('payment-success', '*');
            </script>
          </body>
        </html>
      `);
    } else {
      return res.send(`
        <html>
          <body style="font-family:sans-serif;text-align:center;padding:40px;">
            <h2>❌ Payment Failed</h2>
            <p>${data.data.gateway_response}</p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error("verify:error", error.response?.data || error.message);
    res.status(500).send("Verification failed.");
  }
});

// ✅ Route 4 — Subscription Status
app.get("/status-page", (req, res) => {
  const userId = req.query.userId || "";
  const u = users[userId] || { subscription_status: "free" };
  const expires = u.subscription_expires_at
    ? `Expires: ${u.subscription_expires_at}`
    : "";

  res.send(`
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Subscription status</h2>
        <p><strong>User:</strong> ${userId}</p>
        <p><strong>Status:</strong> ${u.subscription_status}</p>
        <p>${expires}</p>
      </body>
    </html>
  `);
});

// ✅ Route 5 — Test Success (for Thunkable)
app.get("/pay/testsuccess", (req, res) => {
  res.send(`
    <html>
      <body style="font-family:Arial;text-align:center;padding:20px;">
        <h3>Test success page</h3>
        <button onclick="window.parent.postMessage('payment-success','*')">
          Send Test Message
        </button>
      </body>
    </html>
  `);
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server started on port ${PORT}`));
