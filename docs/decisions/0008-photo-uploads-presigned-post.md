# 0008. Photos uploaded straight to S3 with presigned POSTs

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Users photograph finished puzzles on their phones. Photos are several MB; Lambda request
payloads are limited to 6 MB and you pay for the time spent receiving them.

## Decision

1. The browser **compresses** the photo (max 2000 px, JPEG 85%) with a canvas, which also
   strips EXIF metadata such as GPS location.
2. It asks the API for an upload (`POST /api/uploads`). The API returns a **presigned POST**:
   a form the client can submit straight to S3.
3. The browser uploads to S3, then saves the puzzle with the returned `imageKey`.
4. When serving puzzles, the API adds a **presigned GET** URL valid for one hour. The bucket
   stays fully private.

Keys are `uploads/<userId>/<uuid>`, and the API rejects saving a puzzle that points at
another user's key.

## Alternatives considered

- **Upload through the API** — hits Lambda's payload limit and costs more.
- **Presigned PUT** — simpler, but can't enforce a size limit. A presigned POST policy
  enforces `content-length-range` (≤ 10 MB) and the exact content type.
- **Public bucket or CloudFront** — public URLs never expire; CloudFront with signed URLs is
  worth it at scale, overkill here.

## Consequences

- The API never handles image bytes; uploads go device → S3 directly.
- Photo URLs expire after an hour, so the client must refetch puzzles rather than cache URLs
  forever (TanStack Query's 30-second `staleTime` handles this).
- Uploads whose puzzle is never saved leave orphaned objects. Fine for now; an S3 lifecycle
  rule or cleanup job can handle it later.

## Explaining it in an interview

"Clients upload directly to S3 with presigned POSTs, so the API never touches image bytes.
The POST policy lets S3 enforce size and type, keys are scoped per user, the bucket is
private, and the client compresses photos first, which also strips location data."
