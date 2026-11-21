/** Today as YYYY-MM-DD in the user's own time zone (not UTC, which can be a day off). */
export function today() {
  return new Date().toLocaleDateString('en-CA');
}
