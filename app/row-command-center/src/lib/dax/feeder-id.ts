// Feeder id validation — the single guard for any value that could reach a DAX
// string (today: the ?feeder=<id> deep link). A feeder id is
// substation_num-circuit_num, e.g. "214-1", "125-10" (model map in AGENTS.md;
// the SQL column is NVARCHAR(20)). Nothing user-typed is ever interpolated into
// DAX without passing this check first — see src/lib/dax/queries.ts.

/** substation (1–5 digits) "-" circuit (1–3 digits). Anchored, no spaces. */
export const FEEDER_ID_PATTERN = /^[0-9]{1,5}-[0-9]{1,3}$/;

/** True when `value` is a syntactically valid feeder id. */
export function isValidFeederId(value: string): boolean {
  return FEEDER_ID_PATTERN.test(value);
}

/**
 * Returns the feeder id if valid, otherwise `null`. Use at the trust boundary
 * (URL parsing) so an invalid id is dropped before it reaches a query or a
 * lookup — never thrown into the user's face for a bad link.
 */
export function parseFeederId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return isValidFeederId(trimmed) ? trimmed : null;
}

/**
 * Throws if `value` is not a valid feeder id. Use just before interpolating an
 * id into a DAX literal, as a second barrier behind {@link parseFeederId}.
 */
export function assertFeederId(value: string): string {
  if (!isValidFeederId(value)) {
    throw new Error(`Invalid feeder id: ${JSON.stringify(value)}`);
  }
  return value;
}
