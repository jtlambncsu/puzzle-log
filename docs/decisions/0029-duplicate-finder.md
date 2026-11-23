# 0029. Duplicate finder: photo fingerprints and titles, decided by the owner

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The album was imported in overlapping batches before already-imported photos could be
recognized (ADR 0025), so some puzzles may be in the log twice. They might share a photo
(the same shot imported twice) or a title (two shots of one puzzle that the AI named alike).

## Decision

- **A Duplicates page** (`/duplicates`, from More) groups puzzles that match in either way.
  - **Photo:** stored fingerprints at most 10 bits apart, the same "nearly identical"
    threshold as the import.
  - **Title:** identical once case, accents and punctuation are ignored. The "Imported
    puzzle" placeholder is excluded.
  - Matches chain with union-find, as in the import. Each group shows why it matched.
- **The owner decides.** Each copy shows its photo, status and dates, with a delete
  button that asks to confirm first. **Not duplicates** hides that group.
- **"Not duplicates" is remembered on the device (`localStorage`).** It's a convenience:
  if it's lost, the pairs just show again. Keeping it out of the data model avoids a
  schema field for something this minor.
- **Unchecked photos:** puzzles without a fingerprint (added by hand, or rotated) can be
  checked from the page, using the same backfill as the import. That runs on a tap, not
  automatically, so the downloads are visible and intentional.
- Everything runs in the browser on data already cached. No API changes, no AI cost.

## Alternatives considered

- **Merging duplicates automatically (keep one, combine tags and notes):** convenient, but
  a wrong merge loses data, and which copy has the better details is a judgement call.
  Deleting with confirmation is explicit and reversible up to the tap.
- **Rotation-aware photo matching:** saved puzzles store only the fingerprint of the photo
  as displayed, so a copy saved turned differently won't match by photo. Computing all four
  orientations for every saved photo would mean downloading them all each time. Title
  matching catches many of those cases.
- **Fuzzy title matching:** more matches, but many false ones in a collection with similar
  names (e.g. series by the same artist).

## Consequences

- With a few hundred puzzles, comparing every pair is tens of thousands of checks, which
  runs instantly in the browser.
- "Not duplicates" choices don't follow the owner to another device.

## Explaining it in an interview

"It reuses the perceptual hashes from the import and adds normalized-title matching, then
groups matches with union-find. Destructive actions stay manual and confirmed. The 'not a
duplicate' choice lives in localStorage on purpose: it's a convenience that's cheap to
lose, so it doesn't earn a place in the data model."
