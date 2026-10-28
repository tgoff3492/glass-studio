export type PhotoSource = 'camera' | 'library';

export type PhotoResult =
  | { status: 'saved'; uri: string }
  | { status: 'canceled' }
  | { status: 'denied'; source: PhotoSource }
  | { status: 'failed'; message: string };

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
