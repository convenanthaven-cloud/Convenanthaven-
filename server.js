const express = require('express');

const cors = require('cors');

const bodyParser = require('body-parser');

const app = express();
// Safe environment values
const PORT = process.env.PORT || 3000;

// APP_URL: prefer explicit APP_URL env var, otherwise try Render's RENDER_EXTERNAL_URL
// and always remove a trailing slash safely.
const rawAppUrl = process.env.APP_URL || (process.env.RENDER_EXTERNAL_URL ? `https://${process.env.RENDER_EXTERNAL_URL}` : '');
const APP_URL = rawAppUrl ? rawAppUrl.replace(/\/$/, '') : '';

// You can log this once at startup to confirm
console.log('APP_URL:', APP_URL);

app.use(cors());

app.use(bodyParser.json());

app.get('/', (req, res) => {

  res.send('Paystack Thunkable Demo Server Running');

});

// later you will add your paystack endpoints here

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
// --- Paystack quick checkout redirect endpoint ---
// GET /pay/checkout?email=<email>&plan=monthly|6month&userId=<userId>
app.get('/pay/checkout', async (req, res) => {
  try {
    const email = req.query.email;
    const plan = req.query.plan; // "monthly" or "6month"
    const userId = req.query.userId;

    if (!email || !plan || !userId) {
      return res.status(400).send('Missing email, plan or userId');
    }

    const planCode = plan === 'monthly'
      ? process.env.PLAN_MONTHLY_CODE
      : process.env.PLAN_6MONTH_CODE;

    if (!planCode) return res.status(500).send('Server not configured with plan codes');

const callbackUrl = `${APP_URL}/paystack/callback?userId=${encodeURIComponent(userId)}`;

    // Initialize transaction with Paystack
    const initResp = await axios.post('https://api.paystack.co/transaction/initialize', {
      email,
      plan: planCode,
      callback_url: callbackUrl
    }, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' }
    });

    const authUrl = initResp.data?.data?.authorization_url;
    if (!authUrl) return res.status(500).send('No authorization URL returned by Paystack');

    // Save initial reference (optional demo - in-memory)
    const reference = initResp.data?.data?.reference;
    if (userId) {
      if (!users[userId]) users[userId] = { email, subscription_status: 'free' };
      users[userId].last_init_reference = reference;
    }

    // Redirect the client (WebViewer) to Paystack checkout page
    return res.redirect(authUrl);
  } catch (err) {
    console.error('Checkout init error', err.response?.data || err.message);
    return res.status(500).send('Checkout initialization failed');
  }
});

// --- Status page the WebViewer can load to show real server state ---
// GET /status-page?userId=<userId>
app.get('/status-page', (req, res) => {
  const userId = req.query.userId || '';
  const u = users[userId] || { subscription_status: 'free' };
  const status = u.subscription_status || 'free';
  const expires = u.subscription_expires_at ? `Expires: ${u.subscription_expires_at}` : '';

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
  

