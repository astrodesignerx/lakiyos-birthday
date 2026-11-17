// Vercel Serverless Function: receives Paystack charge.success webhooks, logs to Google Sheets, and emails Ivy.
const crypto = require('crypto');
const { recordGuestToSheet } = require('./_sheet');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return res.status(200).json({ ok: true, ignored: 'no secret key' });

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const signature = req.headers['x-paystack-signature'];
  if (signature) {
    const expected = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
    if (signature !== expected) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const event = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (event.event === 'charge.success') {
    const tx = event.data || {};
    const meta = tx.metadata || {};
    const guestName = meta.guest_name || 'Guest';
    const guestPhone = meta.guest_phone || tx.customer?.phone || '';
    const amountKes = Math.round((tx.amount || 100000) / 100);
    const reference = tx.reference || '';
    const mpesaReceipt = tx.receipt_number || tx.authorization?.authorization_code || '';

    const tasks = [
      recordGuestToSheet({
        name: guestName,
        phone: guestPhone,
        method: 'Paystack STK',
        status: 'Paid',
        reference,
        code: mpesaReceipt,
        amount: amountKes,
        timestamp: tx.paid_at || tx.created_at || new Date().toISOString(),
      }),
    ];

    const resendKey = process.env.RESEND_API_KEY;
    const ivyEmail = process.env.IVY_EMAIL;
    if (resendKey && ivyEmail) {
      const fromEmail = process.env.RESEND_FROM || 'Ivy Birthday <onboarding@resend.dev>';
      tasks.push(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [ivyEmail],
            subject: `Ksh ${amountKes} Reservation Paid — ${guestName}`,
            html: `<p><strong>${guestName}</strong> (${guestPhone || 'N/A'}) paid <strong>Ksh ${amountKes}</strong> via M-Pesa.</p><p>Reference: ${reference}</p>`,
          }),
        })
      );
    }

    await Promise.allSettled(tasks);
  }

  return res.status(200).json({ received: true });
};
