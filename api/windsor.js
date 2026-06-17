/**
 * Vercel Serverless Function — Windsor API proxy
 * Set environment variable WINDSOR_API_KEY in Vercel project settings.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { connector, fields, accounts, date_from, date_to, date_preset } = req.body;

  if (!connector || !fields?.length) {
    return res.status(400).json({ error: 'connector and fields are required' });
  }

  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'WINDSOR_API_KEY not configured' });
  }

  const accountId = accounts?.[0];

  // Always request account_id from Windsor so we can filter rows client-side
  const requestedFields = fields.includes('account_id') ? fields : [...fields, 'account_id'];

  const params = new URLSearchParams({ api_key: apiKey, fields: requestedFields.join(',') });
  if (accountId) {
    params.set('account_id', accountId);
    params.append('accounts[]', accountId);
  }
  if (date_from)   params.set('date_from',  date_from);
  if (date_to)     params.set('date_to',    date_to);
  if (date_preset) params.set('date_preset', date_preset);

  const url = `https://connectors.windsor.ai/${connector}?${params}`;
  console.log(`[windsor] ${connector} account=${accountId} url=${url.replace(apiKey, 'REDACTED')}`);

  let data;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Windsor/1.0' } });
    data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
  } catch (err) {
    console.error(`[windsor] ${connector} fetch error: ${err.message}`);
    return res.status(502).json({ error: `Windsor unreachable: ${err.message}` });
  }

  const rows = data?.data ?? [];
  console.log(`[windsor] ${connector} total rows=${rows.length} sample account_id=${rows[0]?.account_id ?? 'none'}`);

  // Filter rows to requested account if Windsor's query param didn't do it
  const filtered = accountId && rows.some(r => r.account_id)
    ? rows.filter(r => String(r.account_id) === String(accountId))
    : rows;

  console.log(`[windsor] ${connector} filtered rows=${filtered.length}`);

  return res.status(200).json({ ...data, data: filtered });
}
