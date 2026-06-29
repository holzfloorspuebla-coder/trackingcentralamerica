// routes/projects.js
const router = require('express').Router();
const db     = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

async function audit(userId, action, entity, entityId, payload) {
  await db.q(
    'INSERT INTO audit_log (user_id,action,entity,entity_id,payload) VALUES ($1,$2,$3,$4,$5)',
    [userId, action, entity, entityId, JSON.stringify(payload)]
  );
}

// GET /api/projects?country=&phase=&date=YYYY-MM
router.get('/', requireAuth, async (req, res) => {
  try {
    const { country, phase } = req.query;
    const date = req.query.date || new Date().toISOString().slice(0,7);
    const params = [date];
    let where = '';
    if (country) { params.push(country); where += ` AND p.country_code = $${params.length}`; }
    if (phase && phase !== 'all' && phase !== 'mature') {
      params.push(phase); where += ` AND ps.phase = $${params.length}`;
    }
    if (phase === 'mature') {
      where += ` AND p.start_date <= (CURRENT_DATE - INTERVAL '3 years')`;
    }

    const rows = await db.q(
      `SELECT p.*,
         ps.phase, ps.notes AS phase_notes, ps.snapshot_date AS phase_date,
         c.name  AS client_name,
         co.name AS country_name
       FROM projects p
       LEFT JOIN project_snapshots ps ON ps.project_id = p.id
         AND ps.snapshot_date = (
           SELECT MAX(ps2.snapshot_date) FROM project_snapshots ps2
           WHERE ps2.project_id = p.id AND ps2.snapshot_date <= $1
         )
       LEFT JOIN clients  c  ON c.id   = p.client_id
       LEFT JOIN countries co ON co.code = p.country_code
       WHERE 1=1 ${where}
       ORDER BY p.country_code, p.name`,
      params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/projects/summary/all?date=YYYY-MM
router.get('/summary/all', requireAuth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0,7);
    const rows = await db.q(
      `SELECT p.country_code, ps.phase,
         COUNT(*)         AS count,
         SUM(p.value_usd) AS total_value
       FROM projects p
       LEFT JOIN project_snapshots ps ON ps.project_id = p.id
         AND ps.snapshot_date = (
           SELECT MAX(ps2.snapshot_date) FROM project_snapshots ps2
           WHERE ps2.project_id = p.id AND ps2.snapshot_date <= $1
         )
       GROUP BY p.country_code, ps.phase`,
      [date]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/projects/:id
router.get('/:id', requireAuth, async (req, res) => {
  const row = await db.q1('SELECT * FROM projects WHERE id = $1', [+req.params.id]);
  if (!row) return res.status(404).json({ error: 'No encontrado' });
  res.json(row);
});

// GET /api/projects/:id/history
router.get('/:id/history', requireAuth, async (req, res) => {
  res.json(await db.q(
    'SELECT * FROM project_snapshots WHERE project_id = $1 ORDER BY snapshot_date ASC',
    [+req.params.id]
  ));
});

// POST /api/projects
router.post('/', requireAuth, requireRole('admin','editor'), async (req, res) => {
  try {
    const { name, country_code, client_id, description, value_usd, start_date, phase, snapshot_date } = req.body;
    const row = await db.q1(
      `INSERT INTO projects (name,country_code,client_id,description,value_usd,start_date,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [name, country_code, client_id||null, description||null, value_usd||null, start_date||null, req.user.id]
    );
    const pid  = row.id;
    const date = snapshot_date || new Date().toISOString().slice(0,7);
    await db.q(
      'INSERT INTO project_snapshots (project_id,snapshot_date,phase,recorded_by) VALUES ($1,$2,$3,$4)',
      [pid, date, phase || 'pending', req.user.id]
    );
    await audit(req.user.id, 'INSERT', 'projects', pid, req.body);
    res.json({ id: pid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/projects/:id
router.put('/:id', requireAuth, requireRole('admin','editor'), async (req, res) => {
  try {
    const { name, country_code, client_id, description, value_usd, start_date } = req.body;
    await db.q(
      `UPDATE projects SET name=$1,country_code=$2,client_id=$3,
       description=$4,value_usd=$5,start_date=$6 WHERE id=$7`,
      [name, country_code, client_id||null, description||null, value_usd||null, start_date||null, +req.params.id]
    );
    await audit(req.user.id, 'UPDATE', 'projects', +req.params.id, req.body);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projects/:id/snapshot
router.post('/:id/snapshot', requireAuth, requireRole('admin','editor'), async (req, res) => {
  try {
    const { snapshot_date, phase, notes } = req.body;
    const date = snapshot_date || new Date().toISOString().slice(0,7);
    await db.q('DELETE FROM project_snapshots WHERE project_id=$1 AND snapshot_date=$2', [+req.params.id, date]);
    const row = await db.q1(
      'INSERT INTO project_snapshots (project_id,snapshot_date,phase,notes,recorded_by) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [+req.params.id, date, phase, notes||null, req.user.id]
    );
    await audit(req.user.id, 'INSERT', 'project_snapshots', row.id, req.body);
    res.json({ id: row.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/projects/:id
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.q('DELETE FROM project_snapshots WHERE project_id=$1', [+req.params.id]);
  await db.q('DELETE FROM projects WHERE id=$1', [+req.params.id]);
  await audit(req.user.id, 'DELETE', 'projects', +req.params.id, {});
  res.json({ ok: true });
});

module.exports = router;
