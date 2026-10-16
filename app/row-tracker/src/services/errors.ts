// Turn a thrown value into a short, plain message safe to show in the UI, while
// keeping the full technical detail in the browser console for debugging.
//
// The Rayfin data client surfaces server-side failures as
// `Error("GraphQL errors: <raw message>")` (see @microsoft/rayfin-data
// GraphQLClient). Showing that raw text in the UI is what prompt 08 flagged:
// e.g. "The field `createClearingPlan` does not exist on the type `Mutation`".
// Those are replaced with a generic line. Messages we raise ourselves
// (validation, the read-back mismatch) are already user-facing and pass through.

const GRAPHQL_PREFIX = 'GraphQL errors:';

/**
 * @param err      the caught value (unknown)
 * @param fallback message to use when `err` carries nothing user-facing
 * @returns a short, plain, user-safe message
 */
export function toUserMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  // Always keep the real error in the console, whatever we show the user.
  console.error(err);

  if (err instanceof Error) {
    if (err.message.startsWith(GRAPHQL_PREFIX)) {
      return 'The server rejected the request. See the browser console for details.';
    }
    // Our own errors already carry a plain, user-facing message.
    return err.message.trim() || fallback;
  }
  return fallback;
}
