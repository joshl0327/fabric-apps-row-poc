import { describe, expect, it } from 'vitest';

import { isFeederImportEnabled } from '@/services/featureFlags';

describe('isFeederImportEnabled', () => {
  it('is on only when the flag is exactly the string "true"', () => {
    expect(isFeederImportEnabled({ VITE_ENABLE_FEEDER_IMPORT: 'true' })).toBe(true);
  });

  it('is off when unset (the default)', () => {
    expect(isFeederImportEnabled({})).toBe(false);
  });

  it('is off for any other value', () => {
    expect(isFeederImportEnabled({ VITE_ENABLE_FEEDER_IMPORT: 'false' })).toBe(false);
    expect(isFeederImportEnabled({ VITE_ENABLE_FEEDER_IMPORT: '1' })).toBe(false);
    expect(isFeederImportEnabled({ VITE_ENABLE_FEEDER_IMPORT: true })).toBe(false);
  });
});
