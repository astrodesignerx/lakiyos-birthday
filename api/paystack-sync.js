// Vercel Serverless Function: backfills past successful Paystack transactions into the Google Sheet.
// Protected by GSHEET_WEBHOOK_SECRET so it cannot be triggered publicly.
const { recordGuestToSheet } = require('./_sheet');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedSecret = process.env.GSHEET_WEBHOOK_SECRET || '';
  if (!expectedSecret) {
    return res.status(400).json({ error: 'Set GSHEET_WEBHOOK_SECRET in Vercel to use paystack-sync.' });
  }

  const authHeader = String(req.headers.authorization || '');
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const querySecret = String(req.query?.secret || '').trim();
  if (bearer !== expectedSecret && querySecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return res.status(400).json({ error: 'PAYSTACK_SECRET_KEY is not configured.' });
  }
  if (!process.env.GSHEET_WEBHOOK_URL) {
    return res.status(400).json({ error: 'GSHEET_WEBHOOK_URL is not configured.' });
  }

  try {
    const upstream = await fetch('https://api.paystack.co/transaction?status=success&perPage=100', {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const payload = await upstream.json();
    if (!upstream.ok || !payload.status) {
      return res.status(502).json({ error: payload.message || 'Failed to fetch Paystack transactions.' });
    }

    const txs = Array.isArray(payload.data) ? payload.data : [];
    let synced = 0;
    const errors = [];

    for (const tx of txs) {
      const meta = tx.metadata || {};
      const result = await recordGuestToSheet({
        name: meta.guest_name || tx.customer?.first_name || 'Guest',
        phone: meta.guest_phone || tx.customer?.phone || '',
        method: 'Paystack STK',
        status: 'Paid',
        reference: tx.reference || '',
        code: tx.receipt_number || tx.authorization?.authorization_code || '',
        amount: Math.round((tx.amount || 100000) / 100),
        timestamp: tx.paid_at || tx.created_at || new Date().toISOString(),
      });
      if (result.logged) synced++;
      else errors.push({ reference: tx.reference, reason: result.reason || result.status });
    }

    return res.status(200).json({ ok: true, total: txs.length, synced, errors });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Sync failed.' });
  }
};
