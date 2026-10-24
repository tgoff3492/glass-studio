// Row types for the local database. Column names match the SQL schema in migrations.ts.
// Times are ISO-8601 strings. Money is stored in whole cents to avoid rounding errors.

export type Coe = 90 | 96;

export type GlassKind = 'sheet' | 'frit' | 'powder' | 'stringer' | 'noodle' | 'confetti' | 'scrap';

export type GlassType =
  | 'cathedral'
  | 'opalescent'
  | 'streaky'
  | 'wispy'
  | 'iridized'
  | 'textured'
  | 'clear'
  | 'other';

/** How a quantity is measured. Sheets by area or count, frit and powder by weight. */
export type QuantityUnit =
  | 'sq_in'
  | 'sheet'
  | 'lb'
  | 'oz'
  | 'g'
  | 'piece'
  | 'ft'
  | 'roll'
  | 'jar'
  | 'bottle'
  | 'stick'
  | 'pack';

export type GlassItem = {
  id: string;
  kind: GlassKind;
  manufacturer: string | null;
  color_name: string;
  product_code: string | null;
  /** The code from the label's barcode, once scanned or typed. Unique across items. */
  barcode: string | null;
  /** Null for glass used only in stained work, where COE doesn't matter. */
  coe: Coe | null;
  glass_type: GlassType | null;
  color_family: string | null;
  /** For sheets tracked by size, the total sheet count across sizes. */
  quantity: number;
  unit: QuantityUnit;
  /** "3 × 12×12 · 4 × 6×12" for sheets tracked by size; null otherwise. Kept in step with glass_pieces. */
  size_summary: string | null;
  cost_per_unit_cents: number | null;
  photo_uri: string | null;
  fired_photo_uri: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** How many sheets of one size she has of a glass. Sizes are inches, shorter side first. */
export type GlassPiece = {
  id: string;
  glass_item_id: string;
  width_in: number;
  height_in: number;
  count: number;
};

export type SupplyCategory =
  | 'foil'
  | 'solder'
  | 'came'
  | 'flux'
  | 'patina'
  | 'grinder_bit'
  | 'cutter'
  | 'kiln_wash'
  | 'fiber_paper'
  | 'shelf_paper'
  | 'mold'
  | 'dichroic'
  | 'other';

export type Supply = {
  id: string;
  category: SupplyCategory;
  name: string;
  brand: string | null;
  /** Free text such as "7/32 in" for foil or "60/40" for solder. */
  size: string | null;
  quantity: number;
  unit: QuantityUnit;
  min_quantity: number | null;
  cost_per_unit_cents: number | null;
  photo_uri: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ShoppingSource = 'glass' | 'supply';

/** Something to buy that she added herself. Running-low supplies are worked out live, not stored. */
export type ShoppingItem = {
  id: string;
  label: string;
  note: string | null;
  /** Set when the item came from a glass or supply page, so the list can link back. */
  source_type: ShoppingSource | null;
  source_id: string | null;
  done: 0 | 1;
  created_at: string;
  updated_at: string;
};

export type ProjectKind = 'stained' | 'fused';

export type ProjectStatus = 'idea' | 'cutting' | 'assembling' | 'firing' | 'finishing' | 'done';

export type Project = {
  id: string;
  name: string;
  kind: ProjectKind;
  status: ProjectStatus;
  pattern_photo_uri: string | null;
  minutes_spent: number;
  started_on: string | null;
  finished_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectGlass = {
  id: string;
  project_id: string;
  glass_item_id: string;
  quantity: number;
  unit: QuantityUnit;
};

export type ProjectSupply = {
  id: string;
  project_id: string;
  supply_id: string;
  quantity: number;
  unit: QuantityUnit;
};

export type PhotoOwner = 'project' | 'firing' | 'glass' | 'supply';

export type Photo = {
  id: string;
  owner_type: PhotoOwner;
  owner_id: string;
  uri: string;
  caption: string | null;
  created_at: string;
};

export type FiringProcess =
  | 'full_fuse'
  | 'tack_fuse'
  | 'contour'
  | 'slump'
  | 'drape'
  | 'fire_polish'
  | 'other';

export type FiringSchedule = {
  id: string;
  name: string;
  process: FiringProcess;
  coe: Coe | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** One step of a schedule: ramp at a rate to a target temperature, then hold. */
export type ScheduleSegment = {
  id: string;
  schedule_id: string;
  position: number;
  /** Degrees Fahrenheit per hour. Null means "as fast as possible". */
  rate_f_per_hr: number | null;
  target_f: number;
  hold_minutes: number;
};

export type Firing = {
  id: string;
  project_id: string | null;
  schedule_id: string | null;
  fired_on: string;
  result_notes: string | null;
  created_at: string;
  updated_at: string;
};
