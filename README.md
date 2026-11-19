# Katharos

An app for stained and fused glass artists to track their glass, supplies, projects and kiln firings. Built first for one artist's home studio, on iPhone and iPad.

The app is called **Katharos**: Greek for pure and clear, a word long tied to the name Kathryn. (It was "Glass Studio" while in development; the repository and the marker inside backup files keep that name.)

## What it does (planned)

- **Glass inventory:** sheet glass, frit, stringers and scrap, with COE (90 or 96) on every item
- **Supplies:** copper foil, solder, came, kiln wash, fiber paper, with low-stock alerts and a shopping list
- **Projects:** each piece linked to the glass and supplies it used, with a COE check for fused work
- **Kiln log:** a library of firing schedules and a log of every firing
- **Costing:** cost per piece and a pricing helper

See [docs/ROADMAP.md](docs/ROADMAP.md) for the build order.

## Status

Phase 0 (foundation) is in place: the app shell with Glass, Supplies, Projects and Kiln tabs, the local database and its schema, and photo storage. Cloud backup and sign-in are still to come.

Phase 1 (glass inventory) is built: add, edit and delete sheet glass, frit, powder, stringers, noodles, confetti, dichroic and scrap; COE on every item, required for fusing-only glass; sheets counted by size ("3 × 12×12 · 4 × 6×12") with per-size +/− and searchable sizes, or as a plain count; sheet and fired photos; quick +/− for quantity; search by color, maker or code; filters by kind, COE and color family; and barcode scanning (a known label opens its glass, a new one can be added or linked; codes can also be typed).

Phase 2 (supplies and shopping) is built: stained-glass supplies (foil, solder, came, flux, patina, grinder bits) and fusing supplies (kiln wash, fiber paper, shelf paper, molds), each with an optional low-stock reminder; a shopping list where running-low supplies appear on their own, plus anything added by hand or from a glass or supply page.

Data safety and delivery are built: photos are saved by name rather than by full file address (so they survive an iOS restore), a **Settings** tab saves everything (database and photos) into one backup file to keep in iCloud Drive and restores from one, the app quietly copies the database before every update and once a week, a crash shows a friendly screen instead of a blank app, and "Send Taylor a note" shares a message with the app version and recent problems attached. A first-launch welcome animation for Kathryn and a matching rose-window icon are in place. See [docs/SHIPPING.md](docs/SHIPPING.md) for getting it onto her iPhone and iPad through TestFlight.

Everyday polish is built: an **Undo** bar after quick changes (the +/− buttons, Put back, removing from the shopping list), where a burst of taps undoes together; **Make this again** on a project, which shows how many more she has materials for and starts a numbered copy that takes the same glass and supplies; **What it cost** on each project, from the prices she entered plus bench time at her hourly rate, with a starting price at her own markup (set both in Settings); and an **iPad layout** with the list and the open item side by side on Inventory and Projects. The Kiln tab is hidden for now because her kiln has its own app; the kiln tables stay for a possible link later.

Faster entry is built: a built-in catalog of Bullseye (COE 90) and Oceanside (COE 96) glass fills in the form from a code or color ("1101", "SF523.2W", "cobalt") and from scanned labels it recognizes; "Add another like this" on a glass page; a "remind me when I'm down to" amount for glass, which puts favorite colors on the shopping list; cutting part of a sheet for a project, with the leftover going back as a smaller size or into a scrap bin that keeps the glass's COE; and a bench timer on each project.

Phase 3 (projects) is built: stained or fused projects with status steps that fit each craft, pattern and progress photos, glass and supplies pulled from inventory (by size for sized sheets) with put-back, a COE warning for fused pieces before and after mixing 90 and 96, and delete that either returns materials or leaves them used. Glass pages list the projects that use them. The Kiln tab still shows what's coming.

## Layout

Four tabs: **Inventory** (a Glass / Supplies switch), **Shopping** (with a badge counting what's to buy), **Projects** and **Settings** (backup, restore, pricing, send a note). On an iPad, Inventory and Projects show the list and the open item side by side (`src/components/split.tsx`). The Kiln screen is still in the code, hidden from the tab bar. Photos accept JPEG, PNG and HEIC; in the web preview, HEIC is converted to JPEG and "Take photo" opens the camera on phones and tablets.

## Web preview

A browser version of the app is published at https://tgoff3492.github.io/glass-studio/ for quick previews. Rebuild and republish it with `npm run deploy:web`. The real app is the iPhone and iPad build; the preview is for looking, not daily use, since anything entered there is stored only in that browser.

## Tech

- [Expo](https://expo.dev) SDK 58 with React Native and TypeScript, so the same code can ship to Android later
- Expo Router for navigation (screens live in `src/app/`)
- expo-sqlite for on-device storage, with versioned migrations in `src/db/migrations.ts`
- expo-image-picker and expo-file-system for photos, copied into the app's own storage and saved in the database by name (`photos/<id>.jpg`)
- fflate and expo-sharing for backups: one .zip with the database and photos, written and read a piece at a time
- react-native-svg and expo-haptics for the welcome animation; the icon is drawn from the same rose window (`scripts/make-icons.ts`)
- The glass catalog is generated from the makers' published lists by `scripts/catalog/build.py`

## Project layout

```
src/
  app/            screens (every file is a route)
    (tabs)/       Inventory (Glass / Supplies), Shopping, Projects, Kiln
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
