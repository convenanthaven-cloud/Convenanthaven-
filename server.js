// server.js - Clean, robust Paystack demo for Thunkable/WebViewer
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Ensure you set these in Render: PAYSTACK_SECRET_KEY and APP_URL
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const APP_URL = process.env.APP_URL || 'https://convenanthaven-alw5.onrender.com';

const users = {}; // simple in-memory store for demo only

// Route 1 - Basic test
app.get('/', (req, res) => {
  res.send('Paystack Thunkable Demo Server Running ✅');
});

// Route 2 - Initialize Paystack Checkout (clean)
app.get('/pay/checkout', async (req, res) => {
  try {
    const email = (req.query.email || '').trim();
    const planRaw = (req.query.plan || '').toLowerCase();
    const userId = req.query.userId || 'user_1';

    if (!email) return res.status(400).send('Missing email');
    if (!planRaw) return res.status(400).send('Missing plan');

    // Normalize plan variants
    const planKey = planRaw.replace(/[^a-z0-9]/g, ''); // remove hyphens etc
    const PLAN_AMOUNTS = {
      monthly: 8000 * 100,   // 800000 kobo => ₦8,000
      '6month': 45000 * 100, // 4500000 kobo => ₦45,000
      sixmonth: 45000 * 100
    };

    const amount = PLAN_AMOUNTS[planKey];
    console.log('checkout:init - incoming', { email, planRaw, planKey, userId });
    console.log('checkout:init - amount to send (kobo):', amount);

    if (!amount) {
      return res.status(400).send(`Unknown plan "${req.query.plan}". Use plan=monthly or plan=6month.`);
    }

    const callbackUrl = `${APP_URL.replace(/\/$/, '')}/pay/verify?userId=${encodeURIComponent(userId)}`;

    const body = {
      email,
      amount,
      callback_url: callbackUrl,
      metadata: { userId, plan: planKey }
    };

    console.log('checkout:init - body:', JSON.stringify(body));

    // Must have PAYSTACK_SECRET_KEY set in Render environment
    if (!PAYSTACK_SECRET_KEY) {
      console.error('Missing PAYSTACK_SECRET_KEY in environment');
      return res.status(500).send('Server misconfigured: missing PAYSTACK_SECRET_KEY');
    }

    const resp = await axios.post('https://api.paystack.co/transaction/initialize', body, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('checkout:init - paystack response status:', resp.data?.status);
    console.log('checkout:init - paystack resp.data.data.amount (kobo):', resp.data?.data?.amount);
    console.log('checkout:init - paystack authorization_url:', resp.data?.data?.authorization_url);

    if (resp.data && resp.data.status && resp.data.data && resp.data.data.authorization_url) {
      return res.redirect(resp.data.data.authorization_url);
    } else {
      return res.status(500).send(`checkout initialization failed: ${resp.data?.message || 'no authorization_url'}`);
    }
  } catch (err) {
    console.error('checkout:init error:', err?.response?.data || err.message || err);
    return res.status(500).send(`checkout initialization failed: ${err?.response?.data?.message || err.message}`);
  }
});

// Route: Verify (called by Paystack redirect) — updates in-memory user store and returns a tiny page that posts to parent
app.get('/pay/verify', async (req, res) => {
  try {
    const userId = req.query.userId || 'user_1';
    // In a real app you would call Paystack verify endpoint with `reference` and confirm transaction
    // For demo: mark user as active and return a page that posts message to WebViewer parent
    users[userId] = { subscription_status: 'active', subscription_expires_at: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString() };
    console.log('verify: mark user active', { userId, users[userId] });

    // Return small page that will postMessage to parent (Thunkable WebViewer)
    res.send(`
      <html>
        <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body>
          <p>Payment verified. You can close this page.</p>
          <script>
            // notify parent (Thunkable WebViewer)
            try {
              window.parent.postMessage('payment-success', '*');
            } catch(e) { console.log('postMessage fail', e); }
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('verify error:', err?.response?.data || err.message || err);
    res.status(500).send('Verification failed');
  }
});

// Status page for debugging
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
      </body>
    </html>
  `);
});

// Test page that posts success (useful for Thunkable test)
app.get('/pay/testsuccess', (req, res) => {
  res.send(`
    <html>
      <body>
        <h3>Test success page</h3>
        <button onclick="window.parent.postMessage('payment-success', '*')">Send Test Message</button>
      </body>
    </html>
  `);
});

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server started on port \${PORT}\`);
});
