import * as ImagePicker from 'expo-image-picker';

import { removePhoto, storePhoto } from './photoStore';
import type { PhotoResult, PhotoSource } from './photoTypes';

// iPhone, iPad and Android. The web preview uses photos.web.ts instead.

export { photoProblem, type PhotoResult, type PhotoSource } from './photoTypes';

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  // Plenty for seeing color and texture, without filling the phone.
  quality: 0.7,
  // iPhones shoot HEIC. Ask iOS for its most compatible version (JPEG) so the
  // photo works everywhere, including if it's ever shared or exported.
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

/** Takes a new photo with the camera, or picks one from the library, and keeps a copy in app storage. */
export async function addPhoto(source: PhotoSource): Promise<PhotoResult> {
  try {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { status: 'denied', source };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ ...pickerOptions, cameraType: ImagePicker.CameraType.back })
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
