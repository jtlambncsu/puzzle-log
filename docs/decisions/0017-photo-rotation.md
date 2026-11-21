# 0017. Rotate photos by re-encoding the pixels; PATCH endpoint and photo cleanup

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Most puzzle photos are taken looking straight down at a table. Phones can't tell which way
is "up" in that position, so photos often come out sideways. The owner needs to fix the
rotation of new photos and of photos already saved.

## Decision

**Rotate the actual pixels**, in the browser, as part of the existing canvas compression
(`compressImage(photo, { rotation })` in `src/lib/image.ts`). The stored photo is upright,
so every screen (and the future mobile app) shows it correctly with no extra logic.

- **New photos** (single and bulk forms): a rotate button turns the preview with CSS; the
  chosen rotation is applied when the photo is compressed for upload. No extra work.
- **Saved photos** (detail page): rotate the preview, then "Save rotation" downloads the photo
  (signed S3 URL, which needs a CORS `GET` rule on the bucket), rotates and re-encodes it,
  uploads it as a new object and points the puzzle at it with the new
  **`PATCH /api/puzzles/:id`** endpoint.
- **Photo cleanup:** when a puzzle's photo is replaced or the puzzle is deleted, the API
  deletes the old S3 object (best-effort: a failure is logged, not returned).
- If a rotation is requested but the browser can't decode the image, `compressImage` throws
  rather than silently uploading the unrotated photo.

The PATCH endpoint takes any subset of the create fields (`updatePuzzleSchema`) and uses a
DynamoDB `UpdateItem` with `attribute_exists(id)`, so it never creates items. It's the
foundation for editing puzzles later.

## Alternatives considered

- **Store a `rotation` field and rotate with CSS when displaying** — instant and lossless, but
  every place that shows a photo (list, detail, mobile app, any future export) must apply it,
  and crops/thumbnails get trickier.
- **Rotate on the server** (Lambda with an image library like `sharp`) — keeps clients simple,
  but adds a native dependency, more Lambda memory and time, and the browser already has a
  capable image pipeline.
- **Overwrite the existing S3 object** instead of uploading a new key — browsers and caches
  could keep showing the old image under the same URL; a new key avoids stale caches.

## Consequences

- Re-encoding a saved photo loses a little quality each time (JPEG at 85%). Rotations are
  rare, so this is acceptable; the original full-size photo isn't kept.
- The bucket now allows cross-origin `GET` from the web app (objects are still private:
  only signed URLs work).
- Deleting puzzles no longer leaves orphaned photos. Photos orphaned before this change
  remain.

## Explaining it in an interview

"I fix orientation by rotating the pixels on a canvas during the client-side compression
step, so the stored image is simply correct everywhere. For already-saved photos, the browser
downloads the signed URL, rotates, uploads a new object, and a PATCH swaps the key; the API
then cleans up the old object. A metadata flag would have been cheaper but pushes rotation
logic into every client."
