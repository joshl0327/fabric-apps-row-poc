import { type AuthUser, type IAuthService } from './IAuthService';

// Backend-free local auth. The ROW slice's supported local run is plain Vite
// (`npm run dev:frontend`), which never starts a Rayfin backend and never
// touches Fabric — so local auth cannot call a server. This stub resolves
// instantly to a synthetic developer identity and keeps the AuthGate in place.
//
// DEV-only: bootstrap loads it through a dynamic import guarded by
// `import.meta.env.DEV`, so it is not in production bundles. The deployed app
// uses RayfinAuthService (Fabric SSO) instead.
const LOCAL_USER: AuthUser = {
  id: 'local-dev-user',
  email: 'dev@localhost',
  name: 'Local Dev',
};

export class LocalAuthService implements IAuthService {
  readonly fabricAuthEnabled = false;

  async signIn(): Promise<AuthUser> {
    return LOCAL_USER;
  }

  async signOut(): Promise<void> {}

  async getCurrentUser(): Promise<AuthUser | null> {
    return LOCAL_USER;
  }

  async initEmbeddedAuth(): Promise<AuthUser | null> {
    return null;
  }

  async getDiagnosticClaims(): Promise<Record<string, unknown>> {
    return {
      sub: LOCAL_USER.id,
      email: LOCAL_USER.email,
      name: LOCAL_USER.name,
      role: '(none)',
      note: 'Synthetic local claims. Real Entra/Fabric claims (and whether any group/role claim exists) only appear after deploy.',
    };
  }
}
