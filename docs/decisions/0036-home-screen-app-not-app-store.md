# 0036. A home-screen web app, not the App Store: launch screens and install help

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

The owner asked what it would take to publish Puzzle Log in Apple's App Store, but wants to
spend as little money as possible.

Any App Store or TestFlight app needs the Apple Developer Program, at $99 a year. The only
free way to put a real app on an iPhone is installing it from a Mac with a free Apple
account. That needs a Mac the owner doesn't have, the app stops working after 7 days, and
it only goes on their own phone.

The app is already a web app that can be installed ([0020](0020-offline-pwa.md)): Safari's
**Add to Home Screen** gives it an icon, and it opens full screen and works offline.

## Decision

Stay a home-screen web app, and close the two most visible gaps with real apps:

- **Launch screens.**
  - iOS shows a blank white screen while a home-screen web app starts, unless the page
    lists an `apple-touch-startup-image` for that exact screen size.
  - `@vite-pwa/assets-generator`, the companion tool to `vite-plugin-pwa`, made one per
    recent iPhone screen size, in light and dark mode: 22 images, about 400 KB. They're
    committed to `public/splash/`, with the `<link>` tags in `index.html`.
  - They're left out of the offline cache: iOS fetches them itself when the app is
    installed.
  - Regenerate with `npm run generate-splash -w @puzzle-log/web`, then update the links
    from the tool's printed output.
- **Install help.**
  - Safari has no install button that a website can trigger, so most people never find
    Add to Home Screen. A card on the home page explains the steps on iPhones and iPads.
    It can be dismissed, and dismissal is remembered on that device. The More page always
    shows it, so it can be found again.
  - Chrome, Edge and Android fire `beforeinstallprompt`. It's caught at startup and
    offered as an **Install** button instead.
  - The card hides itself inside the installed app (`display-mode: standalone`).
  - Device detection is a pure function (`installMethod`), unit-tested with real user
    agents. That includes iPads, which identify as Macs but have a touch screen.

## Alternatives considered

- **Capacitor (wrap this app as a native iOS app):** keeps the code, and native plugins
  help pass review. Needs the $99 a year, plus Xcode: a Mac or paid cloud Mac builds. The
  right next step if the App Store ever becomes worth paying for.
- **React Native / Expo:** truly native, and Expo builds iOS apps in the cloud without a
  Mac, but it means rewriting every screen and still needs the $99 a year to ship.
- **Free sideloading from Xcode:** expires every 7 days and needs a Mac.

## Consequences

- No cost. The app updates the moment `main` deploys, with no App Store review.
- Some native-only features stay out of reach: widgets, Siri, and appearing in App Store
  search. Web push notifications and icon badges are possible later for installed web
  apps.
- New iPhone screen sizes need launch images regenerated. Until then, those phones show
  the plain background color, as before.

## Explaining it in an interview

"I weighed the App Store against a progressive web app on cost and reach. For a personal
app, the $99-a-year developer account and Mac-only build tools weren't worth it, so I made
the PWA feel native instead. I generated device-specific launch images with the
vite-plugin-pwa assets generator. I also added an install prompt that branches on
capability: Chromium's `beforeinstallprompt` gets a button, Safari gets instructions,
and the logic is a pure, unit-tested function. Capacitor remains the upgrade path, since
it wraps the same React code."
