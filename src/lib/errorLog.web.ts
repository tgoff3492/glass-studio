// Web preview: errors are kept in this browser only.
export type LoggedError = { at: string; where: string; message: string; stack?: string };

const KEY = 'glass-studio-errors';

export function readErrors(): LoggedError[] {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]') as LoggedError[];
  } catch {
    return [];
  }
}

export function logError(error: unknown, where: string): void {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const list = [{ at: new Date().toISOString(), where, message: e.message }, ...readErrors()].slice(0, 20);
    globalThis.localStorage?.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage can be unavailable in private browsing.
  }
}
