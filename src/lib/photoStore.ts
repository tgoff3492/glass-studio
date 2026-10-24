import { Directory, File, Paths } from 'expo-file-system';

import { newId } from '@/db/ids';

// iPhone, iPad and Android: copy the picked image into the app's own folder so it
// survives even if the original is deleted from the camera roll.
// The web preview uses photoStore.web.ts instead.

const photosDir = () => new Directory(Paths.document, 'photos');

/** Copies a picked image into app storage and returns the URI to save in the database. */
export async function storePhoto(pickedUri: string): Promise<string> {
  const dir = photosDir();
  dir.create({ idempotent: true, intermediates: true });
  const source = new File(pickedUri);
  const ext = source.extension || '.jpg';
  const dest = new File(dir, `${newId()}${ext}`);
  await source.copy(dest);
  return dest.uri;
}

/** Removes a stored photo. Safe to call if it's already gone or isn't one of ours. */
export function removePhoto(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists && uri.startsWith(photosDir().uri)) file.delete();
  } catch {
    // Missing or foreign files aren't worth interrupting her over.
  }
}
