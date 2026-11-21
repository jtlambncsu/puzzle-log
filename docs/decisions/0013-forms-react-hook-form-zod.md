# 0013. React Hook Form + Zod

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The add-puzzle form has text, number, date and file inputs, needs clear validation messages,
and should match the API's rules.

## Decision

**React Hook Form** with `zodResolver` (`src/features/puzzles/PuzzleForm.tsx`):

- Inputs are uncontrolled (registered by ref), so typing doesn't re-render the form.
- The form has its own schema (`puzzleFormSchema`) because HTML inputs produce strings (an
  empty number field is `''`). It reuses rules from the shared API schema, and
  `toCreatePuzzleInput` converts the result to the API's shape.
- Errors render through shadcn's `Field` components, with `aria-invalid` for accessibility.
- The photo is kept in component state, outside the form values, because a `File` isn't a
  text value.

## Alternatives considered

- **TanStack Form** — newer and fully type-safe; less common in existing codebases so far.
- **Controlled inputs with `useState`** — fine for tiny forms; validation and error state get
  repetitive quickly.
- **Formik** — the previous generation; re-renders more and is less actively developed.

## Consequences

- Validation rules for title, brand and notes come from one place.
- Server errors (e.g. a failed save) show as toasts, and the form keeps the user's input.

## Explaining it in an interview

"React Hook Form keeps inputs uncontrolled for performance and plugs into Zod for validation.
I keep a separate form schema because form values are strings, convert to the API's typed
input on submit, and reuse the shared rules so client and server validation agree."
