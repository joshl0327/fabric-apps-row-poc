import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The one build flag under test. Toggled per test; both the feature-flag module
// and HomePage read it through the mock below.
const flag = vi.hoisted(() => ({ enabled: false }));

vi.mock('@/services/featureFlags', () => ({
  isFeederImportEnabled: () => flag.enabled,
}));
// A real (non-local) backend: both the seed button and the Import panel are
// only offered against Fabric, never in local in-memory mode.
vi.mock('@/services/rayfinClient', () => ({
  isLocalBackend: () => false,
}));
// An empty table — the state in which the empty-state message / seed button
// decision is made.
vi.mock('@/services/clearingPlans', () => ({
  listClearingPlans: vi.fn().mockResolvedValue([]),
  updateClearingPlan: vi.fn(),
  seedFabric: vi.fn(),
  importFeeders: vi.fn(),
}));
vi.mock('@/services/changeLog', () => ({
  listRecentChanges: vi.fn().mockResolvedValue([]),
  listFeederHistory: vi.fn().mockResolvedValue([]),
  logFeederUpdate: vi.fn(),
}));
// The claims card pulls in auth internals we don't exercise here.
vi.mock('@/components/ClaimsPanel', () => ({ ClaimsPanel: () => null }));
vi.mock('@/hooks/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'dev@contoso.com', name: 'dev' },
    signOut: vi.fn(),
  }),
}));

import { HomePage } from '@/pages/HomePage';

const IMPORT_BUTTON = /choose csv/i;
const SEED_BUTTON = /load sample data/i;
const EMPTY_MESSAGE = /no feeders loaded yet/i;

describe('HomePage feeder-import flag (empty Fabric table)', () => {
  beforeEach(() => {
    flag.enabled = false;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hides both load controls and shows a plain message when the flag is off', async () => {
    render(<HomePage />);

    await waitFor(() =>
      expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument()
    );
    expect(screen.queryByText(SEED_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByText(IMPORT_BUTTON)).not.toBeInTheDocument();
  });

  it('shows both load controls and no empty-state message when the flag is on', async () => {
    flag.enabled = true;
    render(<HomePage />);

    await waitFor(() =>
      expect(screen.getByText(SEED_BUTTON)).toBeInTheDocument()
    );
    expect(screen.getByText(IMPORT_BUTTON)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
  });
});
