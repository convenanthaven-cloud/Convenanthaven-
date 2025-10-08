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
// TEMP TEST endpoint — use this to test Thunkable WebViewer postMessage works
app.get('/pay/testsuccess', (req, res) => {
  const userId = req.query.userId || 'user_1';
  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body>
        <h3>Test: posting message to parent</h3>
        <p>User: ${userId}</p>
        <script>
          // send a clear, simple message
          try {
            window.parent.postMessage("payment-success", "*");
          } catch(e) {
            // ignore
          }
        </script>
        <p>If running in a WebViewer, the app should receive "payment-success".</p>
      </body>
    </html>
  `);
});
// GET /status-page?userId=<userId>
// Server renders current subscription status and posts it to the WebViewer parent
app.get('/status-page', (req, res) => {
  const userId = req.query.userId || 'unknown';
  // Pull the current status from your DB or in-memory store
  const user = users[userId] || {};
  const status = user.subscription_status || 'free'; // e.g. 'active', 'free', 'past_due'
  // Send a minimal page that immediately posts message to parent
  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h3>Subscription status: ${status}</h3>
          <p>User: ${userId}</p>
        </div>
        <script>
          (function(){
            var msg = "subscription:${status}";
            try {
              window.parent.postMessage(msg, "*");
            } catch(e) {
              // ignore
            }
          })();
        </script>
      </body>
    </html>
  `);
});
// ---------- initialize checkout by amount (works without Paystack plan codes) ----------
const axios = require('axios'); // ensure axios is required at top of file

app.get('/pay/checkout', async (req, res) => {
  try {
    // read query params
    const email = req.query.email || '';
    const planParam = (req.query.plan || '').toLowerCase(); // "monthly" or "6month"
    const userId = req.query.userId || 'user_1';

    if (!email) {
      return res.status(400).send('Missing email');
    }

    // Map the textual plan to an amount in Kobo (Naira * 100)
    // YOUR PRICES: monthly = ₦8,000 ; six-month = ₦45,000
    const PLAN_AMOUNTS = {
      monthly: 8000 * 100,   // 800000 Kobo
      '6month': 45000 * 100  // 4500000 Kobo
    };

    const amount = PLAN_AMOUNTS[planParam];
    if (!amount) {
      return res.status(400).send(`Unknown plan "${planParam}". Use plan=monthly or plan=6month`);
    }

    // Paystack initialize payload
    const callbackUrl = `${APP_URL}/pay/verify?userId=${encodeURIComponent(userId)}`;

    const body = {
      email,
      amount,            // amount in Kobo
      callback_url: callbackUrl,
      // optional metadata for later reference
      metadata: { userId, plan: planParam }
    };

    // call Paystack initialize endpoint
    const resp = await axios.post('https://api.paystack.co/transaction/initialize', body, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    // Check Paystack response
    const initData = resp.data;
    if (!initData || !initData.status) {
      return res.status(500).send('Paystack initialize failed (no status).');
    }
    if (!initData.data || !initData.data.authorization_url) {
      // include Paystack message if available
      const message = initData.message || 'No authorization_url returned';
      return res.status(500).send(`checkout initialization failed: ${message}`);
    }

    // Redirect user to Paystack hosted payment page
    const authUrl = initData.data.authorization_url;
    return res.redirect(authUrl);

  } catch (err) {
    // log and return clear error so you can see it in Render logs
    console.error('Checkout init error:', err?.response?.data || err.message || err);
    // If Paystack returns an error in err.response.data, include it in response
    const detail = err?.response?.data ? JSON.stringify(err.response.data) : err.message;
    return res.status(500).send(`checkout initialization failed: ${detail}`);
  }
});

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
 // ✅ Verify payment endpoint
app.get('/pay/verify', async (req, res) => {
  try {
    const ref = req.query.reference;
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${ref}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    });

    const data = response.data.data;
    if (data.status === 'success') {
      // ✅ Payment successful – tell Thunkable WebViewer
      res.send(`
        <script>
          window.parent.postMessage("payment success", "*");
        </script>
      `);
    } else {
      // ❌ Payment failed
      res.send(`
        <script>
          window.parent.postMessage("payment failed", "*");
        </script>
      `);
    }
  } catch (error) {
    // ⚠️ Verification error
    res.send(`
      <script>
        window.parent.postMessage("verification error", "*");
      </script>
    `);
  }
});


