module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const OWNER = process.env.GH_OWNER || process.env.GITHUB_OWNER || '';
  const REPO = process.env.GH_REPO || process.env.GITHUB_REPO || '';
  const BRANCH = process.env.GH_BRANCH || process.env.GITHUB_BRANCH || 'main';
  if (!OWNER || !REPO || !TOKEN) { res.status(500).json({ error: 'Server not configured' }); return; }
  try {
    const body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
    let users = [];
    try { users = JSON.parse(body || '[]'); } catch { users = []; }
    if (!Array.isArray(users)) users = [];
    const contentText = JSON.stringify(users, null, 2);
    const shaResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/users.json?ref=${encodeURIComponent(BRANCH)}`, { headers });
    let sha = '';
    if (shaResp.ok) {
      const j = await shaResp.json();
      sha = j && j.sha ? j.sha : '';
    }
    const putBody = { message: 'Update users.json', content: Buffer.from(contentText, 'utf8').toString('base64'), branch: BRANCH };
    if (sha) putBody.sha = sha;
    const putResp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/users.json`, { method: 'PUT', headers, body: JSON.stringify(putBody) });
    if (!putResp.ok) {
      const t = await putResp.text();
      res.status(502).json({ error: 'GitHub write failed', details: t });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Internal error' });
  }
}
