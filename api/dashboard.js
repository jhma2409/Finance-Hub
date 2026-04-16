// ============================================================
// api/dashboard.js — Vercel Serverless Function
// ============================================================
// GET  /api/dashboard  → Airtable에서 전체 목록 가져오기
// POST /api/dashboard  → Airtable에 새 대시보드 추가
// ============================================================

const TOKEN   = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE   = 'Dashboards';
const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!TOKEN || !BASE_ID) {
    return res.status(500).json({ error: 'Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID' });
  }

  try {
    // ── GET: 전체 목록 ──
    if (req.method === 'GET') {
      let allRecords = [];
      let offset = null;

      do {
        const params = new URLSearchParams({
          'sort[0][field]': 'SortOrder',
          'sort[0][direction]': 'asc',
          pageSize: '100',
        });
        if (offset) params.set('offset', offset);

        const r = await fetch(`${BASE_URL}?${params}`, { headers });
        if (!r.ok) throw new Error(`Airtable GET error: ${r.status}`);
        const data = await r.json();
        allRecords = allRecords.concat(data.records);
        offset = data.offset || null;
      } while (offset);

      const dashboards = allRecords.map(rec => ({
        id:          rec.id,
        name:        rec.fields.Name        || '',
        category:    rec.fields.Category    || '',
        url:         rec.fields.URL         || '',
        description: rec.fields.Description || '',
        department:  rec.fields.Department  || '',
        icon:        rec.fields.Icon        || '📌',
        addedAt:     rec.fields.DateAdded   || rec.createdTime?.split('T')[0] || '',
      }));

      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      return res.status(200).json({ dashboards });
    }

    // ── POST: 새 대시보드 추가 ──
    if (req.method === 'POST') {
      const { name, category, url, description, department, icon } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      const r = await fetch(BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          records: [{
            fields: {
              Name:        name,
              Category:    category    || '',
              URL:         url         || '',
              Description: description || '',
              Department:  department  || '',
              Icon:        icon        || '📌',
              SortOrder:   999,
              DateAdded:   new Date().toISOString().split('T')[0],
            }
          }]
        }),
      });

      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Airtable POST error: ${r.status} ${err}`);
      }

      const data = await r.json();
      const created = data.records[0];
      return res.status(201).json({
        dashboard: {
          id:          created.id,
          name:        created.fields.Name        || '',
          category:    created.fields.Category    || '',
          url:         created.fields.URL         || '',
          description: created.fields.Description || '',
          department:  created.fields.Department  || '',
          icon:        created.fields.Icon        || '📌',
          addedAt:     created.fields.DateAdded   || '',
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message });
  }
};
