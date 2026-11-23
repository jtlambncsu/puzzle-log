# 0028. Backup: a spreadsheet and photo zips, made in the browser

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The log now holds a few hundred puzzles and their photos, in one AWS account. The owner
should have a copy they control, in formats that open without this app. Everything is used
from an iPhone, often as the installed app, where downloads behave differently from a
desktop browser and memory is limited.

## Decision

- **Made in the browser, from data it already has.** The puzzle list is cached, and photos
  are downloaded through their signed URLs (S3's CORS already allows it). No new API, no
  server-side job, and no extra AWS cost beyond the photo downloads.
- **Spreadsheet: CSV via Papa Parse.** It's the most widely used CSV library, and it handles
  quoting for commas, quotes and line breaks in notes.
  - One row per puzzle, with readable columns: status, dates, hours spent, tags joined
    with "; ".
  - The file starts with a UTF-8 byte-order mark, so Excel shows accents correctly.
- **Photos: zips of 40, with fflate.**
  - Zipping a few hundred photos at once would hold hundreds of MB in a phone's memory,
    the same limit the big imports hit (ADR 0025).
  - Photos are stored, not compressed again (`level: 0`), because JPEGs don't shrink.
  - File names match the spreadsheet's Photo column (`title-slug-id.jpg`).
- **Saving through the share sheet** (`navigator.share` with files), which gives "Save to
  Files" on iOS, with a normal download as the fallback.
  - Sharing must follow a tap straight away, so a photo part is first **prepared**, and
    then a **Save** button shares it.
- **A More page** (`/more`) holds tools like Import and Backup. The home header keeps two
  buttons (Stats, More), which fit on the smallest phones.

## Alternatives considered

- **Server-side export (a Lambda zips from S3):** it would avoid the phone's memory limit,
  but a big zip outlasts the 30-second API limit. That means a job, storage for the result
  and a download link, which is a lot for a backup run occasionally.
- **JSON only:** complete and easy to re-import, but not readable in a spreadsheet, which is
  what the owner will actually open. CSV covers every field we have.
- **JSZip:** the best-known zip library, but larger and slower than fflate for the same job.
- **Turning on S3 versioning or AWS Backup:** protects against deletion inside AWS, but
  doesn't give the owner a copy outside the account. It's worth considering separately.

## Consequences

- The backup is only as fresh as the moment it's made. The page refreshes the list from
  the server first.
- Very large collections mean more zip parts to save, one tap each.
- There's no import from the CSV yet. The format keeps that possible later.

## Explaining it in an interview

"Export happens entirely client-side: Papa Parse for a correctly escaped CSV, and fflate to
zip photos in fixed-size chunks so a phone never holds hundreds of megabytes at once. On
iOS, the Web Share API with files is the reliable way to save from an installed web app,
and because it needs fresh user activation, preparing and saving are two separate taps."
