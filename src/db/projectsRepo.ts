import { formatQuantity } from '../domain/glass.ts';
import { statusChange, statusForKind, type ProjectFields } from '../domain/projects.ts';
import { normalizeSize, sizeLabel } from '../domain/sizes.ts';
import { changeGlassSize, getGlass, listGlassSizes, setGlassQuantity, type QueryDb } from './glassRepo.ts';
import { newId, nowIso } from './ids.ts';
import { getSupply, setSupplyQuantity } from './suppliesRepo.ts';
import type { Coe, GlassKind, Photo, Project, ProjectGlass, ProjectKind, ProjectStatus, ProjectSupply, QuantityUnit, SupplyCategory } from './types.ts';

type Bind = string | number | null;

const today = () => nowIso().slice(0, 10);

// ---------- projects ----------

export type ProjectListItem = Project & { cover_uri: string | null; glass_count: number };

export type ProjectFilter = { show?: 'active' | 'done' | 'all'; kind?: ProjectKind | null; search?: string };

export async function listProjects(db: QueryDb, filter: ProjectFilter = {}): Promise<ProjectListItem[]> {
  const where: string[] = [];
  const params: Bind[] = [];
  if (filter.show === 'active') where.push("p.status != 'done'");
  if (filter.show === 'done') where.push("p.status = 'done'");
  if (filter.kind) {
    where.push('p.kind = ?');
    params.push(filter.kind);
  }
  const search = filter.search?.trim();
  if (search) {
    for (const word of search.split(/\s+/)) {
      where.push("(p.name LIKE ? ESCAPE '\\' OR p.notes LIKE ? ESCAPE '\\')");
      const like = `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      params.push(like, like);
    }
  }
  return db.getAllAsync<ProjectListItem>(
    `SELECT p.*,
       COALESCE(
         (SELECT uri FROM photos WHERE owner_type = 'project' AND owner_id = p.id ORDER BY created_at DESC LIMIT 1),
         p.pattern_photo_uri
       ) AS cover_uri,
       (SELECT COUNT(*) FROM project_glass WHERE project_id = p.id) AS glass_count
     FROM projects p` +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ` ORDER BY CASE WHEN p.status = 'done' THEN 1 ELSE 0 END, p.updated_at DESC`,
    params,
  );
}

export function getProject(db: QueryDb, id: string): Promise<Project | null> {
  return db.getFirstAsync<Project>('SELECT * FROM projects WHERE id = ?', [id]);
}

export async function createProject(db: QueryDb, fields: ProjectFields): Promise<string> {
  const id = newId();
  const now = nowIso();
  await db.runAsync(
    "INSERT INTO projects (id, name, kind, status, minutes_spent, notes, created_at, updated_at) VALUES (?, ?, ?, 'idea', 0, ?, ?, ?)",
    [id, fields.name, fields.kind, fields.notes, now, now],
  );
  return id;
}

export async function updateProject(db: QueryDb, id: string, fields: ProjectFields): Promise<void> {
  const p = await getProject(db, id);
  if (!p) return;
  await db.runAsync('UPDATE projects SET name = ?, kind = ?, notes = ?, status = ?, updated_at = ? WHERE id = ?', [
    fields.name,
    fields.kind,
    fields.notes,
    statusForKind(fields.kind, p.status),
    nowIso(),
    id,
  ]);
}

export async function setProjectStatus(db: QueryDb, id: string, status: ProjectStatus): Promise<void> {
  const p = await getProject(db, id);
  if (!p) return;
  const next = statusChange(p, statusForKind(p.kind, status), today());
  await db.runAsync('UPDATE projects SET status = ?, started_on = ?, finished_on = ?, updated_at = ? WHERE id = ?', [
    next.status,
    next.started_on,
    next.finished_on,
    nowIso(),
    id,
  ]);
}

export async function setPatternPhoto(db: QueryDb, id: string, uri: string | null): Promise<void> {
  await db.runAsync('UPDATE projects SET pattern_photo_uri = ?, updated_at = ? WHERE id = ?', [uri, nowIso(), id]);
}

// ---------- glass used ----------

export type ProjectGlassLine = ProjectGlass & {
  color_name: string;
  manufacturer: string | null;
  coe: Coe | null;
  photo_uri: string | null;
  color_family: string | null;
  kind: GlassKind;
};

export function listProjectGlass(db: QueryDb, projectId: string): Promise<ProjectGlassLine[]> {
  return db.getAllAsync<ProjectGlassLine>(
    `SELECT pg.*, g.color_name, g.manufacturer, g.coe, g.photo_uri, g.color_family, g.kind
     FROM project_glass pg JOIN glass_items g ON g.id = pg.glass_item_id
     WHERE pg.project_id = ? ORDER BY g.color_name COLLATE NOCASE, pg.width_in DESC`,
    [projectId],
  );
}

/** "2 × 6×12" or "8 oz". */
export function describeUse(line: Pick<ProjectGlass, 'quantity' | 'unit' | 'width_in' | 'height_in'>): string {
  if (line.width_in !== null && line.height_in !== null) return `${line.quantity} × ${sizeLabel(line.width_in, line.height_in)}`;
  return formatQuantity(line.quantity, line.unit);
}

export type UseAmount = { size: { width: number; height: number }; count: number } | { quantity: number };

export type UseResult = { ok: true } | { ok: false; message: string };

/** Takes glass out of inventory for a project. Refuses to take more than she has. */
export async function takeGlass(db: QueryDb, projectId: string, glassId: string, amount: UseAmount): Promise<UseResult> {
  const glass = await getGlass(db, glassId);
  if (!glass) return { ok: false, message: "That glass isn't in the inventory anymore." };

  if ('size' in amount) {
    const [w, h] = normalizeSize(amount.size.width, amount.size.height);
    const n = Math.round(amount.count);
    if (n <= 0) return { ok: false, message: 'Choose how many sheets.' };
    const have = (await listGlassSizes(db, glassId)).find((s) => s.width === w && s.height === h)?.count ?? 0;
    if (n > have) return { ok: false, message: `You have ${have} of ${sizeLabel(w, h)}.` };
    await changeGlassSize(db, glassId, w, h, -n);
    await addLine(db, 'project_glass', 'glass_item_id', projectId, glassId, n, 'sheet', w, h);
    return { ok: true };
  }

  const q = Math.round(amount.quantity * 100) / 100;
  if (!(q > 0)) return { ok: false, message: 'Enter how much you used.' };
  if (q > glass.quantity + 1e-9) return { ok: false, message: `You have ${formatQuantity(glass.quantity, glass.unit)}.` };
  await setGlassQuantity(db, glassId, glass.quantity - q);
  await addLine(db, 'project_glass', 'glass_item_id', projectId, glassId, q, glass.unit, null, null);
  return { ok: true };
}

/** Puts glass from a project back into inventory and removes it from the project. */
export async function returnGlass(db: QueryDb, lineId: string): Promise<void> {
  const line = await db.getFirstAsync<ProjectGlass>('SELECT * FROM project_glass WHERE id = ?', [lineId]);
  if (!line) return;
  if (line.width_in !== null && line.height_in !== null) {
    await changeGlassSize(db, line.glass_item_id, line.width_in, line.height_in, line.quantity);
  } else {
    const glass = await getGlass(db, line.glass_item_id);
    if (glass) await setGlassQuantity(db, glass.id, glass.quantity + line.quantity);
  }
  await db.runAsync('DELETE FROM project_glass WHERE id = ?', [lineId]);
}

// ---------- supplies used ----------

export type ProjectSupplyLine = ProjectSupply & {
  name: string;
  size: string | null;
  category: SupplyCategory;
  photo_uri: string | null;
};

export function listProjectSupplies(db: QueryDb, projectId: string): Promise<ProjectSupplyLine[]> {
  return db.getAllAsync<ProjectSupplyLine>(
    `SELECT ps.*, s.name, s.size, s.category, s.photo_uri
     FROM project_supplies ps JOIN supplies s ON s.id = ps.supply_id
     WHERE ps.project_id = ? ORDER BY s.name COLLATE NOCASE`,
    [projectId],
  );
}

export async function takeSupply(db: QueryDb, projectId: string, supplyId: string, quantity: number): Promise<UseResult> {
  const supply = await getSupply(db, supplyId);
  if (!supply) return { ok: false, message: "That supply isn't in the inventory anymore." };
  const q = Math.round(quantity * 100) / 100;
  if (!(q > 0)) return { ok: false, message: 'Enter how much you used.' };
  if (q > supply.quantity + 1e-9) return { ok: false, message: `You have ${formatQuantity(supply.quantity, supply.unit)}.` };
  await setSupplyQuantity(db, supplyId, supply.quantity - q);
  await addLine(db, 'project_supplies', 'supply_id', projectId, supplyId, q, supply.unit, null, null);
  return { ok: true };
}

export async function returnSupply(db: QueryDb, lineId: string): Promise<void> {
  const line = await db.getFirstAsync<ProjectSupply>('SELECT * FROM project_supplies WHERE id = ?', [lineId]);
  if (!line) return;
  const supply = await getSupply(db, line.supply_id);
  if (supply) await setSupplyQuantity(db, supply.id, supply.quantity + line.quantity);
  await db.runAsync('DELETE FROM project_supplies WHERE id = ?', [lineId]);
}

/** Adds to an existing line for the same item (and size), or starts a new one. */
async function addLine(
  db: QueryDb,
  table: 'project_glass' | 'project_supplies',
  itemColumn: 'glass_item_id' | 'supply_id',
  projectId: string,
  itemId: string,
  quantity: number,
  unit: QuantityUnit,
  width: number | null,
  height: number | null,
): Promise<void> {
  const sized = table === 'project_glass';
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM ${table} WHERE project_id = ? AND ${itemColumn} = ?` + (sized ? ' AND width_in IS ? AND height_in IS ?' : ''),
    sized ? [projectId, itemId, width, height] : [projectId, itemId],
  );
  if (existing) {
    await db.runAsync(`UPDATE ${table} SET quantity = ROUND(quantity + ?, 2) WHERE id = ?`, [quantity, existing.id]);
  } else if (sized) {
    await db.runAsync(
      'INSERT INTO project_glass (id, project_id, glass_item_id, quantity, unit, width_in, height_in) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newId(), projectId, itemId, quantity, unit, width, height],
    );
  } else {
    await db.runAsync('INSERT INTO project_supplies (id, project_id, supply_id, quantity, unit) VALUES (?, ?, ?, ?, ?)', [
      newId(),
      projectId,
      itemId,
      quantity,
      unit,
    ]);
  }
  await db.runAsync('UPDATE projects SET updated_at = ? WHERE id = ?', [nowIso(), projectId]);
}

// ---------- photos ----------

export async function addProjectPhoto(db: QueryDb, projectId: string, uri: string, caption: string | null = null): Promise<string> {
  const id = newId();
  await db.runAsync("INSERT INTO photos (id, owner_type, owner_id, uri, caption, created_at) VALUES (?, 'project', ?, ?, ?, ?)", [
    id,
    projectId,
    uri,
    caption,
    nowIso(),
  ]);
  await db.runAsync('UPDATE projects SET updated_at = ? WHERE id = ?', [nowIso(), projectId]);
  return id;
}

export function listProjectPhotos(db: QueryDb, projectId: string): Promise<Photo[]> {
  return db.getAllAsync<Photo>("SELECT * FROM photos WHERE owner_type = 'project' AND owner_id = ? ORDER BY created_at ASC", [projectId]);
}

/** Removes a progress photo and returns its file so the caller can delete it. */
export async function deleteProjectPhoto(db: QueryDb, photoId: string): Promise<string | null> {
  const p = await db.getFirstAsync<Photo>('SELECT * FROM photos WHERE id = ?', [photoId]);
  await db.runAsync('DELETE FROM photos WHERE id = ?', [photoId]);
  return p?.uri ?? null;
}

// ---------- delete ----------

/**
 * Deletes a project. With `returnMaterials`, glass and supplies it used go back
 * into inventory first; otherwise they stay used. Returns photo files to delete.
 */
export async function deleteProject(db: QueryDb, id: string, returnMaterials: boolean): Promise<string[]> {
  if (returnMaterials) {
    for (const line of await db.getAllAsync<{ id: string }>('SELECT id FROM project_glass WHERE project_id = ?', [id])) {
      await returnGlass(db, line.id);
    }
    for (const line of await db.getAllAsync<{ id: string }>('SELECT id FROM project_supplies WHERE project_id = ?', [id])) {
      await returnSupply(db, line.id);
    }
  }
  const project = await getProject(db, id);
  const photos = await listProjectPhotos(db, id);
  await db.runAsync('DELETE FROM project_glass WHERE project_id = ?', [id]);
  await db.runAsync('DELETE FROM project_supplies WHERE project_id = ?', [id]);
  await db.runAsync("DELETE FROM photos WHERE owner_type = 'project' AND owner_id = ?", [id]);
  await db.runAsync('UPDATE firings SET project_id = NULL WHERE project_id = ?', [id]);
  await db.runAsync('DELETE FROM projects WHERE id = ?', [id]);
  return [...photos.map((p) => p.uri), ...(project?.pattern_photo_uri ? [project.pattern_photo_uri] : [])];
}

/** Projects that use a glass, for its page. */
export function projectsUsingGlass(db: QueryDb, glassId: string): Promise<{ id: string; name: string; status: ProjectStatus; kind: ProjectKind }[]> {
  return db.getAllAsync(
    `SELECT DISTINCT p.id, p.name, p.status, p.kind FROM projects p JOIN project_glass pg ON pg.project_id = p.id
     WHERE pg.glass_item_id = ? ORDER BY p.updated_at DESC`,
    [glassId],
  );
}
