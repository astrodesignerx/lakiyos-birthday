// Vercel Serverless Function: private guest list.
// Reads successful reservation payments straight from Paystack, so there is nothing else to keep in sync.
// Guests who paid Ivy directly on M-Pesa can be added by hand (POST) and removed (DELETE); those entries
// live in a private Vercel Blob store (BLOB_READ_WRITE_TOKEN), one small JSON file per guest under manual-guests/.
// Protected by GUESTS_PASSWORD (Vercel env var), sent as `Authorization: Bearer <password>`.
const crypto = require('crypto');
const { put, list, get, del } = require('@vercel/blob');

const PREFIX = 'manual-guests/';

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // One password per person who may open the list (GUESTS_PASSWORD for the host, GUESTS_PASSWORD_IVY for Ivy).
  const passwords = [process.env.GUESTS_PASSWORD, process.env.GUESTS_PASSWORD_IVY].filter(Boolean);
  if (!passwords.length) {
    return res.status(503).json({ error: 'The guest list password is not set up yet.' });
  }

  const auth = String(req.headers.authorization || '');
  const given = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const matches = passwords.map((p) => (given ? safeEqual(given, p) : false));
  if (!matches.some(Boolean)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return res.status(401).json({ error: 'Wrong password.' });
  }

  // Who is signed in, recorded on manual entries.
  const who = process.env.GUESTS_PASSWORD_IVY && given && safeEqual(given, process.env.GUESTS_PASSWORD_IVY) ? 'Ivy' : 'Host';

  if (req.method === 'POST') return addManual(req, res, who);
  if (req.method === 'DELETE') return removeManual(req, res);

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
          source: 'paystack',
        };
      })
      .concat(await loadManual())
      .sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));

    const total = guests.reduce((sum, g) => sum + g.amount, 0);
    return res.status(200).json({ ok: true, count: guests.length, total, guests, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Could not load the guest list.' });
  }
};

// ---- Manual entries (paid Ivy directly) ----

function blobReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function loadManual() {
  if (!blobReady()) return [];
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const entries = await Promise.all(blobs.map(async (b) => {
    try {
      const r = await get(b.pathname, { access: 'private', useCache: false });
      if (!r || !r.stream) return null;
      return await new Response(r.stream).json();
    } catch (e) {
      return null;
    }
  }));
  return entries.filter(Boolean).map((g) => ({ ...g, source: 'manual' }));
}

async function addManual(req, res, who) {
  if (!blobReady()) return res.status(503).json({ error: 'Storage for manual guests is not set up yet.' });
  let body;
  try { body = await readBody(req); } catch (e) { return res.status(400).json({ error: 'Bad request.' }); }

  const name = String(body.name || '').trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: "Enter the guest's name." });
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) {
    return res.status(400).json({ error: 'Enter a valid amount.' });
  }
  const paidAt = body.paidAt && !isNaN(new Date(body.paidAt)) ? new Date(body.paidAt).toISOString() : new Date().toISOString();

  const id = Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
  const entry = {
    id,
    name,
    phone: String(body.phone || '').trim().slice(0, 30),
    email: '',
    amount,
    currency: 'KES',
    channel: 'M-Pesa (direct)',
    paidAt,
    reference: '',
    receipt: String(body.receipt || '').trim().toUpperCase().slice(0, 30),
    note: String(body.note || '').trim().slice(0, 200),
    addedBy: who,
    addedAt: new Date().toISOString(),
  };
  try {
    await put(PREFIX + id + '.json', JSON.stringify(entry), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Could not save the guest.' });
  }
  return res.status(200).json({ ok: true, guest: { ...entry, source: 'manual' } });
}

async function removeManual(req, res) {
  if (!blobReady()) return res.status(503).json({ error: 'Storage for manual guests is not set up yet.' });
  const id = String(req.query?.id || '').trim();
  if (!/^[a-z0-9]{8,40}$/.test(id)) return res.status(400).json({ error: 'Bad id.' });
  try {
    await del(PREFIX + id + '.json');
  } catch (e) {
    return res.status(500).json({ error: 'Could not remove the guest.' });
  }
  return res.status(200).json({ ok: true });
}
