// Web preview only. The browser hands back a temporary link that stops working
// on reload, so shrink the image and keep it as a data URL in the database.

const MAX_SIDE = 1000;

export async function storePhoto(pickedUri: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('That image could not be opened.'));
    el.src = pickedUri;
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (pickedUri.startsWith('blob:')) URL.revokeObjectURL(pickedUri);
  return canvas.toDataURL('image/jpeg', 0.75);
}

export function removePhoto(_uri: string): void {
  // Nothing to clean up; the photo lives inside the database row.
}
