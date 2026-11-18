import { Directory, File, Paths } from 'expo-file-system';

// The last few things that went wrong, kept on the device so "Send Taylor a note"
// can include them. Nothing is sent anywhere unless she chooses to send the note.

export type LoggedError = { at: string; where: string; message: string; stack?: string };

const MAX = 20;
const logFile = () => new File(new Directory(Paths.document, 'logs'), 'errors.json');

export function readErrors(): LoggedError[] {
  try {
    const f = logFile();
    return f.exists ? (JSON.parse(f.textSync()) as LoggedError[]) : [];
  } catch {
    return [];
  }
}

export function logError(error: unknown, where: string): void {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const entry: LoggedError = { at: new Date().toISOString(), where, message: e.message, stack: e.stack?.split('\n').slice(0, 6).join('\n') };
    const list = [entry, ...readErrors()].slice(0, MAX);
    const f = logFile();
    f.parentDirectory.create({ idempotent: true, intermediates: true });
    if (!f.exists) f.create();
    f.write(JSON.stringify(list));
  } catch {
    // Logging must never cause a second problem.
  }
}
