import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
// @ts-expect-error -- getReactNativePersistence is in the React Native build Metro uses;
// TypeScript only sees the browser types.
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

import { firebaseConfig } from '../firebaseConfig';

// iPhone, iPad and Android. Sign-in is kept in AsyncStorage so she stays signed in.
// The web preview uses firebase.web.ts.

let services: { auth: Auth; db: Firestore; storage: FirebaseStorage } | null = null;

export function firebase() {
  if (services) return services;
  const fresh = getApps().length === 0;
  const app = fresh ? initializeApp(firebaseConfig) : getApp();
  const auth = fresh ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }) : getAuth(app);
  // Long polling is picked automatically where a phone's connection needs it.
  const db = fresh ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }) : getFirestore(app);
  services = { auth, db, storage: getStorage(app) };
  return services;
}
