// Vercel Serverless Function: sends an optional email notification when a guest confirms direct M-Pesa payment.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const ivyEmail = process.env.IVY_EMAIL;
  if (!resendKey || !ivyEmail) {
    return res.status(200).json({ emailed: false });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const name = String(body.name || 'Guest').trim();
    const code = String(body.code || 'Not provided').trim();
    const phone = String(body.phone || 'Not provided').trim();
    const fromEmail = process.env.RESEND_FROM || 'Ivy Birthday <onboarding@resend.dev>';

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [ivyEmail],
        subject: `Reservation Fee Sent (Ksh 1,000) — ${name}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:20px;background:#0b0d12;color:#fff;border-radius:12px;">
            <h2 style="margin-top:0;color:#eef1f6;">Direct M-Pesa Payment Notice</h2>
            <p><strong>Guest:</strong> ${name}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>M-Pesa Code:</strong> ${code}</p>
            <p><strong>Amount:</strong> Ksh 1,000</p>
          </div>
        `,
      }),
    });

    return res.status(200).json({ emailed: r.ok });
  } catch {
    return res.status(200).json({ emailed: false });
  }
};
