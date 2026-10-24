// Database migrations, applied in order. Never edit a migration that has shipped;
// add a new one with the next version number instead.
//
// IDs are text UUIDs rather than auto-increment numbers so records can sync to
// the cloud later without colliding across devices.

export type Migration = { version: number; sql: string };

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
];

export const LATEST_VERSION = migrations[migrations.length - 1].version;
