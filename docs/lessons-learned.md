# Lessons learned

Real problems hit while building this, how they were found, and the fix. Each one is a good
"tell me about a bug you debugged" story.

## Offline cache that never saved anything

**Symptom:** with the network cut in a real browser, reloading the app showed an empty page
(a loading skeleton forever), even though the puzzle list had just loaded online. Unit tests
passed. IndexedDB, where the cache should have been saved, was empty.

**Cause:** a race between two startup steps. `PersistQueryClientProvider` restores the saved
cache asynchronously and only _starts saving changes after the restore finishes_. Meanwhile the
router's loader had already fetched the puzzle list, during the restore. Online, that fetch
finished before saving began, so nothing ever changed afterwards and nothing was saved.
Offline, the loader's request was paused waiting for a connection.

**Fix:** don't render the router until the restore is done (`useIsRestoring()` in `main.tsx`).

**Takeaway:** anything that reads data outside React hooks (route loaders, prefetching) can
run before hydration-style setup completes. Test offline behaviour in a real browser with the
network actually off: jsdom has no service worker or IndexedDB timing to expose this.

## GitHub OIDC subject format changed

**Symptom:** the first deploy failed with
`Not authorized to perform sts:AssumeRoleWithWebIdentity`.

**Cause:** GitHub changed the OIDC token's `sub` claim for repositories created after
July 15, 2026 to include immutable numeric IDs: `repo:owner@123/name@456:ref:refs/heads/main`.
The IAM trust policy expected the older `repo:owner/name:ref:refs/heads/main`, so it never
matched.

**Fix:** the role trusts both formats (`infra/lib/github-deploy-stack.ts`).

**Takeaway:** when federated auth fails, compare the _actual_ token claims with the trust
policy's conditions. The IDs exist so a deleted-and-recreated repo with the same name can't
inherit your cloud access.

## CORS preflights blocked by the authorizer

**Symptom:** found by testing the live API after adding login, before anyone hit it: an
`OPTIONS` request from the Vercel origin returned **401**.

**Cause:** browsers send a CORS preflight (`OPTIONS`, no credentials) before cross-origin
requests with an `Authorization` header. With a catch-all `$default` route, API Gateway routed
preflights to the JWT authorizer, which rejected them. Browsers require a 2xx preflight, so
every real request would have been blocked.

**Fix:** an unauthenticated `OPTIONS /{proxy+}` route (`infra/lib/api-stack.ts`).

**Takeaway:** preflights never carry credentials, so any auth layer in front of a
cross-origin API must let them through. Test with `curl -X OPTIONS -H 'Origin: …'`.

## A cached image breaks a CORS fetch of the same URL (Safari "Load failed")

**Symptom:** on an iPhone, "Save rotation" failed with a toast saying only "Load failed"
(Safari's message for a blocked or failed `fetch`). The API and the bucket's CORS rules both
checked out with `curl`.

**Cause:** the detail page first shows the photo with an `<img>`. Image requests send no
`Origin` header, so S3 answers without CORS headers, and without `Vary: Origin`, because it
only adds those when a request has an `Origin`. Safari caches that response. Rotating then
calls `fetch()` on the _same signed URL_; Safari serves the cached copy, which has no
`Access-Control-Allow-Origin`, so the browser blocks it.

Reproduced with curl: `GET` with `Origin` → CORS headers and `Vary: Origin`; `GET` without
`Origin` → neither.

**Fix:** download with `fetch(url, { cache: 'no-store' })` so the request goes to S3 with its
`Origin` header (`downloadPhoto` in `apps/web/src/api/queries.ts`), plus a clearer error
message than "Load failed".

**Takeaway:** when the same URL is used by both `<img>` (no CORS) and `fetch`/canvas
(CORS), caches can mix the two up. Bypass the cache for the CORS request, or load the image
with `crossorigin="anonymous"` everywhere. "Load failed" in Safari is almost always CORS or
the network: check the exact request with and without `Origin`.

## A new HTTP method missing from the CORS allow-list

**Symptom:** found right after merging the photo-rotation PR, before it was used: a preflight
for `PATCH` from the web app's origin returned 204 with **no** CORS headers.

**Cause:** the new `PATCH /api/puzzles/:id` endpoint worked (and was tested) in the API, but
API Gateway's CORS configuration only listed `GET, POST, DELETE`. Browsers check the preflight
response before sending a cross-origin `PATCH`, so the request would have been blocked.
Unit tests and MSW don't enforce CORS, so nothing failed.

**Fix:** add `PATCH` to `allowMethods`, plus a CDK test listing every method the web client
uses.

**Takeaway:** CORS is enforced by the browser, not your server or test runner. Adding an HTTP
method or a custom header means updating the CORS config, and checking with
`curl -X OPTIONS -H 'Origin: …' -H 'Access-Control-Request-Method: PATCH'` after deploy.

## An unset GitHub variable is an empty string

**Symptom:** Cognito's login page showed "An error was encountered with the requested page."

**Cause:** the deployed app client only allowed `http://localhost:5173` as a redirect URL. The
workflow passes `WEB_URLS: ${{ vars.WEB_URLS }}`; when the variable doesn't exist, GitHub
substitutes `''`. The code fell back to the default with `??`, which only catches
`null`/`undefined`, so the empty string won and produced an empty list.

**Fix:** a `listSetting()` helper that treats blank as missing, with tests
(`infra/lib/config.ts`).

**Takeaway:** environment variables are strings; "unset" often arrives as `''`. Know the
difference between `??` and `||`, and inspect the _deployed_ configuration
(`aws cognito-idp describe-user-pool-client`) rather than trusting the code.

## Renamed library options can fail silently

**Symptom:** none. Found while fixing a type error during an upgrade.

**Cause:** MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`. The old option was
ignored at runtime, so tests that made unexpected requests wouldn't have failed.

**Takeaway:** typecheck test code too, and read changelogs for major-version upgrades.

## Shrinking a photo to 9×8 pixels on a canvas samples, it doesn't average

**Symptom:** the import found exact copies but never grouped two shots of the same puzzle.
Unit tests passed: they fed in made-up fingerprints, because jsdom can't decode images.

**Cause:** the duplicate check shrinks each photo to 9×8 grey pixels. A single
`drawImage(photo, 0, 0, 9, 8)` on a canvas reads only a handful of the 2 million source
pixels, so the result depends on exactly which pixels it happens to hit. Re-creating the
fingerprint in Python showed it: with area averaging, a slightly cropped re-shoot was 5 bits
from the original; with nearest-pixel sampling, 28, the same as unrelated puzzles.

**Fix:** halve the image step by step (each halving averages 2×2 pixels), draw it at 8 pixels
per cell, and average the cells in code. The test photos also showed a different puzzle only
21 bits away, so the looser "taken minutes apart" threshold went from 22 to 16.

**Takeaway:** when tests can't run the real thing (here, image decoding), check it once in a
real browser with realistic input, and measure the numbers your thresholds depend on instead
of guessing them.
