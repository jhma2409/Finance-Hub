// ============================================================
// api/dashboard.js — Vercel Serverless Function (v2.1)
// ============================================================
// GET  /api/dashboard  → Airtable에서 전체 목록 가져오기
// POST /api/dashboard  → Airtable에 새 대시보드 추가
// ============================================================

const TOKEN   = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE   = process.env.AIRTABLE_TABLE_NAME || 'Dashboards';
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
        const params = new URLSearchParams({ pageSize: '100' });
        if (offset) params.set('offset', offset);

        const r = await fetch(`${BASE_URL}?${params}`, { headers });
        if (!r.ok) {
          const errBody = await r.text();
          console.error('Airtable GET error:', r.status, errBody);
          throw new Error(`Airtable GET error: ${r.status}`);
        }
        const data = await r.json();
        allRecords = allRecords.concat(data.records);
        offset = data.offset || null;
      } while (offset);

      const dashboards = allRecords.map(rec => ({
        id:          rec.id,
        name:        rec.fields.Name        || rec.fields.name        || '',
        category:    rec.fields.Category    || rec.fields.category    || '',
        url:         rec.fields.URL         || rec.fields.Url         || rec.fields.url || '',
        description: rec.fields.Description || rec.fields.description || '',
        department:  rec.fields.Department  || rec.fields.department  || '',
        icon:        rec.fields.Icon        || rec.fields.icon        || '📌',
        addedAt:     rec.fields.DateAdded   || rec.fields.Date        || rec.createdTime?.split('T')[0] || '',
      }));

      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      return res.status(200).json({ dashboards });
    }

    // ── POST: 새 대시보드 추가 ──
    if (req.method === 'POST') {
      const { name, category, url, description, department, icon } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      // ⚠️ typecast: true → Airtable이 자동으로 single-select 옵션을 생성/변환
      // SortOrder 필드는 제거 (없는 필드 전송 시 422 에러)
      const r = await fetch(BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          typecast: true,
          records: [{
            fields: {
              Name:        name,
              Category:    category    || '',
              URL:         url         || '',
              Description: description || '',
              Department:  department  || '',
              Icon:        icon        || '📌',
              DateAdded:   new Date().toISOString().split('T')[0],
            }
          }]
        }),
      });

      if (!r.ok) {
        const err = await r.text();
        console.error('Airtable POST error:', r.status, err);
        return res.status(r.status).json({
          error: `Airtable POST error: ${r.status}`,
          detail: err
        });
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
