import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

import { firebaseConfig } from '../firebaseConfig';

// Web preview: the browser keeps the sign-in.
let services: { auth: Auth; db: Firestore; storage: FirebaseStorage } | null = null;

export function firebase() {
  if (services) return services;
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  services = { auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) };
  return services;
}
