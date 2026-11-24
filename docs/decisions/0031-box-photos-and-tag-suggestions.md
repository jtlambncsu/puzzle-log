# 0031. Box photos, and AI tag suggestions on request

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

Puzzles on the wishlist or the shelf have no finished photo, so their cards were blank. The
owner wants to add a photo of the box, and to ask AI for tags when adding or editing a
puzzle (not only for imports).

## Decision

**Box photos are a second, optional photo per puzzle (`boxImageKey`).**

- They're uploaded like the finished photo: presigned POST, under the user's folder, with
  the same ownership check. The API adds `boxImageUrl`, and deletes the old file when it's
  replaced or removed, or when the puzzle is deleted.
- Cards and other thumbnails show the box when there's no finished photo.
- The add form has a "Box photo (optional)" picker.
- The puzzle page can add, replace or remove the box photo, and add a finished photo to a
  puzzle that has none (e.g. once a wishlist puzzle is done).
- Backups include box photos (`…-box.jpg`), and the spreadsheet has a "Box photo" column.
- Fingerprints and duplicates stay based on the finished photo, which is what imports
  compare against.

**Tag suggestions are a button, not automatic.**

- `POST /api/suggestions/tags` takes a title, a brand and up to two of the user's own photo
  keys, and returns 2 to 5 tags.
  - Claude Sonnet 5.5, effort low, structured output, the user's existing tags in the prompt
    so spellings match, refusal fallbacks on, at most 4,000 tokens.
  - Nothing is saved: the form adds the tags, and the owner removes what they don't want.
- In the add form, chosen photos are uploaded when the button is pressed, so the AI can see
  them. Each upload is remembered (by file and rotation) and reused when saving, so a photo
  is never uploaded twice.
- When editing, the saved puzzle's photos are used.

## Alternatives considered

- **A list of photos per puzzle:** more flexible, but every screen would need to choose
  which photo to show. Two named photos (finished, box) match how the owner thinks about
  them.
- **Suggesting tags automatically when a photo is picked:** it costs money on every add, and
  surprises the user. An explicit button keeps AI spending a choice.
- **Sending photos to the AI as base64 straight from the browser:** it would mean an image
  upload through the API (the 100 KB body limit, and Lambda payload sizes). Uploading to S3
  first reuses the normal path, and the same file becomes the saved photo.
- **Reading the title, brand and pieces from the box photo:** promising, since a box shows
  all three, but it's a separate feature. The tag endpoint keeps its scope. (Built later:
  [0034](0034-fill-in-from-box.md).)

## Consequences

- A photo uploaded for suggestions but then removed before saving is left in S3 unused.
  It's rare and tiny, and the same as abandoning an add today.
- Box photos are only checked for type and size like other uploads. They aren't
  fingerprinted.

## Explaining it in an interview

"Box photos reuse the existing upload pipeline: same presigned POST, same ownership checks,
cleanup on replace and delete, so it was mostly a schema field and UI. Tag suggestions are
an explicit, idempotent 'suggest' call that returns data and saves nothing. The form
uploads photos lazily for it and memoizes the upload by file and rotation, so saving
doesn't upload them again."
