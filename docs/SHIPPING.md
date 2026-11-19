# Getting the app onto Kathryn's iPhone and iPad

Right now the app runs in Expo Go from a QR code. Expo Go is fine for trying things, but
it's not a real install: the data lives inside Expo Go, and an Expo Go update can stop the
app from opening. For daily use she needs a real build, through TestFlight.

## What it costs

TestFlight needs a paid **Apple Developer Program** membership: $99 a year. There's no free
way to put an app on someone else's iPhone. A free Apple account can only install on your
own devices from Xcode on a Mac, and those installs stop working after 7 days.

Everything else here is free: Expo's free plan includes cloud builds and over-the-air updates
for an app this size.

## One-time setup (about an hour)

1. Enroll at https://developer.apple.com/programs/ (Apple can take a day or two to approve).
2. Make an Expo account at https://expo.dev, then in this folder:
   ```sh
   npx eas-cli@latest login
   npx eas-cli@latest init                 # links the project and adds its id to app.json
   npx expo install expo-updates
   npx eas-cli@latest update:configure     # lets fixes reach her phone without a reinstall
   ```
3. Build and send to TestFlight. EAS creates the certificates and the App Store Connect
   record for you; answer its questions with your Apple ID.
   ```sh
   npx eas-cli@latest build --platform ios --profile production
   npx eas-cli@latest submit --platform ios --latest
   ```
4. In App Store Connect → the app → TestFlight, add Kathryn as an **internal tester**
   (you add her Apple ID to your team as a user first). Internal testing needs no Apple review.
5. She installs **TestFlight** from the App Store, opens the invite, and taps Install. The
   same Apple ID covers her iPhone and her iPad.

TestFlight builds expire after 90 days. Build again before then, or ship a small update.

## Shipping fixes

- JavaScript-only changes (most of them): `npx eas-cli@latest update --channel production -m "what changed"`.
  She gets it the next time she opens the app twice.
- Anything that adds a native module, or changes app.json: a new build and submit (step 3).

## Before the first real install

- Choose the app's name (`expo.name` in app.json). The home-screen name can differ from the
  App Store name later.
- Make a backup from Settings after she's entered her glass, and make sure she knows where
  it went (iCloud Drive is easiest).
