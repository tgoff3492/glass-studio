# Sync between Kathryn's iPhone and iPad

Katharos keeps everything on the device first (SQLite), so it works with no signal. When
she's signed in, changes also go to Firebase and come down on her other device.

## Firebase project

- Project: `katharos-ab9e0` (console: https://console.firebase.google.com/project/katharos-ab9e0)
- Sign-in: email and password
- Records: Cloud Firestore, `us-south1` (Dallas), at `users/{uid}/rows/{table}:{id}`
- Photos: Cloud Storage, `us-central1` (Iowa, in Google's free tier), at `users/{uid}/photos/{file}`
- Rules: `firebase/firestore.rules` and `firebase/storage.rules`. Only the signed-in person
  can read or write their own data. To change them, edit the files and paste them into
  the console's Rules tabs, or run `npx firebase-tools deploy --only firestore:rules,storage`.
- The web app settings in `src/lib/firebaseConfig.ts` are public by design; the rules are
  what protect the data.

## How it works

- Triggers on each synced table note every change in `sync_outbox` (migration 10), so no
  screen has to remember to sync.
- `src/db/syncRepo.ts` turns those into documents and applies documents that arrive. It
  knows nothing about Firebase and is tested with two in-memory devices (`sync.test.ts`).
- `src/lib/sync/manager.ts` sends changes a couple of seconds after they happen, listens
  live for changes from the other device, and moves photos.
- The newest write to a row wins. A change made on this device and not yet sent is kept
  until it's sent.
- The first sign-in on a device sends everything already on it, so nothing is left behind.
- Per-device settings (last backup, welcome seen) don't sync; pricing does.

## After Kathryn's account exists

Turn off new sign-ups so nobody else can make an account in this project:
Authentication → Settings → User actions → uncheck "Enable create (sign-up)". She can
still sign in on any device.

## Testing on the web preview

Open the preview twice, once with `?device=2` added to the address. Each tab gets its own
local database, like two devices, and both use the same sign-in.
