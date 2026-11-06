// DEV-only stand-in sign-in for `npm run dev:frontend` (no Fabric), mirroring the
// first app's LocalAuthService pattern. It resolves instantly to a synthetic
// authenticated session so the app renders offline. Referenced only behind
// `import.meta.env.DEV` in bootstrapAuth, so production builds tree-shake it out
// — the deployed app always uses Fabric SSO.

import type { OpaqueSession } from '@microsoft/rayfin-auth';
import type { IAuthService } from './rayfin-auth.service';

/** The synthetic signed-in user used in local dev. Synthetic data only. */
export const LOCAL_USER = {
  id: 'local-dev-user',
  email: 'vegetation.lead@brillit.example',
  name: 'Vegetation Lead (local)',
} as const;

// A minimal object shaped like the parts of OpaqueSession the app reads
// (isAuthenticated + user identity). Cast through unknown — the real session is
// opaque and only ever constructed by the SDK in deployed mode.
const localSession = {
  isAuthenticated: true,
  user: { ...LOCAL_USER },
} as unknown as OpaqueSession;

export class LocalAuthService implements IAuthService {
  async initEmbeddedAuth(): Promise<OpaqueSession | null> {
    return localSession;
  }

  signIn(): Promise<OpaqueSession> {
    return Promise.resolve(localSession);
  }
}
