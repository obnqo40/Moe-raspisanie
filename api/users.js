module.exports = function handler(req, res) {
  res.setHeader('Allow', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.status(410).json({
    error: 'Remote user writes are disabled in the public V1 demo.'
  });
};
