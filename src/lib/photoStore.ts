import { Directory, File, Paths } from 'expo-file-system';

import { newId } from '@/db/ids';

import { PHOTO_FOLDER, photoFileName } from './photoRef';

// iPhone, iPad and Android: copy the picked image into the app's own folder so it
// survives even if the original is deleted from the camera roll. The database keeps
// only "photos/<name>", never the full address (see photoRef.ts).
// The app's Documents folder is included in the phone's iCloud backup.

export const photosDir = () => new Directory(Paths.document, PHOTO_FOLDER);

/** Copies a picked image into app storage and returns the reference to save in the database. */
export async function storePhoto(pickedUri: string): Promise<string> {
  const dir = photosDir();
  dir.create({ idempotent: true, intermediates: true });
  const source = new File(pickedUri);
  const ext = source.extension || '.jpg';
  const name = `${newId()}${ext}`;
  await source.copy(new File(dir, name));
  return `${PHOTO_FOLDER}/${name}`;
}

/** Removes a stored photo. Safe to call if it's already gone or isn't one of ours. */
export function removePhoto(ref: string): void {
  try {
    const name = photoFileName(ref);
    if (!name) return;
    const file = new File(photosDir(), name);
    if (file.exists) file.delete();
  } catch {
    // Missing or foreign files aren't worth interrupting her over.
  }
}
