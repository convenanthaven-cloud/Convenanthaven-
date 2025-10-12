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

// Route 2 — Initialize Paystack Checkout (clean, robust)
app.get('/pay/checkout', async (req, res) => {
  try {
    // Read query params (safe defaults)
    const email = req.query.email || '';
    const planRaw = (req.query.plan || '').toLowerCase();
    const userId = req.query.userId || 'user_1';

    if (!email) return res.status(400).send('Missing email');
    if (!planRaw) return res.status(400).send('Missing plan');

    // Normalize plan key variants (accept: monthly, 6month, sixmonth, 6-month)
    const planKey = planRaw.replace(/[^a-z0-9]/g, ''); // removes hyphens etc
    const PLAN_AMOUNTS = {
      monthly: 8000 * 100,    // 800000 kobo => ₦8,000
      '6month': 45000 * 100,  // 4500000 kobo => ₦45,000
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

    console.log('checkout:init - body:', JSON.stringify(body));

    const resp = await axios.post('https://api.paystack.co/transaction/initialize', body, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('checkout:init - paystack response status:', resp.data?.status);
    console.log('checkout:init -
