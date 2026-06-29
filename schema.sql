-- ============================================================
-- RegionMap — PostgreSQL Schema
-- Run this once in Supabase → SQL Editor → New query
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'viewer',  -- admin | editor | viewer
  name        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Countries master
CREATE TABLE IF NOT EXISTS countries (
  code      TEXT PRIMARY KEY,   -- MEX, GTM, DOM, etc.
  name      TEXT NOT NULL,
  region    TEXT,               -- central_america | caribbean | south_america
  is_island BOOLEAN DEFAULT false
);

-- Country data snapshots (population, GDP)
CREATE TABLE IF NOT EXISTS country_data (
  id            SERIAL PRIMARY KEY,
  country_code  TEXT NOT NULL REFERENCES countries(code),
  snapshot_date TEXT NOT NULL,          -- YYYY-MM
  population    BIGINT,
  gdp_usd       NUMERIC(14,2),          -- millions USD
  notes         TEXT,
  recorded_by   INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cdata ON country_data(country_code, snapshot_date);

-- Competitors master
CREATE TABLE IF NOT EXISTS competitors (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  notes TEXT
);

-- Competitor presence per country (snapshots)
CREATE TABLE IF NOT EXISTS competitor_presence (
  id               SERIAL PRIMARY KEY,
  competitor_id    INTEGER NOT NULL REFERENCES competitors(id),
  country_code     TEXT    NOT NULL REFERENCES countries(code),
  snapshot_date    TEXT    NOT NULL,
  direct_presence  BOOLEAN DEFAULT false,
  seller_factory   BOOLEAN DEFAULT false,
  through_dealers  BOOLEAN DEFAULT false,
  stock_in_country BOOLEAN DEFAULT false,
  notes            TEXT,
  recorded_by      INTEGER REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comp ON competitor_presence(country_code, snapshot_date);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  country_code  TEXT NOT NULL REFERENCES countries(code),
  client_type   TEXT NOT NULL,  -- dealer | specialized_chain | project_manager | developer | importer | installer
  contact_name  TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  created_by    INTEGER REFERENCES users(id)
);

-- Client snapshots (dealer attributes per month)
CREATE TABLE IF NOT EXISTS client_snapshots (
  id              SERIAL PRIMARY KEY,
  client_id       INTEGER NOT NULL REFERENCES clients(id),
  snapshot_date   TEXT    NOT NULL,
  has_stock       BOOLEAN DEFAULT false,
  num_salespeople INTEGER DEFAULT 0,
  active          BOOLEAN DEFAULT true,
  notes           TEXT,
  recorded_by     INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_snap ON client_snapshots(client_id, snapshot_date);

-- Segment snapshots per country
CREATE TABLE IF NOT EXISTS segment_snapshots (
  id            SERIAL PRIMARY KEY,
  country_code  TEXT NOT NULL REFERENCES countries(code),
  snapshot_date TEXT NOT NULL,
  industry      BOOLEAN DEFAULT false,
  home          BOOLEAN DEFAULT false,
  retail        BOOLEAN DEFAULT false,
  hospitality   BOOLEAN DEFAULT false,
  data_center   BOOLEAN DEFAULT false,
  health        BOOLEAN DEFAULT false,
  notes         TEXT,
  recorded_by   INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seg ON segment_snapshots(country_code, snapshot_date);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  country_code  TEXT NOT NULL REFERENCES countries(code),
  client_id     INTEGER REFERENCES clients(id),
  description   TEXT,
  value_usd     NUMERIC(14,2),
  start_date    DATE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  created_by    INTEGER REFERENCES users(id)
);

-- Project phase snapshots
CREATE TABLE IF NOT EXISTS project_snapshots (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id),
  snapshot_date TEXT    NOT NULL,
  phase         TEXT    NOT NULL,  -- pending | contacted | won | mature
  notes         TEXT,
  recorded_by   INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proj_snap ON project_snapshots(project_id, snapshot_date);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  payload    JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Countries
INSERT INTO countries (code, name, region, is_island) VALUES
  ('MEX','México','central_america',false),
  ('GTM','Guatemala','central_america',false),
  ('BLZ','Belice','central_america',false),
  ('SLV','El Salvador','central_america',false),
  ('HND','Honduras','central_america',false),
  ('NIC','Nicaragua','central_america',false),
  ('CRI','Costa Rica','central_america',false),
  ('PAN','Panamá','central_america',false),
  ('DOM','República Dominicana','caribbean',true),
  ('PRI','Puerto Rico','caribbean',true),
  ('JAM','Jamaica','caribbean',true),
  ('TTO','Trinidad y Tobago','caribbean',true),
  ('BHS','Bahamas','caribbean',true),
  ('BRB','Barbados','caribbean',true),
  ('ABW','Aruba','caribbean',true),
  ('CUW','Curazao','caribbean',true),
  ('COL','Colombia','south_america',false)
ON CONFLICT (code) DO NOTHING;

-- Sample country data (current month)
INSERT INTO country_data (country_code, snapshot_date, population, gdp_usd) VALUES
  ('MEX', to_char(now(),'YYYY-MM'), 130000000, 1322000),
  ('GTM', to_char(now(),'YYYY-MM'), 17000000,  85000),
  ('BLZ', to_char(now(),'YYYY-MM'), 430000,    2000),
  ('SLV', to_char(now(),'YYYY-MM'), 6500000,   33000),
  ('HND', to_char(now(),'YYYY-MM'), 10000000,  28000),
  ('NIC', to_char(now(),'YYYY-MM'), 6700000,   14000),
  ('CRI', to_char(now(),'YYYY-MM'), 5200000,   68000),
  ('PAN', to_char(now(),'YYYY-MM'), 4400000,   67000),
  ('COL', to_char(now(),'YYYY-MM'), 51000000,  363000),
  ('DOM', to_char(now(),'YYYY-MM'), 11000000,  100000),
  ('PRI', to_char(now(),'YYYY-MM'), 3200000,   105000),
  ('JAM', to_char(now(),'YYYY-MM'), 3000000,   16000),
  ('TTO', to_char(now(),'YYYY-MM'), 1400000,   23000),
  ('BHS', to_char(now(),'YYYY-MM'), 400000,    13000),
  ('BRB', to_char(now(),'YYYY-MM'), 300000,    5700),
  ('ABW', to_char(now(),'YYYY-MM'), 110000,    3400),
  ('CUW', to_char(now(),'YYYY-MM'), 160000,    3600)
ON CONFLICT DO NOTHING;

-- Sample competitors
INSERT INTO competitors (name) VALUES
  ('Competitor A'), ('Competitor B'), ('Competitor C')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DEFAULT USERS — CHANGE PASSWORDS AFTER FIRST LOGIN
-- admin    / admin1234
-- viewer   / viewer123
-- ============================================================
-- Passwords are bcrypt hashes. To generate new ones:
--   node -e "console.log(require('bcryptjs').hashSync('mipassword',10))"
-- then UPDATE users SET password='...' WHERE username='admin';

INSERT INTO users (username, password, role, name) VALUES
  ('admin',  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin',  'Administrador'),
  ('viewer', '$2a$10$TKh8H1.PfQx37YgCzwiKb.KjNyWgaHb9cbcoQgdIVFlYg7B9tpZ0G', 'viewer', 'Solo lectura')
ON CONFLICT (username) DO NOTHING;
