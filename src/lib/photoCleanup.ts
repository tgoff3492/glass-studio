import { deletePhoto } from './photos';

type PhotoFields = { photo_uri: string | null; fired_photo_uri: string | null };

const uris = (f: PhotoFields) => [f.photo_uri, f.fired_photo_uri].filter((u): u is string => Boolean(u));

/** Deletes photos in `from` that aren't kept in `keep`. */
export function discardPhotos(from: PhotoFields, keep: PhotoFields | null = null): void {
  const kept = new Set(keep ? uris(keep) : []);
  for (const uri of uris(from)) if (!kept.has(uri)) deletePhoto(uri);
}
