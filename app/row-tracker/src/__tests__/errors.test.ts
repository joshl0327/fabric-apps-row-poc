import { afterEach, describe, expect, it, vi } from 'vitest';

import { toUserMessage } from '@/services/errors';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('toUserMessage', () => {
  it('replaces a raw GraphQL error with a short, plain message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = new Error(
      'GraphQL errors: The field `createClearingPlan` does not exist on the type `Mutation`.'
    );

    const message = toUserMessage(raw);

    expect(message).toBe(
      'The server rejected the request. See the browser console for details.'
    );
    expect(message).not.toContain('GraphQL');
    // Full technical detail still reaches the console.
    expect(spy).toHaveBeenCalledWith(raw);
  });

  it('passes our own user-facing error messages through unchanged', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const mismatch = new Error(
      'The save did not fully apply — the server kept different values for: next_clearing_date (sent (cleared), server kept 2026-11-15).'
    );

    expect(toUserMessage(mismatch)).toBe(mismatch.message);
  });

  it('uses the fallback for a non-Error value', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(toUserMessage('boom', 'Failed to save.')).toBe('Failed to save.');
  });
});
