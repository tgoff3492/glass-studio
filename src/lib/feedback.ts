import Constants from 'expo-constants';
import { Platform, Share } from 'react-native';

import { readErrors } from './errorLog';

/** The note plus what Taylor needs to know to fix things: app version, device, and recent errors. */
export function buildNote(note: string): string {
  const version = Constants.expoConfig?.version ?? 'unknown';
  const device = `${Platform.OS === 'ios' ? (Platform.isPad ? 'iPad' : 'iPhone') : Platform.OS} ${String(Platform.Version)}`;
  const errors = readErrors().slice(0, 5);
  const lines = [note.trim() || '(no message)', '', '—', `Katharos ${version} on ${device}`];
  if (errors.length > 0) {
    lines.push('', 'Recent problems:');
    for (const e of errors) lines.push(`• ${e.at.slice(0, 16).replace('T', ' ')} ${e.where}: ${e.message}`);
  }
  return lines.join('\n');
}

/**
 * Opens the share sheet with the note, so she can send it by Messages, Mail or anything
 * else she uses. A photo (such as a screenshot) goes along when given; iOS supports one.
 */
export async function sendNote(note: string, photoUri?: string | null): Promise<boolean> {
  const message = buildNote(note);
  const result = await Share.share(Platform.OS === 'ios' && photoUri ? { message, url: photoUri } : { message, title: 'A note about Katharos' }, {
    subject: 'A note about Katharos',
  });
  return result.action === Share.sharedAction;
}
