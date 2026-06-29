// routes/auth.js
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Faltan credenciales' });

    const user = await db.q1('SELECT * FROM users WHERE username = $1', [username]);
    console.log('USER FOUND:', !!user, 'PASS CHECK:', user ? bcrypt.compareSync(password, user.password) : false);
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
  } catch (e) {
    console.log('LOGIN ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => res.json(req.user));

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await db.q1('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!bcrypt.compareSync(currentPassword, user.password))
      return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    const hash = bcrypt.hashSync(newPassword, 10);
    await db.q('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/users  (admin only)
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await db.q('SELECT id, username, role, name, created_at FROM users ORDER BY id');
  res.json(users);
});

// POST /api/auth/users  (admin only)
router.post('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { username, password, role, name } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    const row  = await db.q1(
      'INSERT INTO users (username,password,role,name) VALUES ($1,$2,$3,$4) RETURNING id',
      [username, hash, role || 'viewer', name || username]
    );
    res.json({ id: row.id });
  } catch (e) {
    res.status(400).json({ error: 'El usuario ya existe' });
  }
});

// PUT /api/auth/users/:id/role  (admin only)
router.put('/users/:id/role', requireAuth, requireRole('admin'), async (req, res) => {
  await db.q('UPDATE users SET role = $1 WHERE id = $2', [req.body.role, +req.params.id]);
  res.json({ ok: true });
});

// DELETE /api/auth/users/:id  (admin only)
router.delete('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  if (+req.params.id === req.user.id)
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  await db.q('DELETE FROM users WHERE id = $1', [+req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
