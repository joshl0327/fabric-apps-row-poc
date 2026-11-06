// Deep-link helpers for ?feeder=<id>. A Power BI button (Web URL action) can link
// straight to a feeder; see README "Deep links". The id is validated against the
// feeder pattern before use so a crafted URL cannot reach a query (see
// src/lib/dax/feeder-id.ts and its tests).

import { parseFeederId } from './dax/feeder-id';

export const FEEDER_PARAM = 'feeder';

/** Read and validate the ?feeder=<id> parameter from a query string. Returns the
 * valid id or null. */
export function readFeederParam(search: string): string | null {
  const raw = new URLSearchParams(search).get(FEEDER_PARAM);
  return parseFeederId(raw);
}

/** Build the ?feeder=<id> search string for a validated id (for the README and
 * for copy-link affordances). */
export function feederDeepLink(feederId: string): string {
  const id = parseFeederId(feederId);
  if (!id) throw new Error(`Invalid feeder id: ${JSON.stringify(feederId)}`);
  return `?${FEEDER_PARAM}=${encodeURIComponent(id)}`;
}
