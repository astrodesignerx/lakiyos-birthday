// Vercel Serverless Function: private guest list.
// Reads successful reservation payments straight from Paystack, so there is nothing else to keep in sync.
// Protected by GUESTS_PASSWORD (Vercel env var), sent as `Authorization: Bearer <password>`.
const crypto = require('crypto');

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // One password per person who may open the list (GUESTS_PASSWORD for the host, GUESTS_PASSWORD_IVY for Ivy).
  const passwords = [process.env.GUESTS_PASSWORD, process.env.GUESTS_PASSWORD_IVY].filter(Boolean);
  if (!passwords.length) {
    return res.status(503).json({ error: 'The guest list password is not set up yet.' });
  }

  const auth = String(req.headers.authorization || '');
  const given = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const allowed = given && passwords.map((p) => safeEqual(given, p)).some(Boolean);
  if (!allowed) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return res.status(401).json({ error: 'Wrong password.' });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return res.status(503).json({ error: 'Paystack is not configured.' });
  }

  try {
    const txs = [];
    for (let page = 1; page <= 20; page++) {
      const upstream = await fetch(
        `https://api.paystack.co/transaction?status=success&perPage=100&page=${page}`,
        { headers: { Authorization: `Bearer ${secretKey}` } }
      );
      const payload = await upstream.json();
      if (!upstream.ok || !payload.status) {
        return res.status(502).json({ error: payload.message || 'Could not load payments from Paystack.' });
      }
      const batch = Array.isArray(payload.data) ? payload.data : [];
      txs.push(...batch);
      const pageCount = payload.meta?.pageCount || 1;
      if (page >= pageCount || batch.length === 0) break;
    }

    const guests = txs
      .map((tx) => {
        const meta = tx.metadata || {};
        const customer = tx.customer || {};
        const email = String(customer.email || '');
        return {
          name: String(meta.guest_name || [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Guest').trim(),
          phone: String(meta.guest_phone || customer.phone || tx.authorization?.mobile_money_number || '').trim(),
          email: email.endsWith('@ivys-birthday.vercel.app') ? '' : email, // placeholder emails are not real
          amount: Math.round((Number(tx.amount) || 0) / 100),
          currency: tx.currency || 'KES',
          channel: tx.channel || '',
          paidAt: tx.paid_at || tx.paidAt || tx.created_at || '',
          reference: tx.reference || '',
          receipt: tx.receipt_number || '',
        };
      })
      .sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));

    const total = guests.reduce((sum, g) => sum + g.amount, 0);
    return res.status(200).json({ ok: true, count: guests.length, total, guests, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Could not load the guest list.' });
  }
};
