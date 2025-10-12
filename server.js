toconst express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Make sure you add this key in Render Dashboard → Environment → PAYSTACK_SECRET_KEY
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const users = {};

// ✅ Route 1 — Basic Test
app.get('/', (req, res) => {
  res.send('Paystack Thunkable Demo Server Running ✅');
});

// ✅ Route 2 — Initialize Paystack Checkout
app.get('/pay/checkout', async (req, res) => {
  const { email, plan, userId } = req.query;

  if (!email || !plan || !userId) {
    return res.status(400).send('Missing email, plan, or userId');
  }

  const amount = plan === 'monthly' ? 2000 * 100 : 10000 * 100;

  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount,
        metadata: { plan, userId },
        callback_url: `https://convenanthaven-alw5.onrender.com/pay/verify?userId=${userId}`,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data;
    if (data.status) {
      res.redirect(data.data.authorization_url);
    } else {
      res.send('Checkout initialization failed.');
    }
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.send('Checkout initialization failed.');
  }
});

// ✅ Route 3 — Verify Payment
app.get('/pay/verify', async (req, res) => {
  const { reference, userId } = req.query;

  if (!reference) return res.status(400).send('Missing transaction reference');

  try {
    const verifyResponse = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });

    const data = verifyResponse.data;
    if (data.status && data.data.status === 'success') {
      users[userId] = {
        subscription_status: 'active',
        subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      res.send(`
        <script>
          window.opener.postMessage('payment_success', '*');
          window.close();
        </script>
      `);
    } else {
      res.send('Payment not successful');
    }
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.send('Verification failed');
  }
});

// ✅ Route 4 — Subscription Status Page
app.get('/status-page', (req, res) => {
  const userId = req.query.userId || '';
  const u = users[userId] || { subscription_status: 'free' };
  const status = u.subscription_status || 'free';
  const expires = u.subscription_expires_at
    ? `Expires: ${u.subscription_expires_at}`
    : '';

  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Subscription status</h2>
        <p><strong>User:</strong> ${userId}</p>
        <p><strong>Status:</strong> ${status}</p>
        <p>${expires}</p>
        <p>If this shows <em>active</em>, return to your app — your dashboard should be available.</p>
      </body>
    </html>
  `);
});

// ✅ Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
