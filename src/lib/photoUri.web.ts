/** Web preview photos live in the database as data URLs, so they show as they are. */
export function photoUri(ref: string): string {
  return ref;
}
