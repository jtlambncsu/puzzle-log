# 0025. Recognizing photos that are already in the log

- **Status:** Accepted (extends [0024](0024-album-import-ai-suggestions.md))
- **Date:** 2026-11-22

## Context

The owner imports a few hundred camera-roll photos in batches of about 100, because picking
the whole album stalled. Between batches it was hard to tell what had already been imported.
The import only skipped a photo whose file had exactly the same SHA-256 as an imported one.
That misses three cases:

- the iPhone picker hands over a re-encoded copy (it converts photos to JPEG when picked)
- another shot of a puzzle that's already in the log
- puzzles added by hand, which have no import hashes at all

## Decision

- **Every puzzle stores a visual fingerprint** (`photoFingerprint`): the 64-bit difference
  hash of its photo, as 16 hex characters. New imports save it straight away.
- **Saved puzzles without one get one.** At import, each such photo is downloaded once,
  fingerprinted in the browser and saved. That covers earlier imports, puzzles added by
  hand, and photos rotated since. Replacing a puzzle's photo clears the fingerprint in the
  API, so it's recomputed rather than left stale.
- **A new photo that looks like a saved one is skipped.** The match uses the same "nearly
  identical" threshold as within a batch (at most 10 bits apart). The summary lists each
  match with the new photo, the saved puzzle and its title, and an **Import anyway**
  button. The "taken within minutes" rule doesn't apply here: saved puzzles only have a date.
- **Orientation doesn't matter.** Each picked photo is fingerprinted in all four quarter
  turns, and comparisons use the closest one. Reviewed photos are often saved rotated, and
  a difference hash of a turned picture is unrelated to the upright one.
- **The import page refreshes the puzzle list when it opens** (`revalidateIfStale`), so it
  compares against what's on the server, not a cached copy.
- **Less memory, for big batches:**
  - Fingerprinting makes a 320-pixel thumbnail along the way. The summary shows those
    thumbnails instead of the full-size photos, which were the likely reason a whole album
    stalled.
  - Canvases are zeroed after use, because Safari caps total canvas memory and frees it
    lazily.
  - Uploads run two at a time instead of three.
- **The import page shows progress** ("So far: X imported, Y waiting for review") and says
  that picking the whole album again is safe.

## Alternatives considered

- **Compare against saved photos without storing fingerprints:** download every saved photo
  on every import. That's hundreds of downloads each time. Storing 16 characters per puzzle
  does it once.
- **Compute fingerprints on the server (Lambda):** it would need an image library in the
  Lambda bundle (for example sharp, which is native and platform-specific), and it would
  duplicate the browser code. Doing it in the browser keeps one implementation, and the
  photos are already there at import time.
- **Rotate the saved fingerprint instead of the new photo's:** a difference hash can't be
  rotated as bits. The picture has to be redrawn turned, and only the new photo is at hand
  as pixels during an import.
- **A perceptual-hash library or a vector search service:** a few hundred 64-bit comparisons
  per photo is instant, and stays explainable.

## Consequences

- Picking the whole album every time is the intended workflow: only new puzzles come
  through.
- The first import after this change spends a minute fingerprinting the saved photos, and
  then never again for those puzzles.
- A wrong "already imported" match is visible and reversible (Import anyway). A missed match
  is handled in review ("Same puzzle as…", or delete).
- Whether the thumbnails fully fix the stall on a big album is still to be confirmed on the
  phone. If it still stalls, the iPhone picker preparing hundreds of photos is the next
  suspect, and batches still work because of the deduplication.

## Explaining it in an interview

"Each photo gets a 64-bit perceptual hash in the browser, in all four rotations. We store the
upright one on the record and compare by Hamming distance. That makes re-imports idempotent
even when the bytes differ, because the phone re-encodes photos or the user rotated them. It
also let us lazily backfill fingerprints for older records the first time the import runs."

## Update: large albums on an iPhone

Picking all 462 photos at once still failed. The iPhone picker prepared them for about
30 seconds, then the app showed its start page again with no progress. The page most likely
reloaded because Safari ran out of memory. Changes:

- **The app recommends about 150 photos at a time.** Batches can overlap, since anything
  already in the log is skipped.
- **An import in progress is remembered in `localStorage`.** If the page reloads mid-import,
  the next visit says which step stopped (checking or uploading). No message means the
  photos never reached the page, which points at the picker itself.
- **The progress bar says "Received N photos" straight away.**
- **Less work runs at once:** photos are checked one at a time, and saved puzzles are
  fingerprinted two at a time.
