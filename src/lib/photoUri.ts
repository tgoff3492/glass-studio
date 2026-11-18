import { Paths } from 'expo-file-system';

import { resolvePhotoRef } from './photoRef';

/** The address to show a stored photo at, wherever iOS has put the app's folder today. */
export function photoUri(ref: string): string {
  return resolvePhotoRef(ref, Paths.document.uri);
}
