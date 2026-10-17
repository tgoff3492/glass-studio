import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { newId } from '@/db/ids';

// Photos are copied into the app's own folder so they survive even if the
// original is deleted from the camera roll. The database stores the copy's URI.

export type PhotoSource = 'camera' | 'library';

export type PhotoResult =
  | { status: 'saved'; uri: string }
  | { status: 'canceled' }
  | { status: 'denied'; source: PhotoSource };

const photosDir = () => new Directory(Paths.document, 'photos');

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  // Plenty for seeing color and texture, without filling the phone.
  quality: 0.7,
};

/** Takes a new photo or picks one from the library, and saves a copy into app storage. */
export async function addPhoto(source: PhotoSource): Promise<PhotoResult> {
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

  const uri = await savePhoto(result.assets[0].uri);
  return { status: 'saved', uri };
}

/** Copies a picked image into the app's photos folder and returns the new URI. */
export async function savePhoto(pickedUri: string): Promise<string> {
  const dir = photosDir();
  dir.create({ idempotent: true, intermediates: true });
  const source = new File(pickedUri);
  const ext = source.extension || '.jpg';
  const dest = new File(dir, `${newId()}${ext}`);
  await source.copy(dest);
  return dest.uri;
}

/** Removes a saved photo. Safe to call if it's already gone. */
export function deletePhoto(uri: string): void {
  const file = new File(uri);
  if (file.exists) file.delete();
}
