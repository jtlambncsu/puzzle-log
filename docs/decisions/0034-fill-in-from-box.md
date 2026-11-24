# 0034. Fill in the title, brand and pieces from the box photo

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

A puzzle box has the title, the brand and the piece count printed on it. With a box photo
already in the form ([0031](0031-box-photos-and-tag-suggestions.md)), the owner suggested
letting AI read those fields instead of typing them.

## Decision

- **A "Fill in from box" button** appears once there's a box photo: in the add form after
  one is chosen, and when editing a puzzle that has one saved.
- **A separate endpoint, `POST /api/suggestions/box`.** It takes the key of an uploaded box
  photo, which must be the user's own, and returns `{ title?, brand?, pieceCount? }`.
  Nothing is saved.
- **Claude reads the box** through the same suggester as tag suggestions:
  - the same model, a low effort level and a 4,000-token cap
  - a structured output where each field may be null
  - a prompt that asks only for what's printed and legible, never a guess
- **The server cleans the answer.** Blank text, and piece counts that aren't a positive
  whole number up to 100,000, are dropped, so whatever comes back fits the form.
- **Only empty fields are filled.** Anything the user typed stays, and a toast names the
  fields filled in ("Filled in title and pieces from the box"). If nothing could be read,
  the toast suggests a straight-on photo of the front.
- **The photo is uploaded once.** The add form already reuses an upload made for tag
  suggestions; reading the box uses the same cache, so the photo read is the one saved.

## Alternatives considered

- **Reading the box automatically when a photo is chosen:** faster, but every photo would
  cost an AI call, including a wrong one about to be replaced. As with tags, a button keeps
  spending a choice.
- **One combined "read everything" call, with tags:** saves a call, but the two are useful
  at different moments: tags also come from a title or the finished photo. Two small,
  focused prompts are easier to test and tune.
- **Overwriting filled-in fields:** simpler to explain, but it could silently replace a
  title the user corrected by hand.
- **OCR without AI (for example Tesseract in the browser):** free, but box art is busy and
  stylized. It would return text, not which text is the title or the brand.

## Consequences

- A box read costs about the same as a tag suggestion (under a cent), within the existing
  Anthropic spending cap.
- No new HTTP methods or headers, so no CORS change.
- If barcodes become worth reading this way too, they would be another nullable field.

## Explaining it in an interview

"It's structured extraction from an image. The model returns a schema with nullable fields
and is told not to guess. The server validates the values again before trusting them, and
the client merges them in without overwriting user input. Behind an interface, the route
and UI are tested with fakes, and the photo is checked to belong to the caller, so one
user can't make the AI look at another user's photo."
