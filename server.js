// server.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/countries', require('./routes/countries'));
app.use('/api/clients',   require('./routes/clients'));
app.use('/api/projects',  require('./routes/projects'));

// Audit log (admin only)
const { requireAuth, requireRole } = require('./middleware/auth');
const db = require('./db');
app.get('/api/audit', requireAuth, requireRole('admin'), async (req, res) => {
  const rows = await db.q(
    `SELECT al.*, u.username FROM audit_log al
     LEFT JOIN users u ON u.id = al.user_id
     ORDER BY al.created_at DESC LIMIT 200`
  );
  res.json(rows);
});

// Health check (useful for Railway/Render)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Frontend
app.get('*', (req, res) => {
  if (req.path.startsWith('/admin'))
    return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ RegionMap en http://localhost:${PORT}`);
  console.log(`   Base de datos: ${process.env.DATABASE_URL ? 'Supabase ✓' : '⚠️  DATABASE_URL no configurado'}`);
});
