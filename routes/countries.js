// routes/countries.js
const router = require('express').Router();
const db     = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

async function audit(userId, action, entity, entityId, payload) {
  await db.q(
    'INSERT INTO audit_log (user_id,action,entity,entity_id,payload) VALUES ($1,$2,$3,$4,$5)',
    [userId, action, entity, entityId, JSON.stringify(payload)]
  );
}

// ── Countries list ────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  res.json(await db.q('SELECT * FROM countries ORDER BY region, name'));
});

// ── Country data ──────────────────────────────────────────────────────────

// GET /api/countries/:code/data?date=YYYY-MM
router.get('/:code/data', requireAuth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0,7);
  const row  = await db.q1(
    `SELECT * FROM country_data
     WHERE country_code = $1 AND snapshot_date <= $2
     ORDER BY snapshot_date DESC LIMIT 1`,
    [req.params.code, date]
  );
  res.json(row || null);
});

// GET /api/countries/:code/data/history
router.get('/:code/data/history', requireAuth, async (req, res) => {
  res.json(await db.q(
    'SELECT * FROM country_data WHERE country_code = $1 ORDER BY snapshot_date ASC',
    [req.params.code]
  ));
});

// POST /api/countries/:code/data
router.post('/:code/data', requireAuth, requireRole('admin','editor'), async (req, res) => {
  try {
    const { code } = req.params;
    const { snapshot_date, population, gdp_usd, notes } = req.body;
    const date = snapshot_date || new Date().toISOString().slice(0,7);
    // Upsert by deleting same month first
    await db.q('DELETE FROM country_data WHERE country_code=$1 AND snapshot_date=$2', [code, date]);
    const row = await db.q1(
      `INSERT INTO country_data (country_code,snapshot_date,population,gdp_usd,notes,recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [code, date, population || null, gdp_usd || null, notes || null, req.user.id]
    );
    await audit(req.user.id, 'INSERT', 'country_data', row.id, req.body);
    res.json({ id: row.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Segments ──────────────────────────────────────────────────────────────

router.get('/:code/segments', requireAuth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0,7);
  const row  = await db.q1(
    `SELECT * FROM segment_snapshots
     WHERE country_code = $1 AND snapshot_date <= $2
     ORDER BY snapshot_date DESC LIMIT 1`,
    [req.params.code, date]
  );
  res.json(row || null);
});

router.get('/:code/segments/history', requireAuth, async (req, res) => {
  res.json(await db.q(
    'SELECT * FROM segment_snapshots WHERE country_code=$1 ORDER BY snapshot_date ASC',
    [req.params.code]
  ));
});

router.post('/:code/segments', requireAuth, requireRole('admin','editor'), async (req, res) => {
  try {
    const { code } = req.params;
    const { snapshot_date, industry, home, retail, hospitality, data_center, health, notes } = req.body;
    const date = snapshot_date || new Date().toISOString().slice(0,7);
    await db.q('DELETE FROM segment_snapshots WHERE country_code=$1 AND snapshot_date=$2', [code, date]);
    const row = await db.q1(
      `INSERT INTO segment_snapshots
       (country_code,snapshot_date,industry,home,retail,hospitality,data_center,health,notes,recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [code, date, !!industry, !!home, !!retail, !!hospitality, !!data_center, !!health, notes || null, req.user.id]
    );
    await audit(req.user.id, 'INSERT', 'segment_snapshots', row.id, req.body);
    res.json({ id: row.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Competitors master ────────────────────────────────────────────────────

router.get('/competitors/all', requireAuth, async (req, res) => {
  res.json(await db.q('SELECT * FROM competitors ORDER BY name'));
});

router.post('/competitors/all', requireAuth, requireRole('admin','editor'), async (req, res) => {
  const row = await db.q1(
    'INSERT INTO competitors (name,notes) VALUES ($1,$2) RETURNING id',
    [req.body.name, req.body.notes || null]
  );
  res.json({ id: row.id });
});

// ── Competitor presence ───────────────────────────────────────────────────

router.get('/:code/competitors', requireAuth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0,7);
  const rows = await db.q(
    `SELECT cp.*, c.name AS competitor_name
     FROM competitor_presence cp
     JOIN competitors c ON c.id = cp.competitor_id
     WHERE cp.country_code = $1
       AND cp.snapshot_date = (
         SELECT MAX(cp2.snapshot_date) FROM competitor_presence cp2
         WHERE cp2.competitor_id = cp.competitor_id
           AND cp2.country_code  = cp.country_code
           AND cp2.snapshot_date <= $2
       )`,
    [req.params.code, date]
  );
  res.json(rows);
});

router.get('/:code/competitors/history', requireAuth, async (req, res) => {
  const rows = await db.q(
    `SELECT cp.*, c.name AS competitor_name
     FROM competitor_presence cp
     JOIN competitors c ON c.id = cp.competitor_id
     WHERE cp.country_code = $1
     ORDER BY cp.competitor_id, cp.snapshot_date ASC`,
    [req.params.code]
  );
  res.json(rows);
});

router.post('/:code/competitors', requireAuth, requireRole('admin','editor'), async (req, res) => {
  try {
    const { code } = req.params;
    const { competitor_id, snapshot_date, direct_presence, seller_factory, through_dealers, stock_in_country, notes } = req.body;
    const date = snapshot_date || new Date().toISOString().slice(0,7);
    await db.q(
      'DELETE FROM competitor_presence WHERE competitor_id=$1 AND country_code=$2 AND snapshot_date=$3',
      [competitor_id, code, date]
    );
    const row = await db.q1(
      `INSERT INTO competitor_presence
       (competitor_id,country_code,snapshot_date,direct_presence,seller_factory,through_dealers,stock_in_country,notes,recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [competitor_id, code, date, !!direct_presence, !!seller_factory, !!through_dealers, !!stock_in_country, notes || null, req.user.id]
    );
    await audit(req.user.id, 'INSERT', 'competitor_presence', row.id, req.body);
    res.json({ id: row.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
