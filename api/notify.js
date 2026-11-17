// Vercel Serverless Function: logs direct M-Pesa confirmations to Google Sheets and sends an optional email notification.
const { recordGuestToSheet } = require('./_sheet');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const name = String(body.name || 'Guest').trim();
    const code = String(body.code || '').trim();
    const phone = String(body.phone || '').trim();

    const cleanCode = code.replace(/\s+/g, '').toUpperCase();
    const reference = cleanCode
      ? `direct-${cleanCode}`
      : `direct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const sheetTask = recordGuestToSheet({
      name,
      phone,
      method: 'Direct M-Pesa',
      status: 'Pending Verification',
      reference,
      code: code || 'Not provided',
      amount: 1000,
    });

    const resendKey = process.env.RESEND_API_KEY;
    const ivyEmail = process.env.IVY_EMAIL;
    const emailTask = (resendKey && ivyEmail)
      ? fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || 'Ivy Birthday <onboarding@resend.dev>',
            to: [ivyEmail],
            subject: `Reservation Fee Sent (Ksh 1,000) — ${name}`,
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:20px;background:#0b0d12;color:#fff;border-radius:12px;">
                <h2 style="margin-top:0;color:#eef1f6;">Direct M-Pesa Payment Notice</h2>
                <p><strong>Guest:</strong> ${name}</p>
                <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
                <p><strong>M-Pesa Code:</strong> ${code || 'Not provided'}</p>
                <p><strong>Amount:</strong> Ksh 1,000</p>
              </div>
            `,
          }),
        }).then((r) => r.ok)
      : Promise.resolve(false);

    const [sheetResult, emailResult] = await Promise.allSettled([sheetTask, emailTask]);

    return res.status(200).json({
      logged: sheetResult.status === 'fulfilled' ? sheetResult.value.logged : false,
      emailed: emailResult.status === 'fulfilled' ? Boolean(emailResult.value) : false,
    });
  } catch {
    return res.status(200).json({ logged: false, emailed: false });
  }
};
