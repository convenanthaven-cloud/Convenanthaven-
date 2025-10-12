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

// Route: Initialize Paystack Checkout (with debug logging)
app.get('/pay/checkout', async (req, res) => {
  try {
    const { email = '', plan = '', userId = 'user_1' } = req.query;
    const planKey = (plan || '').toLowerCase().replace(/-/g, '');

    if (!email) return res.status(400).send('Missing email');

    // DEBUG: explicit mapping (Kobo)
    const PLAN_AMOUNTS = {
      monthly: 8000 * 100,   // 800000 kobo => ₦8,000
      '6month': 45000 * 100, // 4500000 kobo => ₦45,000
      sixmonth: 45000 * 100
    };

    // Force the amount from mapping (defensive)
    const amount = PLAN_AMOUNTS[planKey];

    // Log what we received and what we will send
    console.log('checkout:init - incoming', { email, plan, planKey, userId });
    console.log('checkout:init - amount to send (kobo):', amount);

    if (!amount) {
      return res.status(400).send(`Unknown plan "${plan}". Use plan=monthly or plan=6month.`);
    }

    const callbackUrl = `${process.env.APP_URL || 'https://convenanthaven-alw5.onrender.com'}/pay/verify?userId=${encodeURIComponent(userId)}`;

    const body = { email, amount, callback_url: callbackUrl, metadata: { userId, plan: planKey } };

    // Log the exact payload
    console.log('checkout:init - body:', JSON.stringify(body));

    const resp = await axios.post('https://api.paystack.co/transaction/initialize', body, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    // Log Paystack's response (especially the amount returned)
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
