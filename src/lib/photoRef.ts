// Photos are stored in the database by name ("photos/abc.jpg"), relative to the
// app's documents folder. iOS can move that folder after a restore or reinstall,
// so a full file address saved today may point nowhere tomorrow.
// Pure functions, so they can be tested without a phone.

export const PHOTO_FOLDER = 'photos';

/** "file:///…/Documents/photos/abc.jpg" → "photos/abc.jpg". Anything else is returned as it is. */
export function toPhotoRef(uri: string): string {
  const m = uri.match(/^file:.*\/photos\/([^/]+)$/);
  return m ? `${PHOTO_FOLDER}/${m[1]}` : uri;
}

/** The file name inside the photos folder, or null for photos that aren't ours (web data URLs). */
export function photoFileName(ref: string): string | null {
  const r = toPhotoRef(ref);
  return r.startsWith(`${PHOTO_FOLDER}/`) ? r.slice(PHOTO_FOLDER.length + 1) : null;
}

/** Turns a stored reference into an address that can be shown, given the documents folder's current address. */
export function resolvePhotoRef(ref: string, documentsUri: string): string {
  const name = photoFileName(ref);
  if (name === null) return ref;
  const base = documentsUri.endsWith('/') ? documentsUri : `${documentsUri}/`;
  return `${base}${PHOTO_FOLDER}/${name}`;
}
