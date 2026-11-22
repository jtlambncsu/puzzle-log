# 0027. Find details online with web search in the Message Batches API

- **Status:** Accepted
- **Date:** 2026-11-22

## Context

After importing a few hundred photos, most puzzles have an AI-suggested title and tags, but
no brand, piece count or barcode. The barcode matters most: scanning a box in a shop, and
the planned share link for family, both match puzzles by barcode. The boxes are packed away,
so the barcodes can't simply be scanned.

## Decision

**Claude searches the web for each puzzle, and proposes details for the owner to apply.**

- **Model and tools:** Claude Sonnet 5.5 with the server-side `web_search` and `web_fetch`
  tools, at `medium` effort. It gets the puzzle's photo and what's known about it, compares
  product images with the photo, and answers by calling a `report_details` tool:
  - The tool is `strict`, so the API guarantees the answer matches its schema.
  - Forced tool use isn't available on this model, so the prompt asks for exactly one call,
    and a missing report counts as "couldn't finish".
- **Message Batches API instead of live calls:** a search plus reading pages takes longer
  than API Gateway's 30-second limit. A batch runs in the background, usually within an
  hour, at half the token price.
  - `POST /api/details/jobs` reads up to 10 puzzles' photos from S3 and sends them as one
    batch. Photos are embedded (base64), because a presigned link would expire before the
    batch runs.
  - `GET /api/details/jobs` lists jobs. For a batch that has ended, it also saves the results
    onto the puzzles, within an 18-second budget, recording which ones it saved so the next
    call carries on.
  - The web page polls every 30 seconds while a batch is running. That polling is what moves
    jobs along, so there's no scheduler, queue or second Lambda.
- **Nothing changes without the owner.** Results are stored as a `details` proposal on the
  puzzle. The review card shows "current → proposed" with a tick box per field, plus source
  links. Applying or dismissing sends a normal PATCH with `details: null`. Clients can only
  remove a proposal, never write one.
- **Barcodes are double-checked:**
  - a barcode with a wrong check digit is dropped
  - the rest are looked up in UPCitemdb (through the existing cache), and the result is
    `confirmed`, `mismatch` or `unverified`
  - a `mismatch` starts unticked, with a warning
- **Each puzzle is searched once.** The API stamps `detailsSearchedAt` when a puzzle is found
  or not found. Failures (errors, refusals, running out of steps) aren't stamped, so they're
  retried.
- **Costs are capped and measured:**
  - at most 4 searches and 2 page reads per puzzle
  - each result's usage gives an estimated cost
  - the page shows the real average after the 10-puzzle trial, and prices bigger runs on it

## Alternatives considered

- **Live calls with streaming, or a longer-running Lambda behind a queue (SQS):** live calls
  hit the 30-second limit, and a queue means more infrastructure. Batches are cheaper and
  need neither.
- **Structured outputs instead of a report tool:** with web search, the reply text carries
  citations, and a single strict tool call is the most predictable way to get one JSON
  answer out of a turn that also searches.
- **A barcode database search by title (UPCitemdb's search endpoint):** free, but titles from
  photos rarely match listing names exactly, and the free tier allows about 100 calls a day.
  It's used here only to double-check what web search found.
- **Reverse image search services:** no affordable official API, and the results still need
  interpreting.
- **Apply results automatically:** faster, but a wrong barcode is worse than none. Review
  takes seconds per puzzle.

## Consequences

- Batches can take up to 24 hours, and the owner sees results only after the page has
  polled once the batch ends.
- The cost estimate uses published prices hard-coded in `details/claude.ts`; the Anthropic
  console has the real bill. The prepaid credit (auto-reload off) remains the hard cap.
- A refused request can't use the server-side `fallbacks` parameter in a batch. It shows as
  "couldn't finish" and is retried in a later run.
- The puzzles' barcodes get filled in from the web, which unblocks the family share link.

## Explaining it in an interview

"The enrichment runs as Claude with server-side web search, but through the Message Batches
API, because each search outlasts API Gateway's 30-second limit, and batches are half price.
A strict 'report' tool forces a structured answer. Results land as proposals that the user
applies field by field, and barcodes are cross-checked against a product database. There's
no queue or scheduler: the client's polling drives result processing, in time-boxed chunks
that resume where they left off."
