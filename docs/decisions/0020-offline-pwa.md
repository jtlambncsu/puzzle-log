# 0020. Installable, offline-capable app (PWA)

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The app's main job happens in shops, where phone signal is often poor. Checking "have I
done this one?" shouldn't need a connection for puzzles already in the log, and the app
should open like a native app from the home screen.

## Decision

- **`vite-plugin-pwa`** (Workbox `generateSW`) adds a web app manifest (name, icons, standalone
  display) and a service worker that **precaches the whole app**, including the ~1 MB barcode
  decoder, so the app opens and scans offline. `registerType: 'autoUpdate'`: new versions
  activate on the next visit. Every page URL falls back to `index.html`.
- **Photos** are cached at runtime (`CacheFirst`). Their S3 URLs are re-signed every hour, so
  the cache key is the URL **without its query string** (a `cacheKeyWillBeUsed` plugin).
  Photo `<img>` tags use `crossOrigin="anonymous"` so responses are readable (CORS) rather than
  opaque, which the cache would refuse (and browsers pad heavily against storage quotas).
- **Data**: TanStack Query's cache is persisted to **IndexedDB**
  (`PersistQueryClientProvider` + `idb-keyval`) for 7 days (`gcTime` matches). The router only
  renders once the cache is restored (`useIsRestoring`). Signing out deletes the saved copy.
- **Auth**: access tokens last an hour. An expired session first tries a **silent refresh**
  (the refresh token lasts 30 days) before showing sign-in, and **offline** with an expired
  session the app shows saved data instead of a sign-in screen it can't complete.
- **Offline UX**: a banner explains that changes need a connection; scanning an unknown box
  offline says it can't be looked up instead of spinning.

## Alternatives considered

- **Hand-written service worker** — full control, but caching strategies, precache manifests
  and update handling are easy to get subtly wrong; Workbox is the standard.
- **Service-worker caching of API responses** — would work, but responses carry per-user auth;
  persisting TanStack Query's cache keeps data handling in one place and makes the UI instantly
  render from it on launch.
- **localStorage persister** — simpler, but synchronous and limited to ~5 MB; IndexedDB is
  async and larger.
- **Offline writes with a sync queue** — useful later (log a puzzle with no signal), but needs
  conflict handling and queued photo uploads. Writes need a connection for now.
- **A native app** — still the long-term option; the PWA gets home-screen install and offline
  use today with no app store.

## Consequences

- After one online visit, the app and your saved puzzles work with no connection.
- Data shown offline can be up to 7 days old (or older on an outdated device), and photos only
  appear offline once they've been viewed online.
- Saved data lives on the device until sign-out; anyone using the unlocked phone could see it.
- iOS may evict PWA storage for apps unused for weeks; the app then simply reloads online.

## Explaining it in an interview

"The service worker precaches the app shell with Workbox, and runtime-caches photos with a
cache key that strips the expiring S3 signature. Data offline comes from TanStack Query's
cache persisted to IndexedDB; I gate the router on cache restoration, because otherwise
loaders fire before the restore and never get persisted. Auth degrades gracefully: try a
silent refresh, and offline, show saved data rather than a sign-in screen."
