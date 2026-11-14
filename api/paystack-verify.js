// Vercel Serverless Function: verifies a Paystack M-Pesa charge status and emails Ivy on success.
async function sendEmailNotification({ guestName, guestPhone, amountKes, reference, mpesaReceipt }) {
  const resendKey = process.env.RESEND_API_KEY;
  const ivyEmail = process.env.IVY_EMAIL;
  if (!resendKey || !ivyEmail) return false;

  const fromEmail = process.env.RESEND_FROM || 'Ivy Birthday <onboarding@resend.dev>';
  const subject = `Ksh ${amountKes} Reservation Fee Paid — ${guestName}`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:20px;background:#0b0d12;color:#fff;border-radius:12px;">
      <h2 style="margin-top:0;color:#eef1f6;">Reservation Payment Confirmed</h2>
      <p><strong>Guest:</strong> ${guestName}</p>
      <p><strong>Phone:</strong> ${guestPhone}</p>
      <p><strong>Amount:</strong> Ksh ${amountKes}</p>
      <p><strong>Reference:</strong> ${reference}</p>
      ${mpesaReceipt ? `<p><strong>M-Pesa Receipt:</strong> ${mpesaReceipt}</p>` : ''}
      <p style="color:#b8c0ce;font-size:13px;margin-top:20px;">Ivy's Birthday · 28 November 2026 · Zonetria</p>
    </div>
  `;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail, to: [ivyEmail], subject, html }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const reference = String(req.query?.reference || '').trim();
  if (!secretKey) return res.status(400).json({ error: 'Paystack not configured.' });
  if (!reference) return res.status(400).json({ error: 'Missing reference.' });

  try {
    const upstream = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      }
    );
    const data = await upstream.json();
    const tx = data.data || {};
    const status = tx.status || 'pending'; // 'success' | 'failed' | 'ongoing' | 'pending' | 'abandoned'

    if (status === 'success') {
      const meta = tx.metadata || {};
      const guestName = meta.guest_name || 'Guest';
      const guestPhone = meta.guest_phone || tx.customer?.phone || '';
      const mpesaReceipt = tx.receipt_number || tx.authorization?.authorization_code || '';
      await sendEmailNotification({
        guestName,
        guestPhone,
        amountKes: Math.round((tx.amount || 100000) / 100),
        reference,
        mpesaReceipt,
      });
    }

    return res.status(200).json({
      status,
      gateway_response: tx.gateway_response || '',
      receipt: tx.receipt_number || '',
      amount: tx.amount ? Math.round(tx.amount / 100) : 1000,
    });
  } catch {
    return res.status(500).json({ error: 'Could not verify transaction status.' });
  }
};
