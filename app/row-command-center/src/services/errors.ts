// Turn a thrown value into a short, plain message safe to show in the UI, while
// keeping full detail in the console. Copied from app/row-tracker/src/services/
// errors.ts (deliberate duplicate; see validation.ts).

const GRAPHQL_PREFIX = 'GraphQL errors:';

export function toUserMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  console.error(err);

  if (err instanceof Error) {
    if (err.message.startsWith(GRAPHQL_PREFIX)) {
      return 'The server rejected the request. See the browser console for details.';
    }
    return err.message.trim() || fallback;
  }
  return fallback;
}
