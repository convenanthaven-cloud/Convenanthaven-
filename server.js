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
// Route 2 - Initialize Paystack Checkout (clean)
app.get('/pay/checkout', async (req, res) => {
  try {
    const email = (req.query.email || '').trim();
    const planRaw = (req.query.plan || '').toLowerCase();
    const userId = req.query.userId || 'user_1';

    if (!email) return res.status(400).send('Missing email');
    if (!planRaw) return res.status(400).send('Missing plan');

    const planKey = planRaw.replace(/[^a-z0-9]/g, '');
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

    const callbackUrl = `${process.env.APP_URL || 'https://convenanthaven-alw5.onrender.com'}/pay/verify?userId=${encodeURIComponent(userId)}`;

    const body = {
      email,
      amount,
      callback_url: callbackUrl,
      metadata: { userId, plan: planKey }
    };

    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.error('Missing PAYSTACK_SECRET_KEY in environment');
      return res.status(500).send('Server misconfigured: missing PAYSTACK_SECRET_KEY');
    }

    console.log('checkout:init - body:', JSON.stringify(body));

    const resp = await axios.post('https://api.paystack.co/transaction/initialize', body, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
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
