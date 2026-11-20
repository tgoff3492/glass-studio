// The web preview keeps photos inside the records, so there are no files to sync.
export const photoFilesSupported = false;
export const hasPhoto = (_name: string) => true;
export const readPhoto = async (_name: string): Promise<Uint8Array> => new Uint8Array();
export const writePhoto = (_name: string, _bytes: Uint8Array) => {};
