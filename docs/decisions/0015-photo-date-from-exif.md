# 0015. Fill "Finished on" from the photo's EXIF date, in the browser

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The owner has a backlog of puzzle photos to log, and typing each completion date is slow.
Phone photos record when they were taken in EXIF metadata (`DateTimeOriginal`).

## Decision

When a photo is picked, the web app reads its EXIF date with **ExifReader** and fills in
"Finished on" (`src/lib/photoDate.ts`, `PuzzleForm.tsx`):

- It reads the **original** file, before `compressImage`, because re-encoding strips EXIF.
- It never overwrites a date already entered, labels the field "Date from photo", and clears
  that date if the photo is removed. Editing the date makes it the user's.
- The date part of the EXIF timestamp is used as-is. EXIF times are the camera's local time
  with no time zone, so converting through `Date` could shift it by a day.
- The library is loaded with a dynamic `import()` the first time a photo is picked, so it
  doesn't slow down the first page load. Bytes are passed, never strings (the library treats
  strings as URLs or file paths).

## Alternatives considered

- **`exifr`** — the best-known EXIF library, but unmaintained since 2022. ExifReader is
  actively maintained and supports JPEG, HEIC, PNG and WebP. (Its MPL-2.0 license only
  requires sharing changes to the library's own files.)
- **Reading EXIF on the server** (e.g. an S3 upload trigger) — the date would only appear
  after saving, and our compression strips EXIF before upload anyway.
- **`File.lastModified`** — on phones it's often the time the file was picked or exported,
  not when the photo was taken.

## Consequences

- Most phone photos fill the date automatically. Screenshots, edited or downloaded images, and
  photos sent through some messaging apps have no EXIF date, so the field stays empty.
- Uploaded photos still have their metadata (including GPS) stripped; only the date is used,
  and only in the browser.
- Tests use small real JPEG fixtures (`src/test/fixtures/`), so the real library is exercised.

## Explaining it in an interview

"To speed up data entry, the form reads the photo's EXIF capture date client-side and
pre-fills the completion date, without overwriting anything the user typed. It has to read
the original file before compression strips the metadata, and it keeps the EXIF date as a
plain calendar date to avoid time-zone off-by-one bugs."
