# Glass Studio

An app for stained and fused glass artists to track their glass, supplies, projects and kiln firings. Built first for one artist's home studio, on iPhone and iPad.

"Glass Studio" is a working name until the app has a real one.

## What it does (planned)

- **Glass inventory:** sheet glass, frit, stringers and scrap, with COE (90 or 96) on every item
- **Supplies:** copper foil, solder, came, kiln wash, fiber paper, with low-stock alerts and a shopping list
- **Projects:** each piece linked to the glass and supplies it used, with a COE check for fused work
- **Kiln log:** a library of firing schedules and a log of every firing
- **Costing:** cost per piece and a pricing helper

See [docs/ROADMAP.md](docs/ROADMAP.md) for the build order.

## Status

Phase 0 (foundation) is in place: the app shell with Glass, Supplies, Projects and Kiln tabs, the local database and its schema, and photo storage. Each tab says what's coming in its phase. Cloud backup and sign-in are still to come.

## Web preview

A browser version of the app is published at https://tgoff3492.github.io/glass-studio/ for quick previews. Rebuild and republish it with `npm run deploy:web`. The real app is the iPhone and iPad build; the preview is for looking, not daily use, since anything entered there is stored only in that browser.

## Tech

- [Expo](https://expo.dev) SDK 58 with React Native and TypeScript, so the same code can ship to Android later
- Expo Router for navigation (screens live in `src/app/`)
- expo-sqlite for on-device storage, with versioned migrations in `src/db/migrations.ts`
- expo-image-picker and expo-file-system for photos, copied into the app's own storage

## Project layout

```
src/
  app/            screens (every file is a route)
    (tabs)/       Glass, Supplies, Projects, Kiln
  components/     shared UI
  db/             types, migrations, database setup
  domain/         rules about glass, such as COE compatibility
  lib/            device helpers such as photos
  theme/          colors, type sizes, spacing
docs/ROADMAP.md   build order and features by phase
```

## Running it

Requires Node 22 or later.

```sh
npm install
npx expo start
```

Scan the QR code with the camera on an iPhone or iPad that has Expo Go installed.

Checks:

```sh
npm run typecheck
npm run lint
npm test
```

Tests use Node's built-in test runner and SQLite, so they run without a phone or simulator.
