import type { Coe, Project, ProjectKind, ProjectStatus } from '../db/types.ts';
import { checkCoe } from './coe.ts';

// Statuses follow the real steps of each craft. Stained glass never goes in the kiln.
const STATUS_STEPS: Record<ProjectKind, { value: ProjectStatus; label: string }[]> = {
  stained: [
    { value: 'idea', label: 'Idea' },
    { value: 'cutting', label: 'Cutting' },
    { value: 'assembling', label: 'Foiling & soldering' },
    { value: 'finishing', label: 'Patina & cleanup' },
    { value: 'done', label: 'Done' },
  ],
  fused: [
    { value: 'idea', label: 'Idea' },
    { value: 'cutting', label: 'Cutting' },
    { value: 'assembling', label: 'Assembling' },
    { value: 'firing', label: 'In the kiln' },
    { value: 'finishing', label: 'Finishing' },
    { value: 'done', label: 'Done' },
  ],
};

export const PROJECT_KINDS: { value: ProjectKind; label: string }[] = [
  { value: 'stained', label: 'Stained glass' },
  { value: 'fused', label: 'Fused glass' },
];

export function statusSteps(kind: ProjectKind) {
  return STATUS_STEPS[kind];
}

export function statusLabel(kind: ProjectKind, status: ProjectStatus): string {
  return STATUS_STEPS[kind].find((s) => s.value === status)?.label ?? (status === 'firing' ? 'In the kiln' : status);
}

export function kindLabel(kind: ProjectKind): string {
  return kind === 'stained' ? 'Stained' : 'Fused';
}

/**
 * What changes when the status changes: the start date is set the first time work
 * begins, and the finish date is set on Done and cleared if she reopens it.
 */
export function statusChange(
  project: Pick<Project, 'started_on' | 'finished_on'>,
  next: ProjectStatus,
  today: string,
): { status: ProjectStatus; started_on: string | null; finished_on: string | null } {
  return {
    status: next,
    started_on: project.started_on ?? (next === 'idea' ? null : today),
    finished_on: next === 'done' ? (project.finished_on ?? today) : null,
  };
}

export type ProjectInput = { name: string; kind: ProjectKind; notes: string };

export type ProjectFields = { name: string; kind: ProjectKind; notes: string | null };

export function validateProjectInput(
  input: ProjectInput,
): { ok: true; value: ProjectFields } | { ok: false; errors: Partial<Record<keyof ProjectInput, string>> } {
  if (input.name.trim() === '') return { ok: false, errors: { name: 'Give the project a name, like "Sunflower panel".' } };
  return { ok: true, value: { name: input.name.trim(), kind: input.kind, notes: input.notes.trim() || null } };
}

/** A stained project has no kiln step; moving it from fused to stained mid-firing lands on Finishing. */
export function statusForKind(kind: ProjectKind, status: ProjectStatus): ProjectStatus {
  return kind === 'stained' && status === 'firing' ? 'finishing' : status;
}

export type CoeWarning =
  | { kind: 'mixed'; found: Coe[] }
  | { kind: 'unknown'; names: string[] }
  | null;

/**
 * For fused projects only. Mixed COEs are the serious case; glass with no COE
 * recorded gets a softer reminder to check it.
 */
export function projectCoeWarning(
  kind: ProjectKind,
  glass: { color_name: string; coe: Coe | null }[],
): CoeWarning {
  if (kind !== 'fused' || glass.length === 0) return null;
  const check = checkCoe(glass.map((g) => g.coe));
  if (!check.ok) return { kind: 'mixed', found: check.found };
  const unknown = glass.filter((g) => g.coe === null).map((g) => g.color_name);
  if (unknown.length > 0) return { kind: 'unknown', names: [...new Set(unknown)] };
  return null;
}

/** Whether adding a glass with `coe` to these would mix COEs. */
export function wouldMixCoe(existing: (Coe | null)[], coe: Coe | null): boolean {
  if (coe === null) return false;
  return existing.some((c) => c !== null && c !== coe);
}
