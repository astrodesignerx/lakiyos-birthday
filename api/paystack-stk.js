// Vercel Serverless Function: initiates a KES 1,000 M-Pesa STK Push via Paystack.
function normalizeKenyanPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return '+' + digits;
  if (digits.startsWith('0') && digits.length === 10) return '+254' + digits.slice(1);
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return '+254' + digits;
  return null;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const key = process.env.PAYSTACK_SECRET_KEY || '';
    return res.status(200).json({
      configured: Boolean(key),
      mode: key.startsWith('sk_live_') ? 'live' : key.startsWith('sk_test_') ? 'test' : 'none',
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return res.status(200).json({
      configured: false,
      fallback: true,
      message: 'Paystack live key is not configured yet. Please send directly to 0716 571 448.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const name = String(body.name || '').trim();
    const phone = normalizeKenyanPhone(body.phone);
    const emailInput = String(body.email || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'Please enter your name.' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'Enter a valid Kenyan M-Pesa number (e.g. 0712 345 678).' });
    }

    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)
      ? emailInput
      : `guest.${phone.slice(1)}@ivys-birthday.vercel.app`;

    const reference = `ivy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const upstream = await fetch('https://api.paystack.co/charge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: 100000, // Ksh 1,000 in cents/subunits
        currency: 'KES',
        reference,
        // Route the money to Ivy's Paystack subaccount (settles to her M-Pesa) when configured.
        ...(process.env.PAYSTACK_SUBACCOUNT
          ? { subaccount: process.env.PAYSTACK_SUBACCOUNT, bearer: 'subaccount' }
          : {}),
        mobile_money: {
          phone,
          provider: 'mpesa',
        },
        metadata: {
          guest_name: name,
          guest_phone: phone,
          event: "Ivy's Birthday",
          custom_fields: [
            { display_name: 'Guest Name', variable_name: 'guest_name', value: name },
            { display_name: 'M-Pesa Number', variable_name: 'guest_phone', value: phone },
          ],
        },
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok || !data.status) {
      return res.status(400).json({
        error: data.message || 'Could not send M-Pesa prompt. Try sending directly to 0716 571 448.',
        details: data,
      });
    }

    return res.status(200).json({
      configured: true,
      ok: true,
      reference: data.data?.reference || reference,
      status: data.data?.status || 'pay_offline',
      display_text:
        data.data?.display_text ||
        'Check your phone and enter your M-Pesa PIN to complete the Ksh 1,000 payment.',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error while sending M-Pesa prompt.' });
  }
};
