// ============================================================
// api/dashboard/[id].js — Vercel Serverless Function
// ============================================================
// DELETE /api/dashboard/recXXXXXXXX  → Airtable 레코드 삭제
// ============================================================

const TOKEN   = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE   = 'Dashboards';
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!TOKEN || !BASE_ID) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const { id } = req.query;

  if (req.method === 'DELETE') {
    try {
      const r = await fetch(`${BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      });

      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Airtable DELETE error: ${r.status} ${err}`);
      }

      return res.status(200).json({ deleted: true, id });

    } catch (error) {
      console.error('DELETE error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
