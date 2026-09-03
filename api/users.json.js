module.exports = function handler(req, res) {
  res.setHeader('Allow', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Kept only as an inert compatibility endpoint for the public V1 demo.
  res.status(200).json([]);
};
