import { File } from 'expo-file-system';

import { photosDir } from '../photoStore';

// Reading and writing photo files for sync, by file name.
export const photoFilesSupported = true;

export function hasPhoto(name: string): boolean {
  return new File(photosDir(), name).exists;
}

export function readPhoto(name: string): Promise<Uint8Array> {
  return new File(photosDir(), name).bytes();
}

export function writePhoto(name: string, bytes: Uint8Array): void {
  const dir = photosDir();
  dir.create({ idempotent: true, intermediates: true });
  const f = new File(dir, name);
  if (f.exists) f.delete();
  f.create();
  f.write(bytes);
}
