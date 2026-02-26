module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const OWNER = process.env.GH_OWNER || process.env.GITHUB_OWNER || '';
  const REPO = process.env.GH_REPO || process.env.GITHUB_REPO || '';
  const BRANCH = process.env.GH_BRANCH || process.env.GITHUB_BRANCH || 'main';
  if (!OWNER || !REPO) { res.status(500).json({ error: 'Server not configured' }); return; }
  try {
    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${encodeURIComponent(BRANCH)}/users.json`;
    if (r.ok) {
      const txt = await r.text();
      try {
        const json = JSON.parse(txt || '[]');
        res.status(200).json(Array.isArray(json) ? json : []);
        return;
      } catch {
        res.status(200).json([]);
        return;
      }
    }
  } catch {}
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/users.json?ref=${encodeURIComponent(BRANCH)}`;
    if (!r2.ok) { res.status(200).json([]); return; }
    const data = await r2.json();
    if (data && data.content) {
      const b64 = data.content;
      const buf = Buffer.from(b64, 'base64').toString('utf8');
      try {
        const json = JSON.parse(buf || '[]');
        res.status(200).json(Array.isArray(json) ? json : []);
        return;
      } catch {}
    }
    res.status(200).json([]);
  } catch {
    res.status(200).json([]);
  }
}
