// routes/clients.js
const router = require('express').Router();
const db     = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

async function audit(userId, action, entity, entityId, payload) {
  await db.q(
    'INSERT INTO audit_log (user_id,action,entity,entity_id,payload) VALUES ($1,$2,$3,$4,$5)',
    [userId, action, entity, entityId, JSON.stringify(payload)]
  );
}

// GET /api/clients?country=&type=&date=YYYY-MM
router.get('/', requireAuth, async (req, res) => {
  try {
    const { country, type } = req.query;
    const date = req.query.date || new Date().toISOString().slice(0,7);
    const params = [date];
    let where = '';
    if (country) { params.push(country); where += ` AND c.country_code = $${params.length}`; }
    if (type)    { params.push(type);    where += ` AND c.client_type  = $${params.length}`; }

    const rows = await db.q(
      `SELECT c.*,
         cs.has_stock, cs.num_salespeople, cs.active,
         cs.notes AS snap_notes, cs.snapshot_date
       FROM clients c
       LEFT JOIN client_snapshots cs ON cs.client_id = c.id
         AND cs.snapshot_date = (
           SELECT MAX(cs2.snapshot_date) FROM client_snapshots cs2
           WHERE cs2.client_id = c.id AND cs2.snapshot_date <= $1
         )
       WHERE 1=1 ${where}
       ORDER BY c.country_code, c.name`,
      params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/clients/:id
router.get('/:id', requireAuth, async (req, res) => {
  const row = await db.q1('SELECT * FROM clients WHERE id = $1', [+req.params.id]);
  if (!row) return res.status(404).json({ error: 'No encontrado' });
  res.json(row);
});

// GET /api/clients/:id/history
router.get('/:id/history', requireAuth, async (req, res) => {
  res.json(await db.q(
    'SELECT * FROM client_snapshots WHERE client_id = $1 ORDER BY snapshot_date ASC',
    [+req.params.id]
  ));
});

// POST /api/clients
router.post('/', requireAuth, requireRole('admin','editor'), async (req, res) => {
  try {
    const { name, country_code, client_type, contact_name, contact_email, contact_phone, notes } = req.body;
    const row = await db.q1(
      `INSERT INTO clients (name,country_code,client_type,contact_name,contact_email,contact_phone,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [name, country_code, client_type, contact_name||null, contact_email||null, contact_phone||null, notes||null, req.user.id]
    );
    await audit(req.user.id, 'INSERT', 'clients', row.id, req.body);
    res.json({ id: row.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/clients/:id
router.put('/:id', requireAuth, requireRole('admin','editor'), async (req, res) => {
  try {
    const { name, country_code, client_type, contact_name, contact_email, contact_phone, notes } = req.body;
    await db.q(
      `UPDATE clients SET name=$1,country_code=$2,client_type=$3,
       contact_name=$4,contact_email=$5,contact_phone=$6,notes=$7
       WHERE id=$8`,
      [name, country_code, client_type, contact_name||null, contact_email||null, contact_phone||null, notes||null, +req.params.id]
    );
    await audit(req.user.id, 'UPDATE', 'clients', +req.params.id, req.body);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/clients/:id/snapshot
router.post('/:id/snapshot', requireAuth, requireRole('admin','editor'), async (req, res) => {
  try {
    const { snapshot_date, has_stock, num_salespeople, active, notes } = req.body;
    const date = snapshot_date || new Date().toISOString().slice(0,7);
    await db.q('DELETE FROM client_snapshots WHERE client_id=$1 AND snapshot_date=$2', [+req.params.id, date]);
    const row = await db.q1(
      `INSERT INTO client_snapshots (client_id,snapshot_date,has_stock,num_salespeople,active,notes,recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [+req.params.id, date, !!has_stock, num_salespeople||0, active!==false, notes||null, req.user.id]
    );
    await audit(req.user.id, 'INSERT', 'client_snapshots', row.id, req.body);
    res.json({ id: row.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/clients/:id
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.q('DELETE FROM client_snapshots WHERE client_id=$1', [+req.params.id]);
  await db.q('DELETE FROM clients WHERE id=$1', [+req.params.id]);
  await audit(req.user.id, 'DELETE', 'clients', +req.params.id, {});
  res.json({ ok: true });
});

module.exports = router;
