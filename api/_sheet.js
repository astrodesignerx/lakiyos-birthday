// Shared helper (not an exposed Vercel route because filename starts with `_`).
// Sends guest payment/confirmation records to a Google Apps Script Web App.

async function recordGuestToSheet({
  name,
  phone = '',
  method,
  status,
  reference = '',
  code = '',
  amount = 1000,
  timestamp = new Date().toISOString(),
}) {
  const url = process.env.GSHEET_WEBHOOK_URL;
  if (!url) {
    return { logged: false, reason: 'GSHEET_WEBHOOK_URL not set' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
      body: JSON.stringify({
        secret: process.env.GSHEET_WEBHOOK_SECRET || '',
        timestamp,
        name: String(name || 'Guest').trim(),
        phone: String(phone || '').trim(),
        method: String(method || '').trim(),
        status: String(status || '').trim(),
        reference: String(reference || '').trim(),
        code: String(code || '').trim(),
        amount: Number(amount) || 1000,
      }),
    });

    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    return {
      logged: res.ok && (!parsed || parsed.ok !== false),
      status: res.status,
      data: parsed,
    };
  } catch (err) {
    return { logged: false, reason: err?.message || 'fetch failed' };
  }
}

module.exports = { recordGuestToSheet };
