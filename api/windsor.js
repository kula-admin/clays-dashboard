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

  const params = new URLSearchParams({ api_key: apiKey, fields: fields.join(',') });
  if (accounts?.[0]) params.set('account_id', accounts[0]);
  if (date_from)     params.set('date_from',  date_from);
  if (date_to)       params.set('date_to',    date_to);
  if (date_preset)   params.set('date_preset', date_preset);

  const url = `https://connectors.windsor.ai/${connector}?${params}`;

  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Windsor/1.0' } });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: `Windsor unreachable: ${err.message}` });
  }
}
