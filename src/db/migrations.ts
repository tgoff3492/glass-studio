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
];

export const LATEST_VERSION = migrations[migrations.length - 1].version;
