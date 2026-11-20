// Database migrations, applied in order. Never edit a migration that has shipped;
// add a new one with the next version number instead.
//
// IDs are text UUIDs rather than auto-increment numbers so records can sync to
// the cloud later without colliding across devices.

export type Migration = {
  version: number;
  sql: string;
  /** Set when the migration drops and recreates a table that other tables link to. */
  rebuildsTables?: boolean;
};

export const migrations: Migration[] = [
  {
    version: 1,
    sql: `
CREATE TABLE glass_items (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('sheet','frit','powder','stringer','noodle','confetti','scrap')),
  manufacturer TEXT,
  color_name TEXT NOT NULL,
  product_code TEXT,
  coe INTEGER CHECK (coe IN (90, 96)),
  glass_type TEXT,
  color_family TEXT,
  quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  cost_per_unit_cents INTEGER,
  photo_uri TEXT,
  fired_photo_uri TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX glass_items_coe ON glass_items (coe);
CREATE INDEX glass_items_color_family ON glass_items (color_family);

CREATE TABLE supplies (
  id TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  size TEXT,
  quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  min_quantity REAL,
  cost_per_unit_cents INTEGER,
  photo_uri TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('stained','fused')),
  status TEXT NOT NULL DEFAULT 'idea'
    CHECK (status IN ('idea','cutting','assembling','firing','finishing','done')),
  pattern_photo_uri TEXT,
  minutes_spent INTEGER NOT NULL DEFAULT 0,
  started_on TEXT,
  finished_on TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE project_glass (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  glass_item_id TEXT NOT NULL REFERENCES glass_items (id) ON DELETE RESTRICT,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL
);
CREATE INDEX project_glass_project ON project_glass (project_id);

CREATE TABLE project_supplies (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  supply_id TEXT NOT NULL REFERENCES supplies (id) ON DELETE RESTRICT,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL
);
CREATE INDEX project_supplies_project ON project_supplies (project_id);

CREATE TABLE photos (
  id TEXT PRIMARY KEY NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('project','firing','glass','supply')),
  owner_id TEXT NOT NULL,
  uri TEXT NOT NULL,
  caption TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX photos_owner ON photos (owner_type, owner_id);

CREATE TABLE firing_schedules (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  process TEXT NOT NULL,
  coe INTEGER CHECK (coe IN (90, 96)),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE schedule_segments (
  id TEXT PRIMARY KEY NOT NULL,
  schedule_id TEXT NOT NULL REFERENCES firing_schedules (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  rate_f_per_hr INTEGER,
  target_f INTEGER NOT NULL,
  hold_minutes INTEGER NOT NULL DEFAULT 0,
  UNIQUE (schedule_id, position)
);

CREATE TABLE firings (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT REFERENCES projects (id) ON DELETE SET NULL,
  schedule_id TEXT REFERENCES firing_schedules (id) ON DELETE SET NULL,
  fired_on TEXT NOT NULL,
  result_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX firings_project ON firings (project_id);
`,
  },
  {
    // Barcode scanning: the code printed on a sheet's label, linked to one item.
    version: 2,
    sql: `
ALTER TABLE glass_items ADD COLUMN barcode TEXT;
CREATE UNIQUE INDEX glass_items_barcode ON glass_items (barcode) WHERE barcode IS NOT NULL;
`,
  },
  {
    // Shopping list: things she adds by hand. Low-stock supplies are computed, not stored.
    version: 3,
    sql: `
CREATE TABLE shopping_items (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  note TEXT,
  source_type TEXT CHECK (source_type IN ('glass','supply')),
  source_id TEXT,
  done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX shopping_items_source ON shopping_items (source_type, source_id);
CREATE INDEX supplies_category ON supplies (category);
`,
  },
  {
    // Sheet sizes: "3 12×12s and 4 6×12s". One row per size per glass.
    version: 4,
    sql: `
CREATE TABLE glass_pieces (
  id TEXT PRIMARY KEY NOT NULL,
  glass_item_id TEXT NOT NULL REFERENCES glass_items (id) ON DELETE CASCADE,
  width_in REAL NOT NULL CHECK (width_in > 0),
  height_in REAL NOT NULL CHECK (height_in >= width_in),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  UNIQUE (glass_item_id, width_in, height_in)
);
ALTER TABLE glass_items ADD COLUMN size_summary TEXT;
`,
  },
  {
    // Projects: glass used by size, and a bench timer that survives closing the app.
    version: 5,
    sql: `
ALTER TABLE project_glass ADD COLUMN width_in REAL;
ALTER TABLE project_glass ADD COLUMN height_in REAL;
ALTER TABLE projects ADD COLUMN timer_started_at TEXT;
CREATE INDEX project_supplies_supply ON project_supplies (supply_id);
CREATE INDEX project_glass_glass ON project_glass (glass_item_id);
`,
  },
  {
    // Dichroic becomes a kind of glass (it has a COE) instead of a supply.
    // SQLite can't change a CHECK rule in place, so glass_items is rebuilt with
    // 'dichroic' allowed, then any dichroic supplies move over with the same id,
    // so their project use, shopping entries and photos follow them.
    version: 6,
    rebuildsTables: true,
    sql: `
CREATE TABLE glass_items_new (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('sheet','frit','powder','stringer','noodle','confetti','scrap','dichroic')),
  manufacturer TEXT,
  color_name TEXT NOT NULL,
  product_code TEXT,
  coe INTEGER CHECK (coe IN (90, 96)),
  glass_type TEXT,
  color_family TEXT,
  quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  cost_per_unit_cents INTEGER,
  photo_uri TEXT,
  fired_photo_uri TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  barcode TEXT,
  size_summary TEXT
);
INSERT INTO glass_items_new (id, kind, manufacturer, color_name, product_code, coe, glass_type, color_family, quantity, unit,
  cost_per_unit_cents, photo_uri, fired_photo_uri, notes, created_at, updated_at, barcode, size_summary)
SELECT id, kind, manufacturer, color_name, product_code, coe, glass_type, color_family, quantity, unit,
  cost_per_unit_cents, photo_uri, fired_photo_uri, notes, created_at, updated_at, barcode, size_summary
FROM glass_items;
DROP TABLE glass_items;
ALTER TABLE glass_items_new RENAME TO glass_items;
CREATE INDEX glass_items_coe ON glass_items (coe);
CREATE INDEX glass_items_color_family ON glass_items (color_family);
CREATE UNIQUE INDEX glass_items_barcode ON glass_items (barcode) WHERE barcode IS NOT NULL;

INSERT INTO glass_items (id, kind, manufacturer, color_name, coe, quantity, unit, cost_per_unit_cents, photo_uri, notes, created_at, updated_at)
SELECT id, 'dichroic', brand,
  CASE WHEN size IS NOT NULL AND size != '' AND name != 'Dichroic glass' THEN name || ', ' || size
       WHEN size IS NOT NULL AND size != '' THEN 'Dichroic, ' || size
       ELSE name END,
  CASE WHEN (name || ' ' || COALESCE(size, '')) LIKE '%COE 96%' THEN 96
       WHEN (name || ' ' || COALESCE(size, '')) LIKE '%COE 90%' THEN 90
       ELSE NULL END,
  quantity, unit, cost_per_unit_cents, photo_uri, notes, created_at, updated_at
FROM supplies WHERE category = 'dichroic';

INSERT INTO project_glass (id, project_id, glass_item_id, quantity, unit, width_in, height_in)
SELECT id, project_id, supply_id, quantity, unit, NULL, NULL
FROM project_supplies WHERE supply_id IN (SELECT id FROM supplies WHERE category = 'dichroic');
DELETE FROM project_supplies WHERE supply_id IN (SELECT id FROM supplies WHERE category = 'dichroic');
UPDATE shopping_items SET source_type = 'glass'
  WHERE source_type = 'supply' AND source_id IN (SELECT id FROM supplies WHERE category = 'dichroic');
UPDATE photos SET owner_type = 'glass'
  WHERE owner_type = 'supply' AND owner_id IN (SELECT id FROM supplies WHERE category = 'dichroic');
DELETE FROM supplies WHERE category = 'dichroic';
`,
  },
  {
    // Photos are saved by name ("photos/abc.jpg") instead of by full address. iOS can
    // move the app's folder after a restore or reinstall, which would break full
    // addresses. Also a small settings table for things like when she last backed up.
    version: 7,
    sql: `
UPDATE glass_items SET photo_uri = 'photos/' || substr(photo_uri, instr(photo_uri, '/photos/') + 8)
  WHERE photo_uri LIKE 'file:%/photos/%';
UPDATE glass_items SET fired_photo_uri = 'photos/' || substr(fired_photo_uri, instr(fired_photo_uri, '/photos/') + 8)
  WHERE fired_photo_uri LIKE 'file:%/photos/%';
UPDATE supplies SET photo_uri = 'photos/' || substr(photo_uri, instr(photo_uri, '/photos/') + 8)
  WHERE photo_uri LIKE 'file:%/photos/%';
UPDATE projects SET pattern_photo_uri = 'photos/' || substr(pattern_photo_uri, instr(pattern_photo_uri, '/photos/') + 8)
  WHERE pattern_photo_uri LIKE 'file:%/photos/%';
UPDATE photos SET uri = 'photos/' || substr(uri, instr(uri, '/photos/') + 8)
  WHERE uri LIKE 'file:%/photos/%';

CREATE TABLE settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`,
  },
  {
    // One kiln load holds several pieces, and one piece goes through several firings
    // (full fuse, then slump). Firings link to projects through their own table.
    // firings.project_id stays in the table, unused: dropping a column is the one kind of
    // change that could fail on an older SQLite, and a failed migration means the app won't open.
    version: 8,
    sql: `
CREATE TABLE firing_projects (
  firing_id TEXT NOT NULL REFERENCES firings (id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  PRIMARY KEY (firing_id, project_id)
);
CREATE INDEX firing_projects_project ON firing_projects (project_id);
INSERT INTO firing_projects (firing_id, project_id) SELECT id, project_id FROM firings WHERE project_id IS NOT NULL;
UPDATE firings SET project_id = NULL;
`,
  },
  {
    // "Keep at least" for glass, like supplies have, so favorite colors land on the shopping list.
    // Partial sheets: a project line can record that only part of a sheet was used.
    version: 9,
    sql: `
ALTER TABLE glass_items ADD COLUMN min_quantity REAL;
ALTER TABLE project_glass ADD COLUMN partial INTEGER NOT NULL DEFAULT 0 CHECK (partial IN (0, 1));
`,
  },
  {
    // Sync between her iPhone and iPad. Every change to a synced table is noted in
    // sync_outbox by a trigger, so no save path can forget to sync. Changes that arrive
    // from the other device are applied with sync_state.applying = '1', which keeps the
    // triggers quiet so they don't bounce straight back.
    // If a later migration rebuilds one of these tables, it must recreate its triggers.
    // (The triggers use ON CONFLICT DO UPDATE rather than INSERT OR REPLACE: SQLite lets the
    // statement that fired a trigger override OR REPLACE inside it, but not an upsert.)
    version: 10,
    sql: `
CREATE TABLE sync_outbox (
  tbl TEXT NOT NULL,
  row_id TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  PRIMARY KEY (tbl, row_id)
);
CREATE TABLE sync_state (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE sync_photos (
  name TEXT PRIMARY KEY NOT NULL,
  uploaded_at TEXT NOT NULL
);
CREATE TABLE sync_retry (
  doc_key TEXT PRIMARY KEY NOT NULL,
  doc TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
INSERT INTO sync_state (key, value) VALUES ('applying', '0');
CREATE TRIGGER sync_glass_items_insert AFTER INSERT ON glass_items WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('glass_items', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_glass_items_update AFTER UPDATE ON glass_items WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('glass_items', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_glass_items_delete AFTER DELETE ON glass_items WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('glass_items', OLD.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_supplies_insert AFTER INSERT ON supplies WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('supplies', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_supplies_update AFTER UPDATE ON supplies WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('supplies', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_supplies_delete AFTER DELETE ON supplies WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('supplies', OLD.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_projects_insert AFTER INSERT ON projects WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('projects', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_projects_update AFTER UPDATE ON projects WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('projects', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_projects_delete AFTER DELETE ON projects WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('projects', OLD.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_glass_pieces_insert AFTER INSERT ON glass_pieces WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('glass_pieces', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_glass_pieces_update AFTER UPDATE ON glass_pieces WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('glass_pieces', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_glass_pieces_delete AFTER DELETE ON glass_pieces WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('glass_pieces', OLD.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_project_glass_insert AFTER INSERT ON project_glass WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('project_glass', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_project_glass_update AFTER UPDATE ON project_glass WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('project_glass', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_project_glass_delete AFTER DELETE ON project_glass WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('project_glass', OLD.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_project_supplies_insert AFTER INSERT ON project_supplies WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('project_supplies', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_project_supplies_update AFTER UPDATE ON project_supplies WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('project_supplies', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_project_supplies_delete AFTER DELETE ON project_supplies WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('project_supplies', OLD.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_photos_insert AFTER INSERT ON photos WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('photos', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_photos_update AFTER UPDATE ON photos WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('photos', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_photos_delete AFTER DELETE ON photos WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('photos', OLD.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_shopping_items_insert AFTER INSERT ON shopping_items WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('shopping_items', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_shopping_items_update AFTER UPDATE ON shopping_items WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('shopping_items', NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_shopping_items_delete AFTER DELETE ON shopping_items WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0'
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('shopping_items', OLD.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_settings_insert AFTER INSERT ON settings WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0' AND NEW.key IN ('hourly_rate_cents', 'markup_percent')
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('settings', NEW.key, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_settings_update AFTER UPDATE ON settings WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0' AND NEW.key IN ('hourly_rate_cents', 'markup_percent')
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('settings', NEW.key, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_settings_delete AFTER DELETE ON settings WHEN (SELECT value FROM sync_state WHERE key = 'applying') = '0' AND OLD.key IN ('hourly_rate_cents', 'markup_percent')
BEGIN
  INSERT INTO sync_outbox (tbl, row_id, changed_at) VALUES ('settings', OLD.key, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
`,
  },
];

export const LATEST_VERSION = migrations[migrations.length - 1].version;
