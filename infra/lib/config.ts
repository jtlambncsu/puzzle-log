/**
 * Parses a comma-separated list from the first source that has a non-blank value.
 *
 * Blank counts as missing on purpose: GitHub Actions passes an unset repository variable
 * (`${{ vars.X }}`) as an empty string, which `??` would treat as a real value.
 */
export function listSetting(...sources: (string | undefined)[]): string[] | undefined {
  const value = sources.find((source) => source?.trim());
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
