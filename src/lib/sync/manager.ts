import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { Timestamp, collection, doc, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import type { SQLiteDatabase } from 'expo-sqlite';
import { AppState } from 'react-native';

import {
  applyIncoming,
  deviceId,
  getSyncState,
  markPhotoUploaded,
  markSent,
  nextOutgoing,
  pendingCount,
  photosNotUploaded,
  prepareForAccount,
  referencedPhotos,
  setSyncState,
  type SyncDoc,
} from '@/db/syncRepo';
import { dataChanged, onDataChanged } from '../dataChanged';
import { logError } from '../errorLog';
import { shoppingChanged } from '../shoppingCount';
import { firebase } from './firebase';
import { hasPhoto, photoFilesSupported, readPhoto, writePhoto } from './photoFiles';

// Keeps this device and the cloud in step while she's signed in:
//  - changes made here go up a couple of seconds after she makes them;
//  - changes from her other device come down as they happen, through a live listener;
//  - photos go up and come down after the records.
// Everything still works with no connection; it catches up when the connection is back.

export type SyncStatus = {
  signedIn: boolean;
  email: string | null;
  phase: 'signed-out' | 'syncing' | 'synced' | 'offline';
  pending: number;
  lastSyncedAt: string | null;
  /** Something she should know about photos, such as photo storage not being turned on yet. */
  photoNote: string | null;
};

let status: SyncStatus = { signedIn: false, email: null, phase: 'signed-out', pending: 0, lastSyncedAt: null, photoNote: null };
const listeners = new Set<(s: SyncStatus) => void>();

export function getSyncStatus(): SyncStatus {
  return status;
}

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l(status));
}

let db: SQLiteDatabase | null = null;
let user: User | null = null;
let stopListening: Unsubscribe | null = null;
let pushing = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

/** Called once at launch. Sync runs whenever she is signed in. */
export function startSync(database: SQLiteDatabase): void {
  if (started) return;
  started = true;
  db = database;
  const { auth } = firebase();
  onAuthStateChanged(auth, (u) => {
    user = u;
    stopLive();
    if (!u) {
      setStatus({ signedIn: false, email: null, phase: 'signed-out', pending: 0 });
      return;
    }
    setStatus({ signedIn: true, email: u.email, phase: 'syncing' });
    (async () => {
      if (!db) return;
      await prepareForAccount(db, u.uid);
      await refreshPending();
      startLive();
      await syncNow();
    })().catch((e) => logError(e, 'sync start'));
  });
  // Local changes: send them shortly after, so a burst of taps goes up together.
  onDataChanged(() => schedulePush());
  setInterval(() => schedulePush(0), 30_000);
  AppState.addEventListener('change', (s) => {
    if (s === 'active' && user) {
      startLive();
      schedulePush(0);
    } else if (s === 'background') {
      schedulePush(0);
    }
  });
}

function schedulePush(delay = 2000) {
  if (!user) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    syncNow().catch((e) => logError(e, 'sync'));
  }, delay);
}

async function refreshPending() {
  if (db) setStatus({ pending: await pendingCount(db) });
}

/** Sends what's waiting, then catches up photos. Safe to call any time. */
export async function syncNow(): Promise<void> {
  if (!db || !user || pushing) return;
  pushing = true;
  const uid = user.uid;
  try {
    const me = await deviceId(db);
    const { db: fs } = firebase();
    for (;;) {
      const out = await nextOutgoing(db, me);
      if (out.sent.length === 0) break;
      setStatus({ phase: 'syncing', pending: await pendingCount(db) });
      const batch = writeBatch(fs);
      for (const d of out.docs) {
        batch.set(doc(fs, 'users', uid, 'rows', `${d.table}:${d.id}`), { ...d, updatedAt: serverTimestamp() });
      }
      await batch.commit();
      await markSent(db, out.sent);
    }
    await syncPhotos(uid);
    setStatus({ phase: 'synced', pending: await pendingCount(db), lastSyncedAt: new Date().toISOString() });
  } catch (err) {
    logError(err, 'sync push');
    setStatus({ phase: 'offline', pending: await pendingCount(db) });
  } finally {
    pushing = false;
  }
}

/** Listens for changes from her other device, starting after the last one this device saw. */
function startLive() {
  if (!db || !user || stopListening) return;
  const uid = user.uid;
  const database = db;
  const { db: fs } = firebase();
  (async () => {
    const since = Number((await getSyncState(database, 'pulled_through')) ?? '0');
    const me = await deviceId(database);
    const q = query(collection(fs, 'users', uid, 'rows'), where('updatedAt', '>=', Timestamp.fromMillis(since)), orderBy('updatedAt'));
    stopListening = onSnapshot(
      q,
      { includeMetadataChanges: false },
      async (snap) => {
        const docs: SyncDoc[] = [];
        let newest = since;
        for (const change of snap.docChanges()) {
          if (change.type === 'removed') continue;
          const data = change.doc.data({ serverTimestamps: 'none' });
          const at = data.updatedAt as Timestamp | null;
          if (!at) continue; // our own write, not confirmed yet
          newest = Math.max(newest, at.toMillis());
          docs.push({ table: data.table, id: data.id, data: data.data ?? null, device: data.device });
        }
        if (docs.length === 0) return;
        const result = await applyIncoming(database, docs, me);
        await setSyncState(database, 'pulled_through', String(newest));
        if (result.applied > 0) {
          dataChanged();
          shoppingChanged();
          syncPhotos(uid).catch((e) => logError(e, 'sync photos'));
        }
        setStatus({ phase: 'synced', lastSyncedAt: new Date().toISOString() });
      },
      (err) => {
        logError(err, 'sync listen');
        setStatus({ phase: 'offline' });
        stopListening = null;
      },
    );
  })().catch((e) => logError(e, 'sync listen start'));
}

function stopLive() {
  stopListening?.();
  stopListening = null;
}

const PHOTO_BATCH = 12;

/** Uploads photos the cloud doesn't have yet, and downloads ones this device is missing. */
async function syncPhotos(uid: string): Promise<void> {
  if (!db || !photoFilesSupported) return;
  const { storage } = firebase();
  const names = await referencedPhotos(db);
  try {
    const toUpload = (await photosNotUploaded(db, names)).filter(hasPhoto).slice(0, PHOTO_BATCH);
    for (const name of toUpload) {
      const bytes = await readPhoto(name);
      await uploadBytes(ref(storage, `users/${uid}/photos/${name}`), bytes, { contentType: contentType(name) });
      await markPhotoUploaded(db, name);
    }
    const missing = names.filter((n) => !hasPhoto(n)).slice(0, PHOTO_BATCH);
    let downloaded = 0;
    for (const name of missing) {
      try {
        const buf = await getBytes(ref(storage, `users/${uid}/photos/${name}`));
        writePhoto(name, new Uint8Array(buf));
        await markPhotoUploaded(db, name);
        downloaded++;
      } catch (e) {
        // Not uploaded by the other device yet; it'll be there next time.
        if (!String((e as { code?: string }).code).includes('object-not-found')) throw e;
      }
    }
    if (downloaded > 0) dataChanged();
    setStatus({ photoNote: null });
  } catch (err) {
    const code = String((err as { code?: string }).code ?? '');
    logError(err, 'sync photos');
    setStatus({
      photoNote:
        code.includes('unauthorized') || code.includes('bucket') || code.includes('project-not-found') || code.includes('unknown')
          ? 'Photos will sync once photo storage is turned on.'
          : 'Some photos haven’t synced yet. They’ll try again shortly.',
    });
  }
}

const contentType = (name: string) => (/\.png$/i.test(name) ? 'image/png' : /\.heic$/i.test(name) ? 'image/heic' : 'image/jpeg');

// ---------- signing in ----------

export type AuthResult = { ok: true } | { ok: false; message: string };

function friendly(err: unknown): string {
  const code = String((err as { code?: string }).code ?? '');
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'That email and password don’t match. Check them, or tap “Forgot password?”.';
  if (code.includes('email-already-in-use')) return 'There’s already an account with that email. Sign in instead.';
  if (code.includes('weak-password')) return 'Use a password with at least 6 characters.';
  if (code.includes('invalid-email')) return 'That email address doesn’t look right.';
  if (code.includes('network')) return 'No internet connection. Try again when you’re online.';
  if (code.includes('too-many-requests')) return 'Too many tries. Wait a few minutes, then try again.';
  if (code.includes('admin-restricted') || code.includes('operation-not-allowed')) return 'New accounts are turned off for this app. Ask Taylor.';
  return 'Something went wrong signing in. Try again, or send Taylor a note.';
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    await signInWithEmailAndPassword(firebase().auth, email.trim(), password);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: friendly(e) };
  }
}

export async function createAccount(email: string, password: string): Promise<AuthResult> {
  try {
    await createUserWithEmailAndPassword(firebase().auth, email.trim(), password);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: friendly(e) };
  }
}

export async function resetPassword(email: string): Promise<AuthResult> {
  try {
    await sendPasswordResetEmail(firebase().auth, email.trim());
    return { ok: true };
  } catch (e) {
    return { ok: false, message: friendly(e) };
  }
}

/** Stops syncing on this device. Everything stays here; it's just no longer kept in step. */
export async function signOut(): Promise<void> {
  await syncNow().catch(() => {});
  await fbSignOut(firebase().auth);
}
