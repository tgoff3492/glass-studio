import type { PhotoResult, PhotoSource } from './photoTypes';

// Web preview only. The iPhone and iPad app uses photos.ts.
//
// Two things matter here:
//  1. Phones only open the camera or photo picker when the file input is clicked
//     during the tap itself. Any `await` before the click (such as a permission
//     check) makes iOS Safari silently ignore it, so the click happens first.
//  2. iPhone photos are often HEIC, which most non-Apple browsers can't display.
//     Every photo is converted to a JPEG, and HEIC files go through a converter
//     that is only downloaded when one actually turns up.

export { photoProblem, type PhotoResult, type PhotoSource } from './photoTypes';

/** JPEG, PNG and HEIC, plus anything else the browser calls an image. */
export const ACCEPTED_TYPES = 'image/*,.heic,.heif,image/heic,image/heif';

const MAX_SIDE = 1600;

export function addPhoto(source: PhotoSource): Promise<PhotoResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED_TYPES;
    // On a phone or tablet this opens the back camera instead of the photo picker.
    if (source === 'camera') input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.left = '-1000px';
    document.body.appendChild(input);

    let settled = false;
    const finish = (r: PhotoResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(r);
    };

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return finish({ status: 'canceled' });
      try {
        finish({ status: 'saved', uri: await toJpegDataUrl(file) });
      } catch (err) {
        finish({ status: 'failed', message: err instanceof Error ? err.message : 'That photo could not be opened.' });
      }
    });
    input.addEventListener('cancel', () => finish({ status: 'canceled' }));
    // Older browsers don't send "cancel". When the page gets focus back with no
    // file chosen, treat it as canceled so the buttons don't stay disabled.
    const onFocus = () =>
      setTimeout(() => {
        if (!input.files?.length) finish({ status: 'canceled' });
      }, 1500);
    window.addEventListener('focus', onFocus);

    input.click();
  });
}

export function deletePhoto(_uri: string): void {
  // Nothing to clean up; the photo lives inside the database row.
}

export function isHeic(file: { type: string; name: string }): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** Any image file in, a resized JPEG data URL out. */
export async function toJpegDataUrl(file: File): Promise<string> {
  let img = await loadImage(file).catch(() => null);
  if (!img && isHeic(file)) {
    // Safari can show HEIC itself; other browsers need it converted first.
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
    img = await loadImage(Array.isArray(converted) ? converted[0] : converted).catch(() => null);
  }
  if (!img) throw new Error("That file couldn't be opened as a photo. JPEG, PNG and HEIC photos all work.");

  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not process the photo.');
  // Transparent PNGs would turn black as JPEGs; give them a white background.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('unreadable'));
    img.src = url;
  }).finally(() => setTimeout(() => URL.revokeObjectURL(url), 0));
}
