import * as ImagePicker from 'expo-image-picker';

import { removePhoto, storePhoto } from './photoStore';

export type PhotoSource = 'camera' | 'library';

export type PhotoResult =
  | { status: 'saved'; uri: string }
  | { status: 'canceled' }
  | { status: 'denied'; source: PhotoSource }
  | { status: 'failed'; message: string };

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  // Plenty for seeing color and texture, without filling the phone.
  quality: 0.7,
};

/** Takes a new photo or picks one from the library, and keeps a copy in app storage. */
export async function addPhoto(source: PhotoSource): Promise<PhotoResult> {
  try {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { status: 'denied', source };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (result.canceled) return { status: 'canceled' };

    return { status: 'saved', uri: await storePhoto(result.assets[0].uri) };
  } catch (err) {
    return { status: 'failed', message: err instanceof Error ? err.message : 'The photo could not be saved.' };
  }
}

export function deletePhoto(uri: string): void {
  removePhoto(uri);
}

/** What to tell her when a photo didn't work, or null when there's nothing to say. */
export function photoProblem(result: PhotoResult): string | null {
  if (result.status === 'denied') {
    return result.source === 'camera'
      ? 'Glass Studio needs permission to use the camera. Turn it on in Settings → Glass Studio.'
      : 'Glass Studio needs permission to see your photos. Turn it on in Settings → Glass Studio.';
  }
  if (result.status === 'failed') return result.message;
  return null;
}
